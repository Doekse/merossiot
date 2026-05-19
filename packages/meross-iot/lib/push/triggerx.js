'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for trigger configuration changes.
 *
 * Emitted when a device's trigger configuration changes (e.g., trigger added, modified,
 * deleted, or activated). Contains the updated trigger data.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * device.on('pushNotificationReceived', (notification) => {
 *     if (notification instanceof TriggerXPushNotification) {
 *         const triggerData = notification.triggerxData;
 *         triggerData.forEach(trigger => {
 *             console.log('Trigger updated:', trigger.id, trigger.enable === 1 ? 'enabled' : 'disabled');
 *         });
 *     }
 * });
 */
class TriggerXPushNotification extends GenericPushNotification {
    /**
     * Creates a new TriggerXPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.triggerx] - Trigger data (single object or array)
     * @param {string|number} [rawData.triggerx.id] - Trigger identifier
     * @param {number} [rawData.triggerx.channel] - Channel number
     * @param {number} [rawData.triggerx.enable] - Enabled state (0=disabled, 1=enabled)
     * @param {number} [rawData.triggerx.type] - Trigger type
     * @param {Object} [rawData.triggerx.rule] - Trigger rule configuration
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Control.TriggerX', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const triggerxRaw = rawData?.triggerx;
        const triggerx = GenericPushNotification.normalizeToArray(triggerxRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && triggerxRaw !== triggerx) {
            rawData.triggerx = triggerx;
        }

        this._triggerxData = triggerx;
    }

    /**
     * Gets the trigger data array.
     *
     * @returns {Array} Array of trigger objects (empty array if no data)
     */
    get triggerxData() {
        return this._triggerxData;
    }
}

module.exports = TriggerXPushNotification;

