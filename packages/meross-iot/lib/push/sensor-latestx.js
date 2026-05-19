'use strict';

const GenericPushNotification = require('./generic');
const { PresenceState } = require('../enums');

/**
 * Push notification for latest sensor readings (including lux/illuminance).
 *
 * Emitted when a hub sensor subdevice sends latest readings for temperature, humidity, and light.
 * Routed to the appropriate subdevice by the hub device.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * hubDevice.on('pushNotificationReceived', (notification) => {
 *     if (notification instanceof SensorLatestXPushNotification) {
 *         const latestData = notification.latestData;
 *         latestData.forEach(sensor => {
 *             console.log('Latest sensor readings:', sensor.subId);
 *         });
 *     }
 * });
 */
class SensorLatestXPushNotification extends GenericPushNotification {
    /**
     * Creates a new SensorLatestXPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the hub device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.latest] - Latest sensor readings (single object or array)
     * @param {string|number} [rawData.latest.subId] - Subdevice ID (note: uses subId, not id)
     * @param {number} [rawData.latest.channel] - Channel number
     * @param {Object} [rawData.latest.data] - Sensor data containing temp, humi, and light arrays
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Control.Sensor.LatestX', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const latestRaw = rawData?.latest;
        const latest = GenericPushNotification.normalizeToArray(latestRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && latestRaw !== latest) {
            rawData.latest = latest;
        }

        this._latestData = latest;
    }

    /**
     * Gets the latest sensor readings data array.
     *
     * @returns {Array} Array of latest sensor reading objects (empty array if no data)
     */
    get latestData() {
        return this._latestData;
    }

    /**
     * Extracts presence sensor changes from this notification.
     *
     * Converts raw device data format (presence arrays, light arrays) to normalized change
     * format used by subscription managers. Maps presence values to boolean isPresent and
     * extracts distance, timestamp, and light readings.
     *
     * @returns {Object} Changes object with presence sensor data, e.g., { presence: { 0: {...} } }
     */
    extractChanges() {
        const changes = {};
        if (!this._latestData || this._latestData.length === 0) {
            return changes;
        }

        changes.presence = {};
        this._latestData.forEach(entry => {
            if (!entry || !entry.data) {
                return;
            }
            const channel = entry.channel !== undefined ? entry.channel : 0;
            const presenceChange = {};

            if (entry.data.presence && Array.isArray(entry.data.presence) && entry.data.presence.length > 0) {
                const presenceData = entry.data.presence[0];
                presenceChange.isPresent = presenceData.value === PresenceState.PRESENCE;
                presenceChange.distance = presenceData.distance;
                presenceChange.timestamp = presenceData.timestamp;
                presenceChange.times = presenceData.times;
            }

            if (entry.data.light && Array.isArray(entry.data.light) && entry.data.light.length > 0) {
                const lightData = entry.data.light[0];
                presenceChange.light = lightData.value;
                presenceChange.lightTimestamp = lightData.timestamp;
            }

            if (Object.keys(presenceChange).length > 0) {
                changes.presence[channel] = presenceChange;
            }
        });

        return changes;
    }
}

module.exports = SensorLatestXPushNotification;

