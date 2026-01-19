'use strict';

const { OnlineStatus } = require('../enums');
const { DEFAULT_MQTT_HOST, DEFAULT_MQTT_PORT } = require('../constants');
const { extractDomain, extractPort } = require('../../utilities/network');
const { MerossErrorValidation } = require('../exception');

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
 *     devName: 'My Device',
 *     deviceType: 'mss310',
 *     onlineStatus: 1,
 *     channels: []
 * });
 */
class HttpDeviceInfo {
    /**
     * Creates an HttpDeviceInfo instance from a dictionary object.
     *
     * Validates and converts onlineStatus to ensure enum consistency, and converts
     * bindTime from Unix timestamp to Date object for consistent time handling.
     * All other properties are assigned directly from the API response.
     *
     * @static
     * @param {Object} jsonDict - Raw API response object with camelCase keys
     * @param {string} [jsonDict.uuid] - Device UUID
     * @param {string} [jsonDict.devName] - Device name
     * @param {string} [jsonDict.deviceType] - Device type
     * @param {Array<Object>} [jsonDict.channels] - Raw channels array from API
     * @param {string} [jsonDict.fmwareVersion] - Firmware version
     * @param {string} [jsonDict.hdwareVersion] - Hardware version
     * @param {string} [jsonDict.domain] - MQTT domain
     * @param {string} [jsonDict.reservedDomain] - Reserved MQTT domain
     * @param {string} [jsonDict.subType] - Device sub-type
     * @param {number|Date|string} [jsonDict.bindTime] - Device bind timestamp
     * @param {string} [jsonDict.skillNumber] - Skill number
     * @param {string} [jsonDict.userDevIcon] - User device icon
     * @param {number} [jsonDict.iconType] - Icon type
     * @param {string} [jsonDict.region] - Device region
     * @param {string} [jsonDict.devIconId] - Device icon ID
     * @param {number} [jsonDict.onlineStatus] - Online status
     * @returns {HttpDeviceInfo} New HttpDeviceInfo instance
     */
    static fromDict(jsonDict) {
        if (!jsonDict || typeof jsonDict !== 'object') {
            throw new MerossErrorValidation('Device info dictionary is required', 'jsonDict');
        }

        // Object.create() prevents accidental instantiation via 'new' constructor,
        // enforcing the static factory pattern for consistent instance creation.
        const instance = Object.create(HttpDeviceInfo.prototype);
        instance.uuid = jsonDict.uuid;
        instance.devName = jsonDict.devName;
        instance.deviceType = jsonDict.deviceType;
        instance.channels = jsonDict.channels || [];
        instance.fmwareVersion = jsonDict.fmwareVersion;
        instance.hdwareVersion = jsonDict.hdwareVersion;
        instance.domain = jsonDict.domain;
        instance.reservedDomain = jsonDict.reservedDomain;
        instance.subType = jsonDict.subType;
        instance.skillNumber = jsonDict.skillNumber;
        instance.userDevIcon = jsonDict.userDevIcon;
        instance.iconType = jsonDict.iconType;
        instance.region = jsonDict.region;
        instance.devIconId = jsonDict.devIconId;

        // Validate and normalize onlineStatus to ensure it's a valid enum value.
        // The API may return non-numeric values or omit the field, so we default to UNKNOWN.
        if (jsonDict.onlineStatus !== undefined && jsonDict.onlineStatus !== null) {
            if (typeof jsonDict.onlineStatus === 'number') {
                instance.onlineStatus = jsonDict.onlineStatus;
            } else {
                instance.onlineStatus = OnlineStatus.UNKNOWN;
            }
        } else {
            instance.onlineStatus = OnlineStatus.UNKNOWN;
        }

        // Convert bindTime to a Date object for consistent time handling.
        // The API returns Unix timestamps in seconds, but we normalize to JavaScript Date
        // objects to avoid timezone and format inconsistencies in downstream code.
        if (jsonDict.bindTime !== undefined && jsonDict.bindTime !== null) {
            if (typeof jsonDict.bindTime === 'number') {
                instance.bindTime = new Date(jsonDict.bindTime * 1000);
            } else if (jsonDict.bindTime instanceof Date) {
                instance.bindTime = jsonDict.bindTime;
            } else if (typeof jsonDict.bindTime === 'string') {
                instance.bindTime = new Date(jsonDict.bindTime);
            } else {
                instance.bindTime = null;
            }
        } else {
            instance.bindTime = null;
        }

        return instance;
    }

    /**
     * Serializes the instance to a plain object dictionary.
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
     * Gets the MQTT server hostname for this device.
     *
     * Prefers domain over reservedDomain since it represents the active MQTT endpoint.
     * Falls back to reservedDomain if domain is unavailable, and to a default hostname
     * if neither is present.
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
     * Gets the MQTT server port for this device.
     *
     * Prefers domain over reservedDomain since it represents the active MQTT endpoint.
     * Falls back to reservedDomain if domain is unavailable, and to a default port
     * if neither is present.
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
