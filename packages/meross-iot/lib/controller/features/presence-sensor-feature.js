'use strict';

const PresenceSensorState = require('../../model/states/presence-sensor-state');
const { normalizeChannel } = require('../../utilities/options');
const { buildStateChanges } = require('../../utilities/state-changes');

/**
 * Creates a presence sensor feature object for a device.
 *
 * Provides access to presence detection and light sensor data for devices that support it.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Presence sensor feature object with get() and convenience methods
 */
function createPresenceSensorFeature(device) {
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
         * @throws {MerossErrorUnconnected} If device is not connected
         * @throws {MerossErrorCommandTimeout} If command times out
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            const dataTypes = options.dataTypes || ['presence', 'light'];
            const CACHE_MAX_AGE = 5000; // 5 seconds
            const cacheAge = Date.now() - (device.lastFullUpdateTimestamp || 0);

            // Use cache if fresh, otherwise fetch
            if (device.lastFullUpdateTimestamp && cacheAge < CACHE_MAX_AGE) {
                const cached = device._presenceSensorStateByChannel.get(channel);
                if (cached) {
                    return cached;
                }
            }

            // Fetch fresh state
            const payload = {
                latest: [{
                    channel: 0,
                    data: dataTypes
                }]
            };

            const response = await device.publishMessage('GET', 'Appliance.Control.Sensor.LatestX', payload);

            if (response?.latest) {
                updatePresenceState(device, response.latest, 'response');
                device.lastFullUpdateTimestamp = Date.now();
            }

            return device._presenceSensorStateByChannel.get(channel);
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
            return await device.publishMessage('GET', 'Appliance.Control.Presence.Config', payload);
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
            return await device.publishMessage('SET', 'Appliance.Control.Presence.Config', payload);
        },

        /**
         * Gets presence study/calibration status from the device.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<Object>} Promise that resolves with presence study data
         */
        async getStudy(_options = {}) {
            return await device.publishMessage('GET', 'Appliance.Control.Presence.Study', {});
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
            return await device.publishMessage('SET', 'Appliance.Control.Presence.Study', payload);
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
 */
function updatePresenceState(device, latestData, source = 'response') {
    if (!latestData) {return;}

    const latestArray = Array.isArray(latestData) ? latestData : [latestData];

    for (const entry of latestArray) {
        if (!entry || !entry.data) {
            continue;
        }

        const channel = entry.channel !== undefined ? entry.channel : 0;

        const oldState = device._presenceSensorStateByChannel.get(channel);
        const oldValue = oldState ? {
            isPresent: oldState.isPresent,
            distance: oldState.distanceRaw,
            light: oldState.lightLux
        } : undefined;

        let state = device._presenceSensorStateByChannel.get(channel);
        if (!state) {
            state = new PresenceSensorState({ channel });
            device._presenceSensorStateByChannel.set(channel, state);
        }

        const stateUpdate = { channel };

        if (entry.data.presence && Array.isArray(entry.data.presence) && entry.data.presence.length > 0) {
            const presenceData = entry.data.presence[0];
            stateUpdate.presence = {
                value: presenceData.value,
                distance: presenceData.distance,
                timestamp: presenceData.timestamp,
                times: presenceData.times
            };
        }

        if (entry.data.light && Array.isArray(entry.data.light) && entry.data.light.length > 0) {
            const lightData = entry.data.light[0];
            stateUpdate.light = {
                value: lightData.value,
                timestamp: lightData.timestamp
            };
        }

        state.update(stateUpdate);

        const newValue = buildStateChanges(oldValue, {
            isPresent: state.isPresent,
            distance: state.distanceRaw,
            light: state.lightLux
        });

        if (Object.keys(newValue).length > 0) {
            device.emit('state', {
                type: 'presence',
                channel,
                value: newValue,
                source,
                timestamp: Date.now()
            });
        }
    }
}

module.exports = createPresenceSensorFeature;
module.exports._updatePresenceState = updatePresenceState;
