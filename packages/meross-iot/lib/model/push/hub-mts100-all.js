'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for hub MTS100 thermostat valve complete state updates.
 *
 * Emitted when a hub MTS100 thermostat valve sends a complete state update (all parameters).
 * Routed to the appropriate subdevice by the hub device.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * hubDevice.on('pushNotification', (notification) => {
 *     if (notification instanceof HubMts100AllPushNotification) {
 *         const allData = notification.allData;
 *         allData.forEach(thermostat => {
 *             console.log('MTS100 thermostat update:', thermostat.id);
 *             console.log('Mode:', thermostat.mode);
 *             console.log('Temperature:', thermostat.currentTemp);
 *         });
 *     }
 * });
 */
class HubMts100AllPushNotification extends GenericPushNotification {
    /**
     * Creates a new HubMts100AllPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the hub device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.all] - Complete thermostat state data (single object or array)
     * @param {string|number} [rawData.all.id] - Subdevice ID
     * @param {number} [rawData.all.mode] - Thermostat mode
     * @param {number} [rawData.all.targetTemp] - Target temperature
     * @param {number} [rawData.all.currentTemp] - Current temperature
     * @param {number} [rawData.all.working] - Working mode
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Hub.Mts100.All', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const allRaw = rawData?.all;
        const all = GenericPushNotification.normalizeToArray(allRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && allRaw !== all) {
            rawData.all = all;
        }

        this._allData = all;
    }

    /**
     * Gets the complete thermostat state data array.
     *
     * @returns {Array} Array of thermostat state objects (empty array if no data)
     */
    get allData() {
        return this._allData;
    }
}

module.exports = HubMts100AllPushNotification;

