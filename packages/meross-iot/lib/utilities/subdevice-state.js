'use strict';

/**
 * Helpers for hub subdevice {@link MerossSubDevice#getState} snapshots and subscription diffs.
 *
 * @module utilities/subdevice-state
 */

/** @type {ReadonlySet<string>} Top-level keys that are not emitted as typed `stateChange` slices. */
const META_KEYS = new Set(['online', 'timestamp', 'subdeviceId', 'hubUuid']);

/**
 * @param {Object} state - {@link MerossSubDevice#getState} result
 * @returns {Array<{ type: string, channel: number, value: Object }>}
 */
function diffSubdeviceStateSlices(oldState, newState) {
    const events = [];
    const keys = new Set([...Object.keys(oldState || {}), ...Object.keys(newState || {})]);

    for (const type of keys) {
        if (META_KEYS.has(type)) {
            continue;
        }
        const oldSlice = oldState?.[type];
        const newSlice = newState?.[type];
        if (JSON.stringify(oldSlice) !== JSON.stringify(newSlice)) {
            events.push({
                type,
                channel: 0,
                value: newSlice?.[0] ?? newSlice
            });
        }
    }

    if (oldState?.online !== newState?.online) {
        events.push({
            type: 'online',
            value: newState.online
        });
    }

    return events;
}

module.exports = {
    META_KEYS,
    diffSubdeviceStateSlices
};
