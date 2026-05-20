'use strict';

/**
 * Maps Meross API namespace strings to device feature modules.
 *
 * Used during device class construction to dynamically compose device classes
 * based on the capabilities reported by each device. This avoids maintaining
 * separate classes for every device type and version combination.
 *
 * @module device/factory
 * @private
 */
const ABILITY_MATRIX = {
    // Power plugs abilities
    'Appliance.Control.ToggleX': require('../abilities/toggle'),
    'Appliance.Control.Toggle': require('../abilities/toggle'),
    'Appliance.Control.ConsumptionH': require('../abilities/consumption'),
    'Appliance.Control.ConsumptionX': require('../abilities/consumption'),
    'Appliance.Control.Consumption': require('../abilities/consumption'),
    'Appliance.Control.Electricity': require('../abilities/electricity'),
    'Appliance.Control.Alarm': require('../abilities/alarm'),

    // Timer and Trigger
    'Appliance.Control.TimerX': require('../abilities/timer'),
    'Appliance.Digest.TimerX': require('../abilities/digest-timer'),
    'Appliance.Control.TriggerX': require('../abilities/trigger'),
    'Appliance.Digest.TriggerX': require('../abilities/digest-trigger'),

    // Light abilities
    'Appliance.Control.Light': require('../abilities/light'),

    // Garage opener
    'Appliance.GarageDoor.State': require('../abilities/garage'),

    // Roller shutter
    'Appliance.RollerShutter.State': require('../abilities/roller-shutter'),

    // Spray/Humidifier
    'Appliance.Control.Spray': require('../abilities/spray'),

    // Diffuser
    'Appliance.Control.Diffuser.Light': require('../abilities/diffuser'),
    'Appliance.Control.Diffuser.Spray': require('../abilities/diffuser'),

    // Thermostat
    'Appliance.Control.Thermostat.Mode': require('../abilities/thermostat'),
    'Appliance.Control.Thermostat.ModeB': require('../abilities/thermostat'),

    // System (always included via buildDevice, but listed here for completeness)
    'Appliance.System.All': require('../abilities/system'),
    'Appliance.System.Online': require('../abilities/system'),
    'Appliance.System.Hardware': require('../abilities/system'),
    'Appliance.System.Firmware': require('../abilities/system'),
    'Appliance.System.Time': require('../abilities/system'),
    'Appliance.System.Clock': require('../abilities/system'),
    'Appliance.System.Position': require('../abilities/system'),
    'Appliance.System.Ability': require('../abilities/system'),
    'Appliance.System.Report': require('../abilities/system'),
    'Appliance.System.Debug': require('../abilities/system'),
    'Appliance.System.Factory': require('../abilities/system'),
    'Appliance.System.LedMode': require('../abilities/system'),
    'Appliance.Mcu.Firmware': require('../abilities/system'),

    // Encryption
    'Appliance.Encrypt.Suite': require('../abilities/encryption'),
    'Appliance.Encrypt.ECDHE': require('../abilities/encryption'),

    // DND
    'Appliance.System.DNDMode': require('../abilities/dnd'),

    // Runtime
    'Appliance.System.Runtime': require('../abilities/runtime'),

    // Hub functionality (all hub features combined in single file)
    'Appliance.Hub.Online': require('../abilities/hub'),
    'Appliance.Hub.ToggleX': require('../abilities/hub'),
    'Appliance.Hub.Battery': require('../abilities/hub'),
    'Appliance.Hub.Sensor.WaterLeak': require('../abilities/hub'),
    'Appliance.Hub.Sensor.All': require('../abilities/hub'),
    'Appliance.Hub.Sensor.TempHum': require('../abilities/hub'),
    'Appliance.Hub.Sensor.Alert': require('../abilities/hub'),
    'Appliance.Hub.Sensor.Smoke': require('../abilities/hub'),
    'Appliance.Hub.Sensor.Adjust': require('../abilities/hub'),
    'Appliance.Hub.Sensor.DoorWindow': require('../abilities/hub'),
    'Appliance.Hub.Mts100.All': require('../abilities/hub'),
    'Appliance.Hub.Mts100.Mode': require('../abilities/hub'),
    'Appliance.Hub.Mts100.Temperature': require('../abilities/hub'),
    'Appliance.Hub.Mts100.Adjust': require('../abilities/hub'),
    'Appliance.Hub.Mts100.SuperCtl': require('../abilities/hub'),
    'Appliance.Hub.Mts100.ScheduleB': require('../abilities/hub'),
    'Appliance.Hub.Mts100.Config': require('../abilities/hub'),
    'Appliance.Hub.Exception': require('../abilities/hub'),
    'Appliance.Hub.Report': require('../abilities/hub'),
    'Appliance.Hub.PairSubDev': require('../abilities/hub'),
    'Appliance.Hub.SubDevice.Beep': require('../abilities/hub'),
    'Appliance.Hub.SubDevice.MotorAdjust': require('../abilities/hub'),
    'Appliance.Hub.SubDevice.Version': require('../abilities/hub'),

    // Roller Shutter
    'Appliance.RollerShutter.Position': require('../abilities/roller-shutter'),
    'Appliance.RollerShutter.Config': require('../abilities/roller-shutter'),
    'Appliance.RollerShutter.Adjust': require('../abilities/roller-shutter'),

    // Thermostat additional namespaces
    'Appliance.Control.Thermostat.Schedule': require('../abilities/thermostat'),
    'Appliance.Control.Thermostat.Timer': require('../abilities/thermostat'),
    'Appliance.Control.Thermostat.Alarm': require('../abilities/thermostat'),
    'Appliance.Control.Thermostat.WindowOpened': require('../abilities/thermostat'),
    'Appliance.Control.Thermostat.HoldAction': require('../abilities/thermostat'),
    'Appliance.Control.Thermostat.Overheat': require('../abilities/thermostat'),
    'Appliance.Control.Thermostat.DeadZone': require('../abilities/thermostat'),
    'Appliance.Control.Thermostat.Calibration': require('../abilities/thermostat'),
    'Appliance.Control.Thermostat.Sensor': require('../abilities/thermostat'),
    'Appliance.Control.Thermostat.SummerMode': require('../abilities/thermostat'),
    'Appliance.Control.Thermostat.Frost': require('../abilities/thermostat'),
    'Appliance.Control.Thermostat.AlarmConfig': require('../abilities/thermostat'),
    'Appliance.Control.Thermostat.CompressorDelay': require('../abilities/thermostat'),
    'Appliance.Control.Thermostat.CtlRange': require('../abilities/thermostat'),

    // Config namespaces
    'Appliance.Config.OverTemp': require('../abilities/config'),

    // Control namespaces
    'Appliance.Control.Multiple': require('../abilities/control'),
    'Appliance.Control.Upgrade': require('../abilities/control'),
    'Appliance.Control.OverTemp': require('../abilities/control'),
    'Appliance.Control.ConsumptionConfig': require('../abilities/consumption'),
    'Appliance.Control.Diffuser.Sensor': require('../abilities/diffuser'),
    'Appliance.Control.PhysicalLock': require('../abilities/child-lock'),
    'Appliance.Control.Screen.Brightness': require('../abilities/screen'),
    'Appliance.Control.Sensor.History': require('../abilities/sensor-history'),
    'Appliance.Control.Sensor.LatestX': require('../abilities/presence'),
    'Appliance.Control.Smoke.Config': require('../abilities/smoke-config'),
    'Appliance.Control.TempUnit': require('../abilities/temp-unit'),

    // Presence sensor
    'Appliance.Control.Presence.Config': require('../abilities/presence'),
    'Appliance.Control.Presence.Study': require('../abilities/presence'),

    // Garage door additional namespaces
    'Appliance.GarageDoor.MultipleConfig': require('../abilities/garage'),
    'Appliance.GarageDoor.Config': require('../abilities/garage')
};

