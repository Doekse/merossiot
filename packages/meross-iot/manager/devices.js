'use strict';

const Manager = require('./base');
const DeviceRegistry = require('../lib/device/registry');
const { MerossDeviceError } = require('../lib/exception');

/**
 * Manages device discovery, initialization, and lifecycle.
 *
 * Keeps registry and enrollment logic separate from transport and MQTT so hub
 * wiring, subdevice ordering, and removal cleanup can evolve independently.
 *
 * @class ManagerDevices
 * @extends Manager
 */
class ManagerDevices extends Manager {
    /**
     * @param {import('../lib/meross')} meross - Root Meross instance
     */
    constructor(meross) {
        super(meross);
        this._registry = new DeviceRegistry();
    }

    /**
     * Disconnects all devices and clears the registry.
     *
     * Returns cleared devices so callers can drain transport queues before MQTT teardown.
     *
     * @returns {Array} Devices that were cleared
     */
    clear() {
        const devices = this._registry.list();
        this._registry.clear();
        return devices;
    }

    /**
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device
     */
    register(device) {
        this._registry.registerDevice(device);
    }

    /**
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device
     */
    removeFromRegistry(device) {
        this._registry.removeDevice(device);
    }

    /**
     * Gets a device by UUID or subdevice identifier.
     *
     * @param {string|Object} identifier - Device UUID or subdevice identifier
     * @returns {MerossDevice|MerossHubDevice|MerossSubDevice|null} Device instance or null if not found
     */
    get(identifier) {
        return this._registry.get(identifier);
    }

    /**
     * Lists all registered devices.
     *
     * @returns {Array<MerossDevice|MerossHubDevice|MerossSubDevice>} Array of device instances
     */
    list() {
        return this._registry.list();
    }

    /**
     * Finds devices matching the provided filters.
     *
     * @param {Object} filters - Filter criteria
     * @returns {Array<MerossDevice|MerossHubDevice|MerossSubDevice>} Array of matching device instances
     */
    find(filters) {
        return this._registry.find(filters);
    }

    /**
     * Discovers available base devices without initializing them.
     *
     * Fetches the device list from the cloud API and applies optional filters. This method
     * does not initialize any devices; it only returns device metadata for use in device
     * selection UIs where users choose which devices to add.
     *
     * @param {Object} [options] - Optional filter options
     * @param {Array<string>} [options.deviceTypes] - Array of device types to filter (e.g., ['mss315', 'mss425'])
     * @param {boolean} [options.onlineOnly=true] - If true, only return online devices (default: true)
     * @param {boolean} [options.excludeHubs=false] - If true, exclude hub devices (default: false)
     * @returns {Promise<Array>} Promise that resolves with array of device info objects from HTTP API
     * @throws {MerossApiError} If API request fails
     * @throws {MerossAuthError} If authentication token has expired
     * @example
     * // Get all smart plugs
     * const smartPlugs = await manager.devices.discover({ deviceTypes: ['mss315', 'mss425'] });
     *
     * // Get all online devices excluding hubs
     * const devices = await manager.devices.discover({ excludeHubs: true });
     */
    async discover(options = {}) {
        const deviceList = await this.meross.auth.client.getDevices();

        if (!deviceList || !Array.isArray(deviceList)) {
            return [];
        }

        const { OnlineStatus } = require('../lib/enums');

        let filteredDevices = deviceList;

        if (options.onlineOnly !== false) {
            filteredDevices = filteredDevices.filter(dev => dev.onlineStatus === OnlineStatus.ONLINE);
        }

        if (options.deviceTypes && Array.isArray(options.deviceTypes) && options.deviceTypes.length > 0) {
            const deviceTypeSet = new Set(options.deviceTypes.map(t => t.toLowerCase()));
            filteredDevices = filteredDevices.filter(dev => {
                const deviceType = (dev.deviceType || '').toLowerCase();
                return deviceTypeSet.has(deviceType);
            });
        }

        if (options.excludeHubs === true) {
            filteredDevices = filteredDevices.filter(dev => !this._isHubDeviceType(dev));
        }

        return filteredDevices;
    }

