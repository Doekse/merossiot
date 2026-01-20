'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Test Registry - Centralized metadata and auto-discovery for test files
 * 
 * This registry maintains metadata about all available tests including:
 * - Test type names and aliases
 * - File mappings
 * - Descriptions
 * - Required device abilities
 * - Minimum device requirements
 */

/**
 * Static test metadata
 * Maps test type names to their configuration
 * 
 * Structure:
 * {
 *   'test-type': {
 *     file: 'test-file.js',
 *     description: 'Test description',
 *     requiredAbilities: ['Appliance.Control.X', ...],
 *     minDevices: 1,
 *     aliases: ['alias1', 'alias2']  // Optional alternative names
 *   }
 * }
 */
const TEST_METADATA = {
    'switch': {
        file: 'test-toggle.js',
        description: 'Tests on/off control for switches and smart plugs',
        requiredAbilities: ['Appliance.Control.ToggleX', 'Appliance.Control.Toggle'],
        minDevices: 1,
        aliases: ['toggle']
    },
    'light': {
        file: 'test-light.js',
        description: 'Tests RGB color, brightness, and temperature control for light devices',
        requiredAbilities: ['Appliance.Control.Light'],
        minDevices: 1,
        aliases: ['rgb', 'lamp']
    },
    'thermostat': {
        file: 'test-thermostat.js',
        description: 'Tests thermostat mode control, temperature settings, and ambient temperature reading',
        requiredAbilities: ['Appliance.Control.Thermostat.Mode'],
        minDevices: 1
    },
    'shutter': {
        file: 'test-roller-shutter.js',
        description: 'Tests open/close control and position setting for roller shutters',
        requiredAbilities: ['Appliance.RollerShutter.State'],
        minDevices: 1,
        aliases: ['roller-shutter', 'blind']
    },
    'garage': {
        file: 'test-garage.js',
        description: 'Tests open/close control for garage door openers',
        requiredAbilities: ['Appliance.GarageDoor.State'],
        minDevices: 1
    },
    'spray': {
        file: 'test-spray.js',
        description: 'Tests spray mode control for spray devices',
        requiredAbilities: ['Appliance.Control.Spray'],
        minDevices: 1
    },
    'diffuser': {
        file: 'test-diffuser.js',
        description: 'Tests light RGB control, brightness, and spray mode for diffuser devices',
        requiredAbilities: ['Appliance.Control.Diffuser.Light', 'Appliance.Control.Diffuser.Spray'],
        minDevices: 1
    },
    'electricity': {
        file: 'test-electricity.js',
        description: 'Tests power consumption metrics and daily consumption data',
        requiredAbilities: ['Appliance.Control.ConsumptionH', 'Appliance.Control.ConsumptionX', 'Appliance.Control.Consumption', 'Appliance.Control.Electricity'],
        minDevices: 1
    },
    'dnd': {
        file: 'test-dnd.js',
        description: 'Tests do-not-disturb mode functionality',
        requiredAbilities: ['Appliance.System.DNDMode'],
        minDevices: 1
    },
    'child-lock': {
        file: 'test-child-lock.js',
        description: 'Tests physical lock/child lock safety features',
        requiredAbilities: ['Appliance.Control.PhysicalLock'],
        minDevices: 1
    },
    'timer': {
        file: 'test-timer.js',
        description: 'Tests timer creation, management, and execution',
        requiredAbilities: ['Appliance.Control.TimerX', 'Appliance.Digest.TimerX'],
        minDevices: 1
    },
    'trigger': {
        file: 'test-trigger.js',
        description: 'Tests trigger configuration and execution',
        requiredAbilities: ['Appliance.Control.TriggerX', 'Appliance.Digest.TriggerX'],
        minDevices: 1
    },
    'alarm': {
        file: 'test-alarm.js',
        description: 'Tests alarm functionality and notifications',
        requiredAbilities: ['Appliance.Control.Alarm'],
        minDevices: 1
    },
    'runtime': {
        file: 'test-runtime.js',
        description: 'Tests device runtime and system runtime information',
        requiredAbilities: ['Appliance.System.Runtime'],
        minDevices: 1
    },
    'encryption': {
        file: 'test-encryption.js',
        description: 'Tests encryption capabilities and secure communication',
        requiredAbilities: ['Appliance.Encrypt.ECDHE', 'Appliance.Encrypt.Suite'],
        minDevices: 1
    },
    'hub': {
        file: 'test-hub-sensors.js',
        description: 'Tests hub sensor discovery and temperature/humidity readings',
        requiredAbilities: ['Appliance.Hub.Sensor.All', 'Appliance.Hub.Sensor.TempHum', 'Appliance.Hub.Battery'],
        minDevices: 1,
        aliases: ['hub-sensors']
    },
    'mts100': {
        file: 'test-hub-mts100.js',
        description: 'Tests MTS100 thermostat hub functionality',
        requiredAbilities: ['Appliance.Hub.Mts100.All'],
        minDevices: 1,
        aliases: ['hub-mts100']
    },
    'screen': {
        file: 'test-screen.js',
        description: 'Tests screen brightness control',
        requiredAbilities: ['Appliance.Control.Screen.Brightness'],
        minDevices: 1
    },
    'sensor-history': {
        file: 'test-sensor-history.js',
        description: 'Tests sensor history data retrieval',
        requiredAbilities: ['Appliance.Control.Sensor.History'],
        minDevices: 1
    },
    'smoke-config': {
        file: 'test-smoke-config.js',
        description: 'Tests smoke detector configuration settings',
        requiredAbilities: ['Appliance.Control.Smoke.Config'],
        minDevices: 1
    },
    'temp-unit': {
        file: 'test-temp-unit.js',
        description: 'Tests temperature unit settings (Celsius/Fahrenheit)',
        requiredAbilities: ['Appliance.Control.TempUnit'],
        minDevices: 1
    },
    'config': {
        file: 'test-config.js',
        description: 'Tests device configuration and settings',
        requiredAbilities: ['Appliance.Config.OverTemp'],
        minDevices: 1
    },
    'control': {
        file: 'test-control.js',
        description: 'Tests multiple control features and device capabilities',
        requiredAbilities: ['Appliance.Control.Multiple', 'Appliance.Control.Upgrade', 'Appliance.Control.OverTemp'],
        minDevices: 1
    },
    'presence': {
        file: 'test-presence.js',
        description: 'Tests presence detection, light readings, and configuration for presence sensor devices',
        requiredAbilities: ['Appliance.Control.Sensor.LatestX'],
        minDevices: 1
    },
    'system': {
        file: 'test-system.js',
        description: 'Tests system information, hardware, firmware, abilities, and configuration',
        requiredAbilities: ['Appliance.System.All', 'Appliance.System.Ability'],
        minDevices: 1
    }
};

