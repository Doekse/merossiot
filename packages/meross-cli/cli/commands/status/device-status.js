'use strict';

const chalk = require('chalk');
const ora = require('ora');
const { MerossHubDevice, DNDMode, ThermostatMode, WorkMode, SensitivityLevel } = require('meross-iot');

/**
 * Returns list of dangerous namespaces that should never be called automatically.
 */
function _getDangerousNamespaces() {
    return [
        'Appliance.Control.Unbind',      // Removes device from account!
        'Appliance.Control.Bind',         // Binds devices (should be explicit)
        'Appliance.Control.Upgrade',      // Triggers firmware upgrades
        'Appliance.Control.ChangeWiFi',  // Changes WiFi settings
        'Appliance.Hub.Unbind',          // Unbinds subdevices
        'Appliance.Hub.Bind'             // Binds subdevices
    ];
}

/**
 * Filters out namespaces that don't support GET requests or are dangerous.
 */
function _getAllNamespaces(abilities, dangerousNamespaces) {
    return Object.keys(abilities).filter(ns => {
        if (ns.startsWith('Appliance.Hub.')) {return false;}
        if (ns === 'Appliance.System.Ability' || ns === 'Appliance.System.All') {return false;}
        if (ns === 'Appliance.System.Clock') {return false;} // Only supports PUSH mode (device-initiated), not GET
        if (ns === 'Appliance.System.Report') {return false;} // Only supports PUSH mode (device-initiated reports), not GET
        if (ns === 'Appliance.Control.Multiple') {return false;} // Only supports SET (executing multiple commands), not GET
        if (ns === 'Appliance.Control.Upgrade') {return false;} // Only supports SET/PUSH (triggering upgrades), not GET
        if (ns === 'Appliance.Control.OverTemp') {return false;} // Only supports SET (device-initiated when over-temp), not GET
        if (ns === 'Appliance.Control.AlertReport') {return false;} // Only supports PUSH mode (device-initiated alerts), not GET
        if (ns === 'Appliance.Config.Key') {return false;} // Only supports SET (security-sensitive MQTT credentials), not GET
        if (ns.startsWith('Appliance.Encrypt.')) {return false;} // Encryption setup, not GET-able
        if (dangerousNamespaces.includes(ns)) {return false;} // Never call dangerous namespaces
        return true;
    });
}

/**
 * Categorizes namespaces into sensor and config namespaces.
 */
function _categorizeNamespaces(allNamespaces) {
    const sensorNamespaces = allNamespaces.filter(ns => {
        // Control namespaces are sensors/state
        if (ns.startsWith('Appliance.Control.')) {return true;}
        // Digest namespaces are state
        if (ns.startsWith('Appliance.Digest.')) {return true;}
        // System namespaces that are state (not config)
        if (ns.startsWith('Appliance.System.')) {
            // System.DNDMode and System.LedMode are config, others are state
            if (ns === 'Appliance.System.DNDMode' || ns === 'Appliance.System.LedMode') {return false;}
            return true;
        }
        // Garage door, roller shutter, etc. are sensors/state
        if (ns.startsWith('Appliance.GarageDoor.') || ns.startsWith('Appliance.RollerShutter.')) {return true;}
        return false;
    });

    const configNamespaces = allNamespaces.filter(ns => {
        // Config namespaces are configuration
        if (ns.startsWith('Appliance.Config.')) {return true;}
        // Some System namespaces are config
        if (ns === 'Appliance.System.DNDMode' || ns === 'Appliance.System.LedMode') {return true;}
        // Presence config is a Control namespace but it's configuration
        if (ns === 'Appliance.Control.Presence.Config') {return true;}
        return false;
    });

    return { sensorNamespaces, configNamespaces };
}

/**
 * Filters sensor namespaces to determine which ones need to be fetched.
 */
function _filterNamespacesToFetch(sensorNamespaces, isMqttConnected, device) {
    const pushNotificationNamespaces = [
        'Appliance.Control.ToggleX',
        'Appliance.Control.Toggle',
        'Appliance.Control.Thermostat.Mode',
        'Appliance.Control.Thermostat.ModeB',
        'Appliance.Control.Light',
        'Appliance.Digest.TimerX',
        'Appliance.Digest.TriggerX'
    ];

    const pollingRequiredNamespaces = [
        'Appliance.Control.Electricity',
        'Appliance.Control.ConsumptionX',
        'Appliance.Control.Consumption',
        'Appliance.Control.Sensor.History',
        'Appliance.Control.Sensor.Latest',
        'Appliance.Control.Sensor.LatestX'
    ];

    return sensorNamespaces.filter(ns => {
        // Always fetch polling-required namespaces
        if (pollingRequiredNamespaces.some(pns => ns === pns || ns.startsWith(pns))) {
            return true;
        }
        // For push-based namespaces, only fetch if:
        // 1. Not connected via MQTT, OR
        // 2. No cached state available
        if (pushNotificationNamespaces.some(pns => ns === pns || ns.startsWith(pns))) {
            if (!isMqttConnected) {
                return true; // Not MQTT connected, need to poll
            }
            // Check if we have cached state - if yes, skip polling
            if (ns === 'Appliance.Control.ToggleX' && typeof device.isOn === 'function') {
                const isOn = device.isOn(0);
                if (isOn !== undefined) {
                    return false; // Have cached state, skip polling
                }
            }
            // For other push-based namespaces, still fetch to ensure we have latest data
            return true;
        }
        // For unknown namespaces, fetch them
        return true;
    });
}

/**
 * Builds payload for a namespace (fallback for namespaces without feature methods).
 * NOTE: This is a FALLBACK. Feature methods are preferred because they handle payload format correctly,
 * update device state automatically, handle unit conversions, and return typed objects.
 */
function _buildPayloadForNamespace(namespace) {
    // Known payload patterns
    if (namespace === 'Appliance.Control.ToggleX') {
        return { togglex: { channel: 0 } };
    } else if (namespace === 'Appliance.Control.Toggle') {
        return {};
    } else if (namespace === 'Appliance.Control.Electricity') {
        return { channel: 0 };
    } else if (namespace === 'Appliance.Control.Thermostat.Mode') {
        return { mode: [{ channel: 0 }] };
    } else if (namespace === 'Appliance.Control.Thermostat.ModeB') {
        return { modeB: [{ channel: 0 }] };
    } else if (namespace.startsWith('Appliance.Control.Thermostat.')) {
        // Extract the key from namespace (e.g., "WindowOpened" from "Appliance.Control.Thermostat.WindowOpened")
        const key = namespace.replace('Appliance.Control.Thermostat.', '');
        // Convert to camelCase for payload key
        const payloadKey = key.charAt(0).toLowerCase() + key.slice(1);
        // Special cases
        if (key === 'DeadZone') {
            return { deadZone: [{ channel: 0 }] };
        } else if (key === 'HoldAction') {
            return { holdAction: [{ channel: 0 }] };
        } else if (key === 'WindowOpened') {
            return { windowOpened: [{ channel: 0 }] };
        }
        const payload = {};
        payload[payloadKey] = [{ channel: 0 }];
        return payload;
    } else if (namespace === 'Appliance.Control.Screen.Brightness') {
        return { brightness: [{ channel: 0 }] };
    } else if (namespace === 'Appliance.Control.PhysicalLock') {
        return { lock: [{ channel: 0 }] };
    } else if (namespace === 'Appliance.Control.Sensor.LatestX') {
        // Presence sensor - use device method instead of raw publishMessage
        return null; // Signal to use device method
    } else if (namespace === 'Appliance.Control.TimerX') {
        // TimerX GET - use device feature method which handles payload correctly
        return null; // Signal to use device method
    } else if (namespace.startsWith('Appliance.Control.')) {
        // Generic Control namespace - try to infer payload key
        const key = namespace.replace('Appliance.Control.', '');
        const payloadKey = key.charAt(0).toLowerCase() + key.slice(1);
        // Try array format first (most common)
        const payload = {};
        payload[payloadKey] = [{ channel: 0 }];
        return payload;
    } else if (namespace.startsWith('Appliance.Digest.')) {
        // Digest namespaces usually don't need payload or use empty
        return {};
    } else if (namespace.startsWith('Appliance.System.')) {
        // System namespaces usually don't need payload
        return {};
    } else if (namespace.startsWith('Appliance.GarageDoor.')) {
        // Try generic payload
        const key = namespace.replace('Appliance.GarageDoor.', '');
        const payloadKey = key.charAt(0).toLowerCase() + key.slice(1);
        const payload = {};
        payload[payloadKey] = [{ channel: 0 }];
        return payload;
    } else if (namespace.startsWith('Appliance.RollerShutter.')) {
        const key = namespace.replace('Appliance.RollerShutter.', '');
        const payloadKey = key.charAt(0).toLowerCase() + key.slice(1);
        const payload = {};
        payload[payloadKey] = [{ channel: 0 }];
        return payload;
    }
    // Default: empty payload
    return {};
}