    /**
     * Discovers available subdevices without initializing devices.
     *
     * Fetches the device list, identifies hub devices, and retrieves subdevice metadata
     * for each hub. This method does not initialize any devices; it only returns subdevice
     * metadata for use in device selection UIs where users choose which subdevices to add.
     *
     * @param {Object} [options] - Optional filter options
     * @param {Array<string>} [options.hubUuids] - Array of hub UUIDs to filter (if not provided, discover from all hubs)
     * @param {string} [options.subdeviceType] - Subdevice type filter (e.g., 'ma151' for smoke alarms, case-insensitive)
     * @param {boolean} [options.onlineOnly=true] - If true, only return subdevices from online hubs (default: true)
     * @returns {Promise<Array>} Promise that resolves with array of subdevice info objects with hub context
     * @throws {MerossApiError} If API request fails
     * @throws {MerossAuthError} If authentication token has expired
     * @example
     * // Get all smoke alarms
     * const smokeAlarms = await manager.devices.discoverSubdevices({ subdeviceType: 'ma151' });
     *
     * // Get all subdevices from specific hubs
     * const subdevices = await manager.devices.discoverSubdevices({ hubUuids: ['hub-uuid-1', 'hub-uuid-2'] });
     */
    async discoverSubdevices(options = {}) {
        const deviceList = await this.meross.auth.client.getDevices();

        if (!deviceList || !Array.isArray(deviceList)) {
            return [];
        }

        const hubDevices = this._filterHubDevices(deviceList, options);
        const subdeviceTypeFilter = options.subdeviceType
            ? options.subdeviceType.toLowerCase()
            : null;

        const allSubdevices = [];
        for (const hubDevice of hubDevices) {
            const subdevices = await this._fetchAndProcessSubdevices(hubDevice, subdeviceTypeFilter);
            allSubdevices.push(...subdevices);
        }

        return allSubdevices;
    }

    /**
     * Filters device list to hub devices based on options.
     *
     * Applies filtering criteria including hub device type detection, online status,
     * and hub UUID filtering. Returns filtered array of hub devices.
     *
     * @param {Array} deviceList - Array of device info objects from HTTP API
     * @param {Object} options - Filter options
     * @param {boolean} [options.onlineOnly=true] - If true, only return online devices
     * @param {Array<string>} [options.hubUuids] - Array of hub UUIDs to filter
     * @returns {Array} Filtered array of hub device info objects
     * @private
     */
    _filterHubDevices(deviceList, options) {
        const { OnlineStatus } = require('../lib/enums');

        let hubDevices = deviceList.filter(dev => this._isHubDeviceType(dev));

        if (options.onlineOnly !== false) {
            hubDevices = hubDevices.filter(dev => dev.onlineStatus === OnlineStatus.ONLINE);
        }

        if (options.hubUuids && Array.isArray(options.hubUuids) && options.hubUuids.length > 0) {
            const hubUuidSet = new Set(options.hubUuids);
            hubDevices = hubDevices.filter(dev => hubUuidSet.has(dev.uuid));
        }

        return hubDevices;
    }

    /**
     * Creates enriched subdevice object with hub context.
     *
     * Merges subdevice info with hub metadata for UI display purposes.
     * Returns a combined object with both subdevice and hub information.
     *
     * @param {Object} hubDevice - Hub device info object
     * @param {Object} subdeviceInfo - Subdevice info object from HTTP API
     * @returns {Object} Enriched subdevice object with hub context
     * @private
     */
    _enrichSubdeviceInfo(hubDevice, subdeviceInfo) {
        return {
            hubUuid: hubDevice.uuid,
            hubName: hubDevice.devName || hubDevice.name,
            hubDeviceType: hubDevice.deviceType,
            subdeviceId: subdeviceInfo.subDeviceId || subdeviceInfo.id,
            subdeviceType: subdeviceInfo.subDeviceType || subdeviceInfo.type,
            subdeviceName: subdeviceInfo.subDeviceName || subdeviceInfo.name,
            subdeviceIconId: subdeviceInfo.subDeviceIconId,
            subdeviceSubType: subdeviceInfo.subDeviceSubType,
            subdeviceVendor: subdeviceInfo.subDeviceVendor,
            trueId: subdeviceInfo.trueId,
            bindTime: subdeviceInfo.bindTime,
            iconType: subdeviceInfo.iconType,
            ...subdeviceInfo
        };
    }

    /**
     * Fetches subdevices from API and processes them with error handling.
     *
     * Retrieves subdevice list for a hub and filters/enriches each subdevice.
     * Handles errors gracefully by logging and continuing with other hubs.
     *
     * @param {Object} hubDevice - Hub device info object
     * @param {string|null} subdeviceTypeFilter - Optional subdevice type filter (lowercase)
     * @returns {Promise<Array>} Promise that resolves with array of enriched subdevice objects
     * @private
     */
    async _fetchAndProcessSubdevices(hubDevice, subdeviceTypeFilter) {
        const subdevices = [];

        try {
            const subDeviceList = await this.meross.auth.client.getSubDevices(hubDevice.uuid);
            if (subDeviceList && Array.isArray(subDeviceList)) {
                for (const subdeviceInfo of subDeviceList) {
                    if (subdeviceTypeFilter) {
                        const subdeviceType = (subdeviceInfo.subDeviceType || '').toLowerCase();
                        if (subdeviceType !== subdeviceTypeFilter) {
                            continue;
                        }
                    }

                    const enrichedSubdevice = this._enrichSubdeviceInfo(hubDevice, subdeviceInfo);
                    subdevices.push(enrichedSubdevice);
                }
            }
        } catch (err) {
            if (this.meross.options.logger) {
                this.meross.options.logger(`Error fetching subdevices for hub ${hubDevice.uuid}: ${err.message}`);
            }
        }

        return subdevices;
    }

