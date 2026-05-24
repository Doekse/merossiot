'use strict';

const { MerossDevice } = require('./device');
const { ConnectivityCodec } = require('../enums');
const DeviceRegistry = require('./registry');
const { MerossDeviceError } = require('../exception');
const { dispatch, getNamespaceDescriptors } = require('../dispatcher');
const {
    getSubdeviceCapability
} = require('../abilities/hub');
const { SUBDEVICE_REFRESH_ABILITIES } = require('./device');

/**
 * Base class for all Meross subdevices.
 *
 * Subdevices connect through a hub device and route all commands through the hub.
 * They cannot communicate directly with the Meross cloud, so all MQTT messages and
 * HTTP requests must go through the parent hub device.
 *
 * Subdevices include sensors (temperature/humidity, water leak, smoke), thermostat
 * valves, and other devices that connect to hub devices rather than directly to WiFi.
 *
 * State updates are delivered through the parent hub: `meross.subscription.subscribe(hub)`
 * and `deviceUpdate:${hub.uuid}` (`update.device` identifies the subdevice). Use
 * {@link MerossSubDevice#getState} or {@link MerossSubDevice#refreshState} for reads.
 *
 * @class MerossSubDevice
 * @extends MerossDevice
 * @example
 * // Subdevices are typically created automatically when hubs are discovered
 * const hub = devices.find(d => d instanceof MerossHubDevice);
 * const subdevices = hub.getSubdevices();
 *
 * // Access subdevice properties
 * const sensor = subdevices[0];
 * console.log(`Subdevice ID: ${sensor.subdeviceId}`);
 * console.log(`Hub UUID: ${sensor.hub.uuid}`);
 * console.log(`Name: ${sensor.name}`);
 */
class MerossSubDevice extends MerossDevice {
    /**
     * Creates a new MerossSubDevice instance
     * @param {string} hubDeviceUuid - UUID of the hub device this subdevice belongs to
     * @param {string} subdeviceId - Subdevice ID
     * @param {import('../meross')} manager - Root Meross instance
     * @param {Object} [kwargs] - Additional subdevice information
     * @param {string} [kwargs.subDeviceType] - Subdevice type (or type)
     * @param {string} [kwargs.subDeviceName] - Subdevice name (or name)
     * @throws {MerossDeviceError} If hub device is not found or subdevice ID is missing
     */
    constructor(hubDeviceUuid, subdeviceId, manager, kwargs = {}) {
        const hubs = manager.devices.find({ deviceUuids: [hubDeviceUuid] });
        if (!hubs || hubs.length < 1) {
            throw new MerossDeviceError(`Specified hub device ${hubDeviceUuid} is not present`, 'UNKNOWN_DEVICE_TYPE');
        }
        const hub = hubs[0];

        super(manager, hubDeviceUuid, hub.mqttHost, hub.mqttPort);

        this._hub = hub;
        this._subdeviceId = subdeviceId;
        this._type = kwargs.subDeviceType || kwargs.type;
        this._name = kwargs.subDeviceName || kwargs.name;

        if (!this._subdeviceId) {
            throw new MerossDeviceError('Subdevice ID is required', 'UNKNOWN_DEVICE_TYPE');
        }

        // Subdevices share hub's network configuration since they communicate through the hub
        this.lanIp = hub.lanIp;

        this._connectivityWire = -1;
        this._batteryStateByChannel = new Map();
    }

    /**
     * Gets the subdevice ID.
     *
     * This is the unique identifier for this subdevice within the hub.
     *
     * @returns {string} Subdevice ID
     */
    get subdeviceId() {
        return this._subdeviceId;
    }

    /**
     * Gets the hub device this subdevice belongs to.
     *
     * All subdevice commands are routed through this hub device.
     *
     * @returns {MerossHubDevice} Hub device instance
     */
    get hub() {
        return this._hub;
    }

    /**
     * Gets the subdevice type
     * @returns {string|undefined} Subdevice type or undefined if not available
     */
    get type() {
        return this._type;
    }

    /**
     * Gets the subdevice name
     * @returns {string} Subdevice name or subdevice ID if name not available
     */
    get name() {
        return this._name || this._subdeviceId;
    }

    /**
     * Gets the UUID (uses hub's UUID for MQTT routing).
     *
     * Subdevices use their parent hub's UUID for MQTT message routing since
     * they cannot communicate directly with the Meross cloud.
     *
     * @returns {string} Hub device UUID
     */
    get uuid() {
        return this._hub.uuid;
    }

    /**
     * Gets the internal ID used for device registry.
     *
     * Generates and caches a composite ID combining hub UUID and subdevice ID on first
     * access (format: #BASE:{hubUuid}#SUB:{subdeviceId}) to ensure unique identification
     * in the device registry.
     *
     * @returns {string} Internal ID string
     * @throws {MerossDeviceError} If hub UUID is missing
     */
    get internalId() {
        if (this._internalId) {
            return this._internalId;
        }

        const hubUuid = this._hub.uuid || this._hub.dev?.uuid;
        if (!hubUuid) {
            throw new MerossDeviceError('Cannot generate internal ID: hub missing UUID', 'UNKNOWN_DEVICE_TYPE');
        }

        this._internalId = DeviceRegistry.generateInternalId(hubUuid, true, hubUuid, this._subdeviceId);
        return this._internalId;
    }