/**
 * Namespace that identifies hub devices.
 *
 * Used to distinguish hub devices from regular devices during device creation,
 * since hubs require a different base class and constructor signature.
 *
 * @private
 */
const HUB_DISCRIMINATING_ABILITY = 'Appliance.Hub.SubdeviceList';

/**
 * Cache for dynamically created device classes.
 *
 * Caching avoids recreating identical classes for devices with the same type and versions,
 * reducing memory usage and improving instantiation performance.
 *
 * @type {Map<string, Function>}
 * Key: type string (e.g., "mss310:1.0.0:4.2.1")
 * Value: Device class constructor
 */
const _dynamicTypes = new Map();

/**
 * Generates a cache key from device type and version information.
 *
 * The key format `deviceType:hardwareVersion:firmwareVersion` ensures devices with
 * different capabilities (due to version differences) get separate cached classes.
 *
 * @param {string} deviceType - Device type (e.g., "mss310", "msl120")
 * @param {string} [hardwareVersion] - Hardware version (e.g., "1.0.0"). Defaults to 'unknown' if not provided.
 * @param {string} [firmwareVersion] - Firmware version (e.g., "4.2.1"). Defaults to 'unknown' if not provided.
 * @returns {string} Cache key string (e.g., "mss310:1.0.0:4.2.1")
 */