    /**
     * Initializes devices from the Meross cloud.
     *
     * Fetches the device list from the cloud API, applies optional filters, establishes
     * MQTT connections per domain, and enrolls devices. When a UUID filter is provided,
     * only matching devices are initialized, enabling selective device management for
     * platforms that allow users to choose which devices to add.
     *
     * @param {Object} [options] - Optional filter options
     * @param {Array<string>} [options.uuids] - Array of device UUIDs to filter. If provided, only devices with matching UUIDs will be initialized. If not provided, all online devices will be initialized.
     * @returns {Promise<number>} Promise that resolves with the number of devices initialized
     * @throws {MerossApiError} If API request fails
     * @throws {MerossAuthError} If authentication token has expired
     * @example
     * // Initialize all devices
     * const count = await manager.devices.initialize();
     *
     * // Initialize only specific devices
     * const count = await manager.devices.initialize({ uuids: ['uuid1', 'uuid2'] });
     */
    async initialize(options) {
        const deviceList = await this._getValidatedDeviceList();

        if (deviceList.length === 0) {
            return 0;
        }

        const { OnlineStatus } = require('../lib/enums');

        let devicesToInitialize = deviceList.filter(dev => dev.onlineStatus === OnlineStatus.ONLINE);

        if (options && options.uuids && Array.isArray(options.uuids) && options.uuids.length > 0) {
            const uuidSet = new Set(options.uuids);
            const filteredDevices = devicesToInitialize.filter(dev => uuidSet.has(dev.uuid));

            const foundUuids = new Set(filteredDevices.map(dev => dev.uuid));
            const missingUuids = options.uuids.filter(uuid => !foundUuids.has(uuid));
            if (missingUuids.length > 0 && this.meross.options.logger) {
                this.meross.options.logger(`Warning: Some requested device UUIDs were not found: ${missingUuids.join(', ')}`);
            }

            devicesToInitialize = filteredDevices;
        }

        // Group devices by domain to establish one MQTT connection per domain
        const devicesByDomain = new Map();
        devicesToInitialize.forEach(dev => {
            const domain = dev.domain || this.meross.auth.mqttDomain;
            if (!devicesByDomain.has(domain)) {
                devicesByDomain.set(domain, []);
            }
            devicesByDomain.get(domain).push(dev);
        });

        for (const [domain, devices] of devicesByDomain) {
            if (devices.length > 0) {
                const firstDevice = devices[0];
                await this.meross.mqtt.init({
                    uuid: firstDevice.uuid,
                    domain
                });
            }
        }

        const devicePromises = devicesToInitialize.map(dev => this._enrollDevice(dev));
        const devices = (await Promise.all(devicePromises)).filter(d => d !== null);

        // Enroll subdevices after hubs; subdevices require parent hub abilities
        for (const device of devices) {
            await this._enrollSubdevicesIfHub(device);
        }

        return devices.length;
    }

    /**
     * Initializes a single device by UUID or subdevice by identifier.
     *
     * Supports initializing either a base device (by UUID string) or a subdevice
     * (by object with hubUuid and id). For subdevices, the parent hub is automatically
     * initialized if not already initialized, since subdevices depend on their hub
     * for communication and capability detection.
     *
     * @param {string|Object} identifier - Device identifier
     * @param {string} identifier - For base devices: device UUID string (e.g., 'device-uuid')
     * @param {Object} identifier - For subdevices: object with hubUuid and id properties
     * @param {string} identifier.hubUuid - Hub UUID that the subdevice belongs to
     * @param {string} identifier.id - Subdevice ID
     * @returns {Promise<MerossDevice|MerossHubDevice|MerossSubDevice|null>} Device instance, or null if initialization fails
     * @throws {MerossDeviceError} If device UUID not found or subdevice identifier is invalid
     * @example
     * // Initialize a base device
     * const device = await manager.devices.initializeDevice('device-uuid');
     *
     * // Initialize a subdevice
     * const subdevice = await manager.devices.initializeDevice({ hubUuid: 'hub-uuid', id: 'subdevice-id' });
     */
    async initializeDevice(identifier) {
        if (typeof identifier === 'string') {
            return await this._initializeBaseDevice(identifier);
        }

        if (identifier && typeof identifier === 'object' && identifier.hubUuid && identifier.id) {
            return await this._initializeSubdevice(identifier);
        }

        throw new MerossDeviceError('Invalid identifier: expected UUID string or object with hubUuid and id properties', 'VALIDATION_ERROR', { field: 'identifier' });
    }

