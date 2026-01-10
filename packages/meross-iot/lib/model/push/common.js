'use strict';

/**
 * Represents hardware information from device binding data.
 *
 * Encapsulates hardware metadata from device binding notifications. The API may return
 * properties in either camelCase or snake_case format, so this class normalizes them
 * to camelCase for consistent access.
 *
 * @class
 * @example
 * // Use fromDict() to create instances
 * const hardwareInfo = HardwareInfo.fromDict({
 *     version: '1.0.0',
 *     uuid: '12345',
 *     type: 'mss310',
 *     sub_type: 'v1',
 *     mac_address: 'AA:BB:CC:DD:EE:FF',
 *     chip_type: 'ESP32'
 * });
 */
class HardwareInfo {
    /**
     * Creates a HardwareInfo instance from a dictionary object.
     *
     * Normalizes property names from both camelCase and snake_case formats to ensure
     * consistent access regardless of API response format. Uses Object.create() instead
     * of a constructor to allow static factory pattern.
     *
     * @static
     * @param {Object} jsonDict - Raw API response object with any key format
     * @param {string} [jsonDict.version] - Hardware version
     * @param {string} [jsonDict.uuid] - Device UUID
     * @param {string} [jsonDict.type] - Hardware type
     * @param {string} [jsonDict.subType] - Hardware sub-type (camelCase)
     * @param {string} [jsonDict.sub_type] - Hardware sub-type (snake_case)
     * @param {string} [jsonDict.macAddress] - MAC address (camelCase)
     * @param {string} [jsonDict.mac_address] - MAC address (snake_case)
     * @param {string} [jsonDict.chipType] - Chip type (camelCase)
     * @param {string} [jsonDict.chip_type] - Chip type (snake_case)
     * @param {string} [jsonDict.chip_time] - Chip time (snake_case, mapped to chipType)
     * @returns {HardwareInfo} New HardwareInfo instance
     */
    static fromDict(jsonDict) {
        if (!jsonDict || typeof jsonDict !== 'object') {
            return null;
        }

        // Map camelCase keys to their possible API variants (camelCase, snake_case)
        const propertyMappings = {
            version: ['version'],
            uuid: ['uuid'],
            type: ['type'],
            subType: ['subType', 'sub_type'],
            macAddress: ['macAddress', 'mac_address'],
            chipType: ['chipType', 'chip_type', 'chip_time']
        };

        // Check each mapping in priority order to find the first non-null value
        const normalized = {};
        for (const [camelKey, alternatives] of Object.entries(propertyMappings)) {
            for (const key of alternatives) {
                if (jsonDict[key] !== null && jsonDict[key] !== undefined) {
                    normalized[camelKey] = jsonDict[key];
                    break;
                }
            }
        }

        // Use Object.create() to avoid constructor, allowing static factory pattern
        const instance = Object.create(HardwareInfo.prototype);
        instance.version = normalized.version || null;
        instance.uuid = normalized.uuid || null;
        instance.type = normalized.type || null;
        instance.subType = normalized.subType || null;
        instance.macAddress = normalized.macAddress || null;
        instance.chipType = normalized.chipType || null;

        return instance;
    }

    /**
     * Converts the instance to a plain object dictionary with camelCase keys.
     *
     * @returns {Object} Plain object with camelCase property keys
     */
    toDict() {
        return {
            version: this.version,
            uuid: this.uuid,
            type: this.type,
            subType: this.subType,
            macAddress: this.macAddress,
            chipType: this.chipType
        };
    }
}

/**
 * Represents firmware information from device binding data.
 *
 * Encapsulates firmware metadata from device binding notifications. The API may return
 * properties in either camelCase or snake_case format, so this class normalizes them
 * to camelCase for consistent access.
 *
 * @class
 * @example
 * // Use fromDict() to create instances
 * const firmwareInfo = FirmwareInfo.fromDict({
 *     wifi_mac: 'AA:BB:CC:DD:EE:FF',
 *     version: '2.0.0',
 *     user_id: 'user123',
 *     server: 'mqtt.meross.com',
 *     port: 443,
 *     inner_ip: '192.168.1.100',
 *     compile_time: '2024-01-01'
 * });
 */
