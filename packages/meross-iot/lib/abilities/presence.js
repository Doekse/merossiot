'use strict';

const PresenceSensorState = require('../states/presence-sensor-state');
const { getCachedOrFetch } = require('../utilities/cache');
const { normalizeChannel } = require('../utilities/options');
const { buildStateChanges } = require('../utilities/state-changes');
const { getMessageTimestamp, shouldApplyUpdate } = require('../utilities/state-ordering');
const { registerNamespaceDescriptor } = require('../dispatcher');

/**
 * Creates a presence sensor feature object for a device.
 *
 * Provides access to presence detection and light sensor data for devices that support it.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Presence sensor feature object with get() and convenience methods
 */
function createPresenceSensorAbility(device) {
    return {
        /**
         * Gets the current presence sensor state for a channel.
         *
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get state for (default: 0)
         * @param {Array<string>} [options.dataTypes=['presence', 'light']] - Array of data types to request
         * @returns {Promise<PresenceSensorState|undefined>} Promise that resolves with presence sensor state or undefined
         * @throws {MerossDeviceError} If device is not connected (DEVICE_UNCONNECTED) or command times out (COMMAND_TIMEOUT)
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            const dataTypes = options.dataTypes || ['presence', 'light'];
            return getCachedOrFetch(
                device,
                '_presenceSensorStateByChannel',
                channel,
                () =>
                    device.publishMessage('GET', 'Appliance.Control.Sensor.LatestX', {
                        latest: [{ channel: 0, data: dataTypes }]
                    })
            );
        },

        /**
         * Gets the latest presence detection data.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to get presence for (default: 0)
         * @returns {Object|null} Presence data object or null if no data
         */
        getPresence(options = {}) {
            const channel = normalizeChannel(options);
            const state = device._presenceSensorStateByChannel.get(channel);
            if (!state || state.presenceValue === undefined) {
                return null;
            }
            return {
                value: state.presenceValue,
                isPresent: state.isPresent,
                state: state.presenceState,
                distance: state.distanceMeters,
                distanceRaw: state.distanceRaw,
                timestamp: state.presenceTimestamp,
                times: state.presenceTimes
            };
        },

        /**
         * Checks if presence is currently detected.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to check (default: 0)
         * @returns {boolean|null} True if presence detected, false if absence detected, null if no data
         */
        isPresent(options = {}) {
            const channel = normalizeChannel(options);
            const state = device._presenceSensorStateByChannel.get(channel);
            return state ? state.isPresent : null;
        },

        /**
         * Gets the latest light/illuminance reading.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to get light for (default: 0)
         * @returns {Object|null} Light data object or null if no data
         */
        getLight(options = {}) {
            const channel = normalizeChannel(options);
            const state = device._presenceSensorStateByChannel.get(channel);
            if (!state || state.lightLux === undefined) {
                return null;
            }
            return {
                value: state.lightLux,
                timestamp: state.lightTimestamp
            };
        },

        /**
         * Gets all sensor readings (presence and light).
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to get readings for (default: 0)
         * @returns {Object} Object containing all sensor readings
         */
        getAllSensorReadings(options = {}) {
            const channel = normalizeChannel(options);
            const state = device._presenceSensorStateByChannel.get(channel);
            return {
                presence: state ? {
                    value: state.presenceValue,
                    isPresent: state.isPresent,
                    state: state.presenceState,
                    distance: state.distanceMeters,
                    distanceRaw: state.distanceRaw,
                    timestamp: state.presenceTimestamp,
                    times: state.presenceTimes
                } : null,
                light: state ? {
                    value: state.lightLux,
                    timestamp: state.lightTimestamp
                } : null
            };
        },

        /**
         * Gets presence configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get config for (default: 0)
         * @returns {Promise<Object>} Promise that resolves with presence configuration
         */
        async getConfig(options = {}) {
            const channel = normalizeChannel(options);
            const payload = {
                config: [{
                    channel
                }]
            };
            const { payload: out } = await device.publishMessage('GET', 'Appliance.Control.Presence.Config', payload);
            return out;
        },

        /**
         * Sets the presence sensor configuration.
         *
         * @param {Object} options - Config options
         * @param {Object|Array<Object>} options.configData - Config data object or array of config items
         * @returns {Promise<Object>} Response from the device
         */
        async setConfig(options = {}) {
            if (!options.configData) {
                throw new Error('configData is required');
            }
            const payload = { config: Array.isArray(options.configData) ? options.configData : [options.configData] };
            const { payload: out } = await device.publishMessage('SET', 'Appliance.Control.Presence.Config', payload);
            return out;
        },

        /**
         * Gets presence study/calibration status from the device.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<Object>} Promise that resolves with presence study data
         */
        async getStudy(_options = {}) {
            const { payload } = await device.publishMessage('GET', 'Appliance.Control.Presence.Study', {});
            return payload;
        },

        /**
         * Sets the presence study/calibration mode.
         *
         * @param {Object} options - Study options
         * @param {Object|Array<Object>} options.studyData - Study data object or array of study items
         * @returns {Promise<Object>} Response from the device
         */
        async setStudy(options = {}) {
            if (!options.studyData) {
                throw new Error('studyData is required');
            }
            const payload = { study: Array.isArray(options.studyData) ? options.studyData : [options.studyData] };
            const { payload: out } = await device.publishMessage('SET', 'Appliance.Control.Presence.Study', payload);
            return out;
        }
    };
}

/**
 * Updates internal presence sensor state from LatestX notification data.
 *
 * Called automatically when LatestX push notifications are received or System.All
 * digest is processed. Extracts presence and light data from the notification and updates the cached state.
 *
 * @param {Object} device - The device instance
 * @param {Object|Array} latestData - Latest sensor readings (single object or array)
 * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
 * @param {Object} [header] - When provided (e.g. routed from Meross), enforces per-channel
 *   ordering from {@link getMessageTimestamp}
 */