    /**
     * Handles base device initialization path.
     *
     * Initializes a base device by UUID. Checks if device already exists,
     * validates device list, finds device info, checks online status, and
     * initializes/enrolls the device.
     *
     * @param {string} deviceUuid - Device UUID string
     * @returns {Promise<MerossDevice|MerossHubDevice|null>} Device instance or null if initialization fails
     * @throws {MerossDeviceError} If device list is empty, device not found, or device is offline
     * @private
     */
    async _initializeBaseDevice(deviceUuid) {
        const existingDevice = this._registry.get(deviceUuid);
        if (existingDevice) {
            return existingDevice;
        }

        const deviceList = await this._getValidatedDeviceList();
        if (deviceList.length === 0) {
            throw new MerossDeviceError('Device list is empty or invalid', 'VALIDATION_ERROR', { field: 'deviceList' });
        }

        const deviceInfo = this._findDeviceByUuid(deviceList, deviceUuid);
        if (!deviceInfo) {
            throw new MerossDeviceError(`Device with UUID ${deviceUuid} not found`, 'NOT_FOUND', { resourceType: 'device', resourceId: deviceUuid });
        }

        const { OnlineStatus } = require('../lib/enums');
        if (deviceInfo.onlineStatus !== OnlineStatus.ONLINE) {
            if (this.meross.options.logger) {
                this.meross.options.logger(`Skipping offline device ${deviceUuid}`);
            }
            return null;
        }

        const device = await this._initializeAndEnrollDevice(deviceInfo);

        return device;
    }

    /**
     * Handles subdevice initialization path.
     *
     * Initializes a subdevice by identifier. Checks if subdevice already exists,
     * ensures hub is initialized, finds subdevice in hub or API, and enrolls it.
     *
     * @param {Object} identifier - Subdevice identifier object
     * @param {string} identifier.hubUuid - Hub UUID that the subdevice belongs to
     * @param {string} identifier.id - Subdevice ID
     * @returns {Promise<MerossSubDevice>} Subdevice instance
     * @throws {MerossDeviceError} If subdevice not found or hub initialization fails
     * @private
     */
    async _initializeSubdevice(identifier) {
        const { hubUuid, id: subdeviceId } = identifier;

        const existingSubdevice = this._registry.get({ hubUuid, id: subdeviceId });
        if (existingSubdevice) {
            return existingSubdevice;
        }

        const hubDevice = await this._ensureHubInitialized(hubUuid);

        const subdevice = hubDevice.getSubdevice(subdeviceId);
        if (subdevice) {
            return subdevice;
        }

        return await this._findAndEnrollSubdevice(hubDevice, hubUuid, subdeviceId);
    }

    /**
     * Ensures hub is initialized, initializes if needed.
     *
     * Checks if hub device exists and is a valid MerossHubDevice instance.
     * If not, fetches device list, finds hub device info, and initializes it.
     * This ensures the hub is ready before subdevice operations.
     *
     * @param {string} hubUuid - Hub UUID
     * @returns {Promise<MerossHubDevice>} Hub device instance
     * @throws {MerossDeviceError} If device list is empty, hub not found, or hub initialization fails
     * @private
     */
    async _ensureHubInitialized(hubUuid) {
        let hubDevice = this._registry.get(hubUuid);
        const { MerossHubDevice } = require('../lib/device/hubdevice');

        if (!hubDevice || !(hubDevice instanceof MerossHubDevice)) {
            const deviceList = await this._getValidatedDeviceList();
            if (deviceList.length === 0) {
                throw new MerossDeviceError('Device list is empty or invalid', 'VALIDATION_ERROR', { field: 'deviceList' });
            }

            const hubDeviceInfo = this._findDeviceByUuid(deviceList, hubUuid);
            if (!hubDeviceInfo) {
                throw new MerossDeviceError(`Hub device with UUID ${hubUuid} not found`, 'NOT_FOUND', { resourceType: 'hubDevice', resourceId: hubUuid });
            }

            hubDevice = await this._initializeAndEnrollDevice(hubDeviceInfo);
            if (!hubDevice || !(hubDevice instanceof MerossHubDevice)) {
                throw new MerossDeviceError(`Failed to initialize hub device ${hubUuid}`, 'INITIALIZATION_FAILED', { component: 'hubDevice', reason: 'Initialization returned invalid device type' });
            }
        }

        return hubDevice;
    }

    /**
     * Finds subdevice in API and enrolls it.
     *
     * Fetches subdevice list from API, finds matching subdevice by ID,
     * and enrolls it with the hub. Handles errors gracefully.
     *
     * @param {MerossHubDevice} hubDevice - Hub device instance
     * @param {string} hubUuid - Hub UUID (for API calls and error messages)
     * @param {string} subdeviceId - Subdevice ID to find
     * @returns {Promise<MerossSubDevice>} Enrolled subdevice instance
     * @throws {MerossDeviceError} If subdevice not found in hub
     * @private
     */
    async _findAndEnrollSubdevice(hubDevice, hubUuid, subdeviceId) {
        try {
            const subDeviceList = await this.meross.auth.client.getSubDevices(hubUuid);
            if (subDeviceList && Array.isArray(subDeviceList)) {
                const subdeviceInfo = subDeviceList.find(sd =>
                    (sd.subDeviceId || sd.id) === subdeviceId
                );

                if (subdeviceInfo) {
                    return await this._enrollSubdevice(hubDevice, subdeviceInfo);
                }
            }
        } catch (err) {
            if (this.meross.options.logger) {
                this.meross.options.logger(`Error fetching subdevices for hub ${hubUuid}: ${err.message}`);
            }
        }

        throw new MerossDeviceError(`Subdevice with ID ${subdeviceId} not found in hub ${hubUuid}`, 'NOT_FOUND', { resourceType: 'subdevice', resourceId: subdeviceId });
    }

