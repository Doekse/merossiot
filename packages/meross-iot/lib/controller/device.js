'use strict';

const EventEmitter = require('events');
const { OnlineStatus } = require('../model/enums');
const { parsePushNotification } = require('../model/push');
const DeviceRegistry = require('../device-registry');
const ChannelInfo = require('../model/channel-info');
const HttpDeviceInfo = require('../model/http/device');
const {
    MerossErrorCommand,
    MerossErrorCommandTimeout,
    MerossErrorUnconnected,
    MerossErrorUnknownDeviceType,
    MerossErrorValidation,
    MerossErrorNotFound,
    MerossErrorInitialization
} = require('../model/exception');

// Import feature factories
const createSystemFeature = require('./features/system-feature');
const createEncryptionFeature = require('./features/encryption-feature');
const createToggleFeature = require('./features/toggle-feature');
const createLightFeature = require('./features/light-feature');
const createThermostatFeature = require('./features/thermostat-feature');
const createRollerShutterFeature = require('./features/roller-shutter-feature');
const createGarageFeature = require('./features/garage-feature');
const createDiffuserFeature = require('./features/diffuser-feature');
const createSprayFeature = require('./features/spray-feature');
const createConsumptionFeature = require('./features/consumption-feature');
const createElectricityFeature = require('./features/electricity-feature');
const createTimerFeature = require('./features/timer-feature');
const createTriggerFeature = require('./features/trigger-feature');
const createPresenceSensorFeature = require('./features/presence-sensor-feature');
const createAlarmFeature = require('./features/alarm-feature');
const createChildLockFeature = require('./features/child-lock-feature');
const createScreenFeature = require('./features/screen-feature');
const createRuntimeFeature = require('./features/runtime-feature');
const createConfigFeature = require('./features/config-feature');
const createDNDFeature = require('./features/dnd-feature');
const createTempUnitFeature = require('./features/temp-unit-feature');
const createSmokeConfigFeature = require('./features/smoke-config-feature');
const createSensorHistoryFeature = require('./features/sensor-history-feature');
const createDigestTimerFeature = require('./features/digest-timer-feature');
const createDigestTriggerFeature = require('./features/digest-trigger-feature');
const createControlFeature = require('./features/control-feature');
const Heartbeat = require('../utilities/heartbeat');

// Import capability getters
const getToggleCapabilities = require('./features/toggle-feature').getCapabilities;
const getLightCapabilities = require('./features/light-feature').getCapabilities;
const getThermostatCapabilities = require('./features/thermostat-feature').getCapabilities;
const getRollerShutterCapabilities = require('./features/roller-shutter-feature').getCapabilities;
const getGarageCapabilities = require('./features/garage-feature').getCapabilities;
const getDiffuserCapabilities = require('./features/diffuser-feature').getCapabilities;
const getSprayCapabilities = require('./features/spray-feature').getCapabilities;
const getConsumptionCapabilities = require('./features/consumption-feature').getCapabilities;
const getElectricityCapabilities = require('./features/electricity-feature').getCapabilities;
const getTimerCapabilities = require('./features/timer-feature').getCapabilities;
const getTriggerCapabilities = require('./features/trigger-feature').getCapabilities;
const getPresenceSensorCapabilities = require('./features/presence-sensor-feature').getCapabilities;
const getAlarmCapabilities = require('./features/alarm-feature').getCapabilities;
const getChildLockCapabilities = require('./features/child-lock-feature').getCapabilities;
const getScreenCapabilities = require('./features/screen-feature').getCapabilities;
const getRuntimeCapabilities = require('./features/runtime-feature').getCapabilities;
const getConfigCapabilities = require('./features/config-feature').getCapabilities;
const getDNDCapabilities = require('./features/dnd-feature').getCapabilities;
const getTempUnitCapabilities = require('./features/temp-unit-feature').getCapabilities;
const getSmokeConfigCapabilities = require('./features/smoke-config-feature').getCapabilities;
const getSensorHistoryCapabilities = require('./features/sensor-history-feature').getCapabilities;
const getDigestTimerCapabilities = require('./features/digest-timer-feature').getCapabilities;
const getDigestTriggerCapabilities = require('./features/digest-trigger-feature').getCapabilities;
const getControlCapabilities = require('./features/control-feature').getCapabilities;
const getHubCapabilities = require('./features/hub-feature').getCapabilities;
const getSensorCapabilities = require('./features/hub-feature').getSensorCapabilities;