/**
 * Builds the per-entry `state.update` payload from a raw LatestX entry, merging only
 * the supported nested blocks (`presence`, `light`) when the device actually reports them.
 *
 * @param {number} channel
 * @param {Object} entry - Raw LatestX entry with `data.presence[]` / `data.light[]`
 * @returns {Object} Update payload accepted by {@link PresenceSensorState#update}
 */
function buildPresenceUpdate(channel, entry) {
    const update = { channel };
    const presenceList = entry.data.presence;
    if (Array.isArray(presenceList) && presenceList.length > 0) {
        const p = presenceList[0];
        update.presence = {
            value: p.value,
            distance: p.distance,
            timestamp: p.timestamp,
            times: p.times
        };
    }
    const lightList = entry.data.light;
    if (Array.isArray(lightList) && lightList.length > 0) {
        const l = lightList[0];
        update.light = {
            value: l.value,
            timestamp: l.timestamp
        };
    }
    return update;
}

/**
 * Snapshot used for diff emission; kept in one place so the before/after comparison is
 * symmetric regardless of which code path produced the state.
 *
 * @param {Object} state
 * @returns {Object}
 */
function presenceSnapshot(state) {
    return {
        isPresent: state.isPresent,
        distance: state.distanceRaw,
        light: state.lightLux
    };
}

/**
 * Writes one LatestX entry into the device's presence state map and emits a diffed
 * `stateChange` when the snapshot actually moved. Separated so the outer loop stays
 * focused on iteration and ordering.
 *
 * @param {Object} device
 * @param {Object} entry - Raw LatestX entry
 * @param {string} source - `stateChange` `source` field
 */
function applyPresenceEntry(device, entry, source) {
    const channel = entry.channel !== undefined ? entry.channel : 0;
    const oldState = device._presenceSensorStateByChannel.get(channel);
    const oldValue = oldState ? presenceSnapshot(oldState) : undefined;

    let state = oldState;
    if (!state) {
        state = new PresenceSensorState({ channel });
        device._presenceSensorStateByChannel.set(channel, state);
    }

    state.update(buildPresenceUpdate(channel, entry));

    const newValue = buildStateChanges(oldValue, presenceSnapshot(state));
    if (Object.keys(newValue).length > 0) {
        device.emit('stateChange', {
            type: 'presence',
            channel,
            value: newValue,
            source,
            timestamp: Date.now()
        });
    }
}

/**
 * Updates presence state for each entry that passes the per-channel ordering gate.
 *
 * @param {Object} device
 * @param {Object|Array} latestData - LatestX payload (single object or array)
 * @param {string} [source='response']
 * @param {Object} [header] - When provided, enforces per-channel ordering via
 *   {@link getMessageTimestamp}
 */
function updatePresenceState(device, latestData, source = 'response', header) {
    if (!device._presenceSensorStateByChannel) {return;}
    if (!latestData) {return;}

    const messageTs = header ? getMessageTimestamp(header) : null;
    const latestArray = Array.isArray(latestData) ? latestData : [latestData];
    const presenceNs = 'Appliance.Control.Sensor.LatestX';

    for (const entry of latestArray) {
        if (!entry || !entry.data) {
            continue;
        }
        const channel = entry.channel !== undefined ? entry.channel : 0;
        if (messageTs !== null && !shouldApplyUpdate(device, `${presenceNs}:${channel}`, messageTs)) {
            continue;
        }
        applyPresenceEntry(device, entry, source);
    }
}

/**
 * `LatestX` payloads are merged into `PresenceSensorState` with nested `data` shapes, so
 * the generic per-channel `dispatch` is not used; the outer namespace gate in
 * `dispatch` still coarsely orders whole messages, while {@link updatePresenceState}
 * applies per-channel `shouldApply` when a header is present.
 */
const presenceLatestXDescriptor = {
    namespace: 'Appliance.Control.Sensor.LatestX',
    stateMap: '_presenceSensorStateByChannel',
    eventType: 'presence',
    snapshot: presenceSnapshot,
    customApply(device, payload, source, header) {
        const list = payload ? payload.latest : null;
        updatePresenceState(device, list, source, header);
    }
};

registerNamespaceDescriptor('Appliance.Control.Sensor.LatestX', presenceLatestXDescriptor);

/**
 * Gets presence sensor capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Presence sensor capability object or null if not supported
 */
function getPresenceSensorCapabilities(device, channelIds) {
    const hasPresenceConfig = !!device.abilities['Appliance.Control.Presence.Config'];
    const hasPresenceStudy = !!device.abilities['Appliance.Control.Presence.Study'];
    const hasLatestX = !!device.abilities['Appliance.Control.Sensor.LatestX'];

    if (!hasPresenceConfig && !hasPresenceStudy && !hasLatestX) {
        return null;
    }

    return {
        supported: true,
        channels: channelIds,
        presenceEvents: true,
        lux: hasLatestX,
        distance: true
    };
}

module.exports = createPresenceSensorAbility;
/**
 * Private export for unit tests. Do not rename or change shape without updating
 * `test/presence.test.js`.
 */
module.exports.getCapabilities = getPresenceSensorCapabilities;
module.exports.ability = {
    key: 'presence',
    namespaces: [
        'Appliance.Control.Sensor.LatestX',
        'Appliance.Control.Presence.Config',
        'Appliance.Control.Presence.Study'
    ],
    caches: ['_presenceSensorStateByChannel'],
    create: createPresenceSensorAbility,
    getCapabilities: getPresenceSensorCapabilities
};
