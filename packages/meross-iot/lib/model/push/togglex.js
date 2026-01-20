'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for toggle (on/off) state changes.
 *
 * Emitted when a device's toggle state changes (e.g., a smart plug is turned on or off).
 * Contains the updated toggle state for one or more channels.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * device.on('pushNotificationReceived', (notification) => {
 *     if (notification instanceof ToggleXPushNotification) {
 *         const toggleData = notification.togglexData;
 *         toggleData.forEach(toggle => {
 *             console.log(`Channel ${toggle.channel} is now ${toggle.onoff === 1 ? 'on' : 'off'}`);
 *         });
 *     }
 * });
 */
class ToggleXPushNotification extends GenericPushNotification {
    /**
     * Creates a new ToggleXPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.togglex] - Toggle state data (single object or array)
     * @param {number} [rawData.togglex.channel] - Channel number
     * @param {number} [rawData.togglex.onoff] - On/off state (0=off, 1=on)
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Control.ToggleX', originatingDeviceUuid, rawData);

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

    /**
     * Extracts toggle state changes from this notification.
     *
     * Converts raw device data format (onoff: 0/1) to normalized change format (boolean)
     * used by subscription managers, keyed by channel number.
     *
     * @returns {Object} Changes object with toggle state, e.g., { toggle: { 0: true, 1: false } }
     */
    extractChanges() {
        const changes = {};
        if (this._togglexData && this._togglexData.length > 0) {
            changes.toggle = {};
            this._togglexData.forEach(item => {
                changes.toggle[item.channel] = item.onoff === 1;
            });
        }
        return changes;
    }
}

module.exports = ToggleXPushNotification;