class FirmwareInfo {
    /**
     * Creates a FirmwareInfo instance from a dictionary object.
     *
     * Normalizes property names from both camelCase and snake_case formats to ensure
     * consistent access regardless of API response format. Uses Object.create() instead
     * of a constructor to allow static factory pattern.
     *
     * @static
     * @param {Object} jsonDict - Raw API response object with any key format
     * @param {string} [jsonDict.wifiMac] - WiFi MAC address (camelCase)
     * @param {string} [jsonDict.wifi_mac] - WiFi MAC address (snake_case)
     * @param {string} [jsonDict.version] - Firmware version
     * @param {string} [jsonDict.userId] - User ID (camelCase)
     * @param {string} [jsonDict.user_id] - User ID (snake_case)
     * @param {string} [jsonDict.server] - Server address
     * @param {number} [jsonDict.port] - Port number
     * @param {string} [jsonDict.innerIp] - Inner IP address (camelCase)
     * @param {string} [jsonDict.inner_ip] - Inner IP address (snake_case)
     * @param {string} [jsonDict.compileTime] - Compile time (camelCase)
     * @param {string} [jsonDict.compile_time] - Compile time (snake_case)
     * @returns {FirmwareInfo} New FirmwareInfo instance
     */
    static fromDict(jsonDict) {
        if (!jsonDict || typeof jsonDict !== 'object') {
            return null;
        }

        // Map camelCase keys to their possible API variants (camelCase, snake_case)
        const propertyMappings = {
            wifiMac: ['wifiMac', 'wifi_mac'],
            version: ['version'],
            userId: ['userId', 'user_id'],
            server: ['server'],
            port: ['port'],
            innerIp: ['innerIp', 'inner_ip'],
            compileTime: ['compileTime', 'compile_time']
        };

        // Check each mapping in priority order to find the first non-null value
        const normalized = {};
        for (const [camelKey, alternatives] of Object.entries(propertyMappings)) {
            for (const key of alternatives) {
                if (jsonDict[key] !== null && jsonDict[key] !== undefined) {
                    normalized[camelKey] = jsonDict[key];
                    break;
                }
            }
        }

        // Use Object.create() to avoid constructor, allowing static factory pattern
        const instance = Object.create(FirmwareInfo.prototype);
        instance.wifiMac = normalized.wifiMac || null;
        instance.version = normalized.version || null;
        instance.userId = normalized.userId || null;
        instance.server = normalized.server || null;
        instance.port = normalized.port || null;
        instance.innerIp = normalized.innerIp || null;
        instance.compileTime = normalized.compileTime || null;

        return instance;
    }

    /**
     * Converts the instance to a plain object dictionary with camelCase keys.
     *
     * @returns {Object} Plain object with camelCase property keys
     */
    toDict() {
        return {
            wifiMac: this.wifiMac,
            version: this.version,
            userId: this.userId,
            server: this.server,
            port: this.port,
            innerIp: this.innerIp,
            compileTime: this.compileTime
        };
    }
}

/**
 * Represents time information from device binding data.
 *
 * Encapsulates time metadata from device binding notifications. The API may return
 * properties in either camelCase or snake_case format, so this class normalizes them
 * to camelCase for consistent access.
 *
 * @class
 * @example
 * // Use fromDict() to create instances
 * const timeInfo = TimeInfo.fromDict({
 *     timezone: 'America/New_York',
 *     timestamp: 1234567890,
 *     time_rule: 'DST'
 * });
 */
class TimeInfo {
    /**
     * Creates a TimeInfo instance from a dictionary object.
     *
     * Normalizes property names from both camelCase and snake_case formats to ensure
     * consistent access regardless of API response format. Uses Object.create() instead
     * of a constructor to allow static factory pattern.
     *
     * @static
     * @param {Object} jsonDict - Raw API response object with any key format
     * @param {string} [jsonDict.timezone] - Timezone string
     * @param {number} [jsonDict.timestamp] - Unix timestamp
     * @param {string} [jsonDict.timeRule] - Time rule (camelCase)
     * @param {string} [jsonDict.time_rule] - Time rule (snake_case)
     * @returns {TimeInfo} New TimeInfo instance
     */
    static fromDict(jsonDict) {
        if (!jsonDict || typeof jsonDict !== 'object') {
            return null;
        }

        // Map camelCase keys to their possible API variants (camelCase, snake_case)
        const propertyMappings = {
            timezone: ['timezone'],
            timestamp: ['timestamp'],
            timeRule: ['timeRule', 'time_rule']
        };

        // Check each mapping in priority order to find the first non-null value
        const normalized = {};
        for (const [camelKey, alternatives] of Object.entries(propertyMappings)) {
            for (const key of alternatives) {
                if (jsonDict[key] !== null && jsonDict[key] !== undefined) {
                    normalized[camelKey] = jsonDict[key];
                    break;
                }
            }
        }

        // Use Object.create() to avoid constructor, allowing static factory pattern
        const instance = Object.create(TimeInfo.prototype);
        instance.timezone = normalized.timezone || null;
        instance.timestamp = normalized.timestamp || null;
        instance.timeRule = normalized.timeRule || null;

        return instance;
    }

    /**
     * Converts the instance to a plain object dictionary with camelCase keys.
     *
     * @returns {Object} Plain object with camelCase property keys
     */
    toDict() {
        return {
            timezone: this.timezone,
            timestamp: this.timestamp,
            timeRule: this.timeRule
        };
    }
}

module.exports = {
    HardwareInfo,
    FirmwareInfo,
    TimeInfo
};
