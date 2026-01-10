'use strict';

const PresenceSensorState = require('../../model/states/presence-sensor-state');
const { normalizeChannel } = require('../../utilities/options');
const { buildStateChanges } = require('../../utilities/state-changes');

/**
 * Presence sensor feature module.
 * Provides access to presence detection and light sensor data for devices that support it.
 */
module.exports = {
    /**
     * Updates internal presence sensor state from LatestX notification data.
     *
     * Called automatically when LatestX push notifications are received or responses are processed.
     * Extracts presence and light data from the notification and updates the cached state.
     *
     * @param {Object|Array} latestData - Latest sensor readings (single object or array)
     * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
     * @private
     */
    _updatePresenceState(latestData, source = 'response') {
        if (!latestData) {return;}

        const latestArray = Array.isArray(latestData) ? latestData : [latestData];

        for (const entry of latestArray) {
            if (!entry || !entry.data) {
                continue;
            }

            const channel = entry.channel !== undefined ? entry.channel : 0;

            const oldState = this._presenceSensorStateByChannel.get(channel);
            const oldValue = oldState ? {
                isPresent: oldState.isPresent,
                distance: oldState.distanceRaw,
                light: oldState.lightLux
            } : undefined;

            let state = this._presenceSensorStateByChannel.get(channel);
            if (!state) {
                state = new PresenceSensorState({ channel });
                this._presenceSensorStateByChannel.set(channel, state);
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
                this.emit('stateChange', {
                    type: 'presence',
                    channel,
                    value: newValue,
                    oldValue,
                    source,
                    timestamp: Date.now()
                });
            }
        }
    },

    /**
     * Gets the cached presence sensor state for a channel.
     *
     * Returns the cached state without making a request to the device. Use {@link getLatestSensorReadings}
     * to fetch fresh data from the device.
     *
     * @param {number} [channel=0] - Channel to get state for (default: 0)
     * @returns {import('../lib/model/states/presence-sensor-state').PresenceSensorState|null} Presence sensor state object or null if no cached state
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getCachedPresenceSensorState(channel = 0) {
        this.validateState();
        return this._presenceSensorStateByChannel.get(channel);
    },

    /**
     * Gets the latest presence detection data.
     *
     * Returns formatted presence data from cached state. Returns null if no presence data
     * is available for the channel.
     *
     * @param {number} [channel=0] - Channel to get presence for (default: 0)
     * @returns {Object|null} Presence data object with value, isPresent (boolean), state ('presence'|'absence'), distance (in meters), distanceRaw (in mm), timestamp, and times, or null if no data
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getPresence(channel = 0) {
        const state = this.getCachedPresenceSensorState(channel);
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
     * @param {number} [channel=0] - Channel to check (default: 0)
     * @returns {boolean|null} True if presence detected, false if absence detected, null if no data
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    isPresent(channel = 0) {
        const state = this.getCachedPresenceSensorState(channel);
        return state ? state.isPresent : null;
    },

    /**
     * Gets the latest light/illuminance reading.
     *
     * Returns formatted light data from cached state. Returns null if no light data
     * is available for the channel.
     *
     * @param {number} [channel=0] - Channel to get light for (default: 0)
     * @returns {Object|null} Light data object with value and timestamp, or null if no data
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getLight(channel = 0) {
        const state = this.getCachedPresenceSensorState(channel);
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
     * Returns both presence and light data from cached state in a single object.
     *
     * @param {number} [channel=0] - Channel to get readings for (default: 0)
     * @returns {Object} Object containing all sensor readings with presence and light properties
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getAllSensorReadings(channel = 0) {
        const state = this.getCachedPresenceSensorState(channel);
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
     * Gets latest sensor readings from the device.
     *
     * Queries the device for the most recent sensor readings. Automatically updates the cached
     * state when the response is received.
     *
     * @param {Object} [options={}] - Get options
     * @param {Array<string>} [options.dataTypes=['presence', 'light']] - Array of data types to request
     * @returns {Promise<Object>} Promise that resolves with latest sensor data containing `latest` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getLatestSensorReadings(options = {}) {
        const dataTypes = options.dataTypes || ['presence', 'light'];
        const payload = {
            latest: [{
                channel: 0,
                data: dataTypes
            }]
        };

        const response = await this.publishMessage('GET', 'Appliance.Control.Sensor.LatestX', payload);

        if (response && response.latest) {
            this._updatePresenceState(response.latest, 'response');
            this._lastFullUpdateTimestamp = Date.now();
        }

        return response;
    },

    /**
     * Gets presence configuration from the device.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get config for (default: 0)
     * @returns {Promise<Object>} Promise that resolves with presence configuration containing `config` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getPresenceConfig(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            config: [{
                channel
            }]
        };
        return await this.publishMessage('GET', 'Appliance.Control.Presence.Config', payload);
    },

    /**
     * Controls the presence sensor configuration.
     *
     * @param {Object|Array<Object>} configData - Config data object or array of config items
     * @param {number} [configData.channel] - Channel to configure (default: 0)
     * @param {Object} [configData.mode] - Mode configuration
     * @param {number} [configData.mode.workMode] - Work mode (0=Unknown, 1=Biological detection only, 2=Security)
     * @param {number} [configData.mode.testMode] - Test mode value
     * @param {Object} [configData.noBodyTime] - No body detection time configuration
     * @param {number} [configData.noBodyTime.time] - Time in seconds before absence is detected
     * @param {Object} [configData.distance] - Distance configuration
     * @param {number} [configData.distance.value] - Distance threshold in millimeters
     * @param {Object} [configData.sensitivity] - Sensitivity configuration
     * @param {number} [configData.sensitivity.level] - Sensitivity level (1=Anti-Interference, 2=Balance, 3=Responsive)
     * @param {Object} [configData.mthx] - Motion threshold configuration
     * @param {number} [configData.mthx.mth1] - Motion threshold 1
     * @param {number} [configData.mthx.mth2] - Motion threshold 2
     * @param {number} [configData.mthx.mth3] - Motion threshold 3
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setPresenceConfig(configData) {
        const payload = { config: Array.isArray(configData) ? configData : [configData] };
        return await this.publishMessage('SET', 'Appliance.Control.Presence.Config', payload);
    },

    /**
     * Gets presence study/calibration status from the device.
     *
     * @returns {Promise<Object>} Promise that resolves with presence study data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getPresenceStudy() {
        return await this.publishMessage('GET', 'Appliance.Control.Presence.Study', {});
    },

    /**
     * Controls the presence study/calibration mode.
     *
     * Used to start or stop the presence sensor study/calibration process, which helps
     * the device learn its environment for better detection accuracy.
     *
     * @param {Object|Array<Object>} studyData - Study data object or array of study items
     * @param {number} [studyData.channel] - Channel to configure (default: 0)
     * @param {number} [studyData.value] - Study mode value (typically 1-3)
     * @param {number} [studyData.status] - Study status (0 = stop/inactive, 1 = start/active)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setPresenceStudy(studyData) {
        const payload = { study: Array.isArray(studyData) ? studyData : [studyData] };
        return await this.publishMessage('SET', 'Appliance.Control.Presence.Study', payload);
    }
};