// Import update functions
const updateToggleState = require('./features/toggle-feature')._updateToggleState;
const updateLightState = require('./features/light-feature')._updateLightState;
const updateThermostatMode = require('./features/thermostat-feature')._updateThermostatMode;
const updateThermostatModeB = require('./features/thermostat-feature')._updateThermostatModeB;
const updateRollerShutterState = require('./features/roller-shutter-feature')._updateRollerShutterState;
const updateRollerShutterPosition = require('./features/roller-shutter-feature')._updateRollerShutterPosition;
const updateGarageDoorState = require('./features/garage-feature')._updateGarageDoorState;
const updateGarageDoorConfig = require('./features/garage-feature').updateGarageDoorConfig;
const updateDiffuserLightState = require('./features/diffuser-feature')._updateDiffuserLightState;
const updateDiffuserSprayState = require('./features/diffuser-feature')._updateDiffuserSprayState;
const updateSprayState = require('./features/spray-feature')._updateSprayState;
const updateTimerXState = require('./features/timer-feature')._updateTimerXState;
const updateTriggerXState = require('./features/trigger-feature')._updateTriggerXState;
const updatePresenceState = require('./features/presence-sensor-feature')._updatePresenceState;
const updateAlarmEvents = require('./features/alarm-feature')._updateAlarmEvents;

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

        // Accept both object and string to support subdevices initialized with UUID only,
        // which lack full HTTP device info at construction time
        const dev = typeof devOrUuid === 'string' ? { uuid: devOrUuid } : devOrUuid;

        if (!dev || !dev.uuid) {
            throw new MerossErrorUnknownDeviceType('Device UUID is required');
        }

        this._initializeCoreProperties(dev, domain, port);
        this._initializeStateCaches();
        this._initializeConnectionState(cloudInstance);
        this._initializeHttpInfo(dev);

        // Initialize feature objects
        this.system = createSystemFeature(this);
        this.encryption = createEncryptionFeature(this);
        this.toggle = createToggleFeature(this);
        this.light = createLightFeature(this);
        this.thermostat = createThermostatFeature(this);
        this.rollerShutter = createRollerShutterFeature(this);
        this.garage = createGarageFeature(this);
        this.diffuser = createDiffuserFeature(this);
        this.spray = createSprayFeature(this);
        this.consumption = createConsumptionFeature(this);
        this.electricity = createElectricityFeature(this);
        this.timer = createTimerFeature(this);
        this.trigger = createTriggerFeature(this);
        this.presence = createPresenceSensorFeature(this);
        this.alarm = createAlarmFeature(this);
        this.childLock = createChildLockFeature(this);
        this.screen = createScreenFeature(this);
        this.runtime = createRuntimeFeature(this);
        this.config = createConfigFeature(this);
        this.dnd = createDNDFeature(this);
        this.tempUnit = createTempUnitFeature(this);
        this.smokeConfig = createSmokeConfigFeature(this);
        this.sensorHistory = createSensorHistoryFeature(this);
        this.digestTimer = createDigestTimerFeature(this);
        this.digestTrigger = createDigestTriggerFeature(this);
        this.control = createControlFeature(this);
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
        this.chipType = null;
        this.homekitVersion = null;
        this.firmwareCompileTime = null;
        this.wifiEncrypt = null;
        this.wifiMac = null;
        this.userId = null;
        this.domain = domain || dev.domain;

        if (!MerossDevice._isGetterOnly(this, 'onlineStatus')) {
            this.onlineStatus = dev.onlineStatus !== undefined ? dev.onlineStatus : OnlineStatus.UNKNOWN;
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

        // Extended HTTP device info properties populated from HttpDeviceInfo when available
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
        // Track push notification activity to detect when device is actively sending updates,
        // allowing polling to be reduced when push notifications are active
        this._pushNotificationActive = false;
        this._lastPushNotificationTime = null;
        this._pushInactivityTimer = null;
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
     * Uses HttpDeviceInfo.fromDict() to normalize data types (bindTime from Unix timestamp
     * to Date, onlineStatus validation) before copying properties directly to the device
     * instance. The HttpDeviceInfo instance is not stored to avoid redundancy.
     *
     * @private
     * @param {Object} dev - Device information object from API response
     */
    _initializeHttpInfo(dev) {
        this.channels = [];

        if (dev && dev.uuid && typeof dev === 'object' && dev.deviceType !== undefined) {
            try {
                const httpInfo = HttpDeviceInfo.fromDict(dev);
                this.channels = MerossDevice._parseChannels(dev.channels);
                this._buildCapabilities();

                // Copy extended properties directly to device instance; bindTime already
                // normalized to Date by HttpDeviceInfo.fromDict()
                this.reservedDomain = httpInfo.reservedDomain || null;
                this.subType = httpInfo.subType || null;
                this.bindTime = httpInfo.bindTime || null;
                this.skillNumber = httpInfo.skillNumber || null;
                this.userDevIcon = httpInfo.userDevIcon || null;
                this.iconType = httpInfo.iconType || null;
                this.region = httpInfo.region || null;
                this.devIconId = httpInfo.devIconId || null;
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
        // Only update if abilities actually changed to avoid redundant capability building
        const abilitiesChanged = !this.abilities || JSON.stringify(this.abilities) !== JSON.stringify(abilities);

        if (!abilitiesChanged) {
            return;
        }

        this.abilities = abilities;
        if (this.encryption && typeof this.encryption._updateAbilitiesWithEncryption === 'function') {
            this.encryption._updateAbilitiesWithEncryption(abilities);
        }
        this._buildCapabilities();
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

        // Query each feature for its capabilities
        const capabilityGetters = [
            { key: 'toggle', getter: getToggleCapabilities },
            { key: 'light', getter: getLightCapabilities },
            { key: 'thermostat', getter: getThermostatCapabilities },
            { key: 'rollerShutter', getter: getRollerShutterCapabilities },
            { key: 'garage', getter: getGarageCapabilities },
            { key: 'diffuser', getter: getDiffuserCapabilities },
            { key: 'spray', getter: getSprayCapabilities },
            { key: 'consumption', getter: getConsumptionCapabilities },
            { key: 'electricity', getter: getElectricityCapabilities },
            { key: 'timer', getter: getTimerCapabilities },
            { key: 'trigger', getter: getTriggerCapabilities },
            { key: 'presence', getter: getPresenceSensorCapabilities },
            { key: 'alarm', getter: getAlarmCapabilities },
            { key: 'childLock', getter: getChildLockCapabilities },
            { key: 'screen', getter: getScreenCapabilities },
            { key: 'runtime', getter: getRuntimeCapabilities },
            { key: 'config', getter: getConfigCapabilities },
            { key: 'dnd', getter: getDNDCapabilities },
            { key: 'tempUnit', getter: getTempUnitCapabilities },
            { key: 'smokeConfig', getter: getSmokeConfigCapabilities },
            { key: 'sensorHistory', getter: getSensorHistoryCapabilities },
            { key: 'digestTimer', getter: getDigestTimerCapabilities },
            { key: 'digestTrigger', getter: getDigestTriggerCapabilities },
            { key: 'control', getter: getControlCapabilities },
            { key: 'hub', getter: getHubCapabilities },
            { key: 'sensor', getter: getSensorCapabilities }
        ];

        for (const { key, getter } of capabilityGetters) {
            const featureCaps = getter(this, channelIds);
            if (featureCaps) {
                caps[key] = featureCaps;
            }
        }

        this.capabilities = caps;
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
     * @throws {MerossErrorUnknownDeviceType} If device UUID is missing
     */
    get internalId() {
        if (this._internalId) {
            return this._internalId;
        }

        if (!this.uuid) {
            throw new MerossErrorUnknownDeviceType('Cannot generate internal ID: device missing UUID');
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
     * @throws {MerossErrorUnknownDeviceType} If device does not support refreshState()
     */
    async refreshState() {
        if (this.system && typeof this.system.getAllData === 'function') {
            await this.system.getAllData();

            this.emit('state', {
                type: 'refresh',
                timestamp: this.lastFullUpdateTimestamp || Date.now(),
                value: this.getUnifiedState()
            });
        } else {
            throw new MerossErrorUnknownDeviceType('Device does not support refreshState()', this.deviceType);
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
            timestamp: this.lastFullUpdateTimestamp || Date.now()
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

        // Collect state from feature objects (toggle, light) or state maps (others)
        if (this.light) {
            this._collectLightState(state, channels);
        }

        // Collect state from state maps for features not yet refactored
        const channelFeatures = [
            { key: 'electricity', map: '_channelCachedSamples' },
            { key: 'consumption', map: '_channelCachedConsumption' },
            { key: 'thermostat', map: '_thermostatStateByChannel' },
            { key: 'rollerShutter', map: '_rollerShutterStateByChannel' },
            { key: 'garageDoor', map: '_garageDoorStateByChannel' },
            { key: 'spray', map: '_sprayStateByChannel' }
        ];

        for (const feature of channelFeatures) {
            this._collectChannelFeatureFromMap(state, feature.key, feature.map, channels);
        }

        // Features requiring custom transforms to map internal state to unified format
        this._collectPresenceSensorState(state, channels);
        this._collectDiffuserLightState(state, channels);
        this._collectDiffuserSprayState(state, channels);
    }

    /**
     * Collects toggle state.
     *
     * Toggle state uses Map-based storage (_toggleStateByChannel) rather than
     * per-channel getters, so it's handled separately.
     *
     * @private
     * @param {Object} state - State object to populate
     */
    _collectToggleState(state) {
        if (!this._toggleStateByChannel || this._toggleStateByChannel.size === 0) {
            return;
        }

        state.toggle = {};
        this._toggleStateByChannel.forEach((toggleState, channel) => {
            state.toggle[channel] = toggleState.isOn;
        });
    }

    /**
     * Collects light state from feature object.
     *
     * @private
     * @param {Object} state - State object to populate
     * @param {Array} channels - Array of channel objects
     */
    _collectLightState(state, channels) {
        const featureState = {};
        for (const ch of channels) {
            const cached = this._lightStateByChannel.get(ch.index);
            if (cached) {
                featureState[ch.index] = {
                    isOn: cached.isOn,
                    rgb: cached.rgbInt,
                    rgbTuple: cached.rgbTuple,
                    luminance: cached.luminance,
                    temperature: cached.temperature,
                    capacity: cached.capacity
                };
            }
        }

        if (Object.keys(featureState).length > 0) {
            state.light = featureState;
        }
    }

    /**
     * Collects a channel-based feature state from state map.
     *
     * @private
     * @param {Object} state - State object to populate
     * @param {string} key - Feature key in state object
     * @param {string} mapName - Name of state map property
     * @param {Array} channels - Array of channel objects
     */
    _collectChannelFeatureFromMap(state, key, mapName, channels) {
        const stateMap = this[mapName];
        if (!stateMap || stateMap.size === 0) {
            return;
        }

        const featureState = {};
        for (const ch of channels) {
            const cached = stateMap.get(ch.index);
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
        if (!this._presenceSensorStateByChannel || this._presenceSensorStateByChannel.size === 0) {
            return;
        }

        const featureState = {};
        for (const ch of channels) {
            const cached = this._presenceSensorStateByChannel.get(ch.index);
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
        if (!this._diffuserLightStateByChannel || this._diffuserLightStateByChannel.size === 0) {
            return;
        }

        const featureState = {};
        for (const ch of channels) {
            const cached = this._diffuserLightStateByChannel.get(ch.index);
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
        if (!this._diffuserSprayStateByChannel || this._diffuserSprayStateByChannel.size === 0) {
            return;
        }

        const featureState = {};
        for (const ch of channels) {
            const cached = this._diffuserSprayStateByChannel.get(ch.index);
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

        // Extract System.All from any message type to update device metadata
        if (message.payload?.all) {
            this._handleSystemAllUpdate(message.payload);
        }

        // Extract System.Online from any message type to update online status
        if (message.header.namespace === 'Appliance.System.Online' && message.payload?.online) {
            this._updateOnlineStatus(message.payload.online.status);
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
     * Emits the deviceInitialized event if not already emitted.
     *
     * @private
     */
    _emitDeviceInitialized() {
        if (this._deviceInitializedEmitted) {
            return;
        }
        this._deviceInitializedEmitted = true;
        this.emit('deviceInitialized', this.uuid, this);
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
     */
    _handleSystemAllUpdate(payload) {
        const system = payload.all?.system;
        if (!system) {
        // System.All was received but system property is missing; finalize initialization
        // since the device is connected and responding
            this._finalizeInitialization();
            return;
        }

        const hasUpdates = this.system.handleSystemAllUpdate(payload);
        if (hasUpdates) {
            this.emit('state', {
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
        if (digest.togglex) {
            updateToggleState(this, digest.togglex, 'poll');
        }
        if (digest.light) {
            updateLightState(this, digest.light, 'poll');
        }
        if (digest.spray) {
            updateSprayState(this, digest.spray, 'poll');
        }
        if (digest.timerx) {
            updateTimerXState(this, digest.timerx, 'poll');
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
        if (thermostat.mode) {
            updateThermostatMode(this, thermostat.mode, 'poll');
        }
        if (thermostat.modeB) {
            updateThermostatModeB(this, thermostat.modeB, 'poll');
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
        if (rollerShutter.state) {
            updateRollerShutterState(this, rollerShutter.state, 'poll');
        }
        if (rollerShutter.position) {
            updateRollerShutterPosition(this, rollerShutter.position, 'poll');
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

        if (message.header.method === 'ERROR') {
            const errorPayload = message.payload || {};
            pending.reject(new MerossErrorCommand(
                `Device returned error: ${JSON.stringify(errorPayload)}`,
                errorPayload,
                this.uuid
            ));
        } else {
            if (this._heartbeat) {
                this._heartbeat.recordResponse();
            }
            pending.resolve(message.payload || message);
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
        this._pushNotificationReceived();

        const namespace = message.header?.namespace || '';
        const payload = message.payload || message;

        this.emit('pushNotificationReceived', namespace);

        parsePushNotification(namespace, payload, this.uuid);

        this._routePushNotificationToFeatures(namespace, payload);

        // Feature modules can override for custom routing (e.g., hub subdevices that
        // need to route notifications to child devices)
        if (typeof this.handlePushNotification === 'function') {
            this.handlePushNotification(namespace, payload);
        }
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
        if (namespace === 'Appliance.System.Online' && payload?.online) {
            this._updateOnlineStatus(payload.online.status);
            return;
        }

        if (namespace === 'Appliance.Control.ToggleX' && payload?.togglex) {
            updateToggleState(this, payload.togglex, 'push');
            return;
        }

        if (namespace === 'Appliance.Control.Toggle' && payload?.toggle) {
            const toggleData = payload.toggle;
            if (toggleData.channel === undefined) {
                toggleData.channel = 0;
            }
            updateToggleState(this, toggleData, 'push');
            return;
        }

        if (namespace === 'Appliance.Control.Thermostat.Mode' && payload?.mode) {
            updateThermostatMode(this, payload.mode, 'push');
            return;
        }

        if (namespace === 'Appliance.Control.Thermostat.ModeB' && payload?.modeB) {
            updateThermostatModeB(this, payload.modeB, 'push');
            return;
        }

        if (namespace === 'Appliance.Control.Light' && payload?.light) {
            updateLightState(this, payload.light, 'push');
            return;
        }

        if (namespace === 'Appliance.Control.Diffuser.Light' && payload?.light) {
            updateDiffuserLightState(this, payload.light, 'push');
            return;
        }

        if (namespace === 'Appliance.Control.Diffuser.Spray' && payload?.spray) {
            updateDiffuserSprayState(this, payload.spray, 'push');
            return;
        }

        if (namespace === 'Appliance.Control.Spray' && payload?.spray) {
            updateSprayState(this, payload.spray, 'push');
            return;
        }

        if (namespace === 'Appliance.RollerShutter.State' && payload?.state) {
            updateRollerShutterState(this, payload.state, 'push');
            return;
        }

        if (namespace === 'Appliance.RollerShutter.Position' && payload?.position) {
            updateRollerShutterPosition(this, payload.position, 'push');
            return;
        }

        if (namespace === 'Appliance.GarageDoor.State' && payload?.state) {
            updateGarageDoorState(this, payload.state, 'push');
            return;
        }

        if (namespace === 'Appliance.GarageDoor.MultipleConfig' && payload?.config) {
            updateGarageDoorConfig(this, payload.config);
            return;
        }

        if (namespace === 'Appliance.Control.Alarm' && payload?.alarm) {
            updateAlarmEvents(this, payload.alarm, 'push');
            return;
        }

        if (namespace === 'Appliance.Control.TimerX' && payload?.timerx) {
            updateTimerXState(this, payload.timerx, 'push');
            return;
        }

        if (namespace === 'Appliance.Control.TriggerX' && payload?.triggerx) {
            updateTriggerXState(this, payload.triggerx, 'push');
            return;
        }

        if (namespace === 'Appliance.Control.Sensor.LatestX' && payload?.latest) {
            updatePresenceState(this, payload.latest, 'push');
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
                this.emit('error', new MerossErrorInitialization(
                    'Device initialization timeout: System.All not received',
                    'device',
                    'System.All timeout'
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
        if (this._initializationTimeout) {
            clearTimeout(this._initializationTimeout);
            this._initializationTimeout = null;
        }
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
     * @returns {Promise<Object>} Promise that resolves with the response payload
     * @throws {MerossErrorUnconnected} If device has no data connection available
     * @throws {MerossErrorCommandTimeout} If message times out
     */
    async publishMessage(method, namespace, payload, transportMode = null) {
        const data = this.cloudInst.mqtt.encode(method, namespace, payload, this.uuid);
        const { messageId } = data.header;

        return new Promise(async (resolve, reject) => {
            try {
                if (!this.deviceConnected) {
                    return reject(new MerossErrorUnconnected('Device is not connected', this.uuid));
                }

                const res = await this.cloudInst.transport.request(this, this.lanIp, data, transportMode);
                if (!res) {
                    return reject(new MerossErrorUnconnected('Device has no data connection available', this.uuid));
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
                                new MerossErrorCommandTimeout(
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

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Updates the device's online status and emits events if changed.
     *
     * Emits unified state events for state handling by subscription managers.
     *
     * @private
     * @param {number} status - Online status from OnlineStatus enum
     */
    _updateOnlineStatus(status) {
        const oldStatus = this.onlineStatus;
        if (oldStatus !== status) {
            this.onlineStatus = status;
            this.emit('state', {
                type: 'online',
                value: status,
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
     * @throws {MerossErrorNotFound} If channel is not found or multiple channels match
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

        throw new MerossErrorNotFound(`Could not find channel by id or name = ${channelIdOrName}`, 'channel', channelIdOrName);
    }

    /**
     * Updates device properties from HttpDeviceInfo object.
     *
     * Synchronizes the device instance with updated HTTP device info, including channels,
     * core properties, and extended metadata. Validates UUID match to prevent updating
     * the wrong device. Properties are copied directly to the device instance; the
     * HttpDeviceInfo object is not stored.
     *
     * @param {HttpDeviceInfo} deviceInfo - HttpDeviceInfo object created via HttpDeviceInfo.fromDict()
     * @returns {Promise<MerossDevice>} Promise that resolves with this device instance
     * @throws {MerossErrorValidation} If device info is missing or UUID doesn't match
     * @example
     * const updatedInfo = HttpDeviceInfo.fromDict(deviceDataFromApi);
     * await device.updateFromHttpState(updatedInfo);
     */
    async updateFromHttpState(deviceInfo) {
        if (!deviceInfo || !deviceInfo.uuid) {
            throw new MerossErrorValidation('Device info is required and must have a UUID', 'deviceInfo');
        }

        if (deviceInfo.uuid !== this.uuid) {
            throw new MerossErrorValidation(`Cannot update device (${this.uuid}) with HttpDeviceInfo for device id ${deviceInfo.uuid}`, 'deviceInfo.uuid');
        }

        this.channels = MerossDevice._parseChannels(deviceInfo.channels);
        this._buildCapabilities();

        // Subdevices override name and onlineStatus as getter-only properties that
        // compute values from parent hub, so we must check before assignment
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

        // Extended HTTP device info properties; bindTime already normalized to Date by HttpDeviceInfo
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


module.exports = { MerossDevice };

