'use strict';

/**
 * Control method registry for device control testing.
 * Maps control method names to metadata including parameter schemas and categories.
 */

/**
 * Mapping from control method names to required ability namespaces.
 * This is used to filter methods based on what the device actually supports.
 */
const METHOD_TO_NAMESPACE_MAP = {
    // Power Control
    setToggle: ['Appliance.Control.Toggle'],
    setToggleX: ['Appliance.Control.ToggleX'],

    // Light Control
    setLight: ['Appliance.Control.Light'],
    setLightColor: ['Appliance.Control.Light'],
    setDiffuserLight: ['Appliance.Control.Diffuser.Light'],

    // Climate Control
    setThermostatMode: ['Appliance.Control.Thermostat.Mode'],
    setThermostatModeB: ['Appliance.Control.Thermostat.ModeB'],
    setSpray: ['Appliance.Control.Spray'],
    setDiffuserSpray: ['Appliance.Control.Diffuser.Spray'],

    // Cover Control
    setGarageDoor: ['Appliance.GarageDoor.State'],
    openGarageDoor: ['Appliance.GarageDoor.State'],
    closeGarageDoor: ['Appliance.GarageDoor.State'],
    setGarageDoorConfig: ['Appliance.GarageDoor.Config', 'Appliance.GarageDoor.MultipleConfig'],
    setRollerShutterPosition: ['Appliance.RollerShutter.Position', 'Appliance.RollerShutter.State'],
    setRollerShutterUp: ['Appliance.RollerShutter.Position', 'Appliance.RollerShutter.State'],
    setRollerShutterDown: ['Appliance.RollerShutter.Position', 'Appliance.RollerShutter.State'],
    setRollerShutterStop: ['Appliance.RollerShutter.Position', 'Appliance.RollerShutter.State'],
    openRollerShutter: ['Appliance.RollerShutter.Position', 'Appliance.RollerShutter.State'],
    closeRollerShutter: ['Appliance.RollerShutter.Position', 'Appliance.RollerShutter.State'],
    stopRollerShutter: ['Appliance.RollerShutter.Position', 'Appliance.RollerShutter.State'],
    setRollerShutterConfig: ['Appliance.RollerShutter.Config'],

    // Configuration
    setChildLock: ['Appliance.Control.PhysicalLock'],
    setSystemLedMode: ['Appliance.System.LedMode'],
    setScreenBrightness: ['Appliance.Control.Screen.Brightness'],
    setTempUnit: ['Appliance.Control.TempUnit'],
    setDNDMode: ['Appliance.System.DNDMode'],
    setConfigOverTemp: ['Appliance.Config.OverTemp'],
    setPresenceConfig: ['Appliance.Control.Presence.Config'],
    setPresenceStudy: ['Appliance.Control.Presence.Study'],

    // Timer and Trigger
    setTimerX: ['Appliance.Control.TimerX'],
    deleteTimerX: ['Appliance.Control.TimerX'],
    setTriggerX: ['Appliance.Control.TriggerX'],
    deleteTriggerX: ['Appliance.Control.TriggerX']
};

/**
 * Control method metadata registry.
 * Each entry defines:
 * - name: Human-readable name
 * - category: Feature category for grouping
 * - params: Parameter schema for input collection
 * - description: Brief description
 */
