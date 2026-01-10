'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for hub subdevice toggle (on/off) state changes.
 *
 * Emitted when a hub subdevice's toggle state changes.
 * Routed to the appropriate subdevice by the hub device.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * hubDevice.on('pushNotification', (notification) => {
 *     if (notification instanceof HubToggleXPushNotification) {
 *         const toggleData = notification.togglexData;
 *         toggleData.forEach(toggle => {
 *             console.log(`Subdevice ${toggle.id} channel ${toggle.channel} is now ${toggle.onoff === 1 ? 'on' : 'off'}`);
 *         });
 *     }
 * });
 */
class HubToggleXPushNotification extends GenericPushNotification {
    /**
     * Creates a new HubToggleXPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the hub device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.togglex] - Toggle state data (single object or array)
     * @param {string|number} [rawData.togglex.id] - Subdevice ID
     * @param {number} [rawData.togglex.channel] - Channel number
     * @param {number} [rawData.togglex.onoff] - On/off state (0=off, 1=on)
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Hub.ToggleX', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const togglexRaw = rawData?.togglex;
        const togglex = GenericPushNotification.normalizeToArray(togglexRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && togglexRaw !== togglex) {
            rawData.togglex = togglex;
        }

        this._togglexData = togglex;
    }

    /**
     * Gets the toggle state data array.
     *
     * @returns {Array} Array of toggle state objects (empty array if no data)
     */
    get togglexData() {
        return this._togglexData;
    }
}

module.exports = HubToggleXPushNotification;

