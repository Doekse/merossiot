'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for water leak sensor events from hub subdevices.
 *
 * Emitted when a water leak sensor (hub subdevice) detects a leak or sends sensor updates.
 * Routed to the appropriate subdevice by the hub device.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * hubDevice.on('pushNotification', (notification) => {
 *     if (notification instanceof WaterLeakPushNotification) {
 *         console.log('Water leak sensor update from subdevice:', notification.subdeviceId);
 *         console.log('Latest sample indicates leak:', notification.latestSampleIsLeak);
 *         console.log('Sample time:', notification.latestSampleTime);
 *     }
 * });
 */
class WaterLeakPushNotification extends GenericPushNotification {
    /**
     * Creates a new WaterLeakPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the hub device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.waterLeak] - Water leak sensor data (single object or array)
     * @param {string|number} [rawData.waterLeak.id] - Subdevice ID
     * @param {boolean} [rawData.waterLeak.latestWaterLeak] - Whether latest sample indicates leak
     * @param {number} [rawData.waterLeak.latestSampleTime] - Timestamp of latest sample
     * @param {number} [rawData.waterLeak.syncedTime] - Synchronization timestamp
     * @param {Array} [rawData.waterLeak.sample] - Array of sensor samples
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Hub.Sensor.WaterLeak', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const waterLeakRaw = rawData?.waterLeak;
        const waterLeak = GenericPushNotification.normalizeToArray(waterLeakRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && waterLeakRaw !== waterLeak) {
            rawData.waterLeak = waterLeak;
        }

        if (waterLeak && waterLeak.length > 0) {
            const event = waterLeak[0];
            this._subDeviceId = event?.id;
            this._latestWaterLeak = event?.latestWaterLeak;
            this._latestSampleTime = event?.latestSampleTime;
            this._syncedTime = event?.syncedTime;
            this._samples = event?.sample;
        }
    }

    /**
     * Gets the synchronization timestamp.
     *
     * @returns {number|undefined} Sync timestamp or undefined if not available
     */
    get syncedTime() {
        return this._syncedTime;
    }

    /**
     * Gets the timestamp of the latest sample.
     *
     * @returns {number|undefined} Latest sample timestamp or undefined if not available
     */
    get latestSampleTime() {
        return this._latestSampleTime;
    }

    /**
     * Gets whether the latest sample indicates a water leak.
     *
     * @returns {boolean|undefined} True if leak detected, false if no leak, undefined if not available
     */
    get latestSampleIsLeak() {
        return this._latestWaterLeak;
    }

    /**
     * Gets the subdevice ID of the water leak sensor.
     *
     * @returns {string|number|undefined} Subdevice ID or undefined if not available
     */
    get subdeviceId() {
        return this._subDeviceId;
    }

    /**
     * Gets the array of sensor samples.
     *
     * Contains historical sensor readings for analysis.
     *
     * @returns {Array|undefined} Array of sample data or undefined if not available
     */
    get samples() {
        return this._samples;
    }
}

module.exports = WaterLeakPushNotification;

