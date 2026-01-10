'use strict';

/**
 * Represents subdevice information from the HTTP API
 *
 * This class encapsulates subdevice metadata retrieved from the Meross HTTP API,
 * including subdevice identification, type, vendor, and icon information.
 *
 * @class
 * @example
 * // Use fromDict() to create instances
 * const subdeviceInfo = HttpSubdeviceInfo.fromDict({
 *     sub_device_id: '12345',
 *     true_id: '67890',
 *     sub_device_type: 'ms130',
 *     sub_device_vendor: 'meross',
 *     sub_device_name: 'Temperature Sensor',
 *     sub_device_icon_id: 'icon123'
 * });
 */
class HttpSubdeviceInfo {
    /**
     * Creates an HttpSubdeviceInfo instance from a dictionary object.
     * Normalizes incoming keys (handles camelCase, snake_case, and generic keys) to camelCase.
     * This is the only way to create instances.
     *
     * @static
     * @param {Object} jsonDict - Raw API response object with any key format
     * @param {string} [jsonDict.subDeviceId] - Subdevice ID (camelCase)
     * @param {string} [jsonDict.sub_device_id] - Subdevice ID (snake_case)
     * @param {string} [jsonDict.id] - Generic ID key (mapped to subDeviceId)
     * @param {string} [jsonDict.trueId] - True ID (camelCase)
     * @param {string} [jsonDict.true_id] - True ID (snake_case)
     * @param {string} [jsonDict.subDeviceType] - Subdevice type (camelCase)
     * @param {string} [jsonDict.sub_device_type] - Subdevice type (snake_case)
     * @param {string} [jsonDict.type] - Generic type key (mapped to subDeviceType)
     * @param {string} [jsonDict.subDeviceVendor] - Subdevice vendor (camelCase)
     * @param {string} [jsonDict.sub_device_vendor] - Subdevice vendor (snake_case)
     * @param {string} [jsonDict.subDeviceName] - Subdevice name (camelCase)
     * @param {string} [jsonDict.sub_device_name] - Subdevice name (snake_case)
     * @param {string} [jsonDict.name] - Generic name key (mapped to subDeviceName)
     * @param {string} [jsonDict.subDeviceIconId] - Subdevice icon ID (camelCase)
     * @param {string} [jsonDict.sub_device_icon_id] - Subdevice icon ID (snake_case)
     * @returns {HttpSubdeviceInfo} New HttpSubdeviceInfo instance
     */
    static fromDict(jsonDict) {
        if (!jsonDict || typeof jsonDict !== 'object') {
            throw new Error('Subdevice info dictionary is required');
        }

        // The Meross API returns properties in inconsistent formats (camelCase, snake_case, or generic keys).
        // This mapping allows us to accept any format and normalize to camelCase for internal use.
        // Generic keys like 'id', 'type', and 'name' are included as fallbacks for API variations.
        const propertyMappings = {
            subDeviceId: ['subDeviceId', 'sub_device_id', 'id'],
            trueId: ['trueId', 'true_id'],
            subDeviceType: ['subDeviceType', 'sub_device_type', 'type'],
            subDeviceVendor: ['subDeviceVendor', 'sub_device_vendor'],
            subDeviceName: ['subDeviceName', 'sub_device_name', 'name'],
            subDeviceIconId: ['subDeviceIconId', 'sub_device_icon_id']
        };

        // Normalize properties by checking alternatives in priority order (camelCase, snake_case, then generic).
        // This ensures consistent property names regardless of API response format.
        const normalized = {};
        for (const [camelKey, alternatives] of Object.entries(propertyMappings)) {
            for (const key of alternatives) {
                if (jsonDict[key] !== null && jsonDict[key] !== undefined) {
                    normalized[camelKey] = jsonDict[key];
                    break;
                }
            }
        }

        // Use Object.create() instead of a constructor to allow static factory pattern.
        // This prevents accidental instantiation via 'new' and enforces use of fromDict().
        const instance = Object.create(HttpSubdeviceInfo.prototype);
        instance.subDeviceId = normalized.subDeviceId || null;
        instance.trueId = normalized.trueId || null;
        instance.subDeviceType = normalized.subDeviceType || null;
        instance.subDeviceVendor = normalized.subDeviceVendor || null;
        instance.subDeviceName = normalized.subDeviceName || null;
        instance.subDeviceIconId = normalized.subDeviceIconId || null;

        return instance;
    }

    /**
     * Converts the instance to a plain object dictionary with camelCase keys
     *
     * @returns {Object} Plain object with camelCase property keys
     */
    toDict() {
        return {
            subDeviceId: this.subDeviceId,
            trueId: this.trueId,
            subDeviceType: this.subDeviceType,
            subDeviceVendor: this.subDeviceVendor,
            subDeviceName: this.subDeviceName,
            subDeviceIconId: this.subDeviceIconId
        };
    }

    /**
     * Returns a string representation of the subdevice info
     *
     * Provides a human-readable format for logging and debugging. Includes
     * name, type, and both device IDs to uniquely identify the subdevice.
     *
     * @returns {string} String representation in the format "Name (type, ID x, TRUE-ID y)"
     */
    toString() {
        const name = this.subDeviceName || 'Unknown';
        const type = this.subDeviceType || 'unknown';
        const id = this.subDeviceId || 'N/A';
        const trueId = this.trueId || 'N/A';
        return `${name} (${type}, ID ${id}, TRUE-ID ${trueId})`;
    }

    /**
     * Returns a JSON representation of the subdevice info
     *
     * Serializes the subdevice data to JSON format. Uses toDict() to ensure
     * consistent camelCase property names in the output.
     *
     * @returns {string} JSON string representation of the subdevice data
     */
    toJSON() {
        return JSON.stringify(this.toDict());
    }
}

module.exports = HttpSubdeviceInfo;
