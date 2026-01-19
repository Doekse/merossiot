'use strict';

const { MerossErrorValidation } = require('../exception');

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
 *     subDeviceId: '12345',
 *     trueId: '67890',
 *     subDeviceType: 'ms130',
 *     subDeviceVendor: 'meross',
 *     subDeviceName: 'Temperature Sensor',
 *     subDeviceIconId: 'icon123'
 * });
 */
class HttpSubdeviceInfo {
    /**
     * Creates an HttpSubdeviceInfo instance from a dictionary object.
     *
     * Accepts camelCase API response format. The API sometimes uses generic keys ('id', 'type',
     * 'name') instead of the fully-qualified camelCase names, so we check both formats and
     * normalize all properties to camelCase for consistent internal representation.
     *
     * @static
     * @param {Object} jsonDict - Raw API response object with camelCase keys or generic keys
     * @param {string} [jsonDict.subDeviceId] - Subdevice ID
     * @param {string} [jsonDict.id] - Generic ID key (mapped to subDeviceId as fallback)
     * @param {string} [jsonDict.trueId] - True ID
     * @param {string} [jsonDict.subDeviceType] - Subdevice type
     * @param {string} [jsonDict.type] - Generic type key (mapped to subDeviceType as fallback)
     * @param {string} [jsonDict.subDeviceVendor] - Subdevice vendor
     * @param {string} [jsonDict.subDeviceName] - Subdevice name
     * @param {string} [jsonDict.name] - Generic name key (mapped to subDeviceName as fallback)
     * @param {string} [jsonDict.subDeviceIconId] - Subdevice icon ID
     * @returns {HttpSubdeviceInfo} New HttpSubdeviceInfo instance
     */
    static fromDict(jsonDict) {
        if (!jsonDict || typeof jsonDict !== 'object') {
            throw new MerossErrorValidation('Subdevice info dictionary is required', 'jsonDict');
        }

        // Map camelCase properties to their possible API key variants, including generic
        // fallback keys that the API sometimes uses instead of fully-qualified names.
        const propertyMappings = {
            subDeviceId: ['subDeviceId', 'id'],
            trueId: ['trueId'],
            subDeviceType: ['subDeviceType', 'type'],
            subDeviceVendor: ['subDeviceVendor'],
            subDeviceName: ['subDeviceName', 'name'],
            subDeviceIconId: ['subDeviceIconId']
        };

        // Check each property mapping in priority order, preferring camelCase over generic keys
        // to maintain consistent property names regardless of API response format.
        const normalized = {};
        for (const [camelKey, alternatives] of Object.entries(propertyMappings)) {
            for (const key of alternatives) {
                if (jsonDict[key] !== null && jsonDict[key] !== undefined) {
                    normalized[camelKey] = jsonDict[key];
                    break;
                }
            }
        }

        // Object.create() prevents accidental instantiation via 'new' constructor,
        // enforcing the static factory pattern for consistent instance creation.
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
     * Serializes the instance to a plain object dictionary.
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
     * Returns a string representation of the subdevice info.
     *
     * Formats the subdevice name, type, and both device IDs for logging and debugging.
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
     * Returns a JSON representation of the subdevice info.
     *
     * Uses toDict() to ensure consistent camelCase property names in the serialized output.
     *
     * @returns {string} JSON string representation of the subdevice data
     */
    toJSON() {
        return JSON.stringify(this.toDict());
    }
}

module.exports = HttpSubdeviceInfo;
