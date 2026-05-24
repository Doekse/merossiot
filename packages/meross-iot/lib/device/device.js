'use strict';

const EventEmitter = require('events');
const { ConnectivityCodec } = require('../enums');
const { parsePushNotification } = require('../push');
const DeviceRegistry = require('./registry');
const ChannelInfo = require('./channel');
const ApiDeviceInfo = require('../api/device');
const { MerossDeviceError } = require('../exception');

const Heartbeat = require('../utilities/heartbeat');
const { SUBDEVICE_FAMILIES } = require('../abilities/hub');

const { dispatch, getNamespaceDescriptors } = require('../dispatcher');

/**
 * Single registry of device abilities: factory wiring, optional state caches, capability
 * reporters, and hub subdevice family tags for derived subdevice maps.
 *
 * @type {ReadonlyArray<Record<string, unknown>>}
 */
const ABILITIES = [
    {
        key: 'system',
        always: true,
        create: require('../abilities/system')
    },
    {
        key: 'encryption',
        always: true,
        create: require('../abilities/encryption')
    },
    require('../abilities/toggle').ability,
    require('../abilities/light').ability,
    require('../abilities/thermostat').ability,
    require('../abilities/roller-shutter').ability,
    require('../abilities/garage').ability,
    require('../abilities/diffuser').ability,
    require('../abilities/spray').ability,
    require('../abilities/consumption').ability,
    require('../abilities/electricity').ability,
    require('../abilities/timer').ability,
    require('../abilities/trigger').ability,
    require('../abilities/presence').ability,
    require('../abilities/alarm').ability,
    require('../abilities/child-lock').ability,
    require('../abilities/screen').ability,
    require('../abilities/runtime').ability,
    require('../abilities/config').ability,
    require('../abilities/dnd').ability,
    require('../abilities/temp-unit').ability,
    require('../abilities/smoke-config').ability,
    require('../abilities/hub-smoke').ability,
    require('../abilities/hub-temp-hum').ability,
    {
        key: 'sensorAll',
        namespaces: ['Appliance.Hub.Sensor.All'],
        family: ['tempHum', 'doorWindow', 'waterLeak', 'smoke']
    },
    require('../abilities/hub-alert').ability,
    require('../abilities/hub-adjust').ability,
    require('../abilities/hub-water-leak').ability,
    require('../abilities/hub-door-window').ability,
    require('../abilities/hub-mts100').ability,
    require('../abilities/sensor-history').ability,
    require('../abilities/digest-timer').ability,
    require('../abilities/digest-trigger').ability,
    require('../abilities/control').ability,
    require('../abilities/hub').ability
];

/**
 * Returns ability registry rows tagged for a hub subdevice family.
 *
 * Places the shared {@link sensorAll} row after the family's primary ability so
 * derived namespace lists match the former subdevice-types ordering.
 *
 * @param {keyof typeof SUBDEVICE_FAMILIES} family
 * @returns {typeof ABILITIES}
 */
function abilitiesInFamily(family) {
    const rows = ABILITIES.filter((a) => {
        if (Array.isArray(a.family)) {
            return a.family.includes(family);
        }
        return a.family === family;
    });
    const sensorAllRow = rows.find((a) => a.key === 'sensorAll');
    if (!sensorAllRow) {
        return rows;
    }
    const others = rows.filter((a) => a.key !== 'sensorAll');
    if (family === 'tempHum') {
        const tempHumIdx = others.findIndex((a) => a.key === 'tempHum');
        if (tempHumIdx === -1) {
            return rows;
        }
        return [
            ...others.slice(0, tempHumIdx + 1),
            sensorAllRow,
            ...others.slice(tempHumIdx + 1)
        ];
    }
    return [...others, sensorAllRow];
}

const SUBDEVICE_ABILITY_MAPPING = (() => {
    const out = {};
    for (const [family, { models }] of Object.entries(SUBDEVICE_FAMILIES)) {
        const namespaces = abilitiesInFamily(family).flatMap((a) => a.namespaces || []);
        for (const model of models) {
            out[model] = namespaces;
        }
    }
    return out;
})();

const SUBDEVICE_REFRESH_ABILITIES = Object.fromEntries(
    Object.keys(SUBDEVICE_FAMILIES).map((family) => [
        family,
        abilitiesInFamily(family).filter((a) => a.create).map((a) => a.key)
    ])
);
const { getMessageTimestamp } = require('../utilities/state-ordering');

/**
 * Maps a top-level `digest` field to the Meross namespace and `payload` key used by
 * ability descriptors registered with {@link module:dispatcher}.
 *
 * @type {ReadonlyArray<{ digestKey: string, namespace: string, payloadKey: string }>}
 */
const DIGEST_FLAT_ROUTES = [
    { digestKey: 'togglex', namespace: 'Appliance.Control.ToggleX', payloadKey: 'togglex' },
    { digestKey: 'light', namespace: 'Appliance.Control.Light', payloadKey: 'light' },
    { digestKey: 'spray', namespace: 'Appliance.Control.Spray', payloadKey: 'spray' },
    { digestKey: 'timerx', namespace: 'Appliance.Control.TimerX', payloadKey: 'timerx' }
];

/**
 * Base class for all Meross cloud devices.
 *
 * Manages device communication via MQTT and LAN HTTP, maintains cached state per channel,
 * and composes feature modules to provide device-specific capabilities. All device commands
 * and state updates flow through this class.
 *
 * Consumers receive state through {@link ManagerSubscription} (`meross.subscription`), not
 * `stateChange` events on the device (internal wiring for subscription and tests).
 *
 * @extends EventEmitter
 */
