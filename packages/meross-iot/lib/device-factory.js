'use strict';

/**
 * Maps Meross API namespace strings to device feature modules.
 *
 * Used during device class construction to dynamically compose device classes
 * based on the capabilities reported by each device. This avoids maintaining
 * separate classes for every device type and version combination.
 *
 * @private
 */
const ABILITY_MATRIX = {
    // Power plugs abilities
    'Appliance.Control.ToggleX': require('./controller/abilities/toggle-ability'),
    'Appliance.Control.Toggle': require('./controller/abilities/toggle-ability'),
    'Appliance.Control.ConsumptionH': require('./controller/abilities/consumption-ability'),
    'Appliance.Control.ConsumptionX': require('./controller/abilities/consumption-ability'),
    'Appliance.Control.Consumption': require('./controller/abilities/consumption-ability'),
    'Appliance.Control.Electricity': require('./controller/abilities/electricity-ability'),
    'Appliance.Control.Alarm': require('./controller/abilities/alarm-ability'),

    // Timer and Trigger
    'Appliance.Control.TimerX': require('./controller/abilities/timer-ability'),
    'Appliance.Digest.TimerX': require('./controller/abilities/digest-timer-ability'),
    'Appliance.Control.TriggerX': require('./controller/abilities/trigger-ability'),
    'Appliance.Digest.TriggerX': require('./controller/abilities/digest-trigger-ability'),

    // Light abilities
    'Appliance.Control.Light': require('./controller/abilities/light-ability'),

    // Garage opener
    'Appliance.GarageDoor.State': require('./controller/abilities/garage-ability'),

    // Roller shutter
    'Appliance.RollerShutter.State': require('./controller/abilities/roller-shutter-ability'),

    // Spray/Humidifier
    'Appliance.Control.Spray': require('./controller/abilities/spray-ability'),

    // Diffuser
    'Appliance.Control.Diffuser.Light': require('./controller/abilities/diffuser-ability'),
    'Appliance.Control.Diffuser.Spray': require('./controller/abilities/diffuser-ability'),

    // Thermostat
    'Appliance.Control.Thermostat.Mode': require('./controller/abilities/thermostat-ability'),
    'Appliance.Control.Thermostat.ModeB': require('./controller/abilities/thermostat-ability'),

    // System (always included via buildDevice, but listed here for completeness)
    'Appliance.System.All': require('./controller/abilities/system-ability'),
    'Appliance.System.Online': require('./controller/abilities/system-ability'),
    'Appliance.System.Hardware': require('./controller/abilities/system-ability'),
    'Appliance.System.Firmware': require('./controller/abilities/system-ability'),
    'Appliance.System.Time': require('./controller/abilities/system-ability'),
    'Appliance.System.Clock': require('./controller/abilities/system-ability'),
    'Appliance.System.Position': require('./controller/abilities/system-ability'),
    'Appliance.System.Ability': require('./controller/abilities/system-ability'),
    'Appliance.System.Report': require('./controller/abilities/system-ability'),
    'Appliance.System.Debug': require('./controller/abilities/system-ability'),
    'Appliance.System.Factory': require('./controller/abilities/system-ability'),
    'Appliance.System.LedMode': require('./controller/abilities/system-ability'),
    'Appliance.Mcu.Firmware': require('./controller/abilities/system-ability'),

    // Encryption
    'Appliance.Encrypt.Suite': require('./controller/abilities/encryption-ability'),
    'Appliance.Encrypt.ECDHE': require('./controller/abilities/encryption-ability'),

    // DND
    'Appliance.System.DNDMode': require('./controller/abilities/dnd-ability'),

    // Runtime
    'Appliance.System.Runtime': require('./controller/abilities/runtime-ability'),

    // Hub functionality (all hub features combined in single file)
    'Appliance.Hub.Online': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.ToggleX': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.Battery': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.Sensor.WaterLeak': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.Sensor.All': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.Sensor.TempHum': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.Sensor.Alert': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.Sensor.Smoke': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.Sensor.Adjust': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.Sensor.DoorWindow': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.Mts100.All': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.Mts100.Mode': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.Mts100.Temperature': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.Mts100.Adjust': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.Mts100.SuperCtl': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.Mts100.ScheduleB': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.Mts100.Config': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.Exception': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.Report': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.PairSubDev': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.SubDevice.Beep': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.SubDevice.MotorAdjust': require('./controller/abilities/hub-ability'),
    'Appliance.Hub.SubDevice.Version': require('./controller/abilities/hub-ability'),

    // Roller Shutter
    'Appliance.RollerShutter.Position': require('./controller/abilities/roller-shutter-ability'),
    'Appliance.RollerShutter.Config': require('./controller/abilities/roller-shutter-ability'),
    'Appliance.RollerShutter.Adjust': require('./controller/abilities/roller-shutter-ability'),

    // Thermostat additional namespaces
    'Appliance.Control.Thermostat.Schedule': require('./controller/abilities/thermostat-ability'),
    'Appliance.Control.Thermostat.Timer': require('./controller/abilities/thermostat-ability'),
    'Appliance.Control.Thermostat.Alarm': require('./controller/abilities/thermostat-ability'),
    'Appliance.Control.Thermostat.WindowOpened': require('./controller/abilities/thermostat-ability'),
    'Appliance.Control.Thermostat.HoldAction': require('./controller/abilities/thermostat-ability'),
    'Appliance.Control.Thermostat.Overheat': require('./controller/abilities/thermostat-ability'),
    'Appliance.Control.Thermostat.DeadZone': require('./controller/abilities/thermostat-ability'),
    'Appliance.Control.Thermostat.Calibration': require('./controller/abilities/thermostat-ability'),
    'Appliance.Control.Thermostat.Sensor': require('./controller/abilities/thermostat-ability'),
    'Appliance.Control.Thermostat.SummerMode': require('./controller/abilities/thermostat-ability'),
    'Appliance.Control.Thermostat.Frost': require('./controller/abilities/thermostat-ability'),
    'Appliance.Control.Thermostat.AlarmConfig': require('./controller/abilities/thermostat-ability'),
    'Appliance.Control.Thermostat.CompressorDelay': require('./controller/abilities/thermostat-ability'),
    'Appliance.Control.Thermostat.CtlRange': require('./controller/abilities/thermostat-ability'),

    // Config namespaces
    'Appliance.Config.OverTemp': require('./controller/abilities/config-ability'),

    // Control namespaces
    'Appliance.Control.Multiple': require('./controller/abilities/control-ability'),
    'Appliance.Control.Upgrade': require('./controller/abilities/control-ability'),
    'Appliance.Control.OverTemp': require('./controller/abilities/control-ability'),
    'Appliance.Control.ConsumptionConfig': require('./controller/abilities/consumption-ability'),
    'Appliance.Control.Diffuser.Sensor': require('./controller/abilities/diffuser-ability'),
    'Appliance.Control.PhysicalLock': require('./controller/abilities/child-lock-ability'),
    'Appliance.Control.Screen.Brightness': require('./controller/abilities/screen-ability'),
    'Appliance.Control.Sensor.History': require('./controller/abilities/sensor-history-ability'),
    'Appliance.Control.Sensor.LatestX': require('./controller/abilities/presence-sensor-ability'),
    'Appliance.Control.Smoke.Config': require('./controller/abilities/smoke-config-ability'),
    'Appliance.Control.TempUnit': require('./controller/abilities/temp-unit-ability'),

    // Presence sensor
    'Appliance.Control.Presence.Config': require('./controller/abilities/presence-sensor-ability'),
    'Appliance.Control.Presence.Study': require('./controller/abilities/presence-sensor-ability'),

    // Garage door additional namespaces
    'Appliance.GarageDoor.MultipleConfig': require('./controller/abilities/garage-ability'),
    'Appliance.GarageDoor.Config': require('./controller/abilities/garage-ability')
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

    features.add(require('./controller/abilities/system-ability'));

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
 * @param {MerossCloud} manager - MerossCloud manager instance
 * @param {Array<Object>} [subDeviceList] - Optional list of subdevices for hub devices
 * @returns {MerossDevice|MerossHubDevice} Device instance with appropriate features applied
 */
function buildDevice(deviceInfo, abilities, manager, subDeviceList) {
    const { deviceType } = deviceInfo;
    const hardwareVersion = deviceInfo.hdwareVersion;
    const firmwareVersion = deviceInfo.fmwareVersion;

    const isHub = abilities && typeof abilities === 'object' &&
                 HUB_DISCRIMINATING_ABILITY in abilities;

    let DeviceClass = getCachedDeviceClass(deviceType, hardwareVersion, firmwareVersion);

    if (!DeviceClass) {
        const { MerossDevice } = require('./controller/device');
        const { MerossHubDevice } = require('./controller/hub-device');

        const BaseClass = isHub ? MerossHubDevice : MerossDevice;

        const typeKey = getTypeKey(deviceType, hardwareVersion, firmwareVersion);
        DeviceClass = _buildDynamicClass(typeKey, abilities, BaseClass);

        _dynamicTypes.set(typeKey, DeviceClass);
    }

    if (isHub) {
        return new DeviceClass(manager, deviceInfo, subDeviceList);
    } else {
        return new DeviceClass(manager, deviceInfo);
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
    'mts100v3': require('./controller/subdevice').HubThermostatValve,
    'ms100': require('./controller/subdevice').HubTempHumSensor,
    'ms100f': require('./controller/subdevice').HubTempHumSensor,
    'ms130': require('./controller/subdevice').HubTempHumSensor,
    'ms405': require('./controller/subdevice').HubWaterLeakSensor,
    'ms400': require('./controller/subdevice').HubWaterLeakSensor,
    'ma151': require('./controller/subdevice').HubSmokeDetector
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
    'ms100': ['Appliance.Hub.Sensor.TempHum', 'Appliance.Hub.Sensor.All'],
    'ms100f': ['Appliance.Hub.Sensor.TempHum', 'Appliance.Hub.Sensor.All'],
    'ms130': ['Appliance.Hub.Sensor.TempHum', 'Appliance.Hub.Sensor.All'],
    // Smoke detectors
    'ma151': ['Appliance.Hub.Sensor.Smoke', 'Appliance.Hub.Sensor.All'],
    // Water leak sensors
    'ms405': ['Appliance.Hub.Sensor.WaterLeak', 'Appliance.Hub.Sensor.All'],
    'ms400': ['Appliance.Hub.Sensor.WaterLeak', 'Appliance.Hub.Sensor.All'],
    // Thermostat valves
    'mts100v3': ['Appliance.Hub.Mts100.All', 'Appliance.Hub.Mts100.Temperature', 'Appliance.Hub.Mts100.Mode', 'Appliance.Hub.Mts100.Adjust']
};

/**
 * Creates a subdevice instance from subdevice information.
 *
 * Instantiates the appropriate subdevice class based on the subdevice type to ensure
 * type-specific functionality is available. Falls back to the generic MerossSubDevice
 * class for unknown types to maintain compatibility with new or unsupported subdevice
 * types without breaking the application.
 *
 * @param {Object|HttpSubdeviceInfo} subdeviceInfo - Subdevice info from HTTP API (contains subDeviceType/type, id, etc.) or HttpSubdeviceInfo instance
 * @param {string} hubUuid - UUID of the hub device that owns this subdevice
 * @param {Object} hubAbilities - Hub's abilities dictionary (currently unused, reserved for future use)
 * @param {MerossCloud} manager - MerossCloud manager instance
 * @returns {MerossSubDevice} Subdevice instance (specific subclass or generic MerossSubDevice)
 */
function buildSubdevice(subdeviceInfo, hubUuid, hubAbilities, manager) {
    const HttpSubdeviceInfo = require('./model/http/subdevice');
    const { MerossSubDevice } = require('./controller/subdevice');

    const httpSubdeviceInfo = subdeviceInfo instanceof HttpSubdeviceInfo
        ? subdeviceInfo
        : HttpSubdeviceInfo.fromDict(subdeviceInfo);

    const subdeviceId = httpSubdeviceInfo.subDeviceId;
    const subdeviceType = httpSubdeviceInfo.subDeviceType || '';
    const normalizedType = subdeviceType.toLowerCase();

    const SubdeviceClass = SUBDEVICE_MAPPING[normalizedType];

    const kwargs = {
        subDeviceType: httpSubdeviceInfo.subDeviceType,
        subDeviceName: httpSubdeviceInfo.subDeviceName
    };

    if (!SubdeviceClass) {
        const logger = manager?.options?.logger || console.warn;
        logger(`Unknown subdevice type: ${subdeviceType}. Using generic MerossSubDevice`);
        return new MerossSubDevice(hubUuid, subdeviceId, manager, kwargs);
    }

    return new SubdeviceClass(hubUuid, subdeviceId, manager, kwargs);
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

