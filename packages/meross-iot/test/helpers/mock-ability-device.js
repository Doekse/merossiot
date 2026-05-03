'use strict';

const EventEmitter = require('events');

const { getMessageTimestamp } = require('../../lib/utilities/state-ordering');
const { getNamespaceDescriptors, dispatch } = require('../../lib/controller/state-dispatcher');

/**
 * Shared stubs for unit-testing {@link module:controller/abilities} feature factories
 * without MQTT, HTTP, or {@link MerossDevice}.
 */

/**
 * Minimal `EventEmitter` so state updaters can emit `stateChange` during tests.
 *
 * @returns {EventEmitter}
 */
function createDeviceEmitter() {
    return new EventEmitter();
}

/**
 * Returns a `publishMessage` stub that records every call and resolves with a configurable payload.
 *
 * @param {Object} [options]
 * @param {function(string, string, *): *} [options.responseFor] - Resolves the response **payload** (not the `publishMessage` envelope)
 * @param {() => (object|undefined)} [options.getDevice] - When set, the mock applies the same namespace {@link module:lib/controller/state-dispatcher.dispatch}
 *   as production `Device` so tests can assert state maps after GET/SET without hand-calling updaters
 * @returns {{ calls: Array<{ method: string, namespace: string, payload: * }>, publishMessage: function(string, string, *): Promise<{ header: Object, payload: Object }> }}
 */
function createPublishRecorder(options = {}) {
    const { responseFor, getDevice } = options;
    const calls = [];

    /**
     * Mirrors production {@link module:lib/controller/device.Device.publishMessage} resolution: `{ header, payload }`, with optional
     * `dispatch` when `getDevice` is provided.
     *
     * @param {string} method
     * @param {string} namespace
     * @param {*} payload
     * @param {*} [transportMode]
     * @returns {Promise<{ header: Object, payload: Object }>}
     */
    async function publishMessage(method, namespace, payload) {
        calls.push({ method, namespace, payload });
        let responsePayload = {};
        if (typeof responseFor === 'function') {
            const r = await responseFor(method, namespace, payload, calls.length);
            if (r && typeof r === 'object') {
                responsePayload = r;
            }
        }
        const header = {
            namespace,
            method: method === 'SET' ? 'SETACK' : method,
            messageId: `mock-${calls.length}`,
            timestamp: Math.floor(Date.now() / 1000),
            timestampMs: 0
        };
        const device = typeof getDevice === 'function' ? getDevice() : null;
        if (device) {
            const messageTs = getMessageTimestamp(header);
            for (const descriptor of getNamespaceDescriptors(namespace)) {
                dispatch(device, descriptor, responsePayload, 'response', messageTs, header);
            }
        }
        return { header, payload: responsePayload };
    }

    return { calls, publishMessage };
}

/**
 * Returns a function that forwards manual test updates through {@link dispatch} with
 * ordering disabled so unit tests stay aligned with production namespace descriptors
 * without duplicating updater logic from ability modules.
 *
 * @param {string} namespace - Meross `header.namespace`
 * @param {string} payloadKey - Synthetic payload key (e.g. `mode`, `togglex`)
 * @returns {(device: object, itemOrItems: (object|Array|undefined), source?: string) => void}
 */
function createDispatchStateShim(namespace, payloadKey) {
    return function dispatchStateShim(device, itemOrItems, source = 'response') {
        if (itemOrItems === null || itemOrItems === undefined) {
            return;
        }
        const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
        const payload = { [payloadKey]: items };
        for (const descriptor of getNamespaceDescriptors(namespace)) {
            dispatch(device, descriptor, payload, source, null, undefined);
        }
    };
}

module.exports = {
    createDeviceEmitter,
    createDispatchStateShim,
    createPublishRecorder
};
