'use strict';

const { shouldApplyUpdate } = require('./utilities/state-ordering');
const { buildStateChanges } = require('./utilities/state-changes');

/**
 * Data-driven state updates: maps Meross namespace payloads to per-channel state maps,
 * ordering gates, and `stateChange` emissions. Descriptors are registered at module load
 * so incoming SETACK, GETACK, and PUSH can share one code path.
 *
 * @module dispatcher
 */

/**
 * @typedef {Object} StateNamespaceDescriptor
 * @property {string} namespace
 * @property {string} [payloadKey] - Key on `payload` (e.g. `mode` for `payload.mode`)
 * @property {string} [stateMap] - Name of a `Map` on `device` (e.g. `_thermostatStateByChannel`)
 * @property {new (data: object) => { update: (data: object) => void }} [StateClass]
 * @property {string} [eventType] - `stateChange` `type` field
 * @property {(state: object) => object} [snapshot] - Shape used for diffing and emission
 * @property {(device: object, item: object, state: object) => void} [afterApply]
 * @property {(oldSnap: (object|undefined), newSnap: object) => unknown} [emitValue] - If set, used instead of `buildStateChanges` for the emitted `value`
 * @property {(device: object, payload: object, source: string, header: (object|undefined)) => void} [customApply] - For namespaces that are not the per-channel state pattern; ordering uses `gateKey` or `namespace`
 * @property {(device: object, item: object, source: string, header: (object|undefined)) => void} [customApplyItem] - Per-item variant that iterates `payload[payloadKey]` and gates per channel; prefer this when items carry a `channel` field
 * @property {string} [gateKey] - Single ordering key for `customApply` when there is no channel
 */

/** @type {Map<string, StateNamespaceDescriptor[]>} */
const namespaceRegistry = new Map();

/**
 * Appends a descriptor for a namespace. Multiple descriptors allow one namespace to
 * drive several effects (e.g. state map plus a derived cache).
 *
 * @param {string} namespace - Meross `header.namespace` value
 * @param {StateNamespaceDescriptor} descriptor
 * @returns {void}
 */
function registerNamespaceDescriptor(namespace, descriptor) {
    let list = namespaceRegistry.get(namespace);
    if (!list) {
        list = [];
        namespaceRegistry.set(namespace, list);
    }
    list.push(descriptor);
}

/**
 * @param {string} namespace
 * @returns {StateNamespaceDescriptor[]}
 */
function getNamespaceDescriptors(namespace) {
    return namespaceRegistry.get(namespace) || [];
}

/**
 * Marks the device's full-state cache as fresh so `get()` short-circuiting stays
 * consistent with recent applied message traffic.
 *
 * @param {object} device
 * @returns {void}
 */
function touchLastFullUpdate(device) {
    device.lastFullUpdateTimestamp = Date.now();
}

/**
 * Reads `payload[descriptor.payloadKey]` and normalises to an array. Returns `null` when
 * the payload carries no data for this descriptor so callers can bail cleanly.
 *
 * @param {object|null|undefined} payload
 * @param {string} payloadKey
 * @returns {Array<object>|null}
 */
function extractItems(payload, payloadKey) {
    if (payload === null || payload === undefined) {
        return null;
    }
    const raw = payload[payloadKey];
    if (raw === null || raw === undefined) {
        return null;
    }
    return Array.isArray(raw) ? raw : [raw];
}

/**
 * Resolves the channel to use for ordering and state-map keys, defaulting to `0` when
 * the incoming item omits `channel`.
 *
 * @param {object} item
 * @returns {number}
 */
function resolveChannel(item) {
    return item.channel === null || item.channel === undefined ? 0 : item.channel;
}

/**
 * Executes a whole-payload custom descriptor behind the ordering gate. Emission and
 * cache mutation are entirely delegated to `customApply`.
 *
 * @param {object} device
 * @param {StateNamespaceDescriptor} descriptor
 * @param {object|undefined} payload
 * @param {string} source
 * @param {number|null|undefined} messageTs
 * @param {object|undefined} header
 * @returns {void}
 */
function dispatchCustomWhole(device, descriptor, payload, source, messageTs, header) {
    const key = descriptor.gateKey || descriptor.namespace;
    if (!shouldApplyUpdate(device, key, messageTs)) {
        return;
    }
    descriptor.customApply(device, payload, source, header);
    touchLastFullUpdate(device);
}

/**
 * Iterates a per-item custom descriptor, gating each channel independently so an older
 * message for one channel cannot mask a newer one for another.
 *
 * @param {object} device
 * @param {StateNamespaceDescriptor} descriptor
 * @param {object|undefined} payload
 * @param {string} source
 * @param {number|null|undefined} messageTs
 * @param {object|undefined} header
 * @returns {void}
 */
function dispatchCustomItems(device, descriptor, payload, source, messageTs, header) {
    const items = extractItems(payload, descriptor.payloadKey);
    if (!items) {
        return;
    }
    let applied = false;
    for (const item of items) {
        const channel = resolveChannel(item);
        if (!shouldApplyUpdate(device, `${descriptor.namespace}:${channel}`, messageTs)) {
            continue;
        }
        descriptor.customApplyItem(device, item, source, header);
        applied = true;
    }
    if (applied) {
        touchLastFullUpdate(device);
    }
}