class MerossDevice extends EventEmitter {
    /**
     * Creates a new MerossDevice instance
     * @param {import('../meross')} meross - Root Meross instance
     * @param {Object|string} devOrUuid - Device information object from the API, or device UUID (string) for subdevices
     * @param {string} [devOrUuid.uuid] - Device UUID (if devOrUuid is object)
     * @param {string} [devOrUuid.devName] - Device name
     * @param {string} [devOrUuid.fmwareVersion] - Firmware version
     * @param {string} [devOrUuid.hdwareVersion] - Hardware version
     * @param {number} [devOrUuid.onlineStatus] - Initial online status wire code from HTTP API
     * @param {string} [devOrUuid.connectivity] - Initial connectivity (`'online'`, `'offline'`, etc.)
     * @param {string} [devOrUuid.deviceType] - Device type
     * @param {string} [devOrUuid.domain] - MQTT domain
     * @param {string} [domain] - MQTT domain (for subdevices, passed separately)
     * @param {number} [port] - MQTT port (for subdevices, passed separately)
     */
    constructor(meross, devOrUuid, domain = null, port = null) {
        super();

        // Accept both object and string to support subdevices initialized with UUID only,
        // which lack full HTTP device info at construction time
        const dev = typeof devOrUuid === 'string' ? { uuid: devOrUuid } : devOrUuid;

        if (!dev || !dev.uuid) {
            throw new MerossDeviceError('Device UUID is required', 'UNKNOWN_DEVICE_TYPE');
        }

        this._initializeCoreProperties(dev, domain, port);
        this._initializeConnectionState(meross);
        this._initializeApiInfo(dev);

        this._initializeAbilities(null);
    }

    /**
     * Initializes core device properties.
     *
     * Checks for getter-only properties before assignment to prevent overwriting subdevice
     * getters that compute values dynamically (e.g., uuid delegates to hub UUID).
     *
     * @private
     * @param {Object} dev - Device information object
     * @param {string|null} domain - MQTT domain
     * @param {number|null} port - MQTT port
     */
    _initializeCoreProperties(dev, domain, port) {
        // Subdevices override uuid, name, and connectivity as getter-only properties
        // to compute values from parent hub, so we must check before assignment
        if (!MerossDevice._isGetterOnly(this, 'uuid')) {
            this.uuid = dev.uuid;
        }

        if (!MerossDevice._isGetterOnly(this, 'name')) {
            this.name = dev.devName || dev.uuid || 'unknown';
        }

        this.deviceType = dev.deviceType;
        this.firmwareVersion = dev.fmwareVersion || 'unknown';
        this.hardwareVersion = dev.hdwareVersion || 'unknown';
        this.chipType = null;
        this.homekitVersion = null;
        this.firmwareCompileTime = null;
        this.wifiEncrypt = null;
        this.wifiMac = null;
        this.userId = null;
        this.domain = domain || dev.domain;

        if (!MerossDevice._isGetterOnly(this, 'connectivity')) {
            this._connectivityWire = MerossDevice._normalizeConnectivityWire(dev);
        }

        this.abilities = null;
        this.capabilities = null;
        this.macAddress = null;
        this.lanIp = null;
        this.mqttHost = null;
        this.mqttPort = port;
        this.rssi = null;
        this.wifiSignal = null;
        this.signalStrength = null;
        this.wifiSsid = null;
        this.wifiChannel = null;
        this.wifiSnr = null;
        this.wifiLinkStatus = null;
        this.wifiGatewayMac = null;
        this.wifiDisconnectCount = null;
        this.wifiDisconnectDetail = null;
        this.lastFullUpdateTimestamp = null;
        // Lazy initialization avoids registry computation during construction,
        // deferring ID generation until first access
        this._internalId = null;

        // Extended HTTP device info properties populated from ApiDeviceInfo when available
        this.reservedDomain = null;
        this.subType = null;
        this.bindTime = null;
        this.skillNumber = null;
        this.userDevIcon = null;
        this.iconType = null;
        this.region = null;
        this.devIconId = null;
    }

    /**
     * Initializes ability handlers and their dependent state caches from abilities.
     *
     * Device abilities may arrive after construction (e.g., after System.All), so this
     * method keeps ability wiring idempotent and creates only handlers/caches needed
     * for namespaces declared by the device.
     *
     * @private
     * @param {Object|null} abilities - Device abilities keyed by namespace, or null to create only always-on abilities
     */
    _initializeAbilities(abilities) {
        for (const entry of ABILITIES) {
            if (!entry.create || this[entry.key]) {
                continue;
            }

            const shouldCreate = entry.always
                || (abilities && entry.namespaces?.some((ns) => ns in abilities));
            if (!shouldCreate) {
                continue;
            }

            this[entry.key] = entry.create(this);
            for (const cache of entry.caches || []) {
                if (!this[cache]) {
                    this[cache] = new Map();
                }
            }
        }
    }

    /**
     * Initializes connection state and message tracking.
     *
     * @private
     * @param {import('../meross')} meross - Root Meross instance
     */
    _initializeConnectionState(meross) {
        this.meross = meross;
        this.deviceConnected = false;
        this.clientResponseTopic = null;
        this.waitingMessageIds = {};
        // Track push notification activity to detect when device is actively sending updates,
        // allowing polling to be reduced when push notifications are active
        this._pushNotificationActive = false;
        this._lastPushNotificationTime = null;
        this._pushInactivityTimer = null;
        this._pushActiveNamespaces = new Map();
        this._pushNamespaceInactivityTimers = new Map();
        this._metricsPollingIntervals = new Map();
        this._metricsPollingConfig = null;
        this._metricsLastPollTimes = new Map();
        // Track device initialization state
        this._deviceInitializedEmitted = false;
        this._initializationTimeout = null;
        this._readyResolve = null;
        this._readyPromise = new Promise((resolve) => {
            this._readyResolve = resolve;
        });
        // Initialize heartbeat monitoring for online/offline detection
        this._heartbeat = new Heartbeat(this);
    }

    /**
     * Initializes HTTP device info and channels from raw API data.
     *
     * Uses ApiDeviceInfo.fromDict() to normalize data types (bindTime from Unix timestamp
     * to Date, connectivity normalization) before copying properties directly to the device
     * instance. The ApiDeviceInfo instance is not stored to avoid redundancy.
     *
     * @private
     * @param {Object} dev - Device information object from API response
     */
    _initializeApiInfo(dev) {
        this.channels = [];

        if (dev && dev.uuid && typeof dev === 'object' && dev.deviceType !== undefined) {
            try {
                const apiInfo = ApiDeviceInfo.fromDict(dev);
                this.channels = MerossDevice._parseChannels(dev.channels);
                this._buildCapabilities();

                // Copy extended properties directly to device instance; bindTime already
                // normalized to Date by ApiDeviceInfo.fromDict()
                this.reservedDomain = apiInfo.reservedDomain || null;
                this.subType = apiInfo.subType || null;
                this.bindTime = apiInfo.bindTime || null;
                this.skillNumber = apiInfo.skillNumber || null;
                this.userDevIcon = apiInfo.userDevIcon || null;
                this.iconType = apiInfo.iconType || null;
                this.region = apiInfo.region || null;
                this.devIconId = apiInfo.devIconId || null;
            } catch (error) {
                // Device may be created without HTTP info (e.g., subdevices initialized with UUID only)
            }
        }
    }

