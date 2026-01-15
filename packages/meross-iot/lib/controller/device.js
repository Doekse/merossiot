'use strict';

const EventEmitter = require('events');
const { OnlineStatus } = require('../model/enums');
const { parsePushNotification } = require('../model/push');
// DeviceRegistry is nested in ManagerMeross but exported separately to avoid circular dependencies
const { ManagerMeross } = require('../manager');
const ChannelInfo = require('../model/channel-info');
const HttpDeviceInfo = require('../model/http/device');
const {
    CommandTimeoutError,
    UnconnectedError,
    UnknownDeviceTypeError
} = require('../model/exception');

const systemFeature = require('./features/system-feature');
const toggleFeature = require('./features/toggle-feature');
const lightFeature = require('./features/light-feature');
const thermostatFeature = require('./features/thermostat-feature');
const rollerShutterFeature = require('./features/roller-shutter-feature');
const garageFeature = require('./features/garage-feature');
const diffuserFeature = require('./features/diffuser-feature');
const sprayFeature = require('./features/spray-feature');
const consumptionFeature = require('./features/consumption-feature');
const electricityFeature = require('./features/electricity-feature');
const encryptionFeature = require('./features/encryption-feature');

/**
 * Base class for all Meross cloud devices.
 *
 * Manages device communication via MQTT and LAN HTTP, maintains cached state per channel,
 * and composes feature modules to provide device-specific capabilities. All device commands
 * and state updates flow through this class.
 *
 * @extends EventEmitter
 */
class MerossDevice extends EventEmitter {
    /**
     * Creates a new MerossDevice instance
     * @param {Object} cloudInstance - The MerossCloud manager instance
     * @param {Object|string} devOrUuid - Device information object from the API, or device UUID (string) for subdevices
     * @param {string} [devOrUuid.uuid] - Device UUID (if devOrUuid is object)
     * @param {string} [devOrUuid.devName] - Device name
     * @param {string} [devOrUuid.fmwareVersion] - Firmware version
     * @param {string} [devOrUuid.hdwareVersion] - Hardware version
     * @param {number} [devOrUuid.onlineStatus] - Initial online status (from OnlineStatus enum)
     * @param {string} [devOrUuid.deviceType] - Device type
     * @param {string} [devOrUuid.domain] - MQTT domain
     * @param {string} [domain] - MQTT domain (for subdevices, passed separately)
     * @param {number} [port] - MQTT port (for subdevices, passed separately)
     */
    constructor(cloudInstance, devOrUuid, domain = null, port = null) {
        super();

        // Accept both object and string to support subdevices initialized with UUID only
        const dev = typeof devOrUuid === 'string' ? { uuid: devOrUuid } : devOrUuid;

        if (!dev || !dev.uuid) {
            throw new UnknownDeviceTypeError('Device UUID is required');
        }

        this._initializeCoreProperties(dev, domain, port);
        this._initializeStateCaches();
        this._initializeConnectionState(cloudInstance);
        this._initializeHttpInfo(dev);
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
        // Subdevices override uuid, name, and onlineStatus as getter-only properties
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
        this.domain = domain || dev.domain;

        if (!MerossDevice._isGetterOnly(this, 'onlineStatus')) {
            this.onlineStatus = dev.onlineStatus !== undefined ? dev.onlineStatus : OnlineStatus.UNKNOWN;
        }

        this._abilities = null;
        this._macAddress = null;
        this._lanIp = null;
        this._mqttHost = null;
        this._mqttPort = port;
        this._lastFullUpdateTimestamp = null;
        // Lazy initialization avoids registry computation during construction
        this._internalId = null;
    }

    /**
     * Initializes per-channel state caches.
     *
     * Feature modules populate these caches to avoid redundant API calls when
     * multiple consumers request the same channel state.
     *
     * @private
     */
    _initializeStateCaches() {
        this._toggleStateByChannel = new Map();
        this._thermostatStateByChannel = new Map();
        this._lightStateByChannel = new Map();
        this._diffuserLightStateByChannel = new Map();
        this._diffuserSprayStateByChannel = new Map();
        this._sprayStateByChannel = new Map();
        this._rollerShutterStateByChannel = new Map();
        this._rollerShutterPositionByChannel = new Map();
        this._rollerShutterConfigByChannel = new Map();
        this._garageDoorStateByChannel = new Map();
        this._garageDoorConfigByChannel = new Map();
        this._timerxStateByChannel = new Map();
        this._triggerxStateByChannel = new Map();
        this._presenceSensorStateByChannel = new Map();
    }

