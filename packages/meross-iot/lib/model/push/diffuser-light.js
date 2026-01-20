'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for diffuser light state changes.
 *
 * Emitted when a diffuser device's light settings change (on/off, mode, color, brightness).
 * Contains the updated light state for one or more channels.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * device.on('pushNotificationReceived', (notification) => {
 *     if (notification instanceof DiffuserLightPushNotification) {
 *         const lightData = notification.lightData;
 *         lightData.forEach(light => {
 *             console.log(`Channel ${light.channel} light is ${light.onoff === 1 ? 'on' : 'off'}`);
 *         });
 *     }
 * });
 */
class DiffuserLightPushNotification extends GenericPushNotification {
    /**
     * Creates a new DiffuserLightPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.light] - Light state data (single object or array)
     * @param {number} [rawData.light.channel] - Channel number
     * @param {number} [rawData.light.onoff] - On/off state (0=off, 1=on)
     * @param {number} [rawData.light.mode] - Light mode
     * @param {number} [rawData.light.rgb] - RGB color value
     * @param {number} [rawData.light.luminance] - Brightness value
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Control.Diffuser.Light', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const lightRaw = rawData?.light;
        const light = GenericPushNotification.normalizeToArray(lightRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && lightRaw !== light) {
            rawData.light = light;
        }

        this._lightData = light;
    }

    /**
     * Gets the light state data array.
     *
     * @returns {Array} Array of light state objects (empty array if no data)
     */
    get lightData() {
        return this._lightData;
    }

    /**
     * Extracts diffuser light changes from this notification.
     *
     * Converts raw device data format (onoff, mode, rgb, luminance) to normalized change
     * format used by subscription managers. Maps onoff (0/1) to boolean isOn for consistency.
     *
     * @returns {Object} Changes object with light state, e.g., { diffuserLight: { 0: {...} } }
     */
    extractChanges() {
        const changes = {};
        if (!this._lightData || this._lightData.length === 0) {
            return changes;
        }

        changes.diffuserLight = {};
        this._lightData.forEach(item => {
            const channel = item.channel !== undefined ? item.channel : 0;
            const lightChange = {};
            if (item.onoff !== undefined) {
                lightChange.isOn = item.onoff === 1;
            }
            if (item.mode !== undefined) {
                lightChange.mode = item.mode;
            }
            if (item.rgb !== undefined) {
                lightChange.rgb = item.rgb;
            }
            if (item.luminance !== undefined) {
                lightChange.luminance = item.luminance;
            }
            if (Object.keys(lightChange).length > 0) {
                changes.diffuserLight[channel] = lightChange;
            }
        });

        return changes;
    }
}

module.exports = DiffuserLightPushNotification;