    /**
     * Removes a device from the manager.
     *
     * Disconnects the device, removes it from the registry, cleans up subscriptions,
     * request queues, and MQTT connections. For hub devices, all subdevices are also
     * removed automatically. MQTT connections are only closed if no other devices
     * on that domain remain.
     *
     * @param {string|Object} identifier - Device identifier
     * @param {string} identifier - For base devices: device UUID string (e.g., 'device-uuid')
     * @param {Object} identifier - For subdevices: object with hubUuid and id properties
     * @param {string} identifier.hubUuid - Hub UUID that the subdevice belongs to
     * @param {string} identifier.id - Subdevice ID
     * @returns {Promise<boolean>} Promise that resolves to true if device was removed, false if not found
     * @throws {MerossDeviceError} If identifier is invalid
     * @example
     * // Remove a base device
     * const removed = await manager.devices.remove('device-uuid');
     *
     * // Remove a subdevice
     * const removed = await manager.devices.remove({ hubUuid: 'hub-uuid', id: 'subdevice-id' });
     */
    async remove(identifier) {
        const device = this._registry.get(identifier);
        if (!device) {
            if (this.meross.options.logger) {
                const identifierStr = this._formatIdentifier(identifier);
                this.meross.options.logger(`Device not found for removal: ${identifierStr}`);
            }
            return false;
        }

        const { MerossHubDevice } = require('../lib/device/hubdevice');

        // Capture UUID and domain before device modifications
        const deviceUuid = device.uuid;
        const deviceDomain = device.domain || this.meross.auth.mqttDomain;

        if (device instanceof MerossHubDevice && typeof device.getSubdevices === 'function') {
            this._removeHubSubdevices(device);
        }

        this._cleanupSubscriptions(deviceUuid);

        if (device.disconnect) {
            device.disconnect();
        }

        this.meross.transport.clearDeviceQueue(deviceUuid);

        // Subdevices share hub's UUID and MQTT connection
        const isSubdevice = !!(device.subdeviceId || device._subdeviceId) && !!(device.hub || device._hub);

        if (isSubdevice) {
            this._removeSubdeviceFromHub(device);
        }

        this.removeFromRegistry(device);

        this._cleanupMqttConnection(deviceUuid, deviceDomain, isSubdevice);

        if (this.meross.options.logger) {
            const identifierStr = this._formatIdentifier(identifier);
            this.meross.options.logger(`Device removed: ${identifierStr}`);
        }

        return true;
    }

    /**
     * @param {string|Object} identifier - Device UUID or `{ hubUuid, id }`
     * @returns {string}
     * @private
     */
    _formatIdentifier(identifier) {
        return typeof identifier === 'string'
            ? identifier
            : `${identifier.hubUuid}:${identifier.id}`;
    }

    /**
     * Removes all subdevices from a hub device.
     *
     * Disconnects each subdevice and removes it from the device registry.
     * Called when removing a hub device to ensure all subdevices are cleaned up.
     *
     * @param {MerossHubDevice} hubDevice - Hub device instance
     * @private
     */
    _removeHubSubdevices(hubDevice) {
        const subdevices = hubDevice.getSubdevices();
        for (const subdevice of subdevices) {
            if (subdevice.disconnect) {
                subdevice.disconnect();
            }

            this.removeFromRegistry(subdevice);
        }
    }

    /**
     * Handles subscription manager cleanup.
     *
     * Unsubscribes from device updates if the device has active subscriptions.
     * Note: Subdevices share the hub's subscription, so we only need to unsubscribe the hub.
     *
     * @param {string} deviceUuid - Device UUID
     * @private
     */
    _cleanupSubscriptions(deviceUuid) {
        const subscription = this.meross._managers.subscription;
        if (subscription && deviceUuid) {
            const eventName = `deviceUpdate:${deviceUuid}`;
            if (subscription.listenerCount(eventName) > 0) {
                subscription.unsubscribe(deviceUuid);
            }
        }
    }

    /**
     * Handles MQTT device list cleanup.
     *
     * Removes device UUID from MQTT connection's device list if it's a base device.
     * Subdevices share hub's UUID and MQTT connection, so they are not removed from the list.
     *
     * @param {string} deviceUuid - Device UUID
     * @param {string} deviceDomain - MQTT domain for the device
     * @param {boolean} isSubdevice - Whether the device is a subdevice
     * @private
     */
    _cleanupMqttConnection(deviceUuid, deviceDomain, isSubdevice) {
        const mqttConn = this.meross.mqtt.getConnection(deviceDomain);
        if (!isSubdevice && deviceDomain && deviceUuid && mqttConn) {
            const deviceList = mqttConn.deviceList;
            if (deviceList && Array.isArray(deviceList)) {
                const index = deviceList.indexOf(deviceUuid);
                if (index !== -1) {
                    deviceList.splice(index, 1);
                }
            }
        }
    }

