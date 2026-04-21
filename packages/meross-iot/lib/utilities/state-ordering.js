'use strict';

/**
 * Message ordering for device state updates.
 *
 * Meross headers carry `timestamp` and `timestampMs` that are comparable across
 * SETACK, GETACK, and PUSH. These helpers collapse that pair to a single millisecond
 * value and guard per-key application so a newer-applied value is not overwritten
 * by a stale message that arrives later.
 *
 * @module utilities/state-ordering
 */

/**
 * Combines `header.timestamp` and `header.timestampMs` into a single millisecond
 * value suitable for monotonic comparison when the device provides it.
 *
 * @param {Object} [header] - Parsed Meross message header
 * @returns {number|null} Milliseconds since epoch component from the header, or null
 */
function getMessageTimestamp(header) {
    if (!header) {
        return null;
    }
    return (header.timestamp || 0) * 1000 + (header.timestampMs || 0);
}

/**
 * Returns whether an update for `key` should be applied given the message's ordering
 * time. Updates the device's last-seen time for the key when the message is accepted
 * (including equal timestamps) so out-of-order older messages are skipped.
 *
 * @param {Object} device - Device instance (mutates `device._stateUpdateTimestamps`)
 * @param {string} key - Per-namespace or per-channel key used for ordering
 * @param {number|null|undefined} messageTs - From {@link getMessageTimestamp}, or
 *   null/undefined to accept the update without changing ordering state
 * @returns {boolean} True if the update should be applied
 */
function shouldApplyUpdate(device, key, messageTs) {
    if (messageTs === null || messageTs === undefined) {
        return true;
    }
    if (!device._stateUpdateTimestamps) {
        device._stateUpdateTimestamps = new Map();
    }
    const last = device._stateUpdateTimestamps.get(key);
    if (last !== undefined && messageTs < last) {
        return false;
    }
    device._stateUpdateTimestamps.set(key, messageTs);
    return true;
}

module.exports = {
    getMessageTimestamp,
    shouldApplyUpdate
};
