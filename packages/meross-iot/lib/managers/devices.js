'use strict';

/**
 * Manages device discovery, initialization, and lifecycle.
 *
 * Handles device discovery from Meross cloud, device enrollment,
 * subdevice management, and device removal. Provides a clean
 * interface for device operations separate from transport concerns.
 *
 * @class ManagerDevices
 */
class ManagerDevices {
    /**
     * Creates a new ManagerDevices instance.
     *
     * @param {ManagerMeross} manager - Parent manager instance
     */
    constructor(manager) {
        this.manager = manager;
    }

    /**
     * Gets a device by UUID or subdevice identifier.
     *
     * @param {string|Object} identifier - Device UUID or subdevice identifier
     * @returns {MerossDevice|MerossHubDevice|MerossSubDevice|null} Device instance or null if not found
     */
    get(identifier) {
        return this.manager._deviceRegistry.get(identifier);
    }

    /**
     * Lists all registered devices.
     *
     * @returns {Array<MerossDevice|MerossHubDevice|MerossSubDevice>} Array of device instances
     */
    list() {
        return this.manager._deviceRegistry.list();
    }

    /**
     * Finds devices matching the provided filters.
     *
     * @param {Object} filters - Filter criteria
     * @returns {Array<MerossDevice|MerossHubDevice|MerossSubDevice>} Array of matching device instances
     */
    find(filters) {
        return this.manager._deviceRegistry.find(filters);
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
     * @throws {HttpApiError} If API request fails
     * @throws {TokenExpiredError} If authentication token has expired
     * @example
     * // Get all smart plugs
     * const smartPlugs = await manager.devices.discover({ deviceTypes: ['mss315', 'mss425'] });
     *
     * // Get all online devices excluding hubs
     * const devices = await manager.devices.discover({ excludeHubs: true });
     */
    async discover(options = {}) {
        const deviceList = await this.manager.httpClient.getDevices();

        if (!deviceList || !Array.isArray(deviceList)) {
            return [];
        }

        const { OnlineStatus } = require('../model/enums');

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
     * @throws {HttpApiError} If API request fails
     * @throws {TokenExpiredError} If authentication token has expired
     * @example
     * // Get all smoke alarms
     * const smokeAlarms = await manager.devices.discoverSubdevices({ subdeviceType: 'ma151' });
     *
     * // Get all subdevices from specific hubs
     * const subdevices = await manager.devices.discoverSubdevices({ hubUuids: ['hub-uuid-1', 'hub-uuid-2'] });
     */
    async discoverSubdevices(options = {}) {
        const deviceList = await this.manager.httpClient.getDevices();

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
        const { OnlineStatus } = require('../model/enums');

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
            const subDeviceList = await this.manager.httpClient.getSubDevices(hubDevice.uuid);
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
            if (this.manager.options.logger) {
                this.manager.options.logger(`Error fetching subdevices for hub ${hubDevice.uuid}: ${err.message}`);
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
     * @throws {HttpApiError} If API request fails
     * @throws {TokenExpiredError} If authentication token has expired
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

        const { OnlineStatus } = require('../model/enums');

        let devicesToInitialize = deviceList.filter(dev => dev.onlineStatus === OnlineStatus.ONLINE);

        if (options && options.uuids && Array.isArray(options.uuids) && options.uuids.length > 0) {
            const uuidSet = new Set(options.uuids);
            const filteredDevices = devicesToInitialize.filter(dev => uuidSet.has(dev.uuid));

            const foundUuids = new Set(filteredDevices.map(dev => dev.uuid));
            const missingUuids = options.uuids.filter(uuid => !foundUuids.has(uuid));
            if (missingUuids.length > 0 && this.manager.options.logger) {
                this.manager.options.logger(`Warning: Some requested device UUIDs were not found: ${missingUuids.join(', ')}`);
            }

            devicesToInitialize = filteredDevices;
        }

        // Group devices by domain to establish one MQTT connection per domain,
        // reducing connection overhead when multiple devices share the same domain
        const devicesByDomain = new Map();
        devicesToInitialize.forEach(dev => {
            const domain = dev.domain || this.manager.mqttDomain;
            if (!devicesByDomain.has(domain)) {
                devicesByDomain.set(domain, []);
            }
            devicesByDomain.get(domain).push(dev);
        });

        for (const [domain, devices] of devicesByDomain) {
            if (devices.length > 0) {
                const firstDevice = devices[0];
                await this.manager.mqtt.init({
                    uuid: firstDevice.uuid,
                    domain
                });
            }
        }

        const devicePromises = devicesToInitialize.map(dev => this._enrollDevice(dev));
        const devices = (await Promise.all(devicePromises)).filter(d => d !== null);

        // Enroll subdevices after hubs are enrolled since subdevices require
        // their parent hub's abilities to determine their own capabilities
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
     * @throws {Error} If device UUID not found or subdevice identifier is invalid
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

        throw new Error('Invalid identifier: expected UUID string or object with hubUuid and id properties');
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
     * @throws {Error} If device list is empty, device not found, or device is offline
     * @private
     */
    async _initializeBaseDevice(deviceUuid) {
        const existingDevice = this.manager._deviceRegistry.get(deviceUuid);
        if (existingDevice) {
            return existingDevice;
        }

        const deviceList = await this._getValidatedDeviceList();
        if (deviceList.length === 0) {
            throw new Error('Device list is empty or invalid');
        }

        const deviceInfo = this._findDeviceByUuid(deviceList, deviceUuid);
        if (!deviceInfo) {
            throw new Error(`Device with UUID ${deviceUuid} not found`);
        }

        const { OnlineStatus } = require('../model/enums');
        if (deviceInfo.onlineStatus !== OnlineStatus.ONLINE) {
            if (this.manager.options.logger) {
                this.manager.options.logger(`Skipping offline device ${deviceUuid}`);
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
     * @throws {Error} If subdevice not found or hub initialization fails
     * @private
     */
    async _initializeSubdevice(identifier) {
        const { hubUuid, id: subdeviceId } = identifier;

        const existingSubdevice = this.manager._deviceRegistry.get({ hubUuid, id: subdeviceId });
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
     * @throws {Error} If device list is empty, hub not found, or hub initialization fails
     * @private
     */
    async _ensureHubInitialized(hubUuid) {
        let hubDevice = this.manager._deviceRegistry.get(hubUuid);
        const { MerossHubDevice } = require('../controller/hub-device');

        if (!hubDevice || !(hubDevice instanceof MerossHubDevice)) {
            const deviceList = await this._getValidatedDeviceList();
            if (deviceList.length === 0) {
                throw new Error('Device list is empty or invalid');
            }

            const hubDeviceInfo = this._findDeviceByUuid(deviceList, hubUuid);
            if (!hubDeviceInfo) {
                throw new Error(`Hub device with UUID ${hubUuid} not found`);
            }

            hubDevice = await this._initializeAndEnrollDevice(hubDeviceInfo);
            if (!hubDevice || !(hubDevice instanceof MerossHubDevice)) {
                throw new Error(`Failed to initialize hub device ${hubUuid}`);
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
     * @throws {Error} If subdevice not found in hub
     * @private
     */
    async _findAndEnrollSubdevice(hubDevice, hubUuid, subdeviceId) {
        try {
            const subDeviceList = await this.manager.httpClient.getSubDevices(hubUuid);
            if (subDeviceList && Array.isArray(subDeviceList)) {
                const subdeviceInfo = subDeviceList.find(sd =>
                    (sd.subDeviceId || sd.id) === subdeviceId
                );

                if (subdeviceInfo) {
                    return await this._enrollSubdevice(hubDevice, subdeviceInfo);
                }
            }
        } catch (err) {
            if (this.manager.options.logger) {
                this.manager.options.logger(`Error fetching subdevices for hub ${hubUuid}: ${err.message}`);
            }
        }

        throw new Error(`Subdevice with ID ${subdeviceId} not found in hub ${hubUuid}`);
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
     * @throws {Error} If identifier is invalid
     * @example
     * // Remove a base device
     * const removed = await manager.devices.remove('device-uuid');
     *
     * // Remove a subdevice
     * const removed = await manager.devices.remove({ hubUuid: 'hub-uuid', id: 'subdevice-id' });
     */
    async remove(identifier) {
        const device = this.manager._deviceRegistry.get(identifier);
        if (!device) {
            if (this.manager.options.logger) {
                const identifierStr = this._formatIdentifier(identifier);
                this.manager.options.logger(`Device not found for removal: ${identifierStr}`);
            }
            return false;
        }

        const { MerossHubDevice } = require('../controller/hub-device');

        // Capture UUID and domain before any modifications that might affect them
        const deviceUuid = device.uuid;
        const deviceDomain = device.domain || this.manager.mqttDomain;

        if (device instanceof MerossHubDevice && typeof device.getSubdevices === 'function') {
            this._removeHubSubdevices(device);
        }

        this._cleanupSubscriptions(deviceUuid);

        if (device.disconnect) {
            device.disconnect();
        }

        if (this.manager._requestQueue && deviceUuid) {
            this.manager._requestQueue.clearQueue(deviceUuid);
        }

        // Subdevices share hub's UUID, so they shouldn't be removed from MQTT device list
        const isSubdevice = !!(device.subdeviceId || device._subdeviceId) && !!(device.hub || device._hub);

        if (isSubdevice) {
            this._removeSubdeviceFromHub(device);
        }

        this.manager._deviceRegistry.removeDevice(device);

        this._cleanupMqttConnection(deviceUuid, deviceDomain, isSubdevice);

        if (this.manager.options.logger) {
            const identifierStr = this._formatIdentifier(identifier);
            this.manager.options.logger(`Device removed: ${identifierStr}`);
        }

        return true;
    }

    /**
     * Formats identifier string for logging.
     *
     * Converts device identifier (UUID string or object) into a readable string
     * format for logging purposes.
     *
     * @param {string|Object} identifier - Device identifier
     * @returns {string} Formatted identifier string
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

            this.manager._deviceRegistry.removeDevice(subdevice);
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
        if (this.manager._subscriptionManager && deviceUuid) {
            const eventName = `deviceUpdate:${deviceUuid}`;
            if (this.manager._subscriptionManager.listenerCount(eventName) > 0) {
                this.manager._subscriptionManager.unsubscribe(deviceUuid);
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
        // Only remove from list if it's a base device; subdevices share hub's UUID and MQTT connection
        if (!isSubdevice && deviceDomain && deviceUuid && this.manager.mqttConnections[deviceDomain]) {
            const deviceList = this.manager.mqttConnections[deviceDomain].deviceList;
            if (deviceList && Array.isArray(deviceList)) {
                const index = deviceList.indexOf(deviceUuid);
                if (index !== -1) {
                    deviceList.splice(index, 1);
                }
            }
            // Connection remains open in case devices are added back soon; cleaned up by disconnectAll() if needed
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
     * Connects a device to the manager and sets up event handling.
     *
     * Forwards device events to manager and initializes MQTT connection.
     * Device abilities are already known at this point (queried before device creation).
     * The device should already be registered in the device registry before calling this method.
     *
     * @param {MerossDevice|MerossHubDevice} deviceObj - Device instance to connect
     * @param {Object} dev - Device definition object from API
     * @returns {Promise<void>} Promise that resolves when device connection is set up
     */
    async connect(deviceObj, dev) {
        const deviceId = deviceObj.uuid;

        deviceObj.on('close', (error) => {
            this.manager.emit('close', deviceId, error);
        });
        deviceObj.on('error', (error) => {
            this.manager.emit('error', error, deviceId);
        });
        deviceObj.on('rawSendData', (message) => {
            this.manager.emit('rawData', deviceId, message);
        });
        deviceObj.on('pushNotification', (notification) => {
            this.manager.emit('pushNotification', deviceId, notification, deviceObj);
        });

        if (this.manager._subscriptionManager) {
            deviceObj.on('stateChange', () => {
                // Subscription manager handles stateChange events separately
            });
        }

        deviceObj.on('connected', () => {
            this.manager.emit('connected', deviceId);

            // Delay hub state refresh to ensure MQTT connection is fully established
            // before querying devices, preventing race conditions during connection setup
            if (typeof deviceObj.getSubdevices === 'function') {
                const subdevices = deviceObj.getSubdevices();
                if (subdevices.length > 0) {
                    setTimeout(async () => {
                        try {
                            await deviceObj.refreshState();
                        } catch (err) {
                            const logger = this.manager.options?.logger;
                            if (logger && typeof logger === 'function') {
                                logger(`Failed to refresh hub ${deviceId} subdevice statuses: ${err.message}`);
                            }
                        }
                    }, 2000);
                }
            }
        });

        this.manager.emit('deviceInitialized', deviceId, deviceObj);

        await this.manager.mqtt.init(dev);

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
            // Extended timeout accounts for devices that respond slowly during discovery
            // to avoid false negatives when devices are temporarily slow
            let abilities = null;
            try {
                abilities = await this._queryDeviceAbilities(
                    deviceInfo.uuid,
                    deviceInfo.domain || this.manager.mqttDomain,
                    10000
                );
            } catch (err) {
                return null;
            }

            if (!abilities) {
                return null;
            }

            // Device type strings are unreliable; abilities provide consistent hub detection
            // since hub devices always expose the hub-specific ability namespace
            const { HUB_DISCRIMINATING_ABILITY } = require('../device-factory');
            const isHub = abilities && typeof abilities === 'object' &&
                         HUB_DISCRIMINATING_ABILITY in abilities;

            // Fetch subdevice metadata for hubs but defer creation until after hub enrollment
            // to ensure the hub is fully initialized before subdevices are created
            let subDeviceList = null;
            if (isHub) {
                try {
                    subDeviceList = await this.manager.httpClient.getSubDevices(deviceInfo.uuid);
                } catch (err) {
                    subDeviceList = [];
                }
            }

            const { buildDevice } = require('../device-factory');
            const device = buildDevice(deviceInfo, abilities, this.manager, subDeviceList);

            device.updateAbilities(abilities);

            this.manager._deviceRegistry.registerDevice(device);
            await this.connect(device, deviceInfo);

            return device;
        } catch (err) {
            if (this.manager.options.logger) {
                this.manager.options.logger(`Error enrolling device ${deviceInfo.uuid}: ${err.message}`);
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
     * @param {Object|HttpSubdeviceInfo} subdeviceInfo - Subdevice info from HTTP API or HttpSubdeviceInfo instance
     * @returns {Promise<MerossSubDevice|null>} Subdevice instance or null if enrollment fails
     * @private
     */
    async _enrollSubdevice(hubDevice, subdeviceInfo) {
        try {
            const HttpSubdeviceInfo = require('../model/http/subdevice');
            const { buildSubdevice, getSubdeviceAbilities } = require('../device-factory');

            const httpSubdeviceInfo = subdeviceInfo instanceof HttpSubdeviceInfo
                ? subdeviceInfo
                : HttpSubdeviceInfo.fromDict(subdeviceInfo);

            // Build subdevice using hub's abilities since subdevices don't have their own
            // ability set and must derive capabilities from the hub
            const subdevice = buildSubdevice(
                httpSubdeviceInfo,
                hubDevice.uuid,
                hubDevice.abilities,
                this.manager
            );

            hubDevice.registerSubdevice(subdevice);
            this.manager._deviceRegistry.registerDevice(subdevice);

            if (subdevice && subdevice.type) {
                const subdeviceAbilities = getSubdeviceAbilities(subdevice.type, hubDevice.abilities);
                if (Object.keys(subdeviceAbilities).length > 0) {
                    subdevice.updateAbilities(subdeviceAbilities);
                }
            }

            return subdevice;
        } catch (err) {
            if (this.manager.options.logger) {
                this.manager.options.logger(`Error enrolling subdevice: ${err.message}`);
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
        const deviceList = await this.manager.httpClient.getDevices();
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

        const { MerossHubDevice } = require('../controller/hub-device');
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
        await this.manager.mqtt.init({
            uuid: deviceInfo.uuid,
            domain: deviceInfo.domain || this.manager.mqttDomain
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
     * @throws {CommandTimeoutError} If query times out
     * @throws {MqttError} If MQTT connection fails
     * @private
     */
    async _queryDeviceAbilities(deviceUuid, domain, timeout = 5000) {
        if (!this.manager.authenticated || !this.manager.token || !this.manager.key || !this.manager.userId) {
            if (this.manager.options.logger) {
                this.manager.options.logger('Cannot query abilities: not authenticated');
            }
            return null;
        }

        const mqttDomain = domain || this.manager.mqttDomain;

        if (!this.manager.mqttConnections[mqttDomain] || !this.manager.mqttConnections[mqttDomain].client) {
            const minimalDev = { uuid: deviceUuid, domain: mqttDomain };
            await this.manager.mqtt.init(minimalDev);
        }

        const mqttConnection = this.manager.mqttConnections[mqttDomain];

        if (!mqttConnection.client.connected) {
            const connectionPromise = this.manager._mqttConnectionPromises.get(mqttDomain);
            if (!connectionPromise) {
                return null;
            }
            try {
                await connectionPromise;
            } catch {
                return null;
            }
        }

        if (!this.manager.clientResponseTopic) {
            if (this.manager.options.logger) {
                this.manager.options.logger('Client response topic not set');
            }
            return null;
        }

        const message = this.manager.mqtt.encode('GET', 'Appliance.System.Ability', {}, deviceUuid);
        const { messageId } = message.header;

        const { CommandTimeoutError } = require('../model/exception');

        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                if (this.manager._pendingMessagesFutures.has(messageId)) {
                    this.manager._pendingMessagesFutures.delete(messageId);
                    reject(new CommandTimeoutError(
                        `Ability query timeout after ${timeout}ms`,
                        deviceUuid,
                        timeout,
                        { method: 'GET', namespace: 'Appliance.System.Ability' }
                    ));
                }
            }, timeout);

            this.manager._pendingMessagesFutures.set(messageId, {
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
                const { buildDeviceRequestTopic } = require('../utilities/mqtt');
                const topic = buildDeviceRequestTopic(deviceUuid);
                mqttConnection.client.publish(topic, JSON.stringify(message), (err) => {
                    if (err) {
                        if (this.manager._pendingMessagesFutures.has(messageId)) {
                            clearTimeout(timeoutHandle);
                            this.manager._pendingMessagesFutures.delete(messageId);
                        }
                        reject(err);
                    }
                });
            } catch (err) {
                if (this.manager._pendingMessagesFutures.has(messageId)) {
                    clearTimeout(timeoutHandle);
                    this.manager._pendingMessagesFutures.delete(messageId);
                }
                reject(err);
            }
        }).catch((error) => {
            if (this.manager.options.logger) {
                this.manager.options.logger(`Error querying abilities for ${deviceUuid}: ${error.message}`);
            }
            return null;
        });
    }
}

module.exports = ManagerDevices;