    /**
     * Handles subdevice-specific hub cleanup.
     *
     * Removes subdevice from hub's internal registry when the subdevice is removed.
     * This ensures the hub's internal state stays consistent.
     *
     * @param {MerossSubDevice} subdevice - Subdevice instance
     * @private
     */
    _removeSubdeviceFromHub(subdevice) {
        const hub = subdevice.hub || subdevice._hub;
        if (hub && hub._subDevices && hub._subDevices instanceof Map) {
            const subdeviceId = subdevice.subdeviceId || subdevice._subdeviceId;
            if (subdeviceId) {
                hub._subDevices.delete(subdeviceId);
            }
        }
    }

    /**
     * Forwards device lifecycle events to the root Meross instance.
     *
     * @param {MerossDevice|MerossHubDevice} deviceObj - Device instance
     * @private
     */
    _bindDeviceEvents(deviceObj) {
        const deviceId = deviceObj.uuid;

        deviceObj.on('disconnected', (error) => {
            this.meross.emit('disconnected', deviceObj, error);
        });
        deviceObj.on('error', (error) => {
            this.meross.emit('error', error, deviceId);
        });
        deviceObj.on('stateChange', (change) => {
            this.meross.emit('deviceUpdate', deviceObj, change);
        });
        deviceObj.on('ready', () => {
            this.meross.emit('deviceReady', deviceObj);
        });

        deviceObj.on('connected', () => {
            this.meross.emit('connected', deviceObj);

            if (typeof deviceObj.getSubdevices === 'function') {
                const subdevices = deviceObj.getSubdevices();
                if (subdevices.length > 0) {
                    setTimeout(async () => {
                        try {
                            await deviceObj.refreshState();
                        } catch (err) {
                            const logger = this.meross.options?.logger;
                            if (logger && typeof logger === 'function') {
                                logger(`Failed to refresh hub ${deviceId} subdevice statuses: ${err.message}`);
                            }
                        }
                    }, 2000);
                }
            }
        });
        deviceObj.on('reconnected', () => {
            this.meross.emit('reconnected', deviceObj);
        });
    }

    /**
     * Connects a device to the manager and sets up event handling.
     *
     * Abilities are resolved during enrollment; the device emits ready after
     * System.All arrives over MQTT. The device must already be registered.
     *
     * @param {MerossDevice|MerossHubDevice} deviceObj - Device instance to connect
     * @param {Object} dev - Device definition object from API
     * @returns {Promise<void>}
     */
    async connect(deviceObj, dev) {
        this._bindDeviceEvents(deviceObj);
        await this.meross.mqtt.init(dev);
        deviceObj.connect();
    }

    /**
     * Enrolls a single base device.
     *
     * Queries device abilities to determine device class and features, detects if the device
     * is a hub, fetches subdevice metadata for hubs, builds the device instance with the
     * appropriate class, registers it in the device registry, and establishes the connection.
     * Abilities are queried before device creation to avoid needing to query again after
     * instantiation.
     *
     * @param {Object} deviceInfo - Device info from HTTP API
     * @returns {Promise<MerossDevice|MerossHubDevice|null>} Device instance or null if enrollment fails
     * @private
     */
    async _enrollDevice(deviceInfo) {
        try {
            // Extended timeout accounts for slow-responding devices during discovery
            let abilities = null;
            try {
                abilities = await this._queryDeviceAbilities(
                    deviceInfo.uuid,
                    deviceInfo.domain || this.meross.auth.mqttDomain,
                    10000
                );
            } catch (err) {
                return null;
            }

            if (!abilities) {
                return null;
            }

            // Device type strings are unreliable; abilities provide consistent hub detection
            const { HUB_DISCRIMINATING_ABILITY } = require('../lib/device/factory');
            const isHub = abilities && typeof abilities === 'object' &&
                         HUB_DISCRIMINATING_ABILITY in abilities;

            // Fetch subdevice metadata for hubs; defer creation until after hub enrollment
            let subDeviceList = null;
            if (isHub) {
                try {
                    subDeviceList = await this.meross.auth.client.getSubDevices(deviceInfo.uuid);
                } catch (err) {
                    subDeviceList = [];
                }
            }

            const { buildDevice } = require('../lib/device/factory');
            const device = buildDevice(deviceInfo, abilities, this.meross, subDeviceList);

            device._updateAbilities(abilities);

            this.register(device);
            await this.connect(device, deviceInfo);

            return device;
        } catch (err) {
            if (this.meross.options.logger) {
                this.meross.options.logger(`Error enrolling device ${deviceInfo.uuid}: ${err.message}`);
            }
            return null;
        }
    }

