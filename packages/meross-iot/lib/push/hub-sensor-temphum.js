'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for hub temperature/humidity sensor updates.
 *
 * Emitted when a hub temperature/humidity sensor subdevice sends temperature or humidity
 * readings. Routed to the appropriate subdevice by the hub device.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * hubDevice.on('pushNotificationReceived', (notification) => {
 *     if (notification instanceof HubSensorTempHumPushNotification) {
 *         const tempHumData = notification.tempHumData;
 *         tempHumData.forEach(sensor => {
 *             console.log('Temp/Hum sensor update:', sensor.id);
 *             console.log('Temperature:', sensor.temperature);
 *             console.log('Humidity:', sensor.humidity);
 *         });
 *     }
 * });
 */
class HubSensorTempHumPushNotification extends GenericPushNotification {
    /**
     * Creates a new HubSensorTempHumPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the hub device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.tempHum] - Temperature/humidity data (single object or array)
     * @param {string|number} [rawData.tempHum.id] - Subdevice ID
     * @param {number} [rawData.tempHum.temperature] - Temperature reading
     * @param {number} [rawData.tempHum.humidity] - Humidity reading
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Hub.Sensor.TempHum', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const tempHumRaw = rawData?.tempHum;
        const tempHum = GenericPushNotification.normalizeToArray(tempHumRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && tempHumRaw !== tempHum) {
            rawData.tempHum = tempHum;
        }

        this._tempHumData = tempHum;
    }

    /**
     * Gets the temperature/humidity data array.
     *
     * @returns {Array} Array of temperature/humidity objects (empty array if no data)
     */
    get tempHumData() {
        return this._tempHumData;
    }
}

module.exports = HubSensorTempHumPushNotification;

