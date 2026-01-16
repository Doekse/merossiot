'use strict';

const GenericPushNotification = require('./generic');
const { HardwareInfo, FirmwareInfo, TimeInfo } = require('./common');

/**
 * Push notification for device binding events.
 *
 * Emitted when a device is bound to a user account or when binding information is updated.
 * The binding data includes hardware and firmware metadata that uniquely identifies the device
 * and its capabilities, which is used for device registration and feature detection.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * device.on('pushNotification', (notification) => {
 *     if (notification instanceof BindPushNotification) {
 *         const timeInfo = notification.time;
 *         if (timeInfo) {
 *             console.log('Device bound at:', timeInfo.timestamp, 'timezone:', timeInfo.timezone);
 *         }
 *         const hwInfo = notification.hwinfo;
 *         if (hwInfo) {
 *             console.log('Hardware version:', hwInfo.version, 'MAC:', hwInfo.macAddress);
 *         }
 *         const fwInfo = notification.fwinfo;
 *         if (fwInfo) {
 *             console.log('Firmware version:', fwInfo.version, 'WiFi MAC:', fwInfo.wifiMac);
 *         }
 *     }
 * });
 */
class BindPushNotification extends GenericPushNotification {
    /**
     * Creates a new BindPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object} [rawData.bind] - Binding data
     * @param {Object} [rawData.bind.time] - Time information object (will be converted to TimeInfo instance)
     * @param {Object} [rawData.bind.hardware] - Hardware information object (will be converted to HardwareInfo instance)
     * @param {Object} [rawData.bind.firmware] - Firmware information object (will be converted to FirmwareInfo instance)
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Control.Bind', originatingDeviceUuid, rawData);
    }

    /**
     * Gets the binding timestamp information.
     *
     * Returns a TimeInfo instance that normalizes timezone and timestamp data from the raw payload.
     *
     * @returns {TimeInfo|null} TimeInfo instance or null if not available
     */
    get time() {
        const timeData = this._rawData?.bind?.time;
        if (!timeData) {
            return null;
        }
        return TimeInfo.fromDict(timeData);
    }

    /**
     * Gets the hardware information.
     *
     * Returns a HardwareInfo instance that normalizes hardware metadata (version, UUID, MAC, chip type)
     * from the raw payload with camelCase property names.
     *
     * @returns {HardwareInfo|null} HardwareInfo instance or null if not available
     */
    get hwinfo() {
        const hardwareData = this._rawData?.bind?.hardware;
        if (!hardwareData) {
            return null;
        }
        return HardwareInfo.fromDict(hardwareData);
    }

    /**
     * Gets the firmware information.
     *
     * Returns a FirmwareInfo instance that normalizes firmware metadata (version, WiFi MAC, server info)
     * from the raw payload with camelCase property names.
     *
     * @returns {FirmwareInfo|null} FirmwareInfo instance or null if not available
     */
    get fwinfo() {
        const firmwareData = this._rawData?.bind?.firmware;
        if (!firmwareData) {
            return null;
        }
        return FirmwareInfo.fromDict(firmwareData);
    }
}

module.exports = BindPushNotification;