    /**
     * Enrolls a single subdevice.
     *
     * Builds the subdevice instance using the hub's abilities (since subdevices don't have
     * their own ability set), registers it with the hub for communication routing, registers
     * it in the device registry, and extracts subdevice-specific abilities from the hub's
     * full ability set.
     *
     * @param {MerossHubDevice} hubDevice - Hub device instance
     * @param {Object|ApiSubdeviceInfo} subdeviceInfo - Subdevice info from Meross cloud API or ApiSubdeviceInfo instance
     * @returns {Promise<MerossSubDevice|null>} Subdevice instance or null if enrollment fails
     * @private
     */
    async _enrollSubdevice(hubDevice, subdeviceInfo) {
        try {
            const ApiSubdeviceInfo = require('../lib/api/subdevice');
            const { buildSubdevice, getSubdeviceAbilities } = require('../lib/device/factory');

            const apiSubdeviceInfo = subdeviceInfo instanceof ApiSubdeviceInfo
                ? subdeviceInfo
                : ApiSubdeviceInfo.fromDict(subdeviceInfo);

            // Build subdevice using hub's abilities; subdevices derive capabilities from hub
            const subdevice = buildSubdevice(
                apiSubdeviceInfo,
                hubDevice.uuid,
                hubDevice.abilities,
                this.meross
            );

            hubDevice.registerSubdevice(subdevice);
            this.register(subdevice);

            if (subdevice && subdevice.type) {
                const subdeviceAbilities = getSubdeviceAbilities(subdevice.type, hubDevice.abilities);
                if (Object.keys(subdeviceAbilities).length > 0) {
                    subdevice._updateAbilities(subdeviceAbilities);
                }
            }

            return subdevice;
        } catch (err) {
            if (this.meross.options.logger) {
                this.meross.options.logger(`Error enrolling subdevice: ${err.message}`);
            }
            return null;
        }
    }

    /**
     * Enrolls all subdevices for a hub.
     *
     * Iterates through the subdevice list and enrolls each subdevice. Used when a hub
     * is initialized to ensure all its subdevices are available, or when a specific
     * subdevice is requested and the hub needs to be initialized first.
     *
     * @param {MerossHubDevice} hubDevice - Hub device instance
     * @param {Array<Object>} subDeviceList - Array of subdevice info objects from HTTP API
     * @returns {Promise<Array<MerossSubDevice>>} Array of enrolled subdevice instances
     * @private
     */
    async _enrollHubSubdevices(hubDevice, subDeviceList) {
        const enrolledSubdevices = [];

        if (!hubDevice || !subDeviceList || !Array.isArray(subDeviceList) || subDeviceList.length === 0) {
            return enrolledSubdevices;
        }

        for (const subdeviceInfoRaw of subDeviceList) {
            const subdevice = await this._enrollSubdevice(hubDevice, subdeviceInfoRaw);
            if (subdevice) {
                enrolledSubdevices.push(subdevice);
            }
        }

        return enrolledSubdevices;
    }

    /**
     * Determines if a device is a hub based on its device type.
     *
     * Uses device type patterns to quickly detect hub devices without querying abilities.
     * This is used by discovery methods for performance. For accurate detection, abilities
     * should be queried, but this provides a fast heuristic.
     *
     * @param {Object} deviceInfo - Device info from HTTP API
     * @returns {boolean} True if the device is a hub, false otherwise
     * @private
     */
    _isHubDeviceType(deviceInfo) {
        if (!deviceInfo || !deviceInfo.deviceType) {
            return false;
        }

        const deviceType = deviceInfo.deviceType.toLowerCase();
        const hubPatterns = ['msh300', 'msh450', 'msh500'];
        return hubPatterns.some(pattern => deviceType.includes(pattern));
    }

    /**
     * Fetches and validates the device list from the HTTP API.
     *
     * Centralizes device list fetching and validation logic used across
     * multiple initialization methods. Returns an empty array if the API
     * response is invalid or empty.
     *
     * @returns {Promise<Array>} Promise that resolves with array of device info objects, or empty array if invalid
     * @private
     */
    async _getValidatedDeviceList() {
        const deviceList = await this.meross.auth.client.getDevices();
        if (!deviceList || !Array.isArray(deviceList)) {
            return [];
        }
        return deviceList;
    }

    /**
     * Finds a device in the device list by UUID.
     *
     * Searches the provided device list for a device matching the given UUID.
     * Returns null if not found, allowing callers to handle missing devices.
     *
     * @param {Array} deviceList - Array of device info objects from HTTP API
     * @param {string} uuid - Device UUID to find
     * @returns {Object|null} Device info object or null if not found
     * @private
     */
    _findDeviceByUuid(deviceList, uuid) {
        if (!deviceList || !Array.isArray(deviceList)) {
            return null;
        }
        return deviceList.find(dev => dev.uuid === uuid) || null;
    }

