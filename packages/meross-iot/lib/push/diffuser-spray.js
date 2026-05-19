'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for diffuser spray state changes.
 *
 * Emitted when a diffuser device's spray mode changes.
 * Contains the updated spray state for one or more channels.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * device.on('pushNotificationReceived', (notification) => {
 *     if (notification instanceof DiffuserSprayPushNotification) {
 *         const sprayData = notification.sprayData;
 *         sprayData.forEach(spray => {
 *             console.log(`Channel ${spray.channel} spray mode: ${spray.mode}`);
 *         });
 *     }
 * });
 */
class DiffuserSprayPushNotification extends GenericPushNotification {
    /**
     * Creates a new DiffuserSprayPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.spray] - Spray state data (single object or array)
     * @param {number} [rawData.spray.channel] - Channel number
     * @param {number} [rawData.spray.mode] - Spray mode value
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Control.Diffuser.Spray', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const sprayRaw = rawData?.spray;
        const spray = GenericPushNotification.normalizeToArray(sprayRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && sprayRaw !== spray) {
            rawData.spray = spray;
        }

        this._sprayData = spray;
    }

    /**
     * Gets the spray state data array.
     *
     * @returns {Array} Array of spray state objects (empty array if no data)
     */
    get sprayData() {
        return this._sprayData;
    }

    /**
     * Extracts diffuser spray changes from this notification.
     *
     * Converts raw device data format to normalized change format used by subscription managers.
     *
     * @returns {Object} Changes object with spray state, e.g., { diffuserSpray: { 0: { mode: 1 } } }
     */
    extractChanges() {
        const changes = {};
        if (!this._sprayData || this._sprayData.length === 0) {
            return changes;
        }

        changes.diffuserSpray = {};
        this._sprayData.forEach(item => {
            const channel = item.channel !== undefined ? item.channel : 0;
            if (item.mode !== undefined) {
                changes.diffuserSpray[channel] = { mode: item.mode };
            }
        });

        return changes;
    }
}

module.exports = DiffuserSprayPushNotification;