    /**
     * Checks if a property is getter-only (has getter but no setter).
     *
     * Traverses the prototype chain to detect getter-only properties that subdevices
     * use to compute values dynamically (e.g., uuid from hub).
     *
     * @static
     * @private
     * @param {Object} instance - Instance to check
     * @param {string} propName - Property name to check
     * @returns {boolean} True if property is getter-only, false otherwise
     */
    static _isGetterOnly(instance, propName) {
        let proto = Object.getPrototypeOf(instance);
        while (proto && proto !== Object.prototype) {
            const desc = Object.getOwnPropertyDescriptor(proto, propName);
            if (desc) {
                return desc.get && !desc.set;
            }
            proto = Object.getPrototypeOf(proto);
        }
        return false;
    }


    /**
     * Connectivity label exposed to consumers (wire codes stay in `_connectivityWire`).
     *
     * @returns {'online'|'offline'|'not-online'|'upgrading'|'unknown'}
     */
    get connectivity() {
        return ConnectivityCodec.fromWire(this._connectivityWire);
    }

    /**
     * Whether the device accepts commands.
     *
     * @returns {boolean}
     */
    get isOnline() {
        return ConnectivityCodec.isOnline(this._connectivityWire);
    }

    /**
     * Normalizes HTTP API or consumer input to a Meross wire connectivity code.
     *
     * @private
     * @param {Object} dev - Device info with optional `connectivity` string or `onlineStatus` wire code
     * @returns {number}
     */
    static _normalizeConnectivityWire(dev) {
        if (dev.connectivity !== undefined && typeof dev.connectivity === 'string') {
            const wire = ConnectivityCodec.toWire(dev.connectivity);
            return wire !== undefined ? wire : -1;
        }
        if (dev.onlineStatus !== undefined && typeof dev.onlineStatus === 'number') {
            return dev.onlineStatus;
        }
        return -1;
    }

    /**
     * Updates the device's abilities dictionary.
     *
     * Abilities determine which features and namespaces the device supports. The encryption
     * feature must be notified because key derivation depends on ability flags.
     *
     * @param {Object} abilities - Device abilities object
     */
    _updateAbilities(abilities) {
        // Only update if abilities actually changed to avoid redundant capability building
        const abilitiesChanged = !this.abilities || JSON.stringify(this.abilities) !== JSON.stringify(abilities);

        if (!abilitiesChanged) {
            return;
        }

        this.abilities = abilities;
        this._initializeAbilities(abilities);
        if (this.encryption && typeof this.encryption._updateAbilitiesWithEncryption === 'function') {
            this.encryption._updateAbilitiesWithEncryption(abilities);
        }
        this._buildCapabilities();
    }

    /**
     * Whether an {@link ABILITIES} entry applies to this device's current ability set.
     *
     * Entries without `namespaces` (e.g. hub) defer filtering to their `getCapabilities` reporter.
     *
     * @private
     * @param {Record<string, unknown>} entry
     * @returns {boolean}
     */
    _abilityEntryApplies(entry) {
        if (!this.abilities) {
            return false;
        }
        if (!entry.namespaces?.length) {
            return true;
        }
        return entry.namespaces.some((ns) => ns in this.abilities);
    }

    /**
     * Builds the normalized capabilities map from device abilities and channels.
     *
     * Provides a user-friendly capability map that abstracts away Meross namespace strings,
     * making it easy for integrators to discover device features without dealing with protocol details.
     *
     * @private
     */
    _buildCapabilities() {
        if (!this.abilities) {
            this.capabilities = null;
            return;
        }

        const channelIds = this.channels ? this.channels.map(ch => ch.index) : [0];
        const channelCount = channelIds.length;

        const caps = {
            channels: {
                ids: channelIds,
                count: channelCount
            }
        };

        for (const entry of ABILITIES) {
            if (!entry.getCapabilities || !this._abilityEntryApplies(entry)) {
                continue;
            }
            const featureCaps = entry.getCapabilities(this, channelIds);
            if (featureCaps) {
                caps[entry.key] = featureCaps;
            }
        }

        this.capabilities = caps;
    }

    /**
     * Returns sorted, unique channel indices for this device.
     *
     * Multi-outlet and multi-channel devices expose one index per controllable endpoint.
     * Mirrors {@link MerossDevice#capabilities}.channels.ids when capabilities are built.
     *
     * @returns {number[]} Channel indices (defaults to `[0]` when no channel metadata exists)
     */
    getChannelIds() {
        if (this.capabilities?.channels?.ids?.length) {
            return [...this.capabilities.channels.ids];
        }
        if (this.channels && this.channels.length > 0) {
            return [...new Set(this.channels.map(ch => ch.index))].sort((a, b) => a - b);
        }
        return [0];
    }

    /**
     * Updates the device's MAC address.
     *
     * MAC address is used by the encryption feature for key derivation in some firmware versions.
     *
     * @param {string} mac - MAC address string
     */
    updateMacAddress(mac) {
        this.macAddress = mac;
        if (this.encryption && typeof this.encryption._updateMacAddressWithEncryption === 'function') {
            this.encryption._updateMacAddressWithEncryption(mac);
        }
    }


    /**
     * Gets the internal ID used for device registry.
     *
     * Generates and caches the ID on first access to avoid repeated computation during
     * device lookup operations.
     *
     * @returns {string} Internal ID string
     * @throws {MerossDeviceError} If device UUID is missing
     */
    get internalId() {
        if (this._internalId) {
            return this._internalId;
        }

        if (!this.uuid) {
            throw new MerossDeviceError('Cannot generate internal ID: device missing UUID', 'UNKNOWN_DEVICE_TYPE');
        }

        this._internalId = DeviceRegistry.generateInternalId(this.uuid);
        return this._internalId;
    }