/**
 * Emits `stateChange` when snapshots differ, using the same diff rules as the generic
 * stateful dispatch path. Hub `customApply` handlers call this after updating a map.
 *
 * @param {object} device
 * @param {StateNamespaceDescriptor} descriptor
 * @param {string} source
 * @param {number} channel
 * @param {object|undefined} oldSnap
 * @param {object} newSnap
 * @returns {void}
 */
function emitStateChangeFromSnapshot(device, descriptor, source, channel, oldSnap, newSnap) {
    const value = descriptor.emitValue
        ? descriptor.emitValue(oldSnap, newSnap)
        : buildStateChanges(oldSnap, newSnap);

    if (value !== undefined && (typeof value !== 'object' || Object.keys(value).length > 0)) {
        device.emit('stateChange', {
            type: descriptor.eventType,
            channel,
            value,
            source,
            timestamp: Date.now()
        });
    }
}

/**
 * Applies a single stateful item: writes through the device state map, runs optional
 * `afterApply`, and emits a diffed `stateChange` when the snapshot changed.
 *
 * @param {object} device
 * @param {StateNamespaceDescriptor} descriptor
 * @param {object} item
 * @param {string} source
 * @returns {boolean} True when the state map was mutated
 */
function applyStatefulItem(device, descriptor, item, source) {
    const map = device[descriptor.stateMap];
    if (!map) {
        return false;
    }

    const channel = resolveChannel(item);
    const oldState = map.get(channel);
    const oldSnap = oldState ? descriptor.snapshot(oldState) : undefined;

    let state = oldState;
    if (!state) {
        state = new descriptor.StateClass(item);
        map.set(channel, state);
    } else {
        state.update(item);
    }

    if (descriptor.afterApply) {
        descriptor.afterApply(device, item, state);
    }

    const newSnap = descriptor.snapshot(state);
    emitStateChangeFromSnapshot(device, descriptor, source, channel, oldSnap, newSnap);
    return true;
}

/**
 * Iterates a stateful descriptor and applies each item through the ordering gate.
 *
 * @param {object} device
 * @param {StateNamespaceDescriptor} descriptor
 * @param {object|undefined} payload
 * @param {string} source
 * @param {number|null|undefined} messageTs
 * @returns {void}
 */
function dispatchStateful(device, descriptor, payload, source, messageTs) {
    const items = extractItems(payload, descriptor.payloadKey);
    if (!items) {
        return;
    }
    let applied = false;
    for (const item of items) {
        const channel = resolveChannel(item);
        if (!shouldApplyUpdate(device, `${descriptor.namespace}:${channel}`, messageTs)) {
            continue;
        }
        if (applyStatefulItem(device, descriptor, item, source)) {
            applied = true;
        }
    }
    if (applied) {
        touchLastFullUpdate(device);
    }
}

/**
 * Applies a single descriptor: either `customApply` (whole payload), `customApplyItem`
 * (per-channel custom), or the generic stateful per-channel path.
 *
 * @param {object} device
 * @param {StateNamespaceDescriptor} descriptor
 * @param {object} [payload]
 * @param {string} source
 * @param {number|null|undefined} messageTs - Milliseconds from the Meross header (see `getMessageTimestamp` in `state-ordering`), or nullish to skip ordering
 * @param {object} [header] - Forwarded to `customApply` / `customApplyItem` when present
 * @returns {void}
 */
function dispatch(device, descriptor, payload, source, messageTs, header) {
    if (descriptor.customApply) {
        dispatchCustomWhole(device, descriptor, payload, source, messageTs, header);
        return;
    }
    if (descriptor.customApplyItem && descriptor.payloadKey) {
        dispatchCustomItems(device, descriptor, payload, source, messageTs, header);
        return;
    }
    dispatchStateful(device, descriptor, payload, source, messageTs);
}

/**
 * Mutates one channel in a descriptor state map and emits `stateChange` when the snapshot
 * changes. Used by hub `customApply` handlers that receive a flat subdevice item instead of
 * a wrapped `{ payloadKey: [...] }` array.
 *
 * @param {object} device
 * @param {StateNamespaceDescriptor} descriptor
 * @param {(state: object) => void} updateFn
 * @param {string} source
 * @param {number} [channel=0]
 * @returns {void}
 */
function mutateChannelState(device, descriptor, updateFn, source, channel = 0) {
    const map = device[descriptor.stateMap];
    if (!map || !descriptor.StateClass) {
        return;
    }

    let state = map.get(channel);
    const oldSnap = state ? descriptor.snapshot(state) : undefined;
    if (!state) {
        state = new descriptor.StateClass();
        map.set(channel, state);
    }

    updateFn(state);

    const newSnap = descriptor.snapshot(state);
    emitStateChangeFromSnapshot(device, descriptor, source, channel, oldSnap, newSnap);
}

module.exports = {
    dispatch,
    emitStateChangeFromSnapshot,
    getNamespaceDescriptors,
    mutateChannelState,
    registerNamespaceDescriptor
};