    /**
     * Initializes connection state and message tracking.
     *
     * @private
     * @param {Object} cloudInstance - The MerossCloud manager instance
     */
    _initializeConnectionState(cloudInstance) {
        this.cloudInst = cloudInstance;
        this.deviceConnected = false;
        this.clientResponseTopic = null;
        this.waitingMessageIds = {};
        // Track push notification activity to detect when device is actively sending updates
        this._pushNotificationActive = false;
        this._lastPushNotificationTime = null;
        this._pushInactivityTimer = null;
    }

    /**
     * Initializes HTTP device info and channels.
     *
     * Only creates HttpDeviceInfo when a full device object is available (not just UUID),
     * as subdevices may be initialized with UUID only and lack HTTP API metadata.
     *
     * @private
     * @param {Object} dev - Device information object
     */
    _initializeHttpInfo(dev) {
        this._cachedHttpInfo = null;
        this._channels = [];

        if (dev && dev.uuid && typeof dev === 'object' && dev.deviceType !== undefined) {
            try {
                this._cachedHttpInfo = HttpDeviceInfo.fromDict(dev);
                this._channels = MerossDevice._parseChannels(dev.channels);
            } catch (error) {
                // Continue without HttpDeviceInfo if parsing fails
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
     * Checks if the device is currently online
     * @returns {boolean} True if device status is ONLINE, false otherwise
     */
    get isOnline() {
        return this.onlineStatus === OnlineStatus.ONLINE;
    }

    /**
     * Updates the device's abilities dictionary.
     *
     * Abilities determine which features and namespaces the device supports. The encryption
     * feature must be notified because key derivation depends on ability flags.
     *
     * @param {Object} abilities - Device abilities object
     */
    updateAbilities(abilities) {
        this._abilities = abilities;
        if (typeof this._updateAbilitiesWithEncryption === 'function') {
            this._updateAbilitiesWithEncryption(abilities);
        }
    }

    /**
     * Updates the device's MAC address.
     *
     * MAC address is used by the encryption feature for key derivation in some firmware versions.
     *
     * @param {string} mac - MAC address string
     */
    updateMacAddress(mac) {
        this._macAddress = mac;
        if (typeof this._updateMacAddressWithEncryption === 'function') {
            this._updateMacAddressWithEncryption(mac);
        }
    }

    /**
     * Gets the device's MAC address
     * @returns {string|null} MAC address or null if not available
     */
    get macAddress() {
        return this._macAddress;
    }

    /**
     * Gets the device's local network IP address
     * @returns {string|null} LAN IP address or null if not available
     */
    get lanIp() {
        return this._lanIp;
    }

    /**
     * Gets the MQTT broker hostname
     * @returns {string|null} MQTT hostname or null if not available
     */
    get mqttHost() {
        return this._mqttHost;
    }

    /**
     * Gets the MQTT broker port
     * @returns {number|null} MQTT port or null if not available
     */
    get mqttPort() {
        return this._mqttPort;
    }

    /**
     * Gets the device's abilities dictionary
     * @returns {Object|null} Abilities object or null if not available
     */
    get abilities() {
        return this._abilities;
    }

    /**
     * Gets the timestamp of the last full state update
     * @returns {number|null} Timestamp in milliseconds or null if never updated
     */
    get lastFullUpdateTimestamp() {
        return this._lastFullUpdateTimestamp;
    }

    /**
     * Gets the internal ID used for device registry.
     *
     * Generates and caches the ID on first access to avoid repeated computation during
     * device lookup operations.
     *
     * @returns {string} Internal ID string
     * @throws {Error} If device UUID is missing
     */
    get internalId() {
        if (this._internalId) {
            return this._internalId;
        }

        if (!this.uuid) {
            throw new UnknownDeviceTypeError('Cannot generate internal ID: device missing UUID');
        }

        this._internalId = ManagerMeross.DeviceRegistry.generateInternalId(this.uuid);
        return this._internalId;
    }

    /**
     * Gets the list of channels exposed by this device
     *
     * Multi-channel devices might expose a master switch at index 0.
     * Channels are parsed from the HTTP device info during device initialization.
     *
     * @returns {Array<ChannelInfo>} Array of ChannelInfo objects
     */
    get channels() {
        return this._channels;
    }

    /**
     * Gets the cached HTTP device info
     *
     * Returns the original device information object from the HTTP API,
     * or null if not available (e.g., for subdevices created without HTTP info).
     *
     * @returns {HttpDeviceInfo|null} Cached HTTP device info or null
     */
    get cachedHttpInfo() {
        return this._cachedHttpInfo;
    }

    /**
     * Validates that the device state has been refreshed.
     *
     * Logs a warning if state has not been refreshed to help developers catch cases
     * where cached state may be stale or missing.
     *
     * @returns {boolean} True if state has been refreshed, false otherwise
     */
    validateState() {
        const updateDone = this._lastFullUpdateTimestamp !== null;
        if (!updateDone) {
            const deviceName = this.name || this.uuid || 'unknown device';
            const logger = this.cloudInst?.options?.logger || console.error;
            logger(`Please invoke refreshState() for this device (${deviceName}) before accessing its state. Failure to do so may result in inconsistent state.`);
        }
        return updateDone;
    }

    /**
     * Refreshes the device state by fetching System.All data.
     *
     * System.All provides complete device state in a single request, avoiding multiple
     * round trips. Emits a 'stateRefreshed' event with the updated state.
     *
     * @returns {Promise<void>} Promise that resolves when state is refreshed
     * @throws {Error} If device does not support refreshState()
     */
    async refreshState() {
        if (typeof this.getSystemAllData === 'function') {
            await this.getSystemAllData();

            this.emit('stateRefreshed', {
                timestamp: this._lastFullUpdateTimestamp || Date.now(),
                state: this.getUnifiedState()
            });
        } else {
            throw new UnknownDeviceTypeError('Device does not support refreshState()', this.deviceType);
        }
    }

    /**
     * Gets a unified snapshot of all current device state.
     *
     * Aggregates all cached feature states into a single object for subscription managers
     * and state distribution systems.
     *
     * @returns {Object} Unified state object with all available features
     */
    getUnifiedState() {
        const state = {
            online: this.onlineStatus,
            timestamp: this._lastFullUpdateTimestamp || Date.now()
        };

        this._collectFeatureStates(state);

        return state;
    }

    /**
     * Collects all feature states into the unified state object.
     *
     * Uses a configuration-driven approach to iterate over feature getters, reducing
     * code duplication when adding new features.
     *
     * @private
     * @param {Object} state - State object to populate
     */
    _collectFeatureStates(state) {
        const channels = this.channels || [{ index: 0 }];

        // Toggle uses Map-based storage, handled separately
        this._collectToggleState(state);

        const channelFeatures = [
            { key: 'electricity', getter: 'getCachedElectricity' },
            { key: 'consumption', getter: 'getCachedConsumption' },
            { key: 'light', getter: 'getCachedLightState' },
            { key: 'thermostat', getter: 'getCachedThermostatState' },
            { key: 'rollerShutter', getter: 'getCachedRollerShutterState' },
            { key: 'garageDoor', getter: 'getCachedGarageDoorState' },
            { key: 'spray', getter: 'getCachedSprayState' }
        ];

        for (const feature of channelFeatures) {
            this._collectChannelFeature(state, feature.key, feature.getter, channels);
        }

        // Features requiring custom transforms for unified state format
        this._collectPresenceSensorState(state, channels);
        this._collectDiffuserLightState(state, channels);
        this._collectDiffuserSprayState(state, channels);
    }

    /**
     * Collects toggle state.
     *
     * Toggle state uses Map-based storage (getAllCachedToggleStates) rather than
     * per-channel getters, so it's handled separately.
     *
     * @private
     * @param {Object} state - State object to populate
     */
    _collectToggleState(state) {
        if (typeof this.getAllCachedToggleStates !== 'function') {
            return;
        }

        const toggleStates = this.getAllCachedToggleStates();
        if (toggleStates && toggleStates.size > 0) {
            state.toggle = {};
            toggleStates.forEach((toggleState, channel) => {
                state.toggle[channel] = toggleState.isOn;
            });
        }
    }

    /**
     * Collects a channel-based feature state.
     *
     * Iterates over channels and calls the feature's cached getter method for each,
     * aggregating results into the unified state object.
     *
     * @private
     * @param {Object} state - State object to populate
     * @param {string} key - Feature key in state object
     * @param {string} getterMethod - Name of getter method to call
     * @param {Array} channels - Array of channel objects
     */
    _collectChannelFeature(state, key, getterMethod, channels) {
        if (typeof this[getterMethod] !== 'function') {
            return;
        }

        const featureState = {};
        for (const ch of channels) {
            const cached = this[getterMethod](ch.index);
            if (cached) {
                featureState[ch.index] = cached;
            }
        }

        if (Object.keys(featureState).length > 0) {
            state[key] = featureState;
        }
    }

    /**
     * Collects presence sensor state with custom transform.
     *
     * Presence sensors expose additional fields (distance, light, timestamps) that
     * require custom mapping to the unified state format.
     *
     * @private
     * @param {Object} state - State object to populate
     * @param {Array} channels - Array of channel objects
     */
    _collectPresenceSensorState(state, channels) {
        if (typeof this.getCachedPresenceSensorState !== 'function') {
            return;
        }

        const featureState = {};
        for (const ch of channels) {
            const cached = this.getCachedPresenceSensorState(ch.index);
            if (cached) {
                featureState[ch.index] = {
                    isPresent: cached.isPresent,
                    distance: cached.distanceRaw,
                    distanceMeters: cached.distanceMeters,
                    light: cached.lightLux,
                    presenceValue: cached.presenceValue,
                    presenceState: cached.presenceState,
                    presenceTimestamp: cached.presenceTimestamp,
                    lightTimestamp: cached.lightTimestamp,
                    presenceTimes: cached.presenceTimes
                };
            }
        }

        if (Object.keys(featureState).length > 0) {
            state.presence = featureState;
        }
    }

    /**
     * Collects diffuser light state with custom transform.
     *
     * Diffuser light state includes RGB tuples and luminance values that need
     * custom formatting for the unified state format.
     *
     * @private
     * @param {Object} state - State object to populate
     * @param {Array} channels - Array of channel objects
     */
    _collectDiffuserLightState(state, channels) {
        if (typeof this.getCachedDiffuserLightState !== 'function') {
            return;
        }

        const featureState = {};
        for (const ch of channels) {
            const cached = this.getCachedDiffuserLightState(ch.index);
            if (cached) {
                featureState[ch.index] = {
                    isOn: cached.isOn,
                    mode: cached.mode,
                    rgb: cached.rgbInt,
                    rgbTuple: cached.rgbTuple,
                    luminance: cached.luminance
                };
            }
        }

        if (Object.keys(featureState).length > 0) {
            state.diffuserLight = featureState;
        }
    }

    /**
     * Collects diffuser spray state with custom transform.
     *
     * Diffuser spray state requires custom mapping to extract mode information
     * for the unified state format.
     *
     * @private
     * @param {Object} state - State object to populate
     * @param {Array} channels - Array of channel objects
     */
    _collectDiffuserSprayState(state, channels) {
        if (typeof this.getCachedDiffuserSprayState !== 'function') {
            return;
        }

        const featureState = {};
        for (const ch of channels) {
            const cached = this.getCachedDiffuserSprayState(ch.index);
            if (cached) {
                featureState[ch.index] = {
                    mode: cached.mode
                };
            }
        }

        if (Object.keys(featureState).length > 0) {
            state.diffuserSpray = featureState;
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
    _pushNotificationReceived() {
        this._lastPushNotificationTime = Date.now();
        this._pushNotificationActive = true;

        clearTimeout(this._pushInactivityTimer);
        this._pushInactivityTimer = setTimeout(() => {
            this._pushNotificationActive = false;
        }, 60000);
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

        // System.All can appear in any message type, extract it first
        if (message.payload?.all) {
            this._handleSystemAllUpdate(message.payload);
        }

        if (this.waitingMessageIds[message.header.messageId]) {
            this._handleResponseMessage(message);
        } else if (message.header.method === 'PUSH') {
            this._handlePushNotification(message);
        }

        this.emit('rawData', message);
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
     * Handles System.All update responses.
     *
     * Extracts device metadata (abilities, MAC address), network configuration (LAN IP,
     * MQTT host/port), and routes digest data to feature modules for state updates.
     *
     * @private
     * @param {Object} payload - Message payload containing System.All data
     */
    _handleSystemAllUpdate(payload) {
        if (payload.ability) {
            this.updateAbilities(payload.ability);
        }

        const system = payload.all?.system;
        if (!system) {
            return;
        }

        if (system.hardware?.macAddress) {
            this.updateMacAddress(system.hardware.macAddress);
        }

        const firmware = system.firmware;
        if (firmware) {
            if (firmware.innerIp) {
                this._lanIp = firmware.innerIp;
            }
            if (firmware.server) {
                this._mqttHost = firmware.server;
            }
            if (firmware.port) {
                this._mqttPort = firmware.port;
            }
            this._lastFullUpdateTimestamp = Date.now();
        }

        if (system.online) {
            this._updateOnlineStatus(system.online.status);
        }

        if (payload.all.digest) {
            this._routeDigestToFeatures(payload.all.digest);
        }
    }

    /**
     * Routes digest data from System.All to appropriate feature modules.
     *
     * Digest contains feature state data that needs to be distributed to feature modules
     * for cache updates. Handles both simple (direct key mapping) and nested structures.
     *
     * @private
     * @param {Object} digest - Digest object containing feature state data
     */
    _routeDigestToFeatures(digest) {
        if (!digest) {
            return;
        }

        this._routeSimpleDigestFeatures(digest);
        this._routeNestedDigestFeatures(digest);
    }

    /**
     * Routes simple digest features with direct key-to-handler mapping.
     *
     * @private
     * @param {Object} digest - Digest object
     */
    _routeSimpleDigestFeatures(digest) {
        const simpleRoutes = [
            { key: 'togglex', handler: '_updateToggleState' },
            { key: 'light', handler: '_updateLightState' },
            { key: 'spray', handler: '_updateSprayState' },
            { key: 'timerx', handler: '_updateTimerXState' }
        ];

        for (const route of simpleRoutes) {
            if (digest[route.key] && typeof this[route.handler] === 'function') {
                this[route.handler](digest[route.key], 'poll');
            }
        }
    }

    /**
     * Routes nested digest features with complex nested structures.
     *
     * @private
     * @param {Object} digest - Digest object
     */
    _routeNestedDigestFeatures(digest) {
        if (digest.thermostat) {
            this._routeThermostatDigest(digest.thermostat);
        }

        if (digest.diffuser) {
            this._routeDiffuserDigest(digest.diffuser);
        }

        if (digest.rollerShutter) {
            this._routeRollerShutterDigest(digest.rollerShutter);
        }

        if (digest.garageDoor) {
            this._routeGarageDoorDigest(digest.garageDoor);
        }
    }

    /**
     * Routes thermostat digest data to feature handlers.
     *
     * @private
     * @param {Object} thermostat - Thermostat digest data
     */
    _routeThermostatDigest(thermostat) {
        if (thermostat.mode && typeof this._updateThermostatMode === 'function') {
            this._updateThermostatMode(thermostat.mode, 'poll');
        }
        if (thermostat.modeB && typeof this._updateThermostatModeB === 'function') {
            this._updateThermostatModeB(thermostat.modeB, 'poll');
        }
    }

    /**
     * Routes diffuser digest data to feature handlers.
     *
     * @private
     * @param {Object} diffuser - Diffuser digest data
     */
    _routeDiffuserDigest(diffuser) {
        if (diffuser.light && typeof this._updateDiffuserLightState === 'function') {
            this._updateDiffuserLightState(diffuser.light, 'poll');
        }
        if (diffuser.spray && typeof this._updateDiffuserSprayState === 'function') {
            this._updateDiffuserSprayState(diffuser.spray, 'poll');
        }
    }

    /**
     * Routes roller shutter digest data to feature handlers.
     *
     * @private
     * @param {Object} rollerShutter - Roller shutter digest data
     */
    _routeRollerShutterDigest(rollerShutter) {
        if (rollerShutter.state && typeof this._updateRollerShutterState === 'function') {
            this._updateRollerShutterState(rollerShutter.state, 'poll');
        }
        if (rollerShutter.position && typeof this._updateRollerShutterPosition === 'function') {
            this._updateRollerShutterPosition(rollerShutter.position, 'poll');
        }
    }

    /**
     * Routes garage door digest data to feature handlers.
     *
     * @private
     * @param {Object|Array} garageDoor - Garage door digest data
     */
    _routeGarageDoorDigest(garageDoor) {
        if (typeof this._updateGarageDoorState === 'function' && Array.isArray(garageDoor)) {
            this._updateGarageDoorState(garageDoor, 'poll');
        }
    }

    /**
     * Handles response messages by resolving pending promises.
     *
     * Matches response messageId to waiting promises and resolves them with the payload.
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

        pending.resolve(message.payload || message);
        delete this.waitingMessageIds[messageId];
    }

    /**
     * Handles push notification messages.
     *
     * Tracks notification activity, parses into typed notification objects, routes to
     * feature modules, and emits events for both new and legacy consumers.
     *
     * @private
     * @param {Object} message - The push notification message object
     */
    _handlePushNotification(message) {
        this._pushNotificationReceived();

        const namespace = message.header?.namespace || '';
        const payload = message.payload || message;

        const notification = parsePushNotification(namespace, payload, this.uuid);
        if (notification) {
            this.emit('pushNotification', notification);
        }

        this._routePushNotificationToFeatures(namespace, payload);

        // Feature modules can override for custom routing (e.g., hub subdevices)
        if (typeof this.handlePushNotification === 'function') {
            this.handlePushNotification(namespace, payload);
        }

        this.emit('data', namespace, payload);
    }

    /**
     * Routes push notifications to feature modules using registry pattern.
     *
     * Maps namespace strings to handler configurations, allowing new namespaces to be
     * added without modifying routing logic.
     *
     * @private
     * @param {string} namespace - Message namespace
     * @param {Object} payload - Message payload
     */
    _routePushNotificationToFeatures(namespace, payload) {
        const namespaceRoutes = [
            {
                namespace: 'Appliance.Control.ToggleX',
                check: (p) => p?.togglex,
                handler: '_updateToggleState',
                getData: (p) => p.togglex,
                source: 'push'
            },
            {
                namespace: 'Appliance.Control.Toggle',
                check: (p) => p?.toggle,
                handler: '_updateToggleState',
                getData: (p) => {
                    // Legacy namespace lacks channel field, default to 0 for compatibility
                    const toggleData = p.toggle;
                    if (toggleData.channel === undefined) {
                        toggleData.channel = 0;
                    }
                    return toggleData;
                },
                source: 'push'
            },
            {
                namespace: 'Appliance.Control.Thermostat.Mode',
                check: (p) => p?.mode,
                handler: '_updateThermostatMode',
                getData: (p) => p.mode,
                source: 'push'
            },
            {
                namespace: 'Appliance.Control.Thermostat.ModeB',
                check: (p) => p?.modeB,
                handler: '_updateThermostatModeB',
                getData: (p) => p.modeB,
                source: 'push'
            },
            {
                namespace: 'Appliance.Control.Light',
                check: (p) => p?.light,
                handler: '_updateLightState',
                getData: (p) => p.light,
                source: 'push'
            },
            {
                namespace: 'Appliance.Control.Diffuser.Light',
                check: (p) => p?.light,
                handler: '_updateDiffuserLightState',
                getData: (p) => p.light,
                source: 'push'
            },
            {
                namespace: 'Appliance.Control.Diffuser.Spray',
                check: (p) => p?.spray,
                handler: '_updateDiffuserSprayState',
                getData: (p) => p.spray,
                source: 'push'
            },
            {
                namespace: 'Appliance.Control.Spray',
                check: (p) => p?.spray,
                handler: '_updateSprayState',
                getData: (p) => p.spray,
                source: 'push'
            },
            {
                namespace: 'Appliance.RollerShutter.State',
                check: (p) => p?.state,
                handler: '_updateRollerShutterState',
                getData: (p) => p.state,
                source: 'push'
            },
            {
                namespace: 'Appliance.RollerShutter.Position',
                check: (p) => p?.position,
                handler: '_updateRollerShutterPosition',
                getData: (p) => p.position,
                source: 'push'
            },
            {
                namespace: 'Appliance.GarageDoor.State',
                check: (p) => p?.state,
                handler: '_updateGarageDoorState',
                getData: (p) => p.state,
                source: 'push'
            },
            {
                namespace: 'Appliance.GarageDoor.MultipleConfig',
                check: (p) => p?.config,
                handler: '_updateGarageDoorConfig',
                getData: (p) => p.config,
                source: null
            },
            {
                namespace: 'Appliance.System.Online',
                check: (p) => p?.online,
                handler: null,
                getData: (p) => p.online.status,
                source: null
            },
            {
                namespace: 'Appliance.Control.Alarm',
                check: (p) => p?.alarm,
                handler: '_updateAlarmEvents',
                getData: (p) => p.alarm,
                source: 'push'
            },
            {
                namespace: 'Appliance.Control.TimerX',
                check: (p) => p?.timerx,
                handler: '_updateTimerXState',
                getData: (p) => p.timerx,
                source: 'push'
            },
            {
                namespace: 'Appliance.Control.TriggerX',
                check: (p) => p?.triggerx,
                handler: '_updateTriggerXState',
                getData: (p) => p.triggerx,
                source: 'push'
            },
            {
                namespace: 'Appliance.Control.Sensor.LatestX',
                check: (p) => p?.latest,
                handler: '_updatePresenceState',
                getData: (p) => p.latest,
                source: 'push'
            }
        ];

        const route = namespaceRoutes.find(r => r.namespace === namespace);
        if (!route) {
            return;
        }

        if (!route.check(payload)) {
            return;
        }

        // System.Online is handled directly, not through feature handlers
        if (namespace === 'Appliance.System.Online') {
            const onlineStatus = route.getData(payload);
            this._updateOnlineStatus(onlineStatus);
            return;
        }

        if (route.handler && typeof this[route.handler] === 'function') {
            const data = route.getData(payload);
            if (route.source === 'push') {
                this[route.handler](data, 'push');
            } else {
                this[route.handler](data);
            }
        }
    }

    /**
     * Connects the device and automatically fetches System.All data.
     *
     * Emits 'connected' event immediately to allow test code to proceed. Delays initial
     * state fetch to allow MQTT connection to stabilize before making requests.
     *
     */
    connect() {
        this.deviceConnected = true;
        setImmediate(() => {
            this.emit('connected');
        });
        setTimeout(() => {
            if (typeof this.getSystemAllData === 'function') {
                this.getSystemAllData().catch(_err => {
                    // Ignore initial fetch failures as device may still be initializing
                });
            }
        }, 500);
    }

    /**
     * Disconnects the device
     */
    disconnect() {
        this.deviceConnected = false;
    }

    /**
     * Sets a known local IP address for LAN HTTP communication
     * @param {string} ip - Local IP address
     */
    setKnownLocalIp(ip) {
        this._lanIp = ip;
    }

    /**
     * Removes the known local IP address
     */
    removeKnownLocalIp() {
        this._lanIp = null;
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
     * @returns {Promise<Object>} Promise that resolves with the response payload
     * @throws {Error} If device has no data connection available
     * @throws {Error} If message times out
     */
    async publishMessage(method, namespace, payload, transportMode = null) {
        const data = this.cloudInst.encodeMessage(method, namespace, payload, this.uuid);
        const { messageId } = data.header;

        return new Promise(async (resolve, reject) => {
            try {
                if (!this.deviceConnected) {
                    return reject(new UnconnectedError('Device is not connected', this.uuid));
                }

                const res = await this.cloudInst.requestMessage(this, this._lanIp, data, transportMode);
                if (!res) {
                    return reject(new UnconnectedError('Device has no data connection available', this.uuid));
                }

                const timeoutDuration = this.cloudInst.timeout;
                this.waitingMessageIds[messageId] = {
                    resolve,
                    reject,
                    timeout: setTimeout(() => {
                        if (this.waitingMessageIds[messageId]) {
                            const commandInfo = {
                                method,
                                namespace,
                                messageId
                            };
                            this.waitingMessageIds[messageId].reject(
                                new CommandTimeoutError(
                                    `Command timed out after ${timeoutDuration}ms`,
                                    this.uuid,
                                    timeoutDuration,
                                    commandInfo
                                )
                            );
                            delete this.waitingMessageIds[messageId];
                        }
                    }, timeoutDuration)
                };

                this.emit('rawSendData', data);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Updates the device's online status and emits events if changed.
     *
     * Emits both legacy 'data' events and new 'stateChange' events for unified state
     * handling by subscription managers.
     *
     * @private
     * @param {number} newStatus - New online status from OnlineStatus enum
     */
    _updateOnlineStatus(newStatus) {
        const oldStatus = this.onlineStatus;
        if (oldStatus !== newStatus) {
            this.onlineStatus = newStatus;
            this.emit('onlineStatusChange', newStatus, oldStatus);
            this.emit('data', 'Appliance.System.Online', { online: { status: newStatus } });

            this.emit('stateChange', {
                type: 'online',
                channel: 0,
                value: newStatus,
                oldValue: oldStatus,
                source: 'push',
                timestamp: Date.now()
            });
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
     * @throws {Error} If channel is not found or multiple channels match
     * @example
     * const channel = device.lookupChannel(0); // Find by index
     * const channel2 = device.lookupChannel('Main channel'); // Find by name
     */
    lookupChannel(channelIdOrName) {
        let res = [];
        if (typeof channelIdOrName === 'string') {
            res = this._channels.filter(c => c.name === channelIdOrName);
        } else if (typeof channelIdOrName === 'number') {
            res = this._channels.filter(c => c.index === channelIdOrName);
        }

        if (res.length === 1) {
            return res[0];
        }

        throw new Error(`Could not find channel by id or name = ${channelIdOrName}`);
    }

    /**
     * Updates device information from HTTP device info
     *
     * Updates the device's cached HTTP info, channels, and all device properties
     * from an HttpDeviceInfo object (created via HttpDeviceInfo.fromDict()). Validates that the UUID matches before updating.
     *
     * @param {HttpDeviceInfo} deviceInfo - HttpDeviceInfo object from HTTP API
     * @returns {Promise<MerossDevice>} Promise that resolves with this device instance
     * @throws {Error} If device UUID doesn't match
     * @example
     * const updatedInfo = HttpDeviceInfo.fromDict(deviceDataFromApi);
     * await device.updateFromHttpState(updatedInfo);
     */
    async updateFromHttpState(deviceInfo) {
        if (!deviceInfo || !deviceInfo.uuid) {
            throw new Error('Device info is required and must have a UUID');
        }

        if (deviceInfo.uuid !== this.uuid) {
            throw new Error(`Cannot update device (${this.uuid}) with HttpDeviceInfo for device id ${deviceInfo.uuid}`);
        }

        // Update cached HTTP info
        this._cachedHttpInfo = deviceInfo;

        // Update channels
        this._channels = MerossDevice._parseChannels(deviceInfo.channels);

        // Update device properties
        if (!MerossDevice._isGetterOnly(this, 'name')) {
            this.name = deviceInfo.devName || this.uuid || 'unknown';
        }

        this.deviceType = deviceInfo.deviceType;
        this.firmwareVersion = deviceInfo.fmwareVersion || 'unknown';
        this.hardwareVersion = deviceInfo.hdwareVersion || 'unknown';
        this.domain = deviceInfo.domain || this.domain;

        if (!MerossDevice._isGetterOnly(this, 'onlineStatus')) {
            this.onlineStatus = deviceInfo.onlineStatus !== undefined ? deviceInfo.onlineStatus : OnlineStatus.UNKNOWN;
        }

        return this;
    }
}

/**
 * @typedef {Object} MerossDeviceEvents
 * @property {Function} pushNotification - Emitted when a push notification is received
 * @property {Function} data - Emitted with namespace and payload for backward compatibility
 * @property {Function} rawData - Emitted with raw message data
 * @property {Function} rawSendData - Emitted when raw data is sent
 * @property {Function} onlineStatusChange - Emitted when online status changes (newStatus, oldStatus)
 */

// Mix feature modules into device prototype to enable device-specific capabilities.
// Encryption is included for all devices as firmware may enable it dynamically.
Object.assign(MerossDevice.prototype, encryptionFeature);
Object.assign(MerossDevice.prototype, systemFeature);
Object.assign(MerossDevice.prototype, toggleFeature);
Object.assign(MerossDevice.prototype, lightFeature);
Object.assign(MerossDevice.prototype, thermostatFeature);
Object.assign(MerossDevice.prototype, rollerShutterFeature);
Object.assign(MerossDevice.prototype, garageFeature);
Object.assign(MerossDevice.prototype, diffuserFeature);
Object.assign(MerossDevice.prototype, sprayFeature);
Object.assign(MerossDevice.prototype, consumptionFeature);
Object.assign(MerossDevice.prototype, electricityFeature);

module.exports = { MerossDevice };

