'use strict';

/**
 * Control method registry for device control.
 * Uses feature-based API structure: "feature.action" (e.g., "toggle.set", "light.set")
 */

/**
 * Mapping from control method names to required ability namespaces.
 * Method names are in format: "feature.action"
 */
const METHOD_TO_NAMESPACE_MAP = {
    // Power Control
    'toggle.set': ['Appliance.Control.ToggleX', 'Appliance.Control.Toggle'],

    // Light Control
    'light.set': ['Appliance.Control.Light'],
    'diffuser.setLight': ['Appliance.Control.Diffuser.Light'],

    // Climate Control
    'thermostat.set': ['Appliance.Control.Thermostat.Mode', 'Appliance.Control.Thermostat.ModeB'],
    'spray.set': ['Appliance.Control.Spray'],
    'diffuser.setSpray': ['Appliance.Control.Diffuser.Spray'],

    // Cover Control
    'garage.set': ['Appliance.GarageDoor.State'],
    'rollerShutter.setPosition': ['Appliance.RollerShutter.Position', 'Appliance.RollerShutter.State'],

    // Timer and Trigger
    'timer.set': ['Appliance.Control.TimerX'],
    'timer.delete': ['Appliance.Control.TimerX'],
    'trigger.set': ['Appliance.Control.TriggerX'],
    'trigger.delete': ['Appliance.Control.TriggerX'],

    // Configuration
    'childLock.set': ['Appliance.Control.PhysicalLock'],
    'system.setLedMode': ['Appliance.System.LedMode'],
    'screen.setBrightness': ['Appliance.Control.Screen.Brightness'],
    'tempUnit.set': ['Appliance.Control.TempUnit'],
    'dnd.set': ['Appliance.System.DNDMode'],
    'config.setOverTemp': ['Appliance.Config.OverTemp'],
    'presence.setConfig': ['Appliance.Control.Presence.Config'],
    'presence.setStudy': ['Appliance.Control.Presence.Study']
};

/**
 * Control method metadata registry.
 * Method names use feature-based format: "feature.action"
 */