/**
 * Reverse mapping: alias -> canonical test type name
 * Built automatically from TEST_METADATA
 */
let aliasMap = null;

/**
 * Build alias map from metadata
 * @returns {Object} Map of alias -> canonical name
 */
function buildAliasMap() {
    if (aliasMap) {
        return aliasMap;
    }
    
    aliasMap = {};
    for (const [canonicalName, metadata] of Object.entries(TEST_METADATA)) {
        if (metadata.aliases) {
            for (const alias of metadata.aliases) {
                aliasMap[alias.toLowerCase()] = canonicalName;
            }
        }
        // Also map canonical name to itself
        aliasMap[canonicalName.toLowerCase()] = canonicalName;
    }
    
    return aliasMap;
}

/**
 * Resolves a test type name (handles aliases)
 * @param {string} testType - Test type name or alias
 * @returns {string|null} Canonical test type name or null if not found
 */
function resolveTestType(testType) {
    if (!testType) {
        return null;
    }
    
    const aliases = buildAliasMap();
    const normalized = testType.toLowerCase();
    
    return aliases[normalized] || (TEST_METADATA[normalized] ? normalized : null);
}

/**
 * Gets metadata for a test type
 * @param {string} testType - Test type name or alias
 * @returns {Object|null} Test metadata or null if not found
 */
function getTestMetadata(testType) {
    const canonicalName = resolveTestType(testType);
    if (!canonicalName) {
        return null;
    }
    
    return TEST_METADATA[canonicalName] || null;
}

/**
 * Gets available test types
 * @returns {Array<string>} Array of canonical test type names
 */
function getAvailableTestTypes() {
    return Object.keys(TEST_METADATA);
}

/**
 * Gets description for a test type
 * @param {string} testType - Test type name or alias
 * @returns {string} Description of the test type
 */