    /**
     * Connectivity of the subdevice, derived from the hub when the hub is not online.
     *
     * @returns {'online'|'offline'|'not-online'|'upgrading'|'unknown'}
     */
    get connectivity() {
        if (!this._hub.isOnline) {
            return this._hub.connectivity;
        }
        return ConnectivityCodec.fromWire(this._connectivityWire);
    }

    /**
     * Whether this subdevice is reachable for commands (hub and subdevice both online).
     *
     * @returns {boolean}
     */
    get isOnline() {
        return this.connectivity === 'online';
    }

    /**
     * Refreshes this subdevice by polling only its wired hub sensor abilities.
     *
     * Each ability {@link MerossSubDevice#refreshState|get()} targets this subdevice via
     * `subdeviceId`, so sibling subdevices are not included in hub GET payloads.
     *
     * @returns {Promise<void>} Promise that resolves when state is refreshed
     * @example
     * await sensor.refreshState();
     * // Sensor state is now updated
     */
    async refreshState() {
        const capability = getSubdeviceCapability(this);
        const abilityKeys = capability
            ? (SUBDEVICE_REFRESH_ABILITIES[capability] || [])
            : [];

        const logger = this.meross?.options?.logger || console.debug;

        for (const key of abilityKeys) {
            const ability = this[key];
            if (!ability || typeof ability.get !== 'function') {
                continue;
            }

            try {
                const options = key === 'mts100' ? { complete: true } : {};
                await ability.get(options);
            } catch (error) {
                logger(`Failed to refresh ${key} for subdevice ${this.subdeviceId}: ${error.message}`);
            }
        }

        this.emit('stateChange', {
            type: 'refresh',
            timestamp: this.lastFullUpdateTimestamp || Date.now(),
            value: this.getState(),
            source: 'poll'
        });
    }

    /**
     * Snapshot of subdevice state for subscriptions (channel `0` per feature type).
     *
     * @returns {Object} State object aligned with {@link MerossDevice#getState} shape
     */
    getState() {
        const state = {
            online: this.connectivity,
            timestamp: this.lastFullUpdateTimestamp || Date.now(),
            subdeviceId: this.subdeviceId,
            hubUuid: this.uuid
        };

        Object.assign(state, this._collectDescriptorState());
        return state;
    }

    /**
     * @private
     * @param {Object|undefined} header - Hub-forwarded MQTT header
     * @returns {string} `stateChange` source label
     */
    _resolveHubMessageSource(header) {
        const method = header?.method;
        if (method === 'PUSH') {
            return 'push';
        }
        if (method === 'GETACK' || method === 'SETACK') {
            return 'response';
        }
        return 'hub';
    }

    /**
     * Last known battery level (0–100) from the most recent refresh or PUSH.
     *
     * @returns {number|null} Battery percentage, or null if unknown / unsupported
     */
    getBattery() {
        const percent = this._batteryStateByChannel.get(0)?.percent;
        return percent !== undefined && percent !== null ? percent : null;
    }

    /**
     * Publishes a message by routing it through the hub device.
     *
     * All subdevice commands must be routed through the hub since subdevices cannot
     * communicate directly with the Meross cloud. Delegates to the hub's publishMessage() method.
     *
     * @param {string} method - Message method ('GET', 'SET', etc.)
     * @param {string} namespace - Message namespace (e.g., 'Appliance.Hub.Sensor.TempHum')
     * @param {Object} payload - Message payload (must include subdevice ID)
     * @param {number|null} [transportMode=null] - Transport mode from {@link TransportMode} enum
     * @returns {Promise<{header: Object, payload: Object}>} Resolves with the full message
     *   envelope so the header carries namespace and ordering timestamps alongside the payload.
     * @example
     * const { payload } = await sensor.publishMessage(
     *     'GET',
     *     'Appliance.Hub.Sensor.TempHum',
     *     { id: sensor.subdeviceId }
     * );
     */
    async publishMessage(method, namespace, payload, transportMode = null) {
        return await this._hub.publishMessage(method, namespace, payload, transportMode);
    }

    /**
     * Applies a hub-forwarded message to this subdevice.
     *
     * Subdevices do not receive raw MQTT; the hub strips the envelope and
     * forwards `{ header, namespace, payload }` (possibly a single item from
     * a larger hub payload). This override intentionally shadows
     * {@link MerossDevice#handleMessage} — see JSDoc there for the MQTT-raw shape.
     *
     * Routes through the shared namespace registry ({@link module:dispatcher}) like
     * standalone devices via {@link MerossDevice#_routeMessageToAbility}. Descriptors
     * are registered in hub ability modules (see requires at end of this file).
     * Ordering gate keys
     * match the former handler method names (e.g. `_handleSensorAll`) so namespaces
     * that share a handler share one timestamp gate.
     *
     * @param {{ header?: object, namespace: string, payload: object }} message - Hub-forwarded envelope
     * @returns {Promise<void>}
     */
    async handleMessage({ header, namespace, payload }) {
        this.emit('message', { header, namespace, payload });

        const source = this._resolveHubMessageSource(header);

        if (header === null || header === undefined) {
            const descriptors = getNamespaceDescriptors(namespace);
            for (const descriptor of descriptors) {
                dispatch(this, descriptor, payload, source, null, undefined);
            }
            return;
        }

        this._routeMessageToAbility({ ...header, namespace }, payload, source);
    }
}

module.exports = {
    MerossSubDevice
};