    /**
     * Enrolls subdevices for a hub device if applicable.
     *
     * Checks if the provided device is a hub and has subdevices, then enrolls
     * all subdevices. This pattern is used consistently across initialization
     * methods to ensure hubs are fully initialized with their subdevices.
     *
     * @param {MerossDevice|MerossHubDevice} device - Device instance to check
     * @returns {Promise<void>}
     * @private
     */
    async _enrollSubdevicesIfHub(device) {
        if (!device) {
            return;
        }

        const { MerossHubDevice } = require('../lib/device/hubdevice');
        if (device instanceof MerossHubDevice && typeof device.getSubdevices === 'function') {
            const subDeviceList = device.subDeviceList || [];
            if (subDeviceList && Array.isArray(subDeviceList) && subDeviceList.length > 0) {
                await this._enrollHubSubdevices(device, subDeviceList);
            }
        }
    }

    /**
     * Initializes MQTT connection, enrolls device, and enrolls subdevices if hub.
     *
     * Performs the complete device initialization flow: establishes MQTT connection,
     * enrolls the device, and automatically enrolls subdevices if the device is a hub.
     * This pattern is used consistently across device initialization methods.
     *
     * @param {Object} deviceInfo - Device info object from HTTP API
     * @returns {Promise<MerossDevice|MerossHubDevice|null>} Enrolled device instance or null if enrollment fails
     * @private
     */
    async _initializeAndEnrollDevice(deviceInfo) {
        await this.meross.mqtt.init({
            uuid: deviceInfo.uuid,
            domain: deviceInfo.domain || this.meross.auth.mqttDomain
        });

        const device = await this._enrollDevice(deviceInfo);

        if (device) {
            await this._enrollSubdevicesIfHub(device);
        }

        return device;
    }

    /**
     * Query device abilities via MQTT (internal method)
     *
     * Queries a device's supported capabilities (namespaces) via MQTT. This is called
     * automatically during device discovery.
     *
     * @param {string} deviceUuid - Device UUID
     * @param {string} domain - MQTT domain for the device
     * @param {number} [timeout=5000] - Timeout in milliseconds
     * @returns {Promise<Object|null>} Abilities object or null if query fails or times out
     * @throws {MerossDeviceError} If query times out (COMMAND_TIMEOUT)
     * @throws {MerossNetworkError} If MQTT connection fails (MQTT_ERROR)
     * @private
     */
    async _queryDeviceAbilities(deviceUuid, domain, timeout = 5000) {
        const mqtt = this.meross.mqtt;
        const mqttDomain = domain || mqtt.mqttDomain;

        if (!mqtt.clientResponseTopic) {
            if (this.meross.options.logger) {
                this.meross.options.logger('Client response topic not set');
            }
            return null;
        }

        if (!mqtt.hasConnection(mqttDomain)) {
            await mqtt.init({ uuid: deviceUuid, domain: mqttDomain });
        }

        const mqttConnection = mqtt.getConnection(mqttDomain);
        if (!mqttConnection?.client?.connected) {
            return null;
        }

        const message = mqtt.encode('GET', 'Appliance.System.Ability', {}, deviceUuid);
        const { messageId } = message.header;

        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                if (mqtt.hasPendingFuture(messageId)) {
                    mqtt.deletePendingFuture(messageId);
                    reject(new MerossDeviceError(
                        `Ability query timeout after ${timeout}ms`,
                        'COMMAND_TIMEOUT',
                        { deviceUuid, timeout, command: { method: 'GET', namespace: 'Appliance.System.Ability' } }
                    ));
                }
            }, timeout);

            mqtt.setPendingFuture(messageId, {
                resolve: (response) => {
                    clearTimeout(timeoutHandle);
                    if (response && response.ability) {
                        resolve(response.ability);
                    } else {
                        resolve(null);
                    }
                },
                reject: (error) => {
                    clearTimeout(timeoutHandle);
                    reject(error);
                },
                timeout: timeoutHandle
            });

            try {
                const { buildDeviceRequestTopic } = require('../lib/utilities/mqtt');
                const topic = buildDeviceRequestTopic(deviceUuid);
                mqttConnection.client.publish(topic, JSON.stringify(message), (err) => {
                    if (err) {
                        if (mqtt.hasPendingFuture(messageId)) {
                            clearTimeout(timeoutHandle);
                            mqtt.deletePendingFuture(messageId);
                        }
                        reject(err);
                    }
                });
            } catch (err) {
                if (mqtt.hasPendingFuture(messageId)) {
                    clearTimeout(timeoutHandle);
                    mqtt.deletePendingFuture(messageId);
                }
                reject(err);
            }
        }).catch((error) => {
            if (this.meross.options.logger) {
                this.meross.options.logger(`Error querying abilities for ${deviceUuid}: ${error.message}`);
            }
            return null;
        });
    }
}

module.exports = ManagerDevices;
