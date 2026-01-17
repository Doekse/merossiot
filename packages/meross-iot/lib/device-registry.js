'use strict';

const { UnknownDeviceTypeError } = require('./model/exception');

/**
 * Registry for managing Meross devices and subdevices.
 *
 * Maintains indexes for efficient device lookups across base devices and subdevices.
 * Base devices can be looked up by UUID, while internal IDs enable unified lookup
 * for both base devices and subdevices.
 *
 * Internal IDs unify device identification:
 * - Base devices: `#BASE:{uuid}`
 * - Subdevices: `#SUB:{hubUuid}:{subdeviceId}`
 *
 * @class DeviceRegistry
 */
class DeviceRegistry {
    /**
     * Creates a new device registry.
     *
     * Initializes two indexes: one by internal ID (supports all devices) and one by UUID
     * (base devices only). The UUID index enables O(1) lookups for base devices without
     * requiring internal ID generation.
     */
    constructor() {
        this._devicesByInternalId = new Map();
        this._devicesByUuid = new Map();
    }

    /**
     * Generates an internal ID for a device or subdevice.
     *
     * Internal IDs provide a unified identifier format that works for both base devices
     * and subdevices, enabling consistent lookup operations regardless of device type.
     * The prefix distinguishes device types to prevent ID collisions.
     *
     * @param {string} uuid - Device UUID (for base devices) or hub UUID (for subdevices)
     * @param {boolean} [isSubdevice=false] - Whether this is a subdevice
     * @param {string} [hubUuid] - Hub UUID (required if isSubdevice is true)
     * @param {string} [subdeviceId] - Subdevice ID (required if isSubdevice is true)
     * @returns {string} Internal ID string
     */
    static generateInternalId(uuid, isSubdevice = false, hubUuid = null, subdeviceId = null) {
        if (isSubdevice) {
            return `#SUB:${hubUuid}:${subdeviceId}`;
        }
        return `#BASE:${uuid}`;
    }

    /**
     * Registers a device in the registry.
     *
     * Prevents duplicate registrations by checking for existing internal ID.
     * Base devices are indexed by both internal ID and UUID to support both lookup methods.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance to register
     * @returns {void}
     */
    registerDevice(device) {
        const internalId = this._getInternalId(device);

        if (this._devicesByInternalId.has(internalId)) {
            return;
        }

        this._devicesByInternalId.set(internalId, device);

        const uuid = device.uuid;
        if (uuid && !this._isSubdevice(device)) {
            this._devicesByUuid.set(uuid, device);
        }
    }

    /**
     * Removes a device from the registry.
     *
     * Removes the device from all indexes to maintain consistency. Base devices are removed
     * from both the internal ID and UUID indexes, while subdevices are only in the internal ID index.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance to remove
     * @returns {void}
     */
    removeDevice(device) {
        const internalId = this._getInternalId(device);
        const uuid = device.uuid;

        this._devicesByInternalId.delete(internalId);

        if (uuid && !this._isSubdevice(device)) {
            this._devicesByUuid.delete(uuid);
        }
    }

    /**
     * Unified method to get a device by identifier.
     *
     * Supports both base devices (by UUID string) and subdevices (by object with hubUuid and id).
     * Internally converts the identifier to an internal ID format and performs the lookup.
     *
     * @param {string|Object} identifier - Device identifier
     * @param {string} identifier - For base devices: device UUID string (e.g., 'device-uuid')
     * @param {Object} identifier - For subdevices: object with hubUuid and id properties
     * @param {string} identifier.hubUuid - Hub UUID that the subdevice belongs to
     * @param {string} identifier.id - Subdevice ID
     * @returns {MerossDevice|MerossHubDevice|MerossSubDevice|null} Device instance, or null if not found
     * @example
     * // Get base device by UUID
     * const device = registry.get('device-uuid');
     *
     * @example
     * // Get subdevice by hub UUID and subdevice ID
     * const subdevice = registry.get({ hubUuid: 'hub-uuid', id: 'subdevice-id' });
     */
    get(identifier) {
        if (typeof identifier === 'string') {
            // Base device lookup by UUID
            return this._devicesByUuid.get(identifier) || null;
        } else if (identifier && typeof identifier === 'object') {
            // Subdevice lookup by hubUuid and id
            const { hubUuid, id } = identifier;
            if (hubUuid && id) {
                const internalId = DeviceRegistry.generateInternalId(hubUuid, true, hubUuid, id);
                return this._devicesByInternalId.get(internalId) || null;
            }
        }
        return null;
    }

    /**
     * Gets all registered devices.
     *
     * Returns both base devices and subdevices from the internal ID index, which contains
     * all registered devices regardless of type.
     *
     * @returns {Array<MerossDevice|MerossHubDevice|MerossSubDevice>} Array of all registered devices
     */
    list() {
        return Array.from(this._devicesByInternalId.values());
    }