    /**
     * Refreshes the device state by fetching System.All data.
     *
     * System.All provides complete device state in a single request, avoiding multiple
     * round trips. Emits a 'stateRefreshed' event with the updated state.
     *
     * @returns {Promise<void>} Promise that resolves when state is refreshed
     * @throws {MerossDeviceError} If device does not support refreshState()
     */
    async refreshState() {
        if (this.system && typeof this.system.getAllData === 'function') {
            await this.system.getAllData();

            this.emit('stateChange', {
                type: 'refresh',
                timestamp: this.lastFullUpdateTimestamp || Date.now(),
                value: this.getState()
            });
        } else {
            throw new MerossDeviceError('Device does not support refreshState()', 'UNKNOWN_DEVICE_TYPE', { deviceType: this.deviceType });
        }
    }

    /**
     * Gets a snapshot of all current device state.
     *
     * Reuses dispatcher descriptors so subscription snapshots and emitted state-change
     * payloads stay aligned as new namespaces are added.
     *
     * @returns {Object} State object with all available features
     */
    getState() {
        const state = {
            online: this.connectivity,
            timestamp: this.lastFullUpdateTimestamp || Date.now()
        };

        Object.assign(state, this._collectDescriptorState());

        this._collectElectricityState(state);
        this._collectConsumptionState(state);

        return state;
    }

    /**
     * Builds per-`eventType` channel snapshots from registered namespace descriptors.
     *
     * @protected
     * @returns {Record<string, Record<number, object>>}
     */
    _collectDescriptorState() {
        const state = {};
        const seen = new Set();

        for (const namespace of Object.keys(this.abilities || {})) {
            const descriptors = getNamespaceDescriptors(namespace);
            for (const descriptor of descriptors) {
                if (!descriptor.stateMap || !descriptor.snapshot || !descriptor.eventType) {
                    continue;
                }

                if (seen.has(descriptor.stateMap)) {
                    continue;
                }
                seen.add(descriptor.stateMap);

                const stateMap = this[descriptor.stateMap];
                if (!stateMap || stateMap.size === 0) {
                    continue;
                }

                const perChannel = {};
                for (const [channel, channelState] of stateMap) {
                    const snap = descriptor.snapshot(channelState);
                    if (snap !== null && snap !== undefined) {
                        perChannel[channel] = snap;
                    }
                }

                if (Object.keys(perChannel).length > 0) {
                    state[descriptor.eventType] = perChannel;
                }
            }
        }

        return state;
    }

    /**
     * Collects electricity samples from the dedicated cache.
     *
     * Electricity remains outside descriptor wiring, so this helper keeps its
     * existing externally visible shape until that cache is refactored.
     *
     * @private
     * @param {Object} state - State object to populate
     */
    _collectElectricityState(state) {
        const stateMap = this._channelCachedSamples;
        if (!stateMap || stateMap.size === 0) {
            return;
        }

        state.electricity = {};
        for (const [channel, cached] of stateMap) {
            state.electricity[channel] = cached;
        }
    }

    /**
     * Collects consumption values from the dedicated cache.
     *
     * Consumption also bypasses descriptor routing today, so this helper keeps its
     * existing externally visible shape until that cache is refactored.
     *
     * @private
     * @param {Object} state - State object to populate
     */
    _collectConsumptionState(state) {
        const stateMap = this._channelCachedConsumption;
        if (!stateMap || stateMap.size === 0) {
            return;
        }

        state.consumption = {};
        for (const [channel, cached] of stateMap) {
            state.consumption[channel] = cached;
        }
    }

