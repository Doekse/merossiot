'use strict';

const { OnlineStatus } = require('../enums');
const { DEFAULT_MQTT_HOST, DEFAULT_MQTT_PORT } = require('../constants');
const { extractDomain, extractPort } = require('../../utilities/network');

/**
 * Represents device information from the HTTP API
 *
 * This class encapsulates device metadata retrieved from the Meross HTTP API,
 * including device identification, versions, channels, and network configuration.
 * It provides helper methods for extracting MQTT connection information.
 *
 * @class
 * @example
 * // Use fromDict() to create instances
 * const deviceInfo = HttpDeviceInfo.fromDict({
 *     uuid: '12345',
 *     dev_name: 'My Device',
 *     device_type: 'mss310',
 *     online_status: 1,
 *     channels: []
 * });
 */
class HttpDeviceInfo {
    /**
     * Creates an HttpDeviceInfo instance from a dictionary object.
     * Normalizes incoming keys (handles camelCase and snake_case) to camelCase.
     * This is the only way to create instances.
     *
     * @static
     * @param {Object} jsonDict - Raw API response object with any key format
     * @param {string} [jsonDict.uuid] - Device UUID
     * @param {string} [jsonDict.devName] - Device name (camelCase)
     * @param {string} [jsonDict.dev_name] - Device name (snake_case)
     * @param {string} [jsonDict.deviceType] - Device type (camelCase)
     * @param {string} [jsonDict.device_type] - Device type (snake_case)
     * @param {Array<Object>} [jsonDict.channels] - Raw channels array from API
     * @param {string} [jsonDict.fmwareVersion] - Firmware version (camelCase)
     * @param {string} [jsonDict.fmware_version] - Firmware version (snake_case)
     * @param {string} [jsonDict.hdwareVersion] - Hardware version (camelCase)
     * @param {string} [jsonDict.hdware_version] - Hardware version (snake_case)
     * @param {string} [jsonDict.domain] - MQTT domain
     * @param {string} [jsonDict.reservedDomain] - Reserved MQTT domain (camelCase)
     * @param {string} [jsonDict.reserved_domain] - Reserved MQTT domain (snake_case)
     * @param {string} [jsonDict.subType] - Device sub-type (camelCase)
     * @param {string} [jsonDict.sub_type] - Device sub-type (snake_case)
     * @param {number|Date|string} [jsonDict.bindTime] - Device bind timestamp (camelCase)
     * @param {number|Date|string} [jsonDict.bind_time] - Device bind timestamp (snake_case)
     * @param {string} [jsonDict.skillNumber] - Skill number (camelCase)
     * @param {string} [jsonDict.skill_number] - Skill number (snake_case)
     * @param {string} [jsonDict.userDevIcon] - User device icon (camelCase)
     * @param {string} [jsonDict.user_dev_icon] - User device icon (snake_case)
     * @param {number} [jsonDict.iconType] - Icon type (camelCase)
     * @param {number} [jsonDict.icon_type] - Icon type (snake_case)
     * @param {string} [jsonDict.region] - Device region
     * @param {string} [jsonDict.devIconId] - Device icon ID (camelCase)
     * @param {string} [jsonDict.dev_icon_id] - Device icon ID (snake_case)
     * @param {number} [jsonDict.onlineStatus] - Online status (camelCase)
     * @param {number} [jsonDict.online_status] - Online status (snake_case)
     * @returns {HttpDeviceInfo} New HttpDeviceInfo instance
     */
    static fromDict(jsonDict) {
        if (!jsonDict || typeof jsonDict !== 'object') {
            throw new Error('Device info dictionary is required');
        }

        // The Meross API returns properties in inconsistent formats (camelCase vs snake_case).
        // This mapping allows us to accept either format and normalize to camelCase for internal use.
        const propertyMappings = {
            uuid: ['uuid'],
            devName: ['devName', 'dev_name'],
            deviceType: ['deviceType', 'device_type'],
            channels: ['channels'],
            fmwareVersion: ['fmwareVersion', 'fmware_version'],
            hdwareVersion: ['hdwareVersion', 'hdware_version'],
            domain: ['domain'],
            reservedDomain: ['reservedDomain', 'reserved_domain'],
            subType: ['subType', 'sub_type'],
            bindTime: ['bindTime', 'bind_time'],
            skillNumber: ['skillNumber', 'skill_number'],
            userDevIcon: ['userDevIcon', 'user_dev_icon'],
            iconType: ['iconType', 'icon_type'],
            region: ['region'],
            devIconId: ['devIconId', 'dev_icon_id'],
            onlineStatus: ['onlineStatus', 'online_status']
        };

        // Normalize properties by checking alternatives in priority order (camelCase first, then snake_case).
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
        const instance = Object.create(HttpDeviceInfo.prototype);
        instance.uuid = normalized.uuid;
        instance.devName = normalized.devName;
        instance.deviceType = normalized.deviceType;
        instance.channels = normalized.channels || [];
        instance.fmwareVersion = normalized.fmwareVersion;
        instance.hdwareVersion = normalized.hdwareVersion;
        instance.domain = normalized.domain;
        instance.reservedDomain = normalized.reservedDomain;
        instance.subType = normalized.subType;
        instance.skillNumber = normalized.skillNumber;
        instance.userDevIcon = normalized.userDevIcon;
        instance.iconType = normalized.iconType;
        instance.region = normalized.region;
        instance.devIconId = normalized.devIconId;

        // Convert onlineStatus to a number, defaulting to UNKNOWN if invalid or missing.
        // The API may return non-numeric values or omit the field entirely.
        if (normalized.onlineStatus !== undefined && normalized.onlineStatus !== null) {
            if (typeof normalized.onlineStatus === 'number') {
                instance.onlineStatus = normalized.onlineStatus;
            } else {
                instance.onlineStatus = OnlineStatus.UNKNOWN;
            }
        } else {
            instance.onlineStatus = OnlineStatus.UNKNOWN;
        }

        // Convert bindTime from Unix timestamp (seconds) to Date object.
        // The API returns timestamps as numbers, but we store them as Date instances for easier manipulation.
        if (normalized.bindTime !== undefined && normalized.bindTime !== null) {
            if (typeof normalized.bindTime === 'number') {
                instance.bindTime = new Date(normalized.bindTime * 1000);
            } else if (normalized.bindTime instanceof Date) {
                instance.bindTime = normalized.bindTime;
            } else if (typeof normalized.bindTime === 'string') {
                instance.bindTime = new Date(normalized.bindTime);
            } else {
                instance.bindTime = null;
            }
        } else {
            instance.bindTime = null;
        }

        return instance;
    }