const CONTROL_METHOD_REGISTRY = {
    // Power Control
    setToggle: {
        name: 'Toggle (On/Off)',
        category: 'Power Control',
        description: 'Turn device on or off',
        params: [
            {
                name: 'onoff',
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
    setToggleX: {
        name: 'Toggle Channel (On/Off)',
        category: 'Power Control',
        description: 'Turn device channel on or off',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                required: true,
                default: 0
            },
            {
                name: 'onoff',
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
    setLight: {
        name: 'Light Control',
        category: 'Light Control',
        description: 'Control light settings (advanced)',
        params: [
            {
                name: 'light',
                type: 'object',
                label: 'Light Configuration',
                required: true,
                properties: [
                    { name: 'channel', type: 'number', default: 0 },
                    { name: 'onoff', type: 'number', default: 1 },
                    { name: 'rgb', type: 'number' },
                    { name: 'luminance', type: 'number', min: 0, max: 100 },
                    { name: 'temperature', type: 'number', min: 0, max: 100 }
                ]
            }
        ]
    },
    setLightColor: {
        name: 'Light Color & Brightness',
        category: 'Light Control',
        description: 'Set light color, brightness, and temperature',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            },
            {
                name: 'onoff',
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
    setDiffuserLight: {
        name: 'Diffuser Light',
        category: 'Light Control',
        description: 'Control diffuser light settings',
        params: [
            {
                name: 'light',
                type: 'object',
                label: 'Light Configuration',
                required: true,
                properties: [
                    { name: 'channel', type: 'number', default: 0 },
                    { name: 'onoff', type: 'number', default: 1 },
                    { name: 'rgb', type: 'number' },
                    { name: 'luminance', type: 'number', min: 0, max: 100 }
                ]
            }
        ]
    },

    // Climate Control
    setThermostatMode: {
        name: 'Thermostat Mode',
        category: 'Climate Control',
        description: 'Set thermostat mode and temperature',
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
            }
        ]
    },
    setThermostatModeB: {
        name: 'Thermostat Mode B',
        category: 'Climate Control',
        description: 'Set thermostat mode B (advanced)',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            },
            {
                name: 'modeData',
                type: 'object',
                label: 'Mode Data',
                required: true
            }
        ]
    },
    setSpray: {
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
    setDiffuserSpray: {
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
    setGarageDoor: {
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
                name: 'open',
                type: 'boolean',
                label: 'Action',
                choices: [
                    { name: 'Open', value: true },
                    { name: 'Close', value: false }
                ],
                required: true
            }
        ]
    },
    setRollerShutterPosition: {
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
    setRollerShutterUp: {
        name: 'Roller Shutter Open',
        category: 'Cover Control',
        description: 'Open roller shutter (position 100)',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            }
        ]
    },
    setRollerShutterDown: {
        name: 'Roller Shutter Close',
        category: 'Cover Control',
        description: 'Close roller shutter (position 0)',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            }
        ]
    },
    setRollerShutterStop: {
        name: 'Roller Shutter Stop',
        category: 'Cover Control',
        description: 'Stop roller shutter movement',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            }
        ]
    },
    openRollerShutter: {
        name: 'Roller Shutter Open',
        category: 'Cover Control',
        description: 'Open roller shutter (convenience method)',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            }
        ]
    },
    closeRollerShutter: {
        name: 'Roller Shutter Close',
        category: 'Cover Control',
        description: 'Close roller shutter (convenience method)',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            }
        ]
    },
    stopRollerShutter: {
        name: 'Roller Shutter Stop',
        category: 'Cover Control',
        description: 'Stop roller shutter (convenience method)',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            }
        ]
    },
    setRollerShutterPosition: {
        name: 'Roller Shutter Set Position',
        category: 'Cover Control',
        description: 'Set roller shutter to specific position (convenience method)',
        params: [
            {
                name: 'position',
                type: 'number',
                label: 'Position (0-100)',
                min: 0,
                max: 100,
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
    setRollerShutterConfig: {
        name: 'Roller Shutter Configuration',
        category: 'Configuration',
        description: 'Configure roller shutter settings',
        params: [
            {
                name: 'config',
                type: 'object',
                label: 'Configuration Object',
                required: true
            }
        ]
    },
    openGarageDoor: {
        name: 'Garage Door Open',
        category: 'Cover Control',
        description: 'Open garage door (convenience method)',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            }
        ]
    },
    closeGarageDoor: {
        name: 'Garage Door Close',
        category: 'Cover Control',
        description: 'Close garage door (convenience method)',
        params: [
            {
                name: 'channel',
                type: 'number',
                label: 'Channel',
                default: 0
            }
        ]
    },
    setGarageDoorConfig: {
        name: 'Garage Door Configuration',
        category: 'Configuration',
        description: 'Configure garage door settings',
        params: [
            {
                name: 'configData',
                type: 'object',
                label: 'Configuration Object',
                required: true
            }
        ]
    },

    // Configuration
    setChildLock: {
        name: 'Child Lock',
        category: 'Configuration',
        description: 'Enable or disable child lock',
        params: [
            {
                name: 'lockData',
                type: 'object',
                label: 'Lock Configuration',
                required: true,
                properties: [
                    { name: 'lock', type: 'number', label: 'Lock (0=unlock, 1=lock)', required: true }
                ]
            }
        ]
    },
    setSystemLedMode: {
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
    setScreenBrightness: {
        name: 'Screen Brightness',
        category: 'Configuration',
        description: 'Set device screen brightness',
        params: [
            {
                name: 'brightnessData',
                type: 'object',
                label: 'Brightness Configuration',
                required: true,
                properties: [
                    { name: 'brightness', type: 'number', min: 0, max: 100, required: true }
                ]
            }
        ]
    },
    setTempUnit: {
        name: 'Temperature Unit',
        category: 'Configuration',
        description: 'Set temperature unit (Celsius/Fahrenheit)',
        params: [
            {
                name: 'tempUnitData',
                type: 'object',
                label: 'Temperature Unit Configuration',
                required: true,
                properties: [
                    { name: 'unit', type: 'number', label: 'Unit (0=Celsius, 1=Fahrenheit)', required: true }
                ]
            }
        ]
    },
    setDNDMode: {
        name: 'Do Not Disturb Mode',
        category: 'Configuration',
        description: 'Enable or disable Do Not Disturb mode (turns off LED indicator)',
        params: [
            {
                name: 'mode',
                type: 'boolean',
                label: 'DND Mode',
                choices: [
                    { name: 'Enable DND', value: true },
                    { name: 'Disable DND', value: false }
                ],
                required: true
            }
        ]
    },
    setConfigOverTemp: {
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
    setPresenceConfig: {
        name: 'Presence Sensor Configuration',
        category: 'Configuration',
        description: 'Configure presence sensor settings (mode, sensitivity, distance, etc.)',
        params: [
            {
                name: 'configData',
                type: 'object',
                label: 'Configuration Object',
                required: true,
                properties: [
                    { name: 'channel', type: 'number', label: 'Channel', default: 0 },
                    { name: 'mode', type: 'object', label: 'Mode Configuration' },
                    { name: 'noBodyTime', type: 'object', label: 'No Body Time Configuration' },
                    { name: 'distance', type: 'object', label: 'Distance Configuration' },
                    { name: 'sensitivity', type: 'object', label: 'Sensitivity Configuration' },
                    { name: 'mthx', type: 'object', label: 'Motion Threshold Configuration' }
                ]
            }
        ]
    },
    setPresenceStudy: {
        name: 'Presence Sensor Study/Calibration',
        category: 'Configuration',
        description: 'Start or stop presence sensor study/calibration mode',
        params: [
            {
                name: 'studyData',
                type: 'object',
                label: 'Study Data Object',
                required: true,
                properties: [
                    { name: 'channel', type: 'number', label: 'Channel', default: 0 },
                    { name: 'value', type: 'number', label: 'Study Mode Value (typically 1-3)' },
                    { name: 'status', type: 'number', label: 'Status (0=stop, 1=start)', required: true }
                ]
            }
        ]
    },
    setTimerX: {
        name: 'Timer Control',
        category: 'Automation',
        description: 'Create or update a timer',
        params: [
            {
                name: 'timerx',
                type: 'object',
                label: 'Timer Configuration',
                required: true,
                properties: [
                    { name: 'id', type: 'string', label: 'Timer ID (for updates)' },
                    { name: 'channel', type: 'number', default: 0 },
                    { name: 'onoff', type: 'number', label: 'Action (0=off, 1=on)', required: true },
                    { name: 'type', type: 'number', label: 'Timer Type', required: true },
                    { name: 'time', type: 'number', label: 'Time Value', required: true }
                ]
            }
        ]
    },
    deleteTimerX: {
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
    setTriggerX: {
        name: 'Trigger Control',
        category: 'Automation',
        description: 'Create or update a trigger',
        params: [
            {
                name: 'triggerx',
                type: 'object',
                label: 'Trigger Configuration',
                required: true
            }
        ]
    },
    deleteTriggerX: {
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
                required: false,
                default: 0
            }
        ]
    }
};

/**
 * Get metadata for a control method.
 * @param {string} methodName - Name of the control method
 * @returns {Object|null} Method metadata or null if not found
 */
function getMethodMetadata(methodName) {
    return CONTROL_METHOD_REGISTRY[methodName] || null;
}

/**
 * Get all methods grouped by category.
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
 * Check if device supports a required namespace.
 * @param {Object} device - Device instance
 * @param {string} namespace - Namespace to check
 * @returns {boolean} True if device supports the namespace
 */
function deviceSupportsNamespace(device, namespace) {
    if (!device._abilities || typeof device._abilities !== 'object') {
        return false;
    }
    return !!device._abilities[namespace];
}

/**
 * Check if device supports any of the required namespaces for a method.
 * @param {Object} device - Device instance
 * @param {Array<string>} namespaces - Array of namespace strings (any match is sufficient)
 * @returns {boolean} True if device supports at least one namespace
 */
function deviceSupportsAnyNamespace(device, namespaces) {
    if (!namespaces || namespaces.length === 0) {
        return true; // No namespace requirement means always available
    }
    return namespaces.some(namespace => deviceSupportsNamespace(device, namespace));
}

/**
 * Detect available control methods on a device based on device abilities.
 * Only shows methods that are in the registry AND the device supports the required namespaces.
 * @param {Object} device - Device instance
 * @returns {Array} Array of available control methods with metadata
 */
function detectControlMethods(device) {
    const availableMethods = [];

    // Only show methods that are in our registry and device supports
    // Iterate through registry instead of device methods to ensure we only show known methods
    for (const [methodName, metadata] of Object.entries(CONTROL_METHOD_REGISTRY)) {
        // Check if method exists on device (check both exact name and common variations)
        const deviceMethod = device[methodName];
        if (typeof deviceMethod !== 'function') {
            // Try alternative naming (e.g., setDNDMode might be on device)
            continue; // Method doesn't exist on device, skip
        }

        // Check if this method requires specific namespaces
        const requiredNamespaces = METHOD_TO_NAMESPACE_MAP[methodName];

        // If method has namespace requirements, check if device supports them
        if (requiredNamespaces && requiredNamespaces.length > 0) {
            if (!deviceSupportsAnyNamespace(device, requiredNamespaces)) {
                // Device doesn't support required namespaces, skip this method
                continue;
            }
        } else {
            // Method has no namespace requirement - this shouldn't happen for control methods
            // Skip it to be safe, or we could add it but it's better to be strict
            continue;
        }

        // Method exists, has namespace requirements, and device supports them - add it
        availableMethods.push({
            methodName,
            ...metadata
        });
    }

    // Also check for any control/set methods on device that might not be in registry
    // but have namespace requirements (for future extensibility)
    for (const prop in device) {
        if ((prop.startsWith('control') || prop.startsWith('set')) && typeof device[prop] === 'function') {
            // Skip if already in our list
            if (availableMethods.some(m => m.methodName === prop)) {
                continue;
            }

            // Check if this method has namespace requirements
            const requiredNamespaces = METHOD_TO_NAMESPACE_MAP[prop];

            // Only include if it has namespace requirements AND device supports them
            if (requiredNamespaces && requiredNamespaces.length > 0) {
                if (deviceSupportsAnyNamespace(device, requiredNamespaces)) {
                    // Unknown method but device supports it - add with basic info
                    const displayName = prop.replace(/^(control|set)/, '').replace(/([A-Z])/g, ' $1').trim();
                    availableMethods.push({
                        methodName: prop,
                        name: displayName,
                        category: 'Other',
                        description: 'Control method',
                        params: []
                    });
                }
            }
            // If no namespace requirement, skip it (don't show unknown methods without namespace checks)
        }
    }

    // Sort by category, then by name
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