function getTypeKey(deviceType, hardwareVersion, firmwareVersion) {
    const hw = hardwareVersion || 'unknown';
    const fw = firmwareVersion || 'unknown';
    return `${deviceType}:${hw}:${fw}`;
}

/**
 * Retrieves a cached device class if one exists for the given type and versions.
 *
 * Device classes are cached to avoid recreating identical classes for devices
 * with the same capabilities, reducing memory usage and improving performance.
 *
 * @param {string} deviceType - Device type (e.g., "mss310")
 * @param {string} [hardwareVersion] - Hardware version (e.g., "1.0.0")
 * @param {string} [firmwareVersion] - Firmware version (e.g., "4.2.1")
 * @returns {Function|null} Cached device class constructor, or null if not found in cache
 */
function getCachedDeviceClass(deviceType, hardwareVersion, firmwareVersion) {
    const typeKey = getTypeKey(deviceType, hardwareVersion, firmwareVersion);
    return _dynamicTypes.get(typeKey) || null;
}

/**
 * Builds a device class dynamically by composing features based on device abilities.
 *
 * Features are selected from the ability matrix and applied to a base class. Handlers
 * are chained so multiple features can process the same events or state updates.
 *
 * @param {string} typeKey - Type key for caching
 * @param {Object} abilities - Device abilities dictionary
 * @param {Function} BaseClass - Base class (MerossDevice or MerossHubDevice)
 * @returns {Function} Dynamic device class
 */
function _buildDynamicClass(typeKey, abilities, BaseClass) {
    const features = new Set();

    features.add(require('../abilities/system'));

    if (abilities && typeof abilities === 'object') {
        const hasXVersion = new Set();
        for (const namespace of Object.keys(abilities)) {
            if (namespace.endsWith('X')) {
                const baseNamespace = namespace.slice(0, -1);
                hasXVersion.add(baseNamespace);
            }
        }

        for (const [namespace] of Object.entries(abilities)) {
            const feature = ABILITY_MATRIX[namespace];
            if (feature) {
                if (namespace.endsWith('X')) {
                    features.add(feature);
                } else {
                    if (!hasXVersion.has(namespace)) {
                        features.add(feature);
                    }
                }
            }
        }
    }

    class DynamicDevice extends BaseClass {}

    const featureArray = Array.from(features);
    const pushHandlers = [];
    const refreshHandlers = [];

    for (const feature of featureArray) {
        if (feature.handlePushNotification) {
            pushHandlers.push(feature.handlePushNotification);
        }
        if (feature.refreshState) {
            refreshHandlers.push(feature.refreshState);
        }

        const { handlePushNotification: _handlePushNotification, refreshState: _refreshState, ...featureProperties } = feature;
        Object.assign(DynamicDevice.prototype, featureProperties);
    }

    if (pushHandlers.length > 0) {
        DynamicDevice.prototype.handlePushNotification = function (namespace, data) {
            for (const handler of pushHandlers) {
                if (handler.call(this, namespace, data)) {
                    return true;
                }
            }
            return false;
        };
    }

    if (refreshHandlers.length > 0) {
        DynamicDevice.prototype.refreshState = async function (timeout = null) {
            for (const handler of refreshHandlers) {
                await handler.call(this, timeout);
            }
        };
    }

    return DynamicDevice;
}

