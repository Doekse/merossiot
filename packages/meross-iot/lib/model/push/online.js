'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for device online status changes.
 *
 * Emitted when a device's connection status changes (online, offline, or upgrade mode).
 * Devices send this notification to report their connection state to the Meross cloud.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * device.on('pushNotification', (notification) => {
 *     if (notification instanceof OnlinePushNotification) {
 *         console.log('Device status changed:', notification.status);
 *         // status: 0=not online, 1=online, 2=offline, 3=upgrading
 *     }
 * });
 */
class OnlinePushNotification extends GenericPushNotification {
    /**
     * Creates a new OnlinePushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object} [rawData.online] - Online status data
     * @param {number} [rawData.online.status] - Online status value (from OnlineStatus enum)
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.System.Online', originatingDeviceUuid, rawData);
    }

    /**
     * Gets the online status value.
     *
     * Explicitly checks for null/undefined to distinguish between missing data and
     * a valid zero value (not online).
     *
     * @returns {number|undefined} Status value (0=not online, 1=online, 2=offline, 3=upgrading, -1=unknown) or undefined if not available
     * @see {@link module:lib/enums.OnlineStatus} for status constants
     */
    get status() {
        const statusValue = this._rawData?.online?.status;
        if (statusValue === undefined || statusValue === null) {
            return undefined;
        }
        return statusValue;
    }
}

module.exports = OnlinePushNotification;