const CONTROL_METHOD_REGISTRY = {
    // Power Control
    'toggle.set': {
        name: 'Toggle (On/Off)',
        category: 'Power Control',
        description: 'Turn device channel on or off',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            },
            {
                name: 'on',
                type: 'boolean',
                label: 'State',
                choices: [
                    { name: 'On', value: true },
                    { name: 'Off', value: false }
                ],
                required: true
            }
        ]
    },

    // Light Control
    'light.set': {
        name: 'Light Control',
        category: 'Light Control',
        description: 'Set light color, brightness, temperature, and on/off state',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            },
            {
                name: 'on',
                type: 'boolean',
                label: 'Turn On/Off',
                required: false
            },
            {
                name: 'rgb',
                type: 'rgb',
                label: 'RGB Color (r,g,b)',
                required: false
            },
            {
                name: 'luminance',
                type: 'number',
                label: 'Brightness (0-100)',
                min: 0,
                max: 100,
                required: false
            },
            {
                name: 'temperature',
                type: 'number',
                label: 'Temperature (0-100)',
                min: 0,
                max: 100,
                required: false
            },
            {
                name: 'gradual',
                type: 'boolean',
                label: 'Transition Type',
                required: false
            }
        ]
    },
    'diffuser.setLight': {
        name: 'Diffuser Light',
        category: 'Light Control',
        description: 'Control diffuser light settings',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            },
            {
                name: 'on',
                type: 'boolean',
                label: 'State',
                required: false
            },
            {
                name: 'rgb',
                type: 'rgb',
                label: 'RGB Color (r,g,b)',
                required: false
            },
            {
                name: 'luminance',
                type: 'number',
                label: 'Brightness (0-100)',
                min: 0,
                max: 100,
                required: false
            }
        ]
    },

    // Climate Control
    'thermostat.set': {
        name: 'Thermostat Control',
        category: 'Climate Control',
        description: 'Set thermostat mode, temperature, and on/off state',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            },
            {
                name: 'mode',
                type: 'enum',
                label: 'Mode',
                choices: [
                    { name: 'Heat', value: 0 },
                    { name: 'Cool', value: 1 },
                    { name: 'Economy', value: 2 },
                    { name: 'Auto', value: 3 },
                    { name: 'Manual', value: 4 }
                ],
                required: false
            },
            {
                name: 'onoff',
                type: 'number',
                label: 'On/Off (0=off, 1=on)',
                required: false
            },
            {
                name: 'heatTemperature',
                type: 'number',
                label: 'Heat Temperature (°C)',
                required: false
            },
            {
                name: 'coolTemperature',
                type: 'number',
                label: 'Cool Temperature (°C)',
                required: false
            },
            {
                name: 'ecoTemperature',
                type: 'number',
                label: 'Eco Temperature (°C)',
                required: false
            },
            {
                name: 'manualTemperature',
                type: 'number',
                label: 'Manual Temperature (°C)',
                required: false
            },
            {
                name: 'partialUpdate',
                type: 'boolean',
                label: 'Partial Update',
                required: false,
                default: false
            }
        ]
    },
    'spray.set': {
        name: 'Spray/Humidifier',
        category: 'Climate Control',
        description: 'Control spray/humidifier mode',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            },
            {
                name: 'mode',
                type: 'enum',
                label: 'Spray Mode',
                choices: [
                    { name: 'Off', value: 0 },
                    { name: 'Continuous', value: 1 },
                    { name: 'Intermittent', value: 2 }
                ],
                required: true
            }
        ]
    },
    'diffuser.setSpray': {
        name: 'Diffuser Spray',
        category: 'Climate Control',
        description: 'Control diffuser spray mode',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            },
            {
                name: 'mode',
                type: 'enum',
                label: 'Spray Mode',
                choices: [
                    { name: 'Off', value: 0 },
                    { name: 'Continuous', value: 1 },
                    { name: 'Intermittent', value: 2 }
                ],
                required: true
            }
        ]
    },

    // Cover Control
    'garage.set': {
        name: 'Garage Door',
        category: 'Cover Control',
        description: 'Open or close garage door',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            },
            {
                name: 'onoff',
                type: 'number',
                label: 'Action (0=close, 1=open)',
                required: true
            }
        ]
    },
    'rollerShutter.setPosition': {
        name: 'Roller Shutter Position',
        category: 'Cover Control',
        description: 'Set roller shutter position (0-100, -1 to stop)',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            },
            {
                name: 'position',
                type: 'number',
                label: 'Position (0-100, -1=stop)',
                min: -1,
                max: 100,
                required: true
            }
        ]
    },

    // Timer and Trigger
    'timer.set': {
        name: 'Timer Control',
        category: 'Automation',
        description: 'Create or update a timer',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            },
            {
                name: 'id',
                type: 'string',
                label: 'Timer ID (for updates)',
                required: false
            },
            {
                name: 'onoff',
                type: 'number',
                label: 'Action (0=off, 1=on)',
                required: true
            },
            {
                name: 'type',
                type: 'number',
                label: 'Timer Type',
                required: true
            },
            {
                name: 'time',
                type: 'number',
                label: 'Time Value',
                required: true
            }
        ]
    },
    'timer.delete': {
        name: 'Delete Timer',
        category: 'Automation',
        description: 'Delete a timer',
        params: [
            {
                name: 'timerId',
                type: 'string',
                label: 'Timer ID',
                required: true
            },
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            }
        ]
    },
    'trigger.set': {
        name: 'Trigger Control',
        category: 'Automation',
        description: 'Create or update a trigger',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            },
            {
                name: 'triggerx',
                type: 'object',
                label: 'Trigger Configuration',
                required: true
            }
        ]
    },
    'trigger.delete': {
        name: 'Delete Trigger',
        category: 'Automation',
        description: 'Delete a trigger',
        params: [
            {
                name: 'triggerId',
                type: 'string',
                label: 'Trigger ID',
                required: true
            },
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            }
        ]
    },

    // Configuration
    'childLock.set': {
        name: 'Child Lock',
        category: 'Configuration',
        description: 'Enable or disable child lock',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            },
            {
                name: 'lock',
                type: 'number',
                label: 'Lock (0=unlock, 1=lock)',
                required: true
            }
        ]
    },
    'system.setLedMode': {
        name: 'LED Indicator Mode',
        category: 'Configuration',
        description: 'Control LED indicator mode',
        params: [
            {
                name: 'ledModeData',
                type: 'object',
                label: 'LED Mode Configuration',
                required: true
            }
        ]
    },
    'screen.setBrightness': {
        name: 'Screen Brightness',
        category: 'Configuration',
        description: 'Set device screen brightness',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            },
            {
                name: 'brightness',
                type: 'number',
                label: 'Brightness (0-100)',
                min: 0,
                max: 100,
                required: true
            }
        ]
    },
    'tempUnit.set': {
        name: 'Temperature Unit',
        category: 'Configuration',
        description: 'Set temperature unit (Celsius/Fahrenheit)',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            },
            {
                name: 'unit',
                type: 'number',
                label: 'Unit (0=Celsius, 1=Fahrenheit)',
                required: true
            }
        ]
    },
    'dnd.set': {
        name: 'Do Not Disturb Mode',
        category: 'Configuration',
        description: 'Enable or disable Do Not Disturb mode',
        params: [
            {
                name: 'mode',
                type: 'number',
                label: 'DND Mode (0=disabled, 1=enabled)',
                required: true
            }
        ]
    },
    'config.setOverTemp': {
        name: 'Over-Temperature Protection',
        category: 'Configuration',
        description: 'Enable or disable over-temperature protection',
        params: [
            {
                name: 'enable',
                type: 'boolean',
                label: 'Over-Temperature Protection',
                choices: [
                    { name: 'On', value: true },
                    { name: 'Off', value: false }
                ],
                required: true
            }
        ]
    },
    'presence.setConfig': {
        name: 'Presence Sensor Configuration',
        category: 'Configuration',
        description: 'Configure presence sensor settings',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            },
            {
                name: 'configData',
                type: 'object',
                label: 'Configuration Object',
                required: true
            }
        ]
    },
    'presence.setStudy': {
        name: 'Presence Sensor Study/Calibration',
        category: 'Configuration',
        description: 'Start or stop presence sensor study/calibration mode',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            },
            {
                name: 'value',
                type: 'number',
                label: 'Study Mode Value',
                required: false
            },
            {
                name: 'status',
                type: 'number',
                label: 'Status (0=stop, 1=start)',
                required: true
            }
        ]
    }
};