    /**
     * Finds devices matching the specified filters.
     *
     * This method supports multiple filter criteria that can be combined.
     * All filters are applied as AND conditions (device must match all specified filters).
     *
     * @param {Object} [filters={}] - Filter criteria
     * @param {Array<string>} [filters.deviceUuids] - Array of device UUIDs to match
     * @param {Array<string>} [filters.internalIds] - Array of internal IDs to match
     * @param {string} [filters.deviceType] - Device type to match (e.g., "mss310")
     * @param {string} [filters.deviceName] - Device name to match
     * @param {number} [filters.onlineStatus] - Online status to match (0 = offline, 1 = online)
     * @param {string|Array<string>|Function} [filters.deviceClass] - Device capability/class filter.
     *                                                                  Can be:
     *                                                                  - String: 'light', 'thermostat', 'toggle', 'rollerShutter', 'garageDoor', 'diffuser', 'spray', 'hub'
     *                                                                  - Array of strings: matches if device has any of the capabilities
     *                                                                  - Function: custom filter function that receives device and returns boolean
     * @returns {Array<MerossDevice|MerossHubDevice|MerossSubDevice>} Array of matching devices
     */
    find(filters = {}) {
        let devices = this.list();

        if (filters.deviceUuids && Array.isArray(filters.deviceUuids) && filters.deviceUuids.length > 0) {
            const uuidSet = new Set(filters.deviceUuids);
            devices = devices.filter(device => {
                const uuid = device.uuid;
                return uuidSet.has(uuid);
            });
        }

        if (filters.internalIds && Array.isArray(filters.internalIds) && filters.internalIds.length > 0) {
            const idSet = new Set(filters.internalIds);
            devices = devices.filter(device => {
                return idSet.has(this._getInternalId(device));
            });
        }

        if (filters.deviceType) {
            devices = devices.filter(device => {
                const deviceType = device.deviceType;
                return deviceType === filters.deviceType;
            });
        }

        if (filters.deviceName) {
            devices = devices.filter(device => {
                const name = device.name;
                return name === filters.deviceName;
            });
        }

        if (filters.onlineStatus !== undefined) {
            devices = devices.filter(device => {
                const status = device.onlineStatus || device._onlineStatus;
                return status === filters.onlineStatus;
            });
        }

        if (filters.deviceClass) {
            const capabilityChecks = Array.isArray(filters.deviceClass)
                ? filters.deviceClass
                : [filters.deviceClass];

            devices = devices.filter(device => {
                return capabilityChecks.some(check => {
                    if (typeof check === 'function') {
                        return check(device);
                    } else if (typeof check === 'string') {
                        return this._hasCapability(device, check);
                    }
                    return false;
                });
            });
        }

        return devices;
    }

    /**
     * Checks if a device has a specific capability.
     *
     * Determines capability by checking for the presence of device-specific methods or
     * constructor names, rather than relying on device type strings which may vary.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device to check
     * @param {string} capability - Capability name (e.g., 'light', 'thermostat', 'toggle')
     * @returns {boolean} True if device has the capability, false otherwise
     * @private
     */
    _hasCapability(device, capability) {
        const capabilityMap = {
            'light': () => typeof device.getLightState === 'function' ||
                         typeof device.getCachedLightState === 'function',
            'thermostat': () => typeof device.getThermostatMode === 'function' ||
                             typeof device.getCachedThermostatState === 'function',
            'toggle': () => typeof device.setToggle === 'function' ||
                          typeof device.setToggleX === 'function',
            'rollerShutter': () => typeof device.getRollerShutterState === 'function',
            'garageDoor': () => typeof device.getGarageDoorState === 'function',
            'diffuser': () => typeof device.getDiffuserLightState === 'function',
            'spray': () => typeof device.getSprayState === 'function',
            'hub': () => typeof device.getSubdevices === 'function'
        };

        const check = capabilityMap[capability.toLowerCase()];
        return check ? check() : false;
    }

    /**
     * Gets or generates the internal ID for a device.
     *
     * Caches the generated ID on the device to avoid repeated computation. Handles
     * multiple property access patterns for subdevices to support different device implementations.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance
     * @returns {string} Internal ID string
     * @throws {UnknownDeviceTypeError} If required identifiers are missing
     * @private
     */
    _getInternalId(device) {
        if (device._internalId) {
            return device._internalId;
        }

        if (this._isSubdevice(device)) {
            const hubUuid = device.hub?.uuid || device._hub?.uuid || device.hub?.dev?.uuid || device._hub?.dev?.uuid;
            const subdeviceId = device.subdeviceId || device._subdeviceId;

            if (!hubUuid || !subdeviceId) {
                throw new UnknownDeviceTypeError('Cannot generate internal ID for subdevice: missing hub UUID or subdevice ID');
            }

            const internalId = DeviceRegistry.generateInternalId(hubUuid, true, hubUuid, subdeviceId);
            device._internalId = internalId;
            return internalId;
        }

        const uuid = device.uuid;
        if (!uuid) {
            throw new UnknownDeviceTypeError('Cannot generate internal ID: device missing UUID');
        }

        const internalId = DeviceRegistry.generateInternalId(uuid);
        device._internalId = internalId;
        return internalId;
    }

    /**
     * Determines if a device is a subdevice.
     *
     * Checks for the presence of subdevice-specific properties rather than relying on
     * device type, as property names may vary between implementations.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device to check
     * @returns {boolean} True if device is a subdevice, false otherwise
     * @private
     */
    _isSubdevice(device) {
        return !!(device.subdeviceId || device._subdeviceId) && !!(device.hub || device._hub);
    }

    /**
     * Clears all devices from the registry.
     *
     * Disconnects all devices before removal to ensure proper cleanup of connections
     * and event listeners. Both indexes are cleared to maintain consistency.
     *
     * @returns {void}
     */
    clear() {
        const devices = this.list();
        devices.forEach(device => {
            if (device.disconnect) {
                device.disconnect();
            }
        });
        this._devicesByInternalId.clear();
        this._devicesByUuid.clear();
    }

    /**
     * Gets the total number of devices registered (including subdevices).
     *
     * @returns {number} Total number of registered devices
     */
    get size() {
        return this._devicesByInternalId.size;
    }
}

module.exports = DeviceRegistry;