    /**
     * Converts the instance to a plain object dictionary with camelCase keys
     *
     * @returns {Object} Plain object with camelCase property keys
     */
    toDict() {
        return {
            uuid: this.uuid,
            devName: this.devName,
            deviceType: this.deviceType,
            channels: this.channels,
            fmwareVersion: this.fmwareVersion,
            hdwareVersion: this.hdwareVersion,
            domain: this.domain,
            reservedDomain: this.reservedDomain,
            subType: this.subType,
            bindTime: this.bindTime,
            skillNumber: this.skillNumber,
            userDevIcon: this.userDevIcon,
            iconType: this.iconType,
            region: this.region,
            devIconId: this.devIconId,
            onlineStatus: this.onlineStatus
        };
    }

    /**
     * Gets the MQTT server hostname for this device
     *
     * Extracts the hostname from the domain or reservedDomain field.
     * The domain field is preferred as it represents the active MQTT endpoint,
     * while reservedDomain is a fallback. Defaults to a standard hostname if neither is available.
     *
     * @returns {string} MQTT hostname
     */
    getMqttHost() {
        if (this.domain) {
            return extractDomain(this.domain);
        }
        if (this.reservedDomain) {
            return extractDomain(this.reservedDomain);
        }
        return DEFAULT_MQTT_HOST;
    }

    /**
     * Gets the MQTT server port for this device
     *
     * Extracts the port from the domain or reservedDomain field.
     * The domain field is preferred as it represents the active MQTT endpoint,
     * while reservedDomain is a fallback. Defaults to a standard port if neither is available.
     *
     * @returns {number} MQTT port number
     */
    getMqttPort() {
        if (this.domain) {
            return extractPort(this.domain, DEFAULT_MQTT_PORT);
        }
        if (this.reservedDomain) {
            return extractPort(this.reservedDomain, DEFAULT_MQTT_PORT);
        }
        return DEFAULT_MQTT_PORT;
    }
}

module.exports = HttpDeviceInfo;