/**
 * Builds a device instance from device info and abilities.
 *
 * Uses cached device classes when available, or dynamically creates a new class
 * that includes only the features supported by the device's abilities. Hub devices
 * are detected by the presence of a specific ability and use a different base class.
 *
 * @param {Object} deviceInfo - Device info from HTTP API (contains deviceType, hdwareVersion, fmwareVersion, etc.)
 * @param {Object} abilities - Device abilities dictionary from `Appliance.System.Ability` namespace
 * @param {import('../meross')} meross - Root Meross instance
 * @param {Array<Object>} [subDeviceList] - Optional list of subdevices for hub devices
 * @returns {MerossDevice|MerossHubDevice} Device instance with appropriate features applied
 */
function buildDevice(deviceInfo, abilities, meross, subDeviceList) {
    const { deviceType } = deviceInfo;
    const hardwareVersion = deviceInfo.hdwareVersion;
    const firmwareVersion = deviceInfo.fmwareVersion;

    const isHub = abilities && typeof abilities === 'object' &&
                 HUB_DISCRIMINATING_ABILITY in abilities;

    let DeviceClass = getCachedDeviceClass(deviceType, hardwareVersion, firmwareVersion);

    if (!DeviceClass) {
        const { MerossDevice } = require('./device');
        const { MerossHubDevice } = require('./hubdevice');

        const BaseClass = isHub ? MerossHubDevice : MerossDevice;

        const typeKey = getTypeKey(deviceType, hardwareVersion, firmwareVersion);
        DeviceClass = _buildDynamicClass(typeKey, abilities, BaseClass);

        _dynamicTypes.set(typeKey, DeviceClass);
    }

    if (isHub) {
        return new DeviceClass(meross, deviceInfo, subDeviceList);
    } else {
        return new DeviceClass(meross, deviceInfo);
    }
}

/**
 * Maps subdevice type identifiers to their corresponding device class constructors.
 *
 * Different subdevice types require different class implementations because they
 * expose different capabilities and API namespaces. This mapping enables the factory
 * to instantiate the appropriate specialized class for each subdevice type.
 *
 * @private
 */
const SUBDEVICE_MAPPING = {
    'mts100v3': require('./subdevice').HubThermostatValve,
    'ms100': require('./subdevice').HubTempHumSensor,
    'ms100f': require('./subdevice').HubTempHumSensor,
    'ms130': require('./subdevice').HubTempHumSensor,
    'ms200': require('./subdevice').HubDoorWindowSensor,
    'ms405': require('./subdevice').HubWaterLeakSensor,
    'ms400': require('./subdevice').HubWaterLeakSensor,
    'ma151': require('./subdevice').HubSmokeDetector
};

/**
 * Maps subdevice types to the hub ability namespaces they require.
 *
 * Hubs expose abilities for all their subdevices, but each subdevice only needs
 * access to namespaces relevant to its type. This mapping filters the hub's full
 * ability set to prevent subdevices from accessing capabilities they don't support,
 * reducing API surface and potential misuse.
 *
 * @private
 */
const SUBDEVICE_ABILITY_MAPPING = {
    // Temperature/Humidity sensors
    'ms100': [
        'Appliance.Hub.Sensor.TempHum',
        'Appliance.Hub.Sensor.All',
        'Appliance.Hub.Sensor.Alert',
        'Appliance.Hub.Sensor.Adjust'
    ],
    'ms100f': [
        'Appliance.Hub.Sensor.TempHum',
        'Appliance.Hub.Sensor.All',
        'Appliance.Hub.Sensor.Alert',
        'Appliance.Hub.Sensor.Adjust'
    ],
    'ms130': [
        'Appliance.Hub.Sensor.TempHum',
        'Appliance.Hub.Sensor.All',
        'Appliance.Hub.Sensor.Alert',
        'Appliance.Hub.Sensor.Adjust'
    ],
    'ms200': ['Appliance.Hub.Sensor.DoorWindow', 'Appliance.Hub.Sensor.All'],
    // Smoke detectors
    'ma151': ['Appliance.Hub.Sensor.Smoke', 'Appliance.Hub.Sensor.All'],
    // Water leak sensors
    'ms405': ['Appliance.Hub.Sensor.WaterLeak', 'Appliance.Hub.Sensor.All'],
    'ms400': ['Appliance.Hub.Sensor.WaterLeak', 'Appliance.Hub.Sensor.All'],
    // Thermostat valves
    'mts100v3': [
        'Appliance.Hub.Mts100.All',
        'Appliance.Hub.Mts100.Temperature',
        'Appliance.Hub.Mts100.Mode',
        'Appliance.Hub.Mts100.Adjust',
        'Appliance.Hub.Mts100.SuperCtl',
        'Appliance.Hub.Mts100.ScheduleB',
        'Appliance.Hub.Mts100.Config'
    ]
};