/**
 * Gets metadata for a control method from the registry.
 *
 * @param {string} methodName - Name of the control method (format: "feature.action")
 * @returns {Object|null} Method metadata or null if not found
 */
function getMethodMetadata(methodName) {
    return CONTROL_METHOD_REGISTRY[methodName] || null;
}

/**
 * Gets all control methods grouped by category for organized display.
 *
 * @returns {Object} Methods grouped by category
 */
function getMethodsByCategory() {
    const categories = {};
    for (const [methodName, metadata] of Object.entries(CONTROL_METHOD_REGISTRY)) {
        const category = metadata.category || 'Other';
        if (!categories[category]) {
            categories[category] = [];
        }
        categories[category].push({
            methodName,
            ...metadata
        });
    }
    return categories;
}

/**
 * Checks if a device supports a specific ability namespace.
 *
 * @param {Object} device - Device instance
 * @param {string} namespace - Namespace to check
 * @returns {boolean} True if device supports the namespace
 */
function deviceSupportsNamespace(device, namespace) {
    if (!device.abilities || typeof device.abilities !== 'object') {
        return false;
    }
    return !!device.abilities[namespace];
}

/**
 * Checks if a device supports any of the required namespaces for a method.
 *
 * Some methods accept multiple namespace alternatives (e.g., ToggleX or Toggle),
 * so any match satisfies the requirement.
 *
 * @param {Object} device - Device instance
 * @param {Array<string>} namespaces - Array of namespace strings (any match is sufficient)
 * @returns {boolean} True if device supports at least one namespace
 */
function deviceSupportsAnyNamespace(device, namespaces) {
    if (!namespaces || namespaces.length === 0) {
        return true;
    }
    return namespaces.some(namespace => deviceSupportsNamespace(device, namespace));
}

/**
 * Detects available control methods on a device based on device abilities.
 *
 * Validates both namespace requirements and feature availability to determine
 * which methods can be used with a specific device. Uses feature-based API structure.
 *
 * @param {Object} device - Device instance
 * @returns {Array} Array of available control methods with metadata
 */
function detectControlMethods(device) {
    const availableMethods = [];

    for (const [methodName, metadata] of Object.entries(CONTROL_METHOD_REGISTRY)) {
        const requiredNamespaces = METHOD_TO_NAMESPACE_MAP[methodName];

        if (requiredNamespaces && requiredNamespaces.length > 0) {
            if (!deviceSupportsAnyNamespace(device, requiredNamespaces)) {
                continue;
            }
        }

        const parts = methodName.split('.');
        if (parts.length !== 2) {
            continue;
        }

        const [featureName, action] = parts;

        const feature = device[featureName];
        if (!feature) {
            continue;
        }

        if (typeof feature[action] !== 'function') {
            continue;
        }

        availableMethods.push({
            methodName,
            ...metadata
        });
    }

    availableMethods.sort((a, b) => {
        if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
    });

    return availableMethods;
}

module.exports = {
    CONTROL_METHOD_REGISTRY,
    METHOD_TO_NAMESPACE_MAP,
    getMethodMetadata,
    getMethodsByCategory,
    detectControlMethods,
    deviceSupportsNamespace,
    deviceSupportsAnyNamespace
};