    /**
     * Tracks push notification activity.
     *
     * Marks device as actively sending push notifications and resets the inactivity
     * timer. Used to detect when devices are actively updating state.
     *
     * @private
     */
    _pushNotificationReceived(namespace = null) {
        this._lastPushNotificationTime = Date.now();
        this._pushNotificationActive = true;

        clearTimeout(this._pushInactivityTimer);
        this._pushInactivityTimer = setTimeout(() => {
            this._pushNotificationActive = false;
        }, 60000);

        if (!namespace) {
            return;
        }

        const now = Date.now();
        this._pushActiveNamespaces.set(namespace, now);

        const existingTimer = this._pushNamespaceInactivityTimers.get(namespace);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
            this._pushActiveNamespaces.delete(namespace);
            this._pushNamespaceInactivityTimers.delete(namespace);
        }, 60000);

        this._pushNamespaceInactivityTimers.set(namespace, timer);
    }

    /**
     * Checks if push notifications are currently active.
     *
     * Returns true if push notifications were received within the last 60 seconds,
     * indicating the device is actively updating state.
     *
     * @returns {boolean} True if push notifications received recently
     */
    isPushNotificationActive() {
        if (!this._pushNotificationActive) {
            return false;
        }

        if (!this._lastPushNotificationTime) {
            return false;
        }

        const timeSinceLastPush = Date.now() - this._lastPushNotificationTime;
        return timeSinceLastPush < 60000;
    }

    /**
     * Checks whether a namespace received a recent push update.
     *
     * Namespace-level activity tracking prevents redundant polling for data that
     * is already being refreshed by push notifications.
     *
     * @param {string} namespace - Namespace to check
     * @param {number} [maxAge=5000] - Maximum age in milliseconds for push freshness
     * @returns {boolean} True if namespace has recent push activity
     */
    hasRecentPushForNamespace(namespace, maxAge = 5000) {
        if (!namespace) {
            return false;
        }

        const pushTimestamp = this._pushActiveNamespaces.get(namespace);
        if (!pushTimestamp) {
            return false;
        }

        return (Date.now() - pushTimestamp) < maxAge;
    }

    /**
     * Starts periodic polling for metrics that do not reliably push updates.
     *
     * Polling remains opt-in because these requests trade additional network traffic
     * for fresher telemetry when devices do not emit relevant push notifications.
     *
     * @param {Object} [config={}] - Metrics polling configuration
     * @param {number} [config.electricityInterval=30000] - Electricity polling interval in ms (0 to disable)
     * @param {number} [config.consumptionInterval=60000] - Consumption polling interval in ms (0 to disable)
     * @param {number} [config.runtimeInterval=60000] - Runtime polling interval in ms (0 to disable)
     * @param {boolean} [config.smartCaching=true] - Skip polling when cache data is fresh
     * @param {number} [config.cacheMaxAge=10000] - Maximum cache age in ms before polling
     */
    startMetricsPolling(config = {}) {
        this.stopMetricsPolling();

        this._metricsPollingConfig = {
            electricityInterval: config.electricityInterval !== undefined ? config.electricityInterval : 30000,
            consumptionInterval: config.consumptionInterval !== undefined ? config.consumptionInterval : 60000,
            runtimeInterval: config.runtimeInterval !== undefined ? config.runtimeInterval : 60000,
            smartCaching: config.smartCaching !== false,
            cacheMaxAge: config.cacheMaxAge || 10000
        };

        const pollingConfig = this._metricsPollingConfig;

        if (pollingConfig.electricityInterval > 0 && this.electricity && typeof this.electricity.get === 'function') {
            const interval = setInterval(() => {
                this._pollElectricityMetrics().catch(() => {});
            }, pollingConfig.electricityInterval);
            this._metricsPollingIntervals.set('electricity', interval);
        }

        if (pollingConfig.consumptionInterval > 0 && this.consumption && typeof this.consumption.get === 'function') {
            const interval = setInterval(() => {
                this._pollConsumptionMetrics().catch(() => {});
            }, pollingConfig.consumptionInterval);
            this._metricsPollingIntervals.set('consumption', interval);
        }

        if (pollingConfig.runtimeInterval > 0 && this.runtime && typeof this.runtime.get === 'function') {
            const interval = setInterval(() => {
                this._pollRuntimeMetrics().catch(() => {});
            }, pollingConfig.runtimeInterval);
            this._metricsPollingIntervals.set('runtime', interval);
        }

        this._pollElectricityMetrics().catch(() => {});
        this._pollConsumptionMetrics().catch(() => {});
        this._pollRuntimeMetrics().catch(() => {});
    }

    /**
     * Stops all metrics polling intervals for this device.
     *
     * This avoids stale timers when subscriptions are removed or the manager shuts down.
     */
    stopMetricsPolling() {
        this._metricsPollingIntervals.forEach((interval) => {
            clearInterval(interval);
        });

        this._metricsPollingIntervals.clear();
        this._metricsPollingConfig = null;
    }

    /**
     * Polls electricity data for all channels when cache/push data is stale.
     *
     * @private
     * @returns {Promise<void>}
     */
    async _pollElectricityMetrics() {
        if (!this._metricsPollingConfig || !this.isOnline) {
            return;
        }

        if (!this.electricity || typeof this.electricity.get !== 'function') {
            return;
        }

        const config = this._metricsPollingConfig;
        if (config.smartCaching && this._channelCachedSamples) {
            const channels = this.channels || [{ index: 0 }];
            let allCached = true;

            for (const channel of channels) {
                const cached = this._channelCachedSamples.get(channel.index);
                if (!cached || !cached.sampleTimestamp) {
                    allCached = false;
                    break;
                }
                const age = Date.now() - cached.sampleTimestamp.getTime();
                if (age >= config.cacheMaxAge) {
                    allCached = false;
                    break;
                }
            }

            if (allCached) {
                return;
            }
        }

        if (typeof this.electricity.pollAllChannels === 'function') {
            await this.electricity.pollAllChannels();
        } else {
            const channels = this.channels || [{ index: 0 }];
            for (const channel of channels) {
                await this.electricity.get({ channel: channel.index });
            }
        }

        this._metricsLastPollTimes.set('electricity', Date.now());
    }

    /**
     * Polls consumption data for all channels when cache data is stale.
     *
     * @private
     * @returns {Promise<void>}
     */
    async _pollConsumptionMetrics() {
        if (!this._metricsPollingConfig || !this.isOnline) {
            return;
        }

        if (!this.consumption || typeof this.consumption.get !== 'function') {
            return;
        }

        const config = this._metricsPollingConfig;
        if (config.smartCaching && this._channelCachedConsumption) {
            const channels = this.channels || [{ index: 0 }];
            let allCached = true;

            for (const channel of channels) {
                const cached = this._channelCachedConsumption.get(channel.index);
                if (!cached) {
                    allCached = false;
                    break;
                }
            }

            if (allCached) {
                return;
            }
        }

        const channels = this.channels || [{ index: 0 }];
        for (const channel of channels) {
            await this.consumption.get({ channel: channel.index });
        }

        this._metricsLastPollTimes.set('consumption', Date.now());
    }

    /**
     * Polls runtime info when push activity is stale.
     *
     * @private
     * @returns {Promise<void>}
     */
    async _pollRuntimeMetrics() {
        if (!this._metricsPollingConfig || !this.isOnline) {
            return;
        }

        if (!this.runtime || typeof this.runtime.get !== 'function') {
            return;
        }

        const config = this._metricsPollingConfig;
        if (this.hasRecentPushForNamespace('Appliance.System.Runtime', 5000)) {
            return;
        }

        if (config.smartCaching && this._runtimeInfo) {
            const cached = this.runtime.getCached();
            if (cached && Object.keys(cached).length > 0) {
                const cacheAge = Date.now() - (this._metricsLastPollTimes.get('runtime') || 0);
                if (cacheAge < config.cacheMaxAge) {
                    return;
                }
            }
        }

        await this.runtime.get();
        this._metricsLastPollTimes.set('runtime', Date.now());
    }

    /**
     * Handles incoming MQTT messages from the device.
     *
     * Routes messages by type: responses resolve pending promises, push notifications
     * update cached state, and System.All updates refresh device metadata. All messages
     * emit rawData events for logging and debugging.
     *
     * @param {Object} message - The message object
     * @param {Object} message.header - Message header
     * @param {string} message.header.messageId - Message ID
     * @param {string} message.header.method - Method (GET, SET, PUSH)
     * @param {string} message.header.namespace - Namespace
     * @param {string} [message.header.from] - Source device UUID
     * @param {Object} [message.payload] - Message payload
     */
    handleMessage(message) {
        if (!this._validateMessage(message)) {
            return;
        }

        // Extract System.All from any message type to update device metadata
        if (message.payload?.all) {
            this._handleSystemAllUpdate(message.payload, message.header);
        }

        if (this.waitingMessageIds[message.header.messageId]) {
            this._handleResponseMessage(message);
        } else if (message.header.method === 'PUSH') {
            this._handlePushNotification(message);
        }

    }

    /**
     * Validates incoming message before processing.
     *
     * Ensures device is connected, message has required header, and source UUID
     * matches this device (if provided).
     *
     * @private
     * @param {Object} message - The message object
     * @returns {boolean} True if message is valid, false otherwise
     */
    _validateMessage(message) {
        if (!this.deviceConnected) {
            return false;
        }
        if (!message?.header) {
            return false;
        }
        if (message.header.from && !message.header.from.includes(this.uuid)) {
            return false;
        }
        return true;
    }

    /**
     * Emits the ready event exactly once after initial device bootstrap.
     *
     * This aligns the event name with the `ready()` promise API so consumers
     * can use one mental model for initialization completion.
     *
     * @private
     */
    _emitDeviceInitialized() {
        if (this._deviceInitializedEmitted) {
            return;
        }
        this._deviceInitializedEmitted = true;
        this.emit('ready');
        if (this._readyResolve) {
            this._readyResolve();
            this._readyResolve = null;
        }
    }

    /**
     * Resolves once the device has received initial System.All data.
     *
     * @returns {Promise<void>}
     */
    ready() {
        if (this._deviceInitializedEmitted) {
            return Promise.resolve();
        }
        return this._readyPromise;
    }

    /**
     * Finalizes initialization and clears any pending timeout.
     *
     * @private
     */
    _finalizeInitialization() {
        if (this._initializationTimeout) {
            clearTimeout(this._initializationTimeout);
            this._initializationTimeout = null;
        }
        this._emitDeviceInitialized();
    }

    /**
     * Handles System.All update responses.
     *
     * Delegates property extraction to system feature module, then handles device-level
     * concerns (state emission, initialization, heartbeat tracking).
     *
     * @private
     * @param {Object} payload - Message payload containing System.All data
     * @param {Object} [allHeader] - Envelope header so digest slices share ordering timestamps
     */
    _handleSystemAllUpdate(payload, allHeader) {
        const system = payload.all?.system;
        if (!system) {
        // System.All was received but system property is missing; finalize initialization
        // since the device is connected and responding
            this._finalizeInitialization();
            return;
        }

        const hasUpdates = this.system.handleSystemAllUpdate(payload, allHeader);
        if (hasUpdates) {
            this.emit('stateChange', {
                type: 'properties',
                value: {
                    macAddress: this.macAddress,
                    lanIp: this.lanIp,
                    mqttHost: this.mqttHost,
                    mqttPort: this.mqttPort,
                    deviceType: this.deviceType,
                    hardwareVersion: this.hardwareVersion,
                    firmwareVersion: this.firmwareVersion,
                    rssi: this.rssi,
                    wifiSignal: this.wifiSignal,
                    signalStrength: this.signalStrength,
                    wifiSsid: this.wifiSsid,
                    wifiChannel: this.wifiChannel,
                    wifiSnr: this.wifiSnr,
                    wifiLinkStatus: this.wifiLinkStatus
                },
                source: 'poll',
                timestamp: Date.now()
            });
        }

        this._finalizeInitialization();

        // Track System.All response for heartbeat monitoring to detect device connectivity
        if (this._heartbeat) {
            this._heartbeat.recordSystemAll();
        }
    }

    /**
     * Reuses the System.All message header with a feature namespace so digest updates
     * participate in the same timestamp ordering as SETACK/GETACK/PUSH.
     *
     * @private
     * @param {Object|undefined} allHeader - Parent System.All header
     * @param {string} namespace - Target `header.namespace` for routing
     * @returns {Object} Header object suitable for {@link MerossDevice#_routeMessageToAbility}
     */
    _headerForDigestNamespace(allHeader, namespace) {
        if (allHeader && typeof allHeader === 'object') {
            return { ...allHeader, namespace };
        }
        return { namespace };
    }

    /**
     * Routes one digest slice through {@link _routeMessageToAbility} when the slice is
     * defined. Collapses the repeated `!= null` guard for each nested digest field.
     *
     * @private
     * @param {Object} [allHeader] - System.All header used as ordering source
     * @param {string} namespace - Target namespace for the synthesized header
     * @param {string} payloadKey - Key to wrap the slice under
     * @param {*} slice - Digest slice value; routed when not null/undefined
     */
    _routeDigestSlice(allHeader, namespace, payloadKey, slice) {
        if (slice === null || slice === undefined) {
            return;
        }
        this._routeMessageToAbility(
            this._headerForDigestNamespace(allHeader, namespace),
            { [payloadKey]: slice },
            'poll'
        );
    }

    /**
     * Routes digest data from System.All through the namespace registry (same path as
     * responses and push notifications).
     *
     * @private
     * @param {Object} digest - Digest object containing feature state data
     * @param {Object} [allHeader] - System.All message header (for ordering digested slices)
     */
    _routeDigestToFeatures(digest, allHeader) {
        if (!digest) {
            return;
        }

        for (const route of DIGEST_FLAT_ROUTES) {
            this._routeDigestSlice(allHeader, route.namespace, route.payloadKey, digest[route.digestKey]);
        }

        if (digest.thermostat) {
            this._routeDigestSlice(allHeader, 'Appliance.Control.Thermostat.Mode', 'mode', digest.thermostat.mode);
            this._routeDigestSlice(allHeader, 'Appliance.Control.Thermostat.ModeB', 'modeB', digest.thermostat.modeB);
        }

        if (digest.diffuser) {
            this._routeDigestSlice(allHeader, 'Appliance.Control.Diffuser.Light', 'light', digest.diffuser.light);
            this._routeDigestSlice(allHeader, 'Appliance.Control.Diffuser.Spray', 'spray', digest.diffuser.spray);
        }

        if (digest.rollerShutter) {
            this._routeDigestSlice(allHeader, 'Appliance.RollerShutter.State', 'state', digest.rollerShutter.state);
            this._routeDigestSlice(allHeader, 'Appliance.RollerShutter.Position', 'position', digest.rollerShutter.position);
        }

        if (Array.isArray(digest.garageDoor)) {
            this._routeDigestSlice(allHeader, 'Appliance.GarageDoor.State', 'state', digest.garageDoor);
        }
    }

    /**
     * Handles response messages by resolving pending promises.
     *
     * Matches response messageId to waiting promises and resolves `publishMessage`
     * promises with `{ header, payload }`.
     * Clears timeout to prevent duplicate rejections.
     *
     * @private
     * @param {Object} message - The response message object
     */
    _handleResponseMessage(message) {
        const messageId = message.header.messageId;
        const pending = this.waitingMessageIds[messageId];

        if (!pending) {
            return;
        }

        if (pending.timeout) {
            clearTimeout(pending.timeout);
        }

        if (message.header.method === 'ERROR') {
            const errorPayload = message.payload || {};
            pending.reject(new MerossDeviceError(
                `Device returned error: ${JSON.stringify(errorPayload)}`,
                'COMMAND_FAILED',
                { errorPayload, deviceUuid: this.uuid }
            ));
        } else {
            if (this._heartbeat) {
                this._heartbeat.recordResponse();
            }
            const responsePayload = message.payload ?? {};
            this._routeMessageToAbility(message.header, responsePayload, 'response');
            pending.resolve({ header: message.header, payload: responsePayload });
        }
        delete this.waitingMessageIds[messageId];
    }

    /**
     * Handles push notification messages.
     *
     * Tracks notification activity, parses into typed notification objects, routes to
     * feature modules, and emits unified state events. Also emits a lightweight
     * `pushNotificationReceived` event so subscription/polling managers can track
     * push activity by namespace without depending on payload parsing details.
     *
     * @private
     * @param {Object} message - The push notification message object
     */
    _handlePushNotification(message) {
        const namespace = message.header?.namespace || '';
        this._pushNotificationReceived(namespace);
        const payload = message.payload || message;

        const notification = parsePushNotification(namespace, payload, this.uuid, message.header);
        this.emit('pushNotificationReceived', namespace, notification);

        this._routeMessageToAbility(message.header, payload, 'push');

        // Feature modules can override for custom routing (e.g., hub subdevices that
        // need to route notifications to child devices)
        if (typeof this.handlePushNotification === 'function') {
            this.handlePushNotification(notification);
        }
    }

    /**
     * Routes SET/GET responses and PUSH notifications through the shared namespace
     * registry so abilities apply state behind one ordering gate.
     *
     * @private
     * @param {Object} header - Message header including `namespace` and timestamp fields
     * @param {Object} payload - Message payload
     * @param {string} source - Provenance for `stateChange` (e.g. `response`, `push`)
     * @returns {void}
     */
    _routeMessageToAbility(header, payload, source) {
        const namespace = header?.namespace;
        if (!namespace) {
            return;
        }
        const descriptors = getNamespaceDescriptors(namespace);
        if (descriptors.length === 0) {
            return;
        }
        const messageTs = getMessageTimestamp(header);
        for (const descriptor of descriptors) {
            dispatch(this, descriptor, payload, source, messageTs, header);
        }
    }

    /**
     * Connects the device and automatically fetches System.All data.
     *
     * Emits 'connected' event immediately to allow test code to proceed. Delays initial
     * state fetch to allow MQTT connection to stabilize before making requests.
     * Sets a timeout to detect if System.All never arrives and device initialization fails.
     *
     */
    connect() {
        this.deviceConnected = true;
        setImmediate(() => {
            this.emit('connected');
        });
        if (this._heartbeat) {
            this._heartbeat.start();
        }
        setTimeout(() => {
            if (this.system && typeof this.system.getAllData === 'function') {
                this.system.getAllData().catch(_err => {
                    // Ignore initial fetch failures; device may still be initializing
                });
            }
        }, 500);

        this._initializationTimeout = setTimeout(() => {
            if (!this._deviceInitializedEmitted) {
                this.emit('error', new MerossDeviceError(
                    'Device initialization timeout: System.All not received',
                    'INITIALIZATION_FAILED',
                    { component: 'device', reason: 'System.All timeout' }
                ));
            }
            this._initializationTimeout = null;
        }, 5000);
    }

    /**
     * Disconnects the device
     */
    disconnect() {
        this.deviceConnected = false;
        this.stopMetricsPolling();
        if (this._initializationTimeout) {
            clearTimeout(this._initializationTimeout);
            this._initializationTimeout = null;
        }
        if (this._pushInactivityTimer) {
            clearTimeout(this._pushInactivityTimer);
            this._pushInactivityTimer = null;
        }
        this._pushNamespaceInactivityTimers.forEach((timer) => clearTimeout(timer));
        this._pushNamespaceInactivityTimers.clear();
        this._pushActiveNamespaces.clear();
        if (this._heartbeat) {
            this._heartbeat.stop();
        }
    }

    /**
     * Sets a known local IP address for LAN HTTP communication
     * @param {string} ip - Local IP address
     */
    setKnownLocalIp(ip) {
        this.lanIp = ip;
    }

    /**
     * Removes the known local IP address
     */
    removeKnownLocalIp() {
        this.lanIp = null;
    }

    /**
     * Publishes a message to the device via MQTT or LAN HTTP.
     *
     * Prefers LAN HTTP for faster local communication, falls back to MQTT if LAN IP
     * is unavailable. Tracks pending messages by messageId to match responses.
     *
     * @param {string} method - Message method (GET, SET)
     * @param {string} namespace - Message namespace
     * @param {Object} payload - Message payload
     * @param {number|null} [transportMode=null] - Transport mode from TransportMode enum
     * @returns {Promise<{header: Object, payload: Object}>} Promise that resolves with the
     *   response header and payload
     * @throws {MerossDeviceError} If device has no data connection (DEVICE_UNCONNECTED) or message times out (COMMAND_TIMEOUT)
     */
    async publishMessage(method, namespace, payload, transportMode = null) {
        if (!this.deviceConnected) {
            throw new MerossDeviceError('Device is not connected', 'DEVICE_UNCONNECTED', { deviceUuid: this.uuid });
        }

        const data = this.meross.mqtt.encode(method, namespace, payload, this.uuid);
        const { messageId } = data.header;
        const timeoutDuration = this.meross.timeout;

        // Register before sending so a fast response cannot arrive before the entry exists
        const responsePromise = new Promise((resolve, reject) => {
            this.waitingMessageIds[messageId] = {
                resolve,
                reject,
                timeout: setTimeout(() => {
                    if (this.waitingMessageIds[messageId]) {
                        this.waitingMessageIds[messageId].reject(
                            new MerossDeviceError(
                                `Command timed out after ${timeoutDuration}ms`,
                                'COMMAND_TIMEOUT',
                                { deviceUuid: this.uuid, timeout: timeoutDuration, command: { method, namespace, messageId } }
                            )
                        );
                        delete this.waitingMessageIds[messageId];
                    }
                }, timeoutDuration)
            };
        });

        let res;
        try {
            res = await this.meross.transport.request(this, this.lanIp, data, transportMode);
        } catch (error) {
            if (this.waitingMessageIds[messageId]) {
                clearTimeout(this.waitingMessageIds[messageId].timeout);
                delete this.waitingMessageIds[messageId];
            }
            throw error;
        }

        if (!res) {
            if (this.waitingMessageIds[messageId]) {
                clearTimeout(this.waitingMessageIds[messageId].timeout);
                delete this.waitingMessageIds[messageId];
            }
            throw new MerossDeviceError('Device has no data connection available', 'DEVICE_UNCONNECTED', { deviceUuid: this.uuid });
        }

        return responsePromise;
    }

    /**
     * Updates the device's online status and emits events if changed.
     *
     * Emits unified state events for state handling by subscription managers.
     *
     * @private
     * @param {number} wireStatus - Online status wire code from MQTT/HTTP payloads
     */
    _updateOnlineStatus(wireStatus) {
        const oldConnectivity = this.connectivity;
        if (this._connectivityWire !== wireStatus) {
            this._connectivityWire = wireStatus;
            const connectivity = this.connectivity;
            if (oldConnectivity !== connectivity) {
                this.emit('stateChange', {
                    type: 'online',
                    value: connectivity,
                    source: 'push',
                    timestamp: Date.now()
                });
            }
        }
    }

    /**
     * Parses channel data array into ChannelInfo objects
     *
     * Converts raw channel data from the HTTP API into structured ChannelInfo objects.
     * Each channel gets an index (0 for master, 1-n for sub-channels), name, type, and master flag.
     *
     * @param {Array<Object>|null} channelData - Raw channel data array from HTTP API
     * @returns {Array<ChannelInfo>} Array of ChannelInfo objects
     * @static
     */
    static _parseChannels(channelData) {
        const res = [];
        if (!channelData || !Array.isArray(channelData)) {
            return res;
        }

        for (let i = 0; i < channelData.length; i++) {
            const val = channelData[i];
            const name = val && val.devName ? val.devName : (i === 0 ? 'Main channel' : null);
            const type = val && val.type ? val.type : null;
            const master = i === 0;
            res.push(new ChannelInfo(i, name, type, master));
        }

        return res;
    }

    /**
     * Looks up a channel by channel ID or channel name
     *
     * Searches for a channel matching the provided index (number) or name (string).
     * Returns the matching ChannelInfo object if exactly one match is found.
     *
     * @param {number|string} channelIdOrName - Channel index (number) or channel name (string)
     * @returns {ChannelInfo} Matching ChannelInfo object
     * @throws {MerossDeviceError} If channel is not found or multiple channels match
     * @example
     * const channel = device.lookupChannel(0); // Find by index
     * const channel2 = device.lookupChannel('Main channel'); // Find by name
     */
    lookupChannel(channelIdOrName) {
        let res = [];
        if (typeof channelIdOrName === 'string') {
            res = this.channels.filter(c => c.name === channelIdOrName);
        } else if (typeof channelIdOrName === 'number') {
            res = this.channels.filter(c => c.index === channelIdOrName);
        }

        if (res.length === 1) {
            return res[0];
        }

        throw new MerossDeviceError(`Could not find channel by id or name = ${channelIdOrName}`, 'NOT_FOUND', { resourceType: 'channel', resourceId: channelIdOrName });
    }

    /**
     * Updates device properties from ApiDeviceInfo object.
     *
     * Synchronizes the device instance with updated HTTP device info, including channels,
     * core properties, and extended metadata. Validates UUID match to prevent updating
     * the wrong device. Properties are copied directly to the device instance; the
     * ApiDeviceInfo object is not stored.
     *
     * @param {ApiDeviceInfo} deviceInfo - ApiDeviceInfo object created via ApiDeviceInfo.fromDict()
     * @returns {Promise<MerossDevice>} Promise that resolves with this device instance
     * @throws {MerossDeviceError} If device info is missing or UUID doesn't match
     * @example
     * const updatedInfo = ApiDeviceInfo.fromDict(deviceDataFromApi);
     * await device.updateFromApiState(updatedInfo);
     */
    async updateFromApiState(deviceInfo) {
        if (!deviceInfo || !deviceInfo.uuid) {
            throw new MerossDeviceError('Device info is required and must have a UUID', 'VALIDATION_ERROR', { field: 'deviceInfo' });
        }

        if (deviceInfo.uuid !== this.uuid) {
            throw new MerossDeviceError(`Cannot update device (${this.uuid}) with ApiDeviceInfo for device id ${deviceInfo.uuid}`, 'VALIDATION_ERROR', { field: 'deviceInfo.uuid' });
        }

        this.channels = MerossDevice._parseChannels(deviceInfo.channels);
        this._buildCapabilities();

        // Subdevices override name and connectivity as getter-only properties that
        // compute values from parent hub, so we must check before assignment
        if (!MerossDevice._isGetterOnly(this, 'name')) {
            this.name = deviceInfo.devName || this.uuid || 'unknown';
        }

        this.deviceType = deviceInfo.deviceType;
        this.firmwareVersion = deviceInfo.fmwareVersion || 'unknown';
        this.hardwareVersion = deviceInfo.hdwareVersion || 'unknown';
        this.domain = deviceInfo.domain || this.domain;

        if (!MerossDevice._isGetterOnly(this, 'connectivity')) {
            this._connectivityWire = MerossDevice._normalizeConnectivityWire(deviceInfo);
        }

        // Extended HTTP device info properties; bindTime already normalized to Date by ApiDeviceInfo
        this.reservedDomain = deviceInfo.reservedDomain || null;
        this.subType = deviceInfo.subType || null;
        this.bindTime = deviceInfo.bindTime || null;
        this.skillNumber = deviceInfo.skillNumber || null;
        this.userDevIcon = deviceInfo.userDevIcon || null;
        this.iconType = deviceInfo.iconType || null;
        this.region = deviceInfo.region || null;
        this.devIconId = deviceInfo.devIconId || null;

        return this;
    }
}

/**
 * @typedef {Object} MerossDeviceEvents
 * @property {Function} state - Emitted when device state changes (unified event for all state changes)
 * @property {Function} pushNotificationReceived - Emitted on any push notification to track push activity by namespace
 * @property {Function} error - Emitted when an error occurs
 * @property {Function} connected - Emitted when device connects
 * @property {Function} disconnected - Emitted when device disconnects
 */


module.exports = {
    MerossDevice,
    ABILITIES,
    abilitiesInFamily,
    SUBDEVICE_ABILITY_MAPPING,
    SUBDEVICE_REFRESH_ABILITIES
};