/**
 * Creates a subdevice instance from subdevice information.
 *
 * Instantiates the appropriate subdevice class based on the subdevice type to ensure
 * type-specific functionality is available. Falls back to the generic MerossSubDevice
 * class for unknown types to maintain compatibility with new or unsupported subdevice
 * types without breaking the application.
 *
 * @param {Object|ApiSubdeviceInfo} subdeviceInfo - Subdevice info from Meross cloud API (contains subDeviceType/type, id, etc.) or ApiSubdeviceInfo instance
 * @param {string} hubUuid - UUID of the hub device that owns this subdevice
 * @param {Object} hubAbilities - Hub's abilities dictionary (currently unused, reserved for future use)
 * @param {import('../meross')} meross - Root Meross instance
 * @returns {MerossSubDevice} Subdevice instance (specific subclass or generic MerossSubDevice)
 */
function buildSubdevice(subdeviceInfo, hubUuid, hubAbilities, meross) {
    const ApiSubdeviceInfo = require('../api/subdevice');
    const { MerossSubDevice } = require('./subdevice');

    const apiSubdeviceInfo = subdeviceInfo instanceof ApiSubdeviceInfo
        ? subdeviceInfo
        : ApiSubdeviceInfo.fromDict(subdeviceInfo);

    const subdeviceId = apiSubdeviceInfo.subDeviceId;
    const subdeviceType = apiSubdeviceInfo.subDeviceType || '';
    const normalizedType = subdeviceType.toLowerCase();

    const SubdeviceClass = SUBDEVICE_MAPPING[normalizedType];

    const kwargs = {
        subDeviceType: apiSubdeviceInfo.subDeviceType,
        subDeviceName: apiSubdeviceInfo.subDeviceName
    };

    if (!SubdeviceClass) {
        const logger = meross?.options?.logger || console.warn;
        logger(`Unknown subdevice type: ${subdeviceType}. Using generic MerossSubDevice`);
        return new MerossSubDevice(hubUuid, subdeviceId, meross, kwargs);
    }

    return new SubdeviceClass(hubUuid, subdeviceId, meross, kwargs);
}

/**
 * Filters hub abilities to only those relevant for a specific subdevice type.
 *
 * Hubs expose abilities for all their subdevices, but each subdevice should only
 * access namespaces it supports. This filtering prevents subdevices from attempting
 * to use unsupported APIs and reduces the ability surface exposed to each subdevice.
 *
 * @param {string} subdeviceType - Subdevice type (e.g., 'ms130', 'ma151', 'mts100v3')
 * @param {Object} hubAbilities - Hub's full abilities dictionary from `Appliance.System.Ability`
 * @returns {Object} Filtered abilities object containing only namespaces relevant to the subdevice type
 */
function getSubdeviceAbilities(subdeviceType, hubAbilities) {
    if (!hubAbilities || typeof hubAbilities !== 'object') {
        return {};
    }

    const normalizedType = (subdeviceType || '').toLowerCase();
    const relevantNamespaces = SUBDEVICE_ABILITY_MAPPING[normalizedType];

    if (!relevantNamespaces) {
        return {};
    }

    const subdeviceAbilities = {};
    for (const namespace of relevantNamespaces) {
        if (hubAbilities[namespace]) {
            subdeviceAbilities[namespace] = hubAbilities[namespace];
        }
    }

    return subdeviceAbilities;
}

module.exports = {
    getTypeKey,
    getCachedDeviceClass,
    buildDevice,
    HUB_DISCRIMINATING_ABILITY,
    SUBDEVICE_MAPPING,
    SUBDEVICE_ABILITY_MAPPING,
    buildSubdevice,
    getSubdeviceAbilities
};

