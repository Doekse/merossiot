'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for device unbinding events.
 *
 * Emitted when a device is unbound from a user account. Typically occurs when
 * a device is removed from the account or factory reset.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * device.on('pushNotification', (notification) => {
 *     if (notification instanceof UnbindPushNotification) {
 *         console.log('Device unbound:', notification.originatingDeviceUuid);
 *         // Device is no longer associated with this account
 *     }
 * });
 */
class UnbindPushNotification extends GenericPushNotification {
    /**
     * Creates a new UnbindPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Control.Unbind', originatingDeviceUuid, rawData);
    }
}

module.exports = UnbindPushNotification;