function getTestDescription(testType) {
    const metadata = getTestMetadata(testType);
    return metadata ? metadata.description : `Tests ${testType} device functionality`;
}

/**
 * Gets required abilities for a test type
 * @param {string} testType - Test type name or alias
 * @returns {Array<string>} Array of required ability namespaces
 */
function getRequiredAbilities(testType) {
    const metadata = getTestMetadata(testType);
    return metadata ? (metadata.requiredAbilities || []) : [];
}

/**
 * Gets minimum number of devices required for a test
 * @param {string} testType - Test type name or alias
 * @returns {number} Minimum number of devices (default: 1)
 */
function getMinDevices(testType) {
    const metadata = getTestMetadata(testType);
    return metadata ? (metadata.minDevices || 1) : 1;
}

/**
 * Gets test file path for a given test type
 * @param {string} testType - Test type name or alias
 * @param {string} baseDir - Base directory for test files (default: __dirname)
 * @returns {string|null} Path to test file or null if not found
 */
function getTestFile(testType, baseDir = __dirname) {
    const metadata = getTestMetadata(testType);
    if (!metadata || !metadata.file) {
        return null;
    }
    
    const testPath = path.join(baseDir, metadata.file);
    if (fs.existsSync(testPath)) {
        return testPath;
    }
    
    return null;
}

/**
 * Auto-discovers test files in the tests directory
 * Scans for test-*.js files and attempts to load their metadata
 * @param {string} baseDir - Base directory to scan (default: __dirname)
 * @returns {Array<Object>} Array of discovered test info objects
 */
function discoverTestFiles(baseDir = __dirname) {
    const discovered = [];
    
    if (!fs.existsSync(baseDir)) {
        return discovered;
    }
    
    const files = fs.readdirSync(baseDir);
    
    for (const file of files) {
        // Look for test-*.js files
        if (!file.startsWith('test-') || !file.endsWith('.js')) {
            continue;
        }
        
        // Skip helper files
        if (file === 'test-helper.js' || file === 'test-runner.js' || file === 'test-registry.js') {
            continue;
        }
        
        const filePath = path.join(baseDir, file);
        
        try {
            // Try to load the test file and get its metadata
            delete require.cache[require.resolve(filePath)];
            const testModule = require(filePath);
            
            if (testModule.metadata) {
                // Test file exports metadata - use it
                discovered.push({
                    file: file,
                    path: filePath,
                    metadata: testModule.metadata,
                    source: 'file'
                });
            } else {
                // Test file doesn't export metadata yet - use static registry if available
                // Find matching entry in static registry
                for (const [type, metadata] of Object.entries(TEST_METADATA)) {
                    if (metadata.file === file) {
                        discovered.push({
                            file: file,
                            path: filePath,
                            metadata: {
                                name: type,
                                description: metadata.description,
                                requiredAbilities: metadata.requiredAbilities,
                                minDevices: metadata.minDevices
                            },
                            source: 'registry'
                        });
                        break;
                    }
                }
            }
        } catch (error) {
            // File exists but couldn't be loaded - skip it
            // This might happen if the file has syntax errors or missing dependencies
            continue;
        }
    }
    
    return discovered;
}

/**
 * Lists all tests with their metadata
 * @returns {Object} Object mapping test types to their metadata
 */
function listTests() {
    const tests = {};
    
    for (const [type, metadata] of Object.entries(TEST_METADATA)) {
        tests[type] = {
            file: metadata.file,
            description: metadata.description,
            requiredAbilities: metadata.requiredAbilities,
            minDevices: metadata.minDevices,
            aliases: metadata.aliases || []
        };
    }
    
    return tests;
}

/**
 * Validates that a test type exists
 * @param {string} testType - Test type name or alias
 * @returns {boolean} True if test type exists
 */
function testTypeExists(testType) {
    return resolveTestType(testType) !== null;
}

module.exports = {
    // Core functions
    getTestMetadata,
    getAvailableTestTypes,
    getTestDescription,
    getRequiredAbilities,
    getMinDevices,
    getTestFile,
    resolveTestType,
    testTypeExists,
    
    // Discovery
    discoverTestFiles,
    listTests,
    
    // Direct access to metadata (for advanced use cases)
    TEST_METADATA
};

