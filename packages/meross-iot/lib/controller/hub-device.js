'use strict';

const { MerossDevice } = require('./device');

/**
 * Hub device class that manages subdevices connected through a Meross hub.
 *
 * Extends MerossDevice to add hub-specific functionality for managing and routing
 * commands to subdevices (sensors, valves, etc.). Hub devices act as gateways that
 * allow multiple subdevices to communicate over a single MQTT connection, since
 * subdevices cannot authenticate directly with the Meross cloud.
 *
 * @class MerossHubDevice
 * @extends MerossDevice
 * @example
 * // Hub devices are created automatically when devices with hub capabilities are discovered
 * const devices = await merossCloud.getDevices();
 * const hub = devices.find(d => d instanceof MerossHubDevice);
 *
 * // Get all subdevices connected to the hub
 * const subdevices = hub.getSubdevices();
 * console.log(`Hub has ${subdevices.length} subdevices`);
 *
 * // Get a specific subdevice by ID
 * const sensor = hub.getSubdevice('sensor123');
 * if (sensor) {
 *     console.log(`Found sensor: ${sensor.name}`);
 * }
 */
class MerossHubDevice extends MerossDevice {
    /**
     * Creates a new MerossHubDevice instance.
     *
     * @param {MerossCloud} cloudInstance - The MerossCloud manager instance
     * @param {Object} dev - Device information object from the API (contains deviceType, uuid, etc.)
     * @param {Array<Object>} [subDeviceList] - Initial list of subdevices (for backward compatibility).
     *                                         Subdevices should be registered using {@link MerossHubDevice#registerSubdevice} instead.
     */
    constructor(cloudInstance, dev, subDeviceList) {
        super(cloudInstance, dev);
        // Map provides O(1) lookup by subdevice ID
        this._subDevices = new Map();
        // Legacy array format maintained for backward compatibility with discovery code
        this.subDeviceList = subDeviceList || [];
    }

    /**
     * Gets all registered subdevices connected to this hub.
     *
     * @returns {Array<MerossSubDevice>} Array of all registered subdevice instances
     * @example
     * const subdevices = hub.getSubdevices();
     * for (const subdevice of subdevices) {
     *     console.log(`Subdevice: ${subdevice.name} (${subdevice.type})`);
     * }
     */
    getSubdevices() {
        return Array.from(this._subDevices.values());
    }

    /**
     * Gets a specific subdevice by its ID.
     *
     * @param {string} subdeviceId - The subdevice ID to look up
     * @returns {MerossSubDevice|null} The subdevice instance, or null if not found
     * @example
     * const sensor = hub.getSubdevice('sensor123');
     * if (sensor) {
     *     const temp = sensor.getLastSampledTemperature();
     *     console.log(`Temperature: ${temp}°C`);
     * }
     */
    getSubdevice(subdeviceId) {
        return this._subDevices.get(subdeviceId) || null;
    }

    /**
     * Registers a subdevice with this hub.
     *
     * Adds a subdevice to the hub's internal registry for lookup and management.
     * Prevents duplicate registrations to avoid state conflicts from multiple instances.
     *
     * @param {MerossSubDevice} subdevice - The subdevice instance to register
     * @throws {UnknownDeviceTypeError} If the subdevice is invalid or missing a subdeviceId
     * @example
     * const subdevice = buildSubdevice(subdeviceInfo, hubUuid, hubAbilities, manager, hub);
     * hub.registerSubdevice(subdevice);
     *
     * // Now the subdevice can be retrieved
     * const retrieved = hub.getSubdevice(subdevice.subdeviceId);
     */
    registerSubdevice(subdevice) {
        if (!subdevice || !subdevice.subdeviceId) {
            const { UnknownDeviceTypeError } = require('../model/exception');
            throw new UnknownDeviceTypeError('Invalid subdevice: must have subdeviceId');
        }

        if (this._subDevices.has(subdevice.subdeviceId)) {
            const logger = this.cloudInst?.options?.logger || console.info;
            logger(`Subdevice ${subdevice.subdeviceId} has already been registered to this HUB (${this.name || this.uuid})`);
            return;
        }

        this._subDevices.set(subdevice.subdeviceId, subdevice);
    }

    /**
     * Refreshes the hub device state and all registered subdevices.
     *
     * Calls the parent implementation to refresh the hub's own state. Feature modules
     * may override this method to also refresh subdevice states in a single operation.
     *
     * @returns {Promise<void>} Promise that resolves when state refresh is complete
     * @example
     * await hub.refreshState();
     * // Hub and subdevice states are now up to date
     */
    async refreshState() {
        await super.refreshState();
    }

    /**
     * Handles incoming messages and routes hub-specific notifications to subdevices.
     *
     * Parent implementation routes push notifications to handlePushNotification if provided
     * by feature modules, which can then distribute to subdevices.
     *
     * @param {Object} message - The message object
     */
    handleMessage(message) {
        super.handleMessage(message);
    }

    /**
     * Sets up push notification routing when device connects.
     *
     * Registers fallback routing for push notifications that support subdevice routing.
     * Primary routing is handled by feature modules via handlePushNotification override.
     *
     */
    connect() {
        super.connect();

        this.on('pushNotification', (notification) => {
            if (notification && typeof notification.routeToSubdevices === 'function') {
                notification.routeToSubdevices(this);
            }
        });
    }

    /**
     * Gets the list of subdevices from the hub device.
     *
     * Queries the hub device directly to retrieve the current list of connected subdevices.
     * Useful for discovering subdevices or refreshing the subdevice list after physical changes.
     *
     * @returns {Promise<Object>} Promise that resolves with subdevice list data from the hub
     * @example
     * const subdeviceList = await hub.getHubSubdeviceList();
     * console.log('Subdevices from hub:', subdeviceList);
     */
    async getHubSubdeviceList() {
        return await this.publishMessage('GET', 'Appliance.Hub.SubdeviceList', {}, null);
    }

    /**
     * Gets hub exception/error information.
     *
     * Retrieves error or exception information from the hub device for debugging
     * hub-related issues.
     *
     * @returns {Promise<Object>} Promise that resolves with exception/error data from the hub
     * @example
     * const exception = await hub.getHubException();
     * if (exception && exception.errors) {
     *     console.log('Hub errors:', exception.errors);
     * }
     */
    async getHubException() {
        return await this.publishMessage('GET', 'Appliance.Hub.Exception', {}, null);
    }
}

module.exports = { MerossHubDevice };

