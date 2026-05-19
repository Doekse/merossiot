'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for hub MTS100 thermostat valve temperature updates.
 *
 * Emitted when a hub MTS100 thermostat valve's temperature reading changes.
 * Routed to the appropriate subdevice by the hub device.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * hubDevice.on('pushNotificationReceived', (notification) => {
 *     if (notification instanceof HubMts100TemperaturePushNotification) {
 *         const tempData = notification.temperatureData;
 *         tempData.forEach(thermostat => {
 *             console.log('MTS100 temperature update:', thermostat.id);
 *             console.log('Current temp:', thermostat.currentTemp);
 *             console.log('Target temp:', thermostat.targetTemp);
 *         });
 *     }
 * });
 */
class HubMts100TemperaturePushNotification extends GenericPushNotification {
    /**
     * Creates a new HubMts100TemperaturePushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the hub device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.temperature] - Temperature data (single object or array)
     * @param {string|number} [rawData.temperature.id] - Subdevice ID
     * @param {number} [rawData.temperature.currentTemp] - Current temperature reading
     * @param {number} [rawData.temperature.targetTemp] - Target temperature setting
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Hub.Mts100.Temperature', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const temperatureRaw = rawData?.temperature;
        const temperature = GenericPushNotification.normalizeToArray(temperatureRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && temperatureRaw !== temperature) {
            rawData.temperature = temperature;
        }

        this._temperatureData = temperature;
    }

    /**
     * Gets the temperature data array.
     *
     * @returns {Array} Array of temperature objects (empty array if no data)
     */
    get temperatureData() {
        return this._temperatureData;
    }
}

module.exports = HubMts100TemperaturePushNotification;

