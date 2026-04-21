'use strict';

/**
 * Helpers for reading per-channel state maps on devices only when a recent full update
 * has refreshed them, avoiding stale data when `lastFullUpdateTimestamp` is missing or old.
 *
 * @module utilities/cache
 */

/** @type {number} Default maximum age in ms for treating cached map entries as fresh. */
const CACHE_MAX_AGE = 5000;

/**
 * Returns a cached value from a device state map when the device's last full update is recent.
 *
 * @param {object} device - Device instance with `lastFullUpdateTimestamp` and optional state map
 * @param {string} stateMapName - Property name of the Map on `device` (e.g. `'_toggleStateByChannel'`)
 * @param {number|string} channel - Map key
 * @param {{ maxAgeMs?: number }} [options]
 * @returns {unknown|undefined} Cached value, or `undefined` if stale, missing timestamp, or no map
 */
function readCache(device, stateMapName, channel, { maxAgeMs = CACHE_MAX_AGE } = {}) {
    const ts = device.lastFullUpdateTimestamp;
    if (!ts || Date.now() - ts >= maxAgeMs) return undefined;
    const map = device[stateMapName];
    return map ? map.get(channel) : undefined;
}

/**
 * Returns a fresh cached value if available; otherwise runs `fetcher` and reads from the map again.
 *
 * @param {object} device
 * @param {string} stateMapName
 * @param {number|string} channel
 * @param {() => Promise<unknown>} fetcher - Typically a GET/publish that repopulates the map
 * @param {{ maxAgeMs?: number }} [opts]
 * @returns {Promise<unknown|undefined>}
 */
async function getCachedOrFetch(device, stateMapName, channel, fetcher, opts) {
    const cached = readCache(device, stateMapName, channel, opts);
    if (cached !== undefined) return cached;
    await fetcher();
    const map = device[stateMapName];
    return map ? map.get(channel) : undefined;
}

module.exports = { CACHE_MAX_AGE, readCache, getCachedOrFetch };