/**
 * Maps Toggle feature namespaces to feature methods.
 */
function _mapToggleFeatureNamespace(namespace, device) {
    if (namespace === 'Appliance.Control.ToggleX' && typeof device.getToggleState === 'function') {
        return { featureMethod: device.getToggleState.bind(device), featureArgs: [0] };
    }
    return null;
}

/**
 * Maps Light feature namespaces to feature methods.
 */
function _mapLightFeatureNamespace(namespace, device) {
    if (namespace === 'Appliance.Control.Light' && typeof device.getLightState === 'function') {
        return { featureMethod: device.getLightState.bind(device), featureArgs: [] };
    }
    return null;
}

/**
 * Maps Diffuser feature namespaces to feature methods.
 */
function _mapDiffuserFeatureNamespace(namespace, device) {
    if (namespace === 'Appliance.Control.Diffuser.Light' && typeof device.getDiffuserLightState === 'function') {
        return { featureMethod: device.getDiffuserLightState.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.Control.Diffuser.Spray' && typeof device.getDiffuserSprayState === 'function') {
        return { featureMethod: device.getDiffuserSprayState.bind(device), featureArgs: [] };
    }
    return null;
}

/**
 * Maps Spray feature namespaces to feature methods.
 */
function _mapSprayFeatureNamespace(namespace, device) {
    if (namespace === 'Appliance.Control.Spray' && typeof device.getSprayState === 'function') {
        return { featureMethod: device.getSprayState.bind(device), featureArgs: [] };
    }
    return null;
}

/**
 * Maps Electricity feature namespaces to feature methods.
 */
function _mapElectricityFeatureNamespace(namespace, device) {
    if (namespace === 'Appliance.Control.Electricity' && typeof device.getElectricity === 'function') {
        return { featureMethod: device.getElectricity.bind(device), featureArgs: [0] };
    }
    return null;
}

/**
 * Maps Consumption feature namespaces to feature methods.
 */
function _mapConsumptionFeatureNamespace(namespace, device) {
    if (namespace === 'Appliance.Control.ConsumptionX' && typeof device.getPowerConsumptionX === 'function') {
        return { featureMethod: device.getRawPowerConsumptionX.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Control.Consumption' && typeof device.getPowerConsumption === 'function') {
        return { featureMethod: device.getRawPowerConsumption.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Control.ConsumptionConfig' && typeof device.getConsumptionConfig === 'function') {
        return { featureMethod: device.getConsumptionConfig.bind(device), featureArgs: [] };
    }
    return null;
}

/**
 * Maps Timer feature namespaces to feature methods.
 */
function _mapTimerFeatureNamespace(namespace, device) {
    if (namespace === 'Appliance.Control.TimerX' && typeof device.getTimerX === 'function') {
        // TimerX GET requests can return large amounts of data and may cause connection issues over HTTP
        // TimerX data is available in System.All digest, so skip direct GET requests over HTTP
        return { featureMethod: null, featureArgs: [] }; // Skip TimerX GET over HTTP
    }
    return null;
}

/**
 * Maps Trigger feature namespaces to feature methods.
 */
function _mapTriggerFeatureNamespace(namespace, device) {
    if (namespace === 'Appliance.Control.TriggerX' && typeof device.getTriggerX === 'function') {
        return { featureMethod: device.getTriggerX.bind(device), featureArgs: [0] };
    }
    return null;
}

/**
 * Maps Sensor feature namespaces to feature methods.
 */
function _mapSensorFeatureNamespace(namespace, device) {
    if (namespace === 'Appliance.Control.Sensor.LatestX' && typeof device.getLatestSensorReadings === 'function') {
        return { featureMethod: device.getLatestSensorReadings.bind(device), featureArgs: [['presence', 'light']] };
    } else if (namespace === 'Appliance.Control.Sensor.History' && typeof device.getSensorHistory === 'function') {
        return { featureMethod: device.getSensorHistory.bind(device), featureArgs: [0, 1] }; // channel, capacity
    }
    return null;
}

/**
 * Maps shared/common Control namespaces to feature methods.
 * These are namespaces that don't belong to a specific feature but are common across devices.
 */
function _mapSharedControlNamespace(namespace, device) {
    if (namespace === 'Appliance.Control.Alarm' && typeof device.getAlarmStatus === 'function') {
        return { featureMethod: device.getAlarmStatus.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Control.TempUnit' && typeof device.getTempUnit === 'function') {
        return { featureMethod: device.getTempUnit.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Control.Smoke.Config' && typeof device.getSmokeConfig === 'function') {
        return { featureMethod: device.getSmokeConfig.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Control.Presence.Study' && typeof device.getPresenceStudy === 'function') {
        return { featureMethod: device.getPresenceStudy.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.Control.Screen.Brightness' && typeof device.getScreenBrightness === 'function') {
        return { featureMethod: device.getScreenBrightness.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Control.PhysicalLock' && typeof device.getChildLock === 'function') {
        return { featureMethod: device.getChildLock.bind(device), featureArgs: [0] };
    }
    return null;
}

/**
 * Maps Thermostat namespaces to feature methods.
 */
function _mapThermostatNamespaceToFeatureMethod(namespace, device) {
    if (namespace === 'Appliance.Control.Thermostat.Mode' && typeof device.getThermostatMode === 'function') {
        return { featureMethod: device.getThermostatMode.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Control.Thermostat.ModeB' && typeof device.getThermostatModeB === 'function') {
        return { featureMethod: device.getThermostatModeB.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Control.Thermostat.WindowOpened' && typeof device.getThermostatWindowOpened === 'function') {
        return { featureMethod: device.getThermostatWindowOpened.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Control.Thermostat.Calibration' && typeof device.getThermostatCalibration === 'function') {
        return { featureMethod: device.getThermostatCalibration.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Control.Thermostat.DeadZone' && typeof device.getThermostatDeadZone === 'function') {
        return { featureMethod: device.getThermostatDeadZone.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Control.Thermostat.HoldAction' && typeof device.getThermostatHoldAction === 'function') {
        return { featureMethod: device.getThermostatHoldAction.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Control.Thermostat.Overheat' && typeof device.getThermostatOverheat === 'function') {
        return { featureMethod: device.getThermostatOverheat.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Control.Thermostat.Frost' && typeof device.getThermostatFrost === 'function') {
        return { featureMethod: device.getThermostatFrost.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Control.Thermostat.Sensor' && typeof device.getThermostatSensor === 'function') {
        return { featureMethod: device.getThermostatSensor.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Control.Thermostat.Schedule' && typeof device.getThermostatSchedule === 'function') {
        return { featureMethod: device.getThermostatSchedule.bind(device), featureArgs: [0] };
    }
    return null;
}

/**
 * Maps System namespaces to feature methods.
 */
function _mapSystemNamespaceToFeatureMethod(namespace, device) {
    if (namespace === 'Appliance.System.Runtime' && typeof device.updateRuntimeInfo === 'function') {
        return { featureMethod: device.updateRuntimeInfo.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.System.Hardware' && typeof device.getSystemHardware === 'function') {
        return { featureMethod: device.getSystemHardware.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.System.Firmware' && typeof device.getSystemFirmware === 'function') {
        return { featureMethod: device.getSystemFirmware.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.System.Debug' && typeof device.getSystemDebug === 'function') {
        return { featureMethod: device.getSystemDebug.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.System.Online' && typeof device.getOnlineStatus === 'function') {
        return { featureMethod: device.getOnlineStatus.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.System.Time' && typeof device.getSystemTime === 'function') {
        return { featureMethod: device.getSystemTime.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.System.Position' && typeof device.getSystemPosition === 'function') {
        return { featureMethod: device.getSystemPosition.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.System.DNDMode' && typeof device.getDNDMode === 'function') {
        return { featureMethod: device.getRawDNDMode.bind(device), featureArgs: [] };
    }
    return null;
}

/**
 * Maps Digest namespaces to feature methods.
 */
function _mapDigestNamespaceToFeatureMethod(namespace, device) {
    if (namespace === 'Appliance.Digest.TimerX' && typeof device.getTimerXDigest === 'function') {
        return { featureMethod: device.getTimerXDigest.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.Digest.TriggerX' && typeof device.getTriggerXDigest === 'function') {
        return { featureMethod: device.getTriggerXDigest.bind(device), featureArgs: [] };
    }
    return null;
}


/**
 * Maps GarageDoor feature namespaces to feature methods.
 */
function _mapGarageFeatureNamespace(namespace, device) {
    if (namespace === 'Appliance.GarageDoor.State' && typeof device.getGarageDoorState === 'function') {
        return { featureMethod: device.getGarageDoorState.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.GarageDoor.MultipleConfig' && typeof device.getGarageDoorMultipleState === 'function') {
        return { featureMethod: device.getGarageDoorMultipleState.bind(device), featureArgs: [] };
    }
    return null;
}

/**
 * Maps RollerShutter feature namespaces to feature methods.
 */
function _mapRollerShutterFeatureNamespace(namespace, device) {
    if (namespace === 'Appliance.RollerShutter.State' && typeof device.getRollerShutterState === 'function') {
        return { featureMethod: device.getRollerShutterState.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.RollerShutter.Position' && typeof device.getRollerShutterPosition === 'function') {
        return { featureMethod: device.getRollerShutterPosition.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.RollerShutter.Config' && typeof device.getRollerShutterConfig === 'function') {
        return { featureMethod: device.getRollerShutterConfig.bind(device), featureArgs: [] };
    }
    return null;
}

/**
 * Feature namespace mapping registry organized by feature type.
 * Matches the ManagerMeross class structure where features are organized by type.
 */
const FEATURE_NAMESPACE_MAPPERS = [
    { prefix: 'Appliance.Control.Toggle', mapper: _mapToggleFeatureNamespace },
    { prefix: 'Appliance.Control.Light', mapper: _mapLightFeatureNamespace },
    { prefix: 'Appliance.Control.Diffuser.', mapper: _mapDiffuserFeatureNamespace },
    { prefix: 'Appliance.Control.Spray', mapper: _mapSprayFeatureNamespace },
    { prefix: 'Appliance.Control.Electricity', mapper: _mapElectricityFeatureNamespace },
    { prefix: 'Appliance.Control.Consumption', mapper: _mapConsumptionFeatureNamespace },
    { prefix: 'Appliance.Control.Timer', mapper: _mapTimerFeatureNamespace },
    { prefix: 'Appliance.Control.Trigger', mapper: _mapTriggerFeatureNamespace },
    { prefix: 'Appliance.Control.Sensor.', mapper: _mapSensorFeatureNamespace },
    { prefix: 'Appliance.Control.Thermostat.', mapper: _mapThermostatNamespaceToFeatureMethod },
    { prefix: 'Appliance.GarageDoor.', mapper: _mapGarageFeatureNamespace },
    { prefix: 'Appliance.RollerShutter.', mapper: _mapRollerShutterFeatureNamespace },
    { prefix: 'Appliance.Control.', mapper: _mapSharedControlNamespace },
    { prefix: 'Appliance.System.', mapper: _mapSystemNamespaceToFeatureMethod },
    { prefix: 'Appliance.Digest.', mapper: _mapDigestNamespaceToFeatureMethod }
];

/**
 * Maps a namespace to its feature method and arguments.
 * Returns { featureMethod, featureArgs } or { featureMethod: null, featureArgs: [] } if no feature method exists.
 * Organized by feature type to match ManagerMeross class structure.
 */
function _mapNamespaceToFeatureMethod(namespace, device) {
    for (const { prefix, mapper } of FEATURE_NAMESPACE_MAPPERS) {
        if (namespace.startsWith(prefix)) {
            const result = mapper(namespace, device);
            if (result) {
                return result;
            }
        }
    }
    return { featureMethod: null, featureArgs: [] };
}

/**
 * Collects toggle states from device cache.
 */
function _collectToggleStates(device) {
    const toggleStatesByChannel = new Map();
    if (typeof device.getAllCachedToggleStates === 'function') {
        const allToggleStates = device.getAllCachedToggleStates();
        if (allToggleStates && allToggleStates.size > 0) {
            allToggleStates.forEach((state, channel) => {
                if (state && typeof state.isOn !== 'undefined') {
                    toggleStatesByChannel.set(channel, state.isOn);
                }
            });
        }
    }
    return toggleStatesByChannel;
}

/**
 * Handles Light namespace display.
 */
function _handleLightNamespace(device, sensorLines) {
    if (typeof device.getCachedLightState === 'function') {
        const lightState = device.getCachedLightState(0);
        if (lightState) {
            const isOn = typeof device.getLightIsOn === 'function' ? device.getLightIsOn(0) : lightState.isOn;
            const stateColor = isOn ? chalk.green('On') : chalk.red('Off');
            sensorLines.push(`    ${chalk.white.bold('Light State')}: ${chalk.italic(stateColor)}`);

            if (lightState.luminance !== undefined && lightState.luminance !== null) {
                sensorLines.push(`    ${chalk.white.bold('Brightness')}: ${chalk.italic(`${lightState.luminance}%`)}`);
            }
            return { handled: true, hasReadings: true };
        }
    }
    return { handled: false, hasReadings: false };
}

/**
 * Handles Toggle namespace display.
 */
function _handleToggleNamespace(device, toggleStatesByChannel) {
    if (typeof device.getAllCachedToggleStates === 'function') {
        const allToggleStates = device.getAllCachedToggleStates();
        if (allToggleStates && allToggleStates.size > 0) {
            allToggleStates.forEach((state, channel) => {
                if (state && typeof state.isOn !== 'undefined') {
                    toggleStatesByChannel.set(channel, state.isOn);
                }
            });
        }
    }
    return { handled: true };
}

/**
 * Handles Electricity namespace display.
 */
function _handleElectricityNamespace(device, sensorLines) {
    if (typeof device.getCachedElectricity === 'function') {
        const powerInfo = device.getCachedElectricity(0);
        if (powerInfo) {
            sensorLines.push(`    ${chalk.white.bold('Power')}: ${chalk.italic(`${powerInfo.wattage.toFixed(2)} W`)}`);
            if (powerInfo.voltage !== undefined) {
                sensorLines.push(`    ${chalk.white.bold('Voltage')}: ${chalk.italic(`${powerInfo.voltage.toFixed(1)} V`)}`);
            }
            if (powerInfo.amperage !== undefined) {
                sensorLines.push(`    ${chalk.white.bold('Current')}: ${chalk.italic(`${powerInfo.amperage.toFixed(3)} A`)}`);
            }
            return { handled: true, hasReadings: true, hasElectricity: true };
        }
    }
    return { handled: false, hasReadings: false, hasElectricity: false };
}

/**
 * Displays thermostat temperature and warning info.
 */
function _displayThermostatTemperatureInfo(thermostatState, sensorLines) {
    const currentTemp = thermostatState.currentTemperatureCelsius;
    if (currentTemp !== undefined && currentTemp !== null) {
        sensorLines.push(`    ${chalk.white.bold('Temperature')}: ${chalk.italic(`${currentTemp.toFixed(1)}°C`)}`);
    }
    const targetTemp = thermostatState.targetTemperatureCelsius;
    if (targetTemp !== undefined && targetTemp !== null) {
        sensorLines.push(`    ${chalk.white.bold('Target Temperature')}: ${chalk.italic(`${targetTemp.toFixed(1)}°C`)}`);
    }
    if (thermostatState.warning) {
        sensorLines.push(`    ${chalk.white.bold('Warning')}: ${chalk.italic('Active')}`);
    }
}

/**
 * Handles Thermostat.Mode namespace display.
 */
function _handleThermostatModeNamespace(device, sensorLines) {
    if (typeof device.getCachedThermostatState === 'function') {
        const thermostatState = device.getCachedThermostatState(0);
        if (thermostatState) {
            _displayThermostatTemperatureInfo(thermostatState, sensorLines);
            return { handled: true, hasReadings: true };
        }
    }
    return { handled: false, hasReadings: false };
}

/**
 * Handles Thermostat.ModeB namespace display.
 */
function _handleThermostatModeBNamespace(device, sensorLines) {
    if (typeof device.getCachedThermostatModeBState === 'function') {
        const thermostatState = device.getCachedThermostatModeBState(0);
        if (thermostatState) {
            _displayThermostatTemperatureInfo(thermostatState, sensorLines);
            return { handled: true, hasReadings: true };
        }
    }
    return { handled: false, hasReadings: false };
}

/**
 * Handles Thermostat.WindowOpened namespace display.
 */
function _handleThermostatWindowOpenedNamespace(response, sensorLines) {
    if (response.windowOpened) {
        const wo = response.windowOpened[0];
        if (wo.status !== undefined) {
            sensorLines.push(`    ${chalk.white.bold('Window Opened')}: ${chalk.italic(wo.status === 1 ? 'Open' : 'Closed')}`);
            return { handled: true, hasReadings: true };
        }
    }
    return { handled: false, hasReadings: false };
}

/**
 * Handles Thermostat.Overheat namespace display.
 */
function _handleThermostatOverheatNamespace(response, sensorLines) {
    if (response.overheat) {
        const oh = response.overheat[0];
        let hasReadings = false;
        if (oh.currentTemp !== undefined) {
            sensorLines.push(`    ${chalk.white.bold('External Sensor')}: ${chalk.italic(`${(oh.currentTemp / 10.0).toFixed(1)}°C`)}`);
            hasReadings = true;
        }
        if (oh.warning !== undefined && oh.warning === 1) {
            sensorLines.push(`    ${chalk.white.bold('Overheat Warning')}: ${chalk.italic('Active')}`);
        }
        return { handled: true, hasReadings };
    }
    return { handled: false, hasReadings: false };
}

/**
 * Handles Thermostat.Calibration namespace display.
 */
function _handleThermostatCalibrationNamespace(response, sensorLines) {
    if (response.calibration) {
        const cal = response.calibration[0];
        if (cal.humiValue !== undefined) {
            sensorLines.push(`    ${chalk.white.bold('Sensor Humidity')}: ${chalk.italic(`${(cal.humiValue / 10.0).toFixed(1)}%`)}`);
            return { handled: true, hasReadings: true };
        }
    }
    return { handled: false, hasReadings: false };
}

/**
 * Handles Thermostat.Frost namespace display.
 */
function _handleThermostatFrostNamespace(response, sensorLines) {
    if (response.frost) {
        const frost = response.frost[0];
        if (frost.warning !== undefined && frost.warning === 1) {
            sensorLines.push(`    ${chalk.white.bold('Frost Warning')}: ${chalk.italic('Active')}`);
        }
        return { handled: true, hasReadings: false };
    }
    return { handled: false, hasReadings: false };
}

/**
 * Handles Thermostat namespace display.
 */
function _handleThermostatNamespace(namespace, response, device, sensorLines) {
    if (namespace === 'Appliance.Control.Thermostat.Mode') {
        return _handleThermostatModeNamespace(device, sensorLines);
    } else if (namespace === 'Appliance.Control.Thermostat.ModeB') {
        return _handleThermostatModeBNamespace(device, sensorLines);
    } else if (namespace === 'Appliance.Control.Thermostat.WindowOpened') {
        return _handleThermostatWindowOpenedNamespace(response, sensorLines);
    } else if (namespace === 'Appliance.Control.Thermostat.Overheat') {
        return _handleThermostatOverheatNamespace(response, sensorLines);
    } else if (namespace === 'Appliance.Control.Thermostat.Calibration') {
        return _handleThermostatCalibrationNamespace(response, sensorLines);
    } else if (namespace === 'Appliance.Control.Thermostat.Frost') {
        return _handleThermostatFrostNamespace(response, sensorLines);
    }
    return { handled: false, hasReadings: false };
}

/**
 * Handles a specific sensor namespace and adds display lines.
 * Returns { handled: boolean, sensorLines: string[], hasReadings: boolean, hasElectricity: boolean }
 */
function _handleSensorNamespace(namespace, response, device, sensorLines, toggleStatesByChannel) {
    // Handle System.All digest data (state is already cached by device.handleMessage)
    if (namespace === 'Appliance.System.All' && response.all && response.all.digest) {
        // Toggle states are already cached from handleMessage
        if (typeof device.getAllCachedToggleStates === 'function') {
            const allToggleStates = device.getAllCachedToggleStates();
            if (allToggleStates && allToggleStates.size > 0) {
                allToggleStates.forEach((state, channel) => {
                    if (state && typeof state.isOn !== 'undefined') {
                        toggleStatesByChannel.set(channel, state.isOn);
                    }
                });
            }
        }
        return { handled: true, sensorLines, hasReadings: false, hasElectricity: false };
    }

    // Filter out System namespaces that aren't useful for status display
    if (namespace.startsWith('Appliance.System.')) {
        return { handled: true, sensorLines, hasReadings: false, hasElectricity: false };
    }

    // Handle specific namespaces
    if (namespace === 'Appliance.Control.Light') {
        const result = _handleLightNamespace(device, sensorLines);
        return { ...result, sensorLines, hasElectricity: false };
    } else if (namespace === 'Appliance.Control.ToggleX' || namespace === 'Appliance.Control.Toggle') {
        const result = _handleToggleNamespace(device, toggleStatesByChannel);
        return { ...result, sensorLines, hasReadings: false, hasElectricity: false };
    } else if (namespace === 'Appliance.Control.Electricity') {
        const result = _handleElectricityNamespace(device, sensorLines);
        return { ...result, sensorLines };
    } else if (namespace.startsWith('Appliance.Control.Thermostat.')) {
        const result = _handleThermostatNamespace(namespace, response, device, sensorLines);
        return { ...result, sensorLines, hasElectricity: false };
    }

    return { handled: false, sensorLines, hasReadings: false, hasElectricity: false };
}

/**
 * Formats Consumption namespaces for display.
 */
function _formatConsumptionNamespace(namespace, response, sensorLines) {
    if (namespace === 'Appliance.Control.ConsumptionX' && response.consumptionx) {
        const consumption = Array.isArray(response.consumptionx) ? response.consumptionx : [response.consumptionx];
        if (consumption.length > 0) {
            const latest = consumption[consumption.length - 1];
            if (latest.value !== undefined && latest.value !== null) {
                const valueKwh = (latest.value / 1000.0).toFixed(2);
                sensorLines.push(`    ${chalk.white.bold('Consumption')}: ${chalk.italic(`${valueKwh} kWh`)}`);
            } else {
                sensorLines.push(`    ${chalk.white.bold('Consumption')}: ${chalk.italic('N/A')}`);
            }
            return { formatted: true, hasReadings: true };
        }
    } else if (namespace === 'Appliance.Control.ConsumptionH' && response.consumptionH) {
        // Skip hourly consumption - only show daily
        return { formatted: true, hasReadings: false };
    } else if (namespace === 'Appliance.Control.ConsumptionConfig' && response.config) {
        const { config } = response;
        const configLines = [];
        if (config.voltageRatio !== undefined) {
            configLines.push(`voltageRatio: ${config.voltageRatio}`);
        }
        if (config.electricityRatio !== undefined) {
            configLines.push(`electricityRatio: ${config.electricityRatio}`);
        }
        if (config.maxElectricityCurrent !== undefined) {
            configLines.push(`maxCurrent: ${(config.maxElectricityCurrent / 1000.0).toFixed(1)} A`);
        }
        if (configLines.length > 0) {
            sensorLines.push(`    ${chalk.white.bold('Consumption Config')}: ${chalk.italic(configLines.join(', '))}`);
            return { formatted: true, hasReadings: true };
        }
    }
    return { formatted: false, hasReadings: false };
}

/**
 * Formats Digest namespaces for display.
 */
function _formatDigestNamespace(namespace, response, sensorLines) {
    if (namespace === 'Appliance.Digest.TimerX' && response.digest) {
        const timers = Array.isArray(response.digest) ? response.digest : (response.digest ? [response.digest] : []);
        sensorLines.push(`    ${chalk.white.bold('Timers')}: ${chalk.italic(`${timers.length} active`)}`);
        return { formatted: true, hasReadings: true };
    } else if (namespace === 'Appliance.Digest.TriggerX' && response.digest) {
        const triggers = Array.isArray(response.digest) ? response.digest : (response.digest ? [response.digest] : []);
        sensorLines.push(`    ${chalk.white.bold('Triggers')}: ${chalk.italic(`${triggers.length} active`)}`);
        return { formatted: true, hasReadings: true };
    }
    return { formatted: false, hasReadings: false };
}

/**
 * Formats Sensor.LatestX namespace for display.
 */
function _formatSensorLatestXNamespace(device, sensorLines) {
    let formatted = false;
    let hasReadings = false;

    // Use device methods to get formatted presence sensor data
    if (typeof device.getPresence === 'function') {
        const presence = device.getPresence();
        if (presence) {
            const presenceState = presence.isPresent ? chalk.green('Present') : chalk.yellow('Absent');
            sensorLines.push(`    ${chalk.white.bold('Presence')}: ${chalk.italic(presenceState)}`);

            if (presence.distance !== null && presence.distance !== undefined) {
                sensorLines.push(`    ${chalk.white.bold('Distance')}: ${chalk.italic(`${presence.distance.toFixed(2)} m`)}`);
            }

            if (presence.timestamp) {
                sensorLines.push(`    ${chalk.white.bold('Last Detection')}: ${chalk.italic(presence.timestamp.toLocaleString())}`);
            }

            formatted = true;
            hasReadings = true;
        }
    }

    if (typeof device.getLight === 'function') {
        const light = device.getLight();
        if (light && light.value !== undefined) {
            sensorLines.push(`    ${chalk.white.bold('Light')}: ${chalk.italic(`${light.value} lx`)}`);
            formatted = true;
            hasReadings = true;
        }
    }

    return { formatted, hasReadings };
}

/**
 * Formats unknown sensor namespaces for display.
 * Returns { formatted: boolean, sensorLines: string[], hasReadings: boolean }
 */
function _formatUnknownSensorNamespace(namespace, response, device, sensorLines) {
    // Try Consumption namespaces
    if (namespace.startsWith('Appliance.Control.Consumption')) {
        const result = _formatConsumptionNamespace(namespace, response, sensorLines);
        if (result.formatted) {
            return { ...result, sensorLines };
        }
    }
    // Try Digest namespaces
    if (namespace.startsWith('Appliance.Digest.')) {
        const result = _formatDigestNamespace(namespace, response, sensorLines);
        if (result.formatted) {
            return { ...result, sensorLines };
        }
    }
    // Try Sensor.LatestX
    if (namespace === 'Appliance.Control.Sensor.LatestX') {
        const result = _formatSensorLatestXNamespace(device, sensorLines);
        return { ...result, sensorLines };
    }

    return { formatted: false, sensorLines, hasReadings: false };
}

/**
 * Displays toggle states for all channels.
 */
function _displayToggleStates(device, toggleStatesByChannel, hasElectricity, sensorLines) {
    const deviceChannels = device.channels && device.channels.length > 0 ? device.channels : [];
    const hasChannels = deviceChannels.length > 0;
    const hasToggleStates = toggleStatesByChannel.size > 0;

    if (!hasToggleStates && !(hasChannels && typeof device.getAllCachedToggleStates === 'function')) {
        return;
    }

    const baseLabel = hasElectricity ? 'State' : 'Power';
    let channelsToDisplay = [];
    let toggleStatesMap = toggleStatesByChannel;

    if (hasToggleStates) {
        // Use channels from toggle states (channels with actual state data)
        channelsToDisplay = Array.from(toggleStatesByChannel.keys()).sort((a, b) => a - b);
    } else if (hasChannels) {
        // Fallback: use device.channels structure if no toggle states yet
        channelsToDisplay = deviceChannels.map(ch => ch.index);
    } else if (typeof device.getAllCachedToggleStates === 'function') {
        // Last resort: check cached toggle state
        const allToggleStates = device.getAllCachedToggleStates();
        if (allToggleStates && allToggleStates.size > 0) {
            channelsToDisplay = Array.from(allToggleStates.keys()).sort((a, b) => a - b);
            // Build map from cached states
            toggleStatesMap = new Map();
            allToggleStates.forEach((state, channel) => {
                if (state && typeof state.isOn !== 'undefined') {
                    toggleStatesMap.set(channel, state.isOn);
                }
            });
        }
    }

    if (channelsToDisplay.length > 0) {
        // Determine format based on device channel structure (not just state keys)
        const isSingleChannel = hasChannels ? deviceChannels.length === 1 : (channelsToDisplay.length === 1 && channelsToDisplay[0] === 0);

        if (isSingleChannel) {
            // Single channel device - show simple format
            const channelIndex = channelsToDisplay[0];
            const state = toggleStatesMap.get(channelIndex);
            const stateColor = state ? chalk.green('On') : chalk.red('Off');
            sensorLines.push(`    ${chalk.white.bold(baseLabel)}: ${chalk.italic(stateColor)}`);
        } else {
            // Multi-channel device - show all channels with "Socket X Power:" format
            channelsToDisplay.forEach(channelIndex => {
                const state = toggleStatesMap.get(channelIndex);
                const stateColor = state ? chalk.green('On') : chalk.red('Off');
                sensorLines.push(`    ${chalk.white.bold(`Socket ${channelIndex} ${baseLabel}`)}: ${chalk.italic(stateColor)}`);
            });
        }
    }
}

/**
 * Maps a config namespace to its feature method and arguments.
 */
function _mapConfigNamespaceToFeatureMethod(namespace, device) {
    if (namespace === 'Appliance.Control.Presence.Config' && typeof device.getPresenceConfig === 'function') {
        return { featureMethod: device.getPresenceConfig.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Config.OverTemp' && typeof device.getConfigOverTemp === 'function') {
        return { featureMethod: device.getConfigOverTemp.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.Config.WifiList' && typeof device.getConfigWifiList === 'function') {
        return { featureMethod: device.getConfigWifiList.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.Config.Trace' && typeof device.getConfigTrace === 'function') {
        return { featureMethod: device.getConfigTrace.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.System.DNDMode' && typeof device.getDNDMode === 'function') {
        return { featureMethod: device.getRawDNDMode.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.System.LedMode' && typeof device.getSystemLedMode === 'function') {
        return { featureMethod: device.getSystemLedMode.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.Mcu.Firmware' && typeof device.getMcuFirmware === 'function') {
        return { featureMethod: device.getMcuFirmware.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.Encrypt.Suite' && typeof device.getEncryptSuite === 'function') {
        return { featureMethod: device.getEncryptSuite.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.Encrypt.ECDHE' && typeof device.getEncryptECDHE === 'function') {
        return { featureMethod: device.getEncryptECDHE.bind(device), featureArgs: [] };
    } else if (namespace === 'Appliance.Control.Smoke.Config' && typeof device.getSmokeConfig === 'function') {
        return { featureMethod: device.getSmokeConfig.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Control.TempUnit' && typeof device.getTempUnit === 'function') {
        return { featureMethod: device.getTempUnit.bind(device), featureArgs: [0] };
    } else if (namespace === 'Appliance.Control.Presence.Study' && typeof device.getPresenceStudy === 'function') {
        return { featureMethod: device.getPresenceStudy.bind(device), featureArgs: [] };
    }
    return { featureMethod: null, featureArgs: [] };
}

async function displayDeviceStatus(device) {
    let hasReadings = false;

    // Auto-detect and display sensors and configuration based on device abilities
    // Abilities are already loaded at device creation (single-phase initialization)
    if (device.deviceConnected && typeof device.publishMessage === 'function') {
        try {
            // If device is connected via MQTT, wait briefly for push notifications to arrive
            // This allows real-time updates to be processed before we poll
            const isMqttConnected = device.deviceConnected && device.mqttHost;
            if (isMqttConnected) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            const abilities = device.abilities || {};
            const dangerousNamespaces = _getDangerousNamespaces();
            const allNamespaces = _getAllNamespaces(abilities, dangerousNamespaces);
            const { sensorNamespaces, configNamespaces } = _categorizeNamespaces(allNamespaces);
            const namespacesToFetch = _filterNamespacesToFetch(sensorNamespaces, isMqttConnected, device);

            // Create promise factories (functions that return promises) instead of creating promises directly
            // This allows us to throttle requests by executing them in batches
            const promiseFactories = [];

            // Always fetch System.All to get digest data (contains togglex, timers, etc.)
            if (abilities['Appliance.System.All']) {
                promiseFactories.push(() =>
                    device.getSystemAllData()
                        .then(response => ({ namespace: 'Appliance.System.All', response, type: 'sensor' }))
                        .catch(error => ({ namespace: 'Appliance.System.All', error: error.message, type: 'sensor', success: false }))
                );
            }

            // Add sensor namespace fetches (only for namespaces that need polling)
            // Use device feature methods when available - they handle payload format correctly and update state
            for (const namespace of namespacesToFetch) {
                const { featureMethod, featureArgs } = _mapNamespaceToFeatureMethod(namespace, device);

                if (featureMethod) {
                    // Use feature method - it handles payload format correctly and updates state
                    promiseFactories.push(() =>
                        featureMethod(...featureArgs)
                            .then(response => {
                                // For Electricity, convert back to original format for display
                                if (namespace === 'Appliance.Control.Electricity' && response && typeof response === 'object' && response.wattage !== undefined) {
                                    return { namespace, response: { electricity: { power: response.wattage * 1000, voltage: response.voltage * 10, current: response.amperage * 1000 } }, type: 'sensor' };
                                }
                                // For DNDMode, convert to expected format
                                if (namespace === 'Appliance.System.DNDMode' && typeof response === 'number') {
                                    return { namespace, response: { DNDMode: { mode: response } }, type: 'sensor' };
                                }
                                // For System.Runtime, updateRuntimeInfo returns just the runtime data, wrap it
                                if (namespace === 'Appliance.System.Runtime' && response && typeof response === 'object' && !response.runtime) {
                                    return { namespace, response: { runtime: response }, type: 'sensor' };
                                }
                                return { namespace, response, type: 'sensor' };
                            })
                            .catch(error => ({ namespace, error: error.message, type: 'sensor', success: false }))
                    );
                } else {
                    // Fall back to raw publishMessage for namespaces without feature methods
                    const payload = _buildPayloadForNamespace(namespace);
                    if (payload !== null) {
                        promiseFactories.push(() =>
                            device.publishMessage('GET', namespace, payload)
                                .then(response => ({ namespace, response, type: 'sensor' }))
                                .catch(error => ({ namespace, error: error.message, type: 'sensor', success: false }))
                        );
                    }
                    // If payload is null, skip this namespace (intentionally skipped)
                }
            }

            // Add configuration namespace fetches
            // Use device feature methods when available - they handle payload format correctly
            for (const namespace of configNamespaces) {
                const { featureMethod, featureArgs } = _mapConfigNamespaceToFeatureMethod(namespace, device);

                if (featureMethod) {
                    // Use feature method - it handles payload format correctly
                    promiseFactories.push(() =>
                        featureMethod(...featureArgs)
                            .then(response => {
                                // For DNDMode, convert to expected format
                                if (namespace === 'Appliance.System.DNDMode' && typeof response === 'number') {
                                    return { namespace, response: { DNDMode: { mode: response } }, type: 'config' };
                                }
                                return { namespace, response, type: 'config' };
                            })
                            .catch(error => ({ namespace, error: error.message, type: 'config', success: false }))
                    );
                } else {
                    // Fall back to raw publishMessage for namespaces without feature methods
                    promiseFactories.push(() =>
                        device.publishMessage('GET', namespace, {})
                            .then(response => ({ namespace, response, type: 'config' }))
                            .catch(error => ({ namespace, error: error.message, type: 'config', success: false }))
                    );
                }
            }

            // Show loading spinner while fetching data
            const spinner = promiseFactories.length > 0 ? ora('Fetching device data').start() : null;

            // Execute all promise factories - throttling is handled by core library (requestMessage)
            const allPromises = promiseFactories.map(factory => factory());
            const allResults = await Promise.allSettled(allPromises);

            if (spinner) {
                spinner.stop();
            }
            const successfulSensors = allResults
                .filter(result => result.status === 'fulfilled' && result.value.type === 'sensor' && !result.value.error)
                .map(result => result.value);

            const successfulConfigs = allResults
                .filter(result => result.status === 'fulfilled' && result.value.type === 'config' && !result.value.error)
                .map(result => result.value);

            // Display sensors
            let sensorDataDisplayed = false;
            const sensorLines = [];
            const controlFeatureLines = []; // Separate list for control features
            const unknownSensorNamespaces = [];
            let hasElectricity = false;
            const toggleStatesByChannel = _collectToggleStates(device);

            if (successfulSensors.length > 0) {
                for (const { namespace, response } of successfulSensors) {
                    const result = _handleSensorNamespace(namespace, response, device, sensorLines, toggleStatesByChannel);
                    if (result.handled) {
                        if (result.hasReadings) {
                            sensorDataDisplayed = true;
                            hasReadings = true;
                        }
                        if (result.hasElectricity) {
                            hasElectricity = true;
                        }
                        continue;
                    }

                    // If not handled by known formatters, add to unknown list for generic display
                    if (response && Object.keys(response).length > 0) {
                        unknownSensorNamespaces.push({ namespace, response });
                    }
                }

                // Display unknown sensor namespaces generically
                for (const { namespace, response } of unknownSensorNamespaces) {
                    const result = _formatUnknownSensorNamespace(namespace, response, device, sensorLines);
                    if (result.formatted) {
                        if (result.hasReadings) {
                            sensorDataDisplayed = true;
                            hasReadings = true;
                        }
                    } else {
                        // Control/configuration namespaces that aren't formatted go to a separate list
                        const shortName = namespace.replace('Appliance.', '');
                        // Only add control namespaces (not sensor namespaces) to control features
                        if (namespace.includes('Control.') || namespace.includes('Digest.')) {
                            controlFeatureLines.push(shortName);
                        } else {
                            // For unknown sensor namespaces, still show them but in status
                            sensorLines.push(`    ${chalk.white.bold(shortName)}: ${chalk.italic('(data available, use verbose mode to view)')}`);
                            sensorDataDisplayed = true;
                            hasReadings = true;
                        }
                    }
                }
            }

            // Also check cached presence sensor state if available
            if (!sensorDataDisplayed && typeof device.getPresence === 'function') {
                const presence = device.getPresence();
                if (presence) {
                    const presenceState = presence.isPresent ? chalk.green('Present') : chalk.yellow('Absent');
                    sensorLines.push(`    ${chalk.white.bold('Presence')}: ${chalk.italic(presenceState)}`);

                    if (presence.distance !== null) {
                        sensorLines.push(`    ${chalk.white.bold('Distance')}: ${chalk.italic(`${presence.distance.toFixed(2)} m`)}`);
                    }

                    if (presence.timestamp) {
                        sensorLines.push(`    ${chalk.white.bold('Last Detection')}: ${chalk.italic(presence.timestamp.toLocaleString())}`);
                    }

                    sensorDataDisplayed = true;
                    hasReadings = true;
                }

                const light = device.getLight && device.getLight();
                if (light && light.value !== undefined) {
                    sensorLines.push(`    ${chalk.white.bold('Light')}: ${chalk.italic(`${light.value} lx`)}`);
                    sensorDataDisplayed = true;
                    hasReadings = true;
                }
            }

            // Display toggle states for all channels
            _displayToggleStates(device, toggleStatesByChannel, hasElectricity, sensorLines);
            if (sensorLines.length > 0 && !sensorDataDisplayed) {
                sensorDataDisplayed = true;
                hasReadings = true;
            }

            // Display status if we have any data
            if (sensorDataDisplayed && sensorLines.length > 0) {
                console.log(`\n  ${chalk.bold.underline('Status')}`);
                sensorLines.forEach(line => console.log(line));
            }

            // Optionally show control features in verbose mode (hidden by default for cleaner output)
            // Control features are available but not displayed as they don't show actual status values

            // Display configuration
            const hasThermostatOrElectricity = successfulSensors.some(s =>
                s.namespace.includes('Thermostat') || s.namespace === 'Appliance.Control.Electricity'
            );

            if (successfulConfigs.length > 0 || (successfulSensors.length > 0 && hasThermostatOrElectricity)) {
                const configSectionShown = hasReadings && device instanceof MerossHubDevice;

                // Collect all configuration items first for consistent alignment
                const allConfigItems = [];

                // Display thermostat configuration from cached state
                if (typeof device.getCachedThermostatState === 'function') {
                    const thermostatState = device.getCachedThermostatState(0);
                    if (thermostatState) {
                        const configInfo = [];

                        // Mode and power state
                        if (thermostatState.mode !== undefined) {
                            const modeNames = {
                                [ThermostatMode.HEAT]: 'Heat',
                                [ThermostatMode.COOL]: 'Cool',
                                [ThermostatMode.ECONOMY]: 'Economy',
                                [ThermostatMode.AUTO]: 'Auto',
                                [ThermostatMode.MANUAL]: 'Manual'
                            };
                            const modeName = modeNames[thermostatState.mode] || `Mode ${thermostatState.mode}`;
                            const onoffStatus = thermostatState.isOn ? chalk.green('On') : chalk.red('Off');
                            const targetTemp = thermostatState.targetTemperatureCelsius !== undefined
                                ? `${thermostatState.targetTemperatureCelsius.toFixed(1)}°C`
                                : '';
                            configInfo.push(['Mode', `${onoffStatus} - ${modeName} ${targetTemp}`.trim()]);
                        }

                        // Preset temperatures
                        if (thermostatState.heatTemperatureCelsius !== undefined) {
                            configInfo.push(['Comfort Temperature', `${thermostatState.heatTemperatureCelsius.toFixed(1)}°C`]);
                        }
                        if (thermostatState.coolTemperatureCelsius !== undefined) {
                            configInfo.push(['Cool Temperature', `${thermostatState.coolTemperatureCelsius.toFixed(1)}°C`]);
                        }
                        if (thermostatState.ecoTemperatureCelsius !== undefined) {
                            configInfo.push(['Economy Temperature', `${thermostatState.ecoTemperatureCelsius.toFixed(1)}°C`]);
                        }
                        if (thermostatState.manualTemperatureCelsius !== undefined) {
                            configInfo.push(['Away Temperature', `${thermostatState.manualTemperatureCelsius.toFixed(1)}°C`]);
                        }

                        // Temperature range
                        if (thermostatState.minTemperatureCelsius !== undefined && thermostatState.maxTemperatureCelsius !== undefined) {
                            configInfo.push(['Temperature Range', `${thermostatState.minTemperatureCelsius.toFixed(1)}°C - ${thermostatState.maxTemperatureCelsius.toFixed(1)}°C`]);
                        }

                        // Heating status (from workingMode or state)
                        if (thermostatState.workingMode !== undefined) {
                            const isHeating = thermostatState.workingMode === 1; // 1 = heating
                            const stateColor = isHeating ? chalk.green('Heating') : chalk.gray.bold('Idle');
                            configInfo.push(['Status', stateColor]);
                        } else if (thermostatState.state !== undefined) {
                            // ModeB state: 1 = heating/cooling active
                            const isActive = thermostatState.state === 1;
                            const stateColor = isActive ? chalk.green('Heating') : chalk.gray.bold('Idle');
                            configInfo.push(['Status', stateColor]);
                        }

                        if (configInfo.length > 0) {
                            allConfigItems.push(...configInfo);
                        }
                    }
                }

                // Also check ModeB if available
                if (typeof device.getCachedThermostatModeBState === 'function') {
                    const thermostatStateB = device.getCachedThermostatModeBState(0);
                    if (thermostatStateB && thermostatStateB.state !== undefined) {
                        // ModeB state is already displayed in the Mode section above
                        // Only add if Mode wasn't available
                        if (allConfigItems.length === 0 || !allConfigItems.some(item => item[0] === 'Mode')) {
                            const modeBNames = {
                                0: 'Off',
                                1: 'Heating/Cooling',
                                2: 'Auto'
                            };
                            const modeBName = modeBNames[thermostatStateB.state] || `State ${thermostatStateB.state}`;
                            allConfigItems.push(['Mode B', modeBName]);
                        }
                    }
                }

                // Display other thermostat config from sensor responses (calibration, etc.)
                if (successfulSensors.length > 0) {
                    for (const { namespace, response } of successfulSensors) {
                        if (namespace === 'Appliance.Control.Thermostat.Calibration' && response.calibration) {
                            const cal = response.calibration[0];
                            if (cal.value !== undefined) {
                                const calibTemp = cal.value > 1000 ? cal.value / 100.0 : cal.value / 10.0;
                                allConfigItems.push(['Calibration', `${calibTemp.toFixed(1)}°C`]);
                            }
                        } else if (namespace === 'Appliance.Control.Thermostat.DeadZone' && response.deadZone) {
                            const dz = response.deadZone[0];
                            if (dz.value !== undefined) {
                                const deadzoneTemp = dz.value > 100 ? dz.value / 100.0 : dz.value / 10.0;
                                allConfigItems.push(['Deadzone', `${deadzoneTemp.toFixed(1)}°C`]);
                            }
                        } else if (namespace === 'Appliance.Control.Thermostat.Sensor' && response.sensor) {
                            const sensor = response.sensor[0];
                            if (sensor.mode !== undefined) {
                                const sensorModeNames = { 0: 'Internal & External', 1: 'External Only', 2: 'Internal Only' };
                                allConfigItems.push(['External sensor mode', sensorModeNames[sensor.mode] || `Mode ${sensor.mode}`]);
                            }
                        } else if (namespace === 'Appliance.Control.Thermostat.Frost' && response.frost) {
                            const frost = response.frost[0];
                            if (frost.onoff !== undefined) {
                                allConfigItems.push(['Frost alarm', frost.onoff === 1 ? chalk.green('On') : chalk.red('Off')]);
                            }
                            if (frost.value !== undefined) {
                                const frostTemp = frost.value > 100 ? frost.value / 100.0 : frost.value / 10.0;
                                allConfigItems.push(['Frost', `${frostTemp.toFixed(1)}°C`]);
                            }
                        } else if (namespace === 'Appliance.Control.Thermostat.Overheat' && response.overheat) {
                            const oh = response.overheat[0];
                            if (oh.onoff !== undefined) {
                                allConfigItems.push(['Overheat alarm', oh.onoff === 1 ? chalk.green('On') : chalk.red('Off')]);
                            }
                            if (oh.value !== undefined) {
                                const overheatTemp = oh.value > 100 ? oh.value / 100.0 : oh.value / 10.0;
                                allConfigItems.push(['Overheat threshold', `${overheatTemp.toFixed(1)}°C`]);
                            }
                        } else if (namespace === 'Appliance.Control.Thermostat.HoldAction' && response.holdAction) {
                            const ha = response.holdAction[0];
                            if (ha.mode !== undefined) {
                                const holdModeNames = { 0: 'permanent', 1: 'effective until next schedule', 2: 'effective at specified time' };
                                allConfigItems.push(['Hold action', holdModeNames[ha.mode] || `Mode ${ha.mode}`]);
                                if (ha.time !== undefined) {
                                    allConfigItems.push(['Hold action time', `${ha.time} min`]);
                                }
                            }
                        } else if (namespace === 'Appliance.Control.Thermostat.Schedule' && response.schedule) {
                            const sched = response.schedule[0];
                            const hasSchedule = sched.mon || sched.tue || sched.wed || sched.thu || sched.fri || sched.sat || sched.sun;
                            allConfigItems.push(['Schedule', hasSchedule ? chalk.green('On') : chalk.red('Off')]);
                        } else if (namespace === 'Appliance.Control.Screen.Brightness' && response.brightness) {
                            const bright = response.brightness[0];
                            if (bright.operation !== undefined) {
                                allConfigItems.push(['Screen brightness (active)', `${bright.operation.toFixed(1)}%`]);
                            }
                            if (bright.standby !== undefined) {
                                allConfigItems.push(['Screen brightness (sleep)', `${bright.standby.toFixed(1)}%`]);
                            }
                        } else if (namespace === 'Appliance.Control.PhysicalLock' && response.lock) {
                            const lock = response.lock[0];
                            if (lock.onoff !== undefined) {
                                allConfigItems.push(['Lock', lock.onoff === 1 ? chalk.green('On') : chalk.red('Off')]);
                            }
                        } else if (namespace === 'Appliance.Control.Electricity') {
                            // Use cached electricity data for sample timestamp
                            if (typeof device.getCachedElectricity === 'function') {
                                const powerInfo = device.getCachedElectricity(0);
                                if (powerInfo && powerInfo.sampleTimestamp) {
                                    allConfigItems.push(['Sample Time', powerInfo.sampleTimestamp.toISOString()]);
                                }
                            }
                        }
                    }
                }

                // Display configuration namespaces
                for (const { namespace, response } of successfulConfigs) {
                    const configKey = namespace.replace('Appliance.Config.', '').replace('Appliance.System.', '');

                    // Format configuration display based on namespace
                    if (namespace === 'Appliance.Config.OverTemp' && response.overTemp) {
                        const ot = response.overTemp;
                        allConfigItems.push(['Over-temperature Protection', ot.enable === 1 ? chalk.green('Enabled') : chalk.red('Disabled')]);
                        if (ot.type !== undefined) {
                            const typeNames = { 1: 'Early warning', 2: 'Early warning and shutdown' };
                            allConfigItems.push(['Type', typeNames[ot.type] || `Type ${ot.type}`]);
                        }
                    } else if (namespace === 'Appliance.System.DNDMode' && response.DNDMode) {
                        const dnd = response.DNDMode;
                        allConfigItems.push(['Do Not Disturb', dnd.mode === DNDMode.DND_ENABLED ? chalk.green('Enabled') : chalk.red('Disabled')]);
                    } else if (namespace === 'Appliance.Control.Presence.Config' && response.config) {
                        const configArray = Array.isArray(response.config) ? response.config : [response.config];
                        const config = configArray[0];
                        if (config) {
                            // Work mode
                            if (config.mode && config.mode.workMode !== undefined) {
                                const workModeNames = {
                                    [WorkMode.UNKNOWN]: 'Unknown',
                                    [WorkMode.BIOLOGICAL_DETECTION_ONLY]: 'Biological Detection Only',
                                    [WorkMode.SECURITY]: 'Security'
                                };
                                const workModeName = workModeNames[config.mode.workMode] || `Mode ${config.mode.workMode}`;
                                allConfigItems.push(['Work Mode', workModeName]);
                            }

                            // Test mode
                            if (config.mode && config.mode.testMode !== undefined) {
                                allConfigItems.push(['Test Mode', config.mode.testMode === 1 ? chalk.green('Enabled') : chalk.red('Disabled')]);
                            }

                            // Sensitivity level
                            if (config.sensitivity && config.sensitivity.level !== undefined) {
                                const sensitivityNames = {
                                    [SensitivityLevel.RESPONSIVE]: 'Responsive',
                                    [SensitivityLevel.ANTI_INTERFERENCE]: 'Anti-Interference',
                                    [SensitivityLevel.BALANCE]: 'Balance'
                                };
                                const sensitivityName = sensitivityNames[config.sensitivity.level] || `Level ${config.sensitivity.level}`;
                                allConfigItems.push(['Sensitivity', sensitivityName]);
                            }

                            // Distance threshold
                            if (config.distance && config.distance.value !== undefined) {
                                const distanceMeters = (config.distance.value / 1000).toFixed(2);
                                allConfigItems.push(['Distance Threshold', `${distanceMeters} m`]);
                            }

                            // No body time
                            if (config.noBodyTime && config.noBodyTime.time !== undefined) {
                                allConfigItems.push(['No Body Time', `${config.noBodyTime.time} s`]);
                            }

                            // Motion thresholds
                            if (config.mthx) {
                                const thresholds = [];
                                if (config.mthx.mth1 !== undefined) {thresholds.push(`MTH1: ${config.mthx.mth1}`);}
                                if (config.mthx.mth2 !== undefined) {thresholds.push(`MTH2: ${config.mthx.mth2}`);}
                                if (config.mthx.mth3 !== undefined) {thresholds.push(`MTH3: ${config.mthx.mth3}`);}
                                if (thresholds.length > 0) {
                                    allConfigItems.push(['Motion Thresholds', thresholds.join(', ')]);
                                }
                            }
                        }
                    } else if (namespace === 'Appliance.Config.WifiList' ||
                               namespace === 'Appliance.Config.Trace' ||
                               namespace === 'Appliance.Config.Info') {
                        // Skip these config namespaces - not useful for status display
                    } else {
                        // Generic display for unknown configurations - show summary instead of full JSON
                        const configData = response[configKey] || response;
                        if (configData && typeof configData === 'object' && Object.keys(configData).length > 0) {
                            const keys = Object.keys(configData);
                            if (keys.length <= 3) {
                                // Small objects - show inline with aligned labels
                                const configInfo = keys.map(k => {
                                    const v = configData[k];
                                    if (typeof v === 'object') {return [`${configKey}.${k}`, chalk.gray.bold('{...}')];}
                                    return [`${configKey}.${k}`, JSON.stringify(v)];
                                });
                                allConfigItems.push(...configInfo);
                            } else {
                                // Large objects - show summary
                                allConfigItems.push([configKey, chalk.gray.bold(`(${keys.length} properties)`)]);
                            }
                        } else if (configData !== undefined && configData !== null) {
                            allConfigItems.push([configKey, JSON.stringify(configData)]);
                        }
                    }
                }

                // Display all configuration items with single space after colon
                if (allConfigItems.length > 0) {
                    if (!configSectionShown) {
                        console.log(`\n  ${chalk.bold.underline('Configuration')}`);
                    }
                    allConfigItems.forEach(([label, value]) => {
                        console.log(`    ${chalk.white.bold(label)}: ${chalk.italic(value)}`);
                    });
                }

                hasReadings = true;
            }
        } catch (error) {
            // Silently fail - abilities might not be available
        }
    }

    return hasReadings;
}

module.exports = { displayDeviceStatus };

