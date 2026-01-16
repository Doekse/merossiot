'use strict';

/**
 * Represents hardware information from device binding data.
 *
 * Encapsulates hardware metadata from device binding notifications. The Meross API
 * returns this data in camelCase format, which is used directly without conversion.
 *
 * @class
 * @example
 * // Use fromDict() to create instances
 * const hardwareInfo = HardwareInfo.fromDict({
 *     version: '1.0.0',
 *     uuid: '12345',
 *     type: 'mss310',
 *     subType: 'v1',
 *     macAddress: 'AA:BB:CC:DD:EE:FF',
 *     chipType: 'ESP32'
 * });
 */
class HardwareInfo {
    /**
     * Creates a HardwareInfo instance from a dictionary object.
     *
     * The Meross API returns hardware data in camelCase format, which this method accepts
     * directly. Properties are assigned as-is without format conversion.
     *
     * @static
     * @param {Object} jsonDict - Raw API response object with camelCase keys
     * @param {string} [jsonDict.version] - Hardware version
     * @param {string} [jsonDict.uuid] - Device UUID
     * @param {string} [jsonDict.type] - Hardware type
     * @param {string} [jsonDict.subType] - Hardware sub-type
     * @param {string} [jsonDict.macAddress] - MAC address
     * @param {string} [jsonDict.chipType] - Chip type
     * @returns {HardwareInfo} New HardwareInfo instance
     */
    static fromDict(jsonDict) {
        if (!jsonDict || typeof jsonDict !== 'object') {
            return null;
        }

        // Object.create() prevents accidental instantiation via 'new' constructor,
        // enforcing the static factory pattern for consistent instance creation.
        const instance = Object.create(HardwareInfo.prototype);
        instance.version = jsonDict.version || null;
        instance.uuid = jsonDict.uuid || null;
        instance.type = jsonDict.type || null;
        instance.subType = jsonDict.subType || null;
        instance.macAddress = jsonDict.macAddress || null;
        instance.chipType = jsonDict.chipType || null;

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
 * Encapsulates firmware metadata from device binding notifications. The Meross API
 * returns this data in camelCase format, which is used directly without conversion.
 *
 * @class
 * @example
 * // Use fromDict() to create instances
 * const firmwareInfo = FirmwareInfo.fromDict({
 *     wifiMac: 'AA:BB:CC:DD:EE:FF',
 *     version: '2.0.0',
 *     userId: 'user123',
 *     server: 'mqtt.meross.com',
 *     port: 443,
 *     innerIp: '192.168.1.100',
 *     compileTime: '2024-01-01'
 * });
 */
class FirmwareInfo {
    /**
     * Creates a FirmwareInfo instance from a dictionary object.
     *
     * The Meross API returns firmware data in camelCase format, which this method accepts
     * directly. Properties are assigned as-is without format conversion.
     *
     * @static
     * @param {Object} jsonDict - Raw API response object with camelCase keys
     * @param {string} [jsonDict.wifiMac] - WiFi MAC address
     * @param {string} [jsonDict.version] - Firmware version
     * @param {string} [jsonDict.userId] - User ID
     * @param {string} [jsonDict.server] - Server address
     * @param {number} [jsonDict.port] - Port number
     * @param {string} [jsonDict.innerIp] - Inner IP address
     * @param {string} [jsonDict.compileTime] - Compile time
     * @returns {FirmwareInfo} New FirmwareInfo instance
     */
    static fromDict(jsonDict) {
        if (!jsonDict || typeof jsonDict !== 'object') {
            return null;
        }

        // Object.create() prevents accidental instantiation via 'new' constructor,
        // enforcing the static factory pattern for consistent instance creation.
        const instance = Object.create(FirmwareInfo.prototype);
        instance.wifiMac = jsonDict.wifiMac || null;
        instance.version = jsonDict.version || null;
        instance.userId = jsonDict.userId || null;
        instance.server = jsonDict.server || null;
        instance.port = jsonDict.port || null;
        instance.innerIp = jsonDict.innerIp || null;
        instance.compileTime = jsonDict.compileTime || null;

        return instance;
    }

    /**
     * Serializes the instance to a plain object dictionary.
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
 * Encapsulates time metadata from device binding notifications. The Meross API
 * returns this data in camelCase format, which is used directly without conversion.
 *
 * @class
 * @example
 * // Use fromDict() to create instances
 * const timeInfo = TimeInfo.fromDict({
 *     timezone: 'America/New_York',
 *     timestamp: 1234567890,
 *     timeRule: 'DST'
 * });
 */
class TimeInfo {
    /**
     * Creates a TimeInfo instance from a dictionary object.
     *
     * The Meross API returns time data in camelCase format, which this method accepts
     * directly. Properties are assigned as-is without format conversion.
     *
     * @static
     * @param {Object} jsonDict - Raw API response object with camelCase keys
     * @param {string} [jsonDict.timezone] - Timezone string
     * @param {number} [jsonDict.timestamp] - Unix timestamp
     * @param {string} [jsonDict.timeRule] - Time rule
     * @returns {TimeInfo} New TimeInfo instance
     */
    static fromDict(jsonDict) {
        if (!jsonDict || typeof jsonDict !== 'object') {
            return null;
        }

        // Object.create() prevents accidental instantiation via 'new' constructor,
        // enforcing the static factory pattern for consistent instance creation.
        const instance = Object.create(TimeInfo.prototype);
        instance.timezone = jsonDict.timezone || null;
        instance.timestamp = jsonDict.timestamp || null;
        instance.timeRule = jsonDict.timeRule || null;

        return instance;
    }

    /**
     * Serializes the instance to a plain object dictionary.
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
