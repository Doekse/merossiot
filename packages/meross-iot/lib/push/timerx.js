'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for timer configuration changes.
 *
 * Emitted when a device's timer configuration changes (e.g., timer added, modified,
 * deleted, or triggered). Contains the updated timer data.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * device.on('pushNotificationReceived', (notification) => {
 *     if (notification instanceof TimerXPushNotification) {
 *         const timerData = notification.timerxData;
 *         timerData.forEach(timer => {
 *             console.log('Timer updated:', timer.id, timer.enable === 1 ? 'enabled' : 'disabled');
 *         });
 *     }
 * });
 */
class TimerXPushNotification extends GenericPushNotification {
    /**
     * Creates a new TimerXPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.timerx] - Timer data (single object or array)
     * @param {string|number} [rawData.timerx.id] - Timer identifier
     * @param {number} [rawData.timerx.channel] - Channel number
     * @param {number} [rawData.timerx.enable] - Enabled state (0=disabled, 1=enabled)
     * @param {number} [rawData.timerx.type] - Timer type
     * @param {number} [rawData.timerx.time] - Time value
     * @param {number} [rawData.timerx.week] - Weekday mask
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Control.TimerX', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const timerxRaw = rawData?.timerx;
        const timerx = GenericPushNotification.normalizeToArray(timerxRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && timerxRaw !== timerx) {
            rawData.timerx = timerx;
        }

        this._timerxData = timerx;
    }

    /**
     * Gets the timer data array.
     *
     * @returns {Array} Array of timer objects (empty array if no data)
     */
    get timerxData() {
        return this._timerxData;
    }
}

module.exports = TimerXPushNotification;

