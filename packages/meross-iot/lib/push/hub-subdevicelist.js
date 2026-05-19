'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for hub subdevice list updates.
 *
 * Emitted when a hub's subdevice list changes (e.g., subdevice added, removed, or updated).
 * Contains the updated list of subdevices registered with the hub.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * hubDevice.on('pushNotificationReceived', (notification) => {
 *     if (notification instanceof HubSubdeviceListPushNotification) {
 *         const subdevices = notification.subdeviceListData;
 *         console.log('Subdevice list updated. Total subdevices:', subdevices.length);
 *         subdevices.forEach(subdevice => {
 *             console.log('Subdevice:', subdevice.id, subdevice.type);
 *         });
 *     }
 * });
 */
class HubSubdeviceListPushNotification extends GenericPushNotification {
    /**
     * Creates a new HubSubdeviceListPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the hub device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.subdeviceList] - Subdevice list data
     * @param {Array} [rawData.subdeviceList.subdevice] - Array of subdevice objects (if nested structure)
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Hub.SubdeviceList', originatingDeviceUuid, rawData);

        this._subdeviceListData = rawData?.subdeviceList || rawData?.subdeviceList?.subdevice || [];
    }

    /**
     * Gets the subdevice list data array.
     *
     * @returns {Array} Array of subdevice objects (empty array if no data)
     */
    get subdeviceListData() {
        return this._subdeviceListData;
    }
}

module.exports = HubSubdeviceListPushNotification;

