'use strict';

const path = require('path');
const fs = require('fs');
const testRegistry = require('./test-registry');

/**
 * Test runner for CLI - lightweight custom async execution engine
 * No Mocha dependency - uses simple async/await with structured results
 */

/**
 * Gets device display name for error messages
 * @param {Object} device - Device instance
 * @returns {string} Device display name
 */
function getDeviceName(device) {
    if (!device) return 'Unknown device';
    return device.name || device.uuid || 'Unknown device';
}

/**
 * Formats error message with device context
 * @param {Error} error - Error object
 * @param {Object} device - Device instance (optional)
 * @param {string} testName - Test name (optional)
 * @returns {string} Formatted error message
 */
function formatError(error, device = null, testName = null) {
    const parts = [];
    
    if (testName) {
        parts.push(`Test: ${testName}`);
    }
    
    if (device) {
        parts.push(`Device: ${getDeviceName(device)}`);
    }
    
    parts.push(`Error: ${error.message || error}`);
    
    if (error.stack) {
        parts.push(`\nStack trace:\n${error.stack}`);
    }
    
    return parts.join('\n');
}

/**
 * Runs a single test with timeout and error handling
 * @param {Function} testFn - Test function to execute
 * @param {string} testName - Name of the test
 * @param {number} timeout - Timeout in milliseconds
 * @param {Object} device - Device instance (optional, for context)
 * @returns {Promise<Object>} Test result object
 */
async function runSingleTest(testFn, testName, timeout = 30000, device = null) {
    const startTime = Date.now();
    
    return new Promise(async (resolve) => {
        const timeoutId = setTimeout(() => {
            resolve({
                name: testName,
                passed: false,
                skipped: false,
                error: `Test timed out after ${timeout}ms`,
                duration: Date.now() - startTime,
                device: device ? getDeviceName(device) : null
            });
        }, timeout);
        
        try {
            const result = await testFn();
            
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            
            // Handle test result - can be boolean, object, or void
            if (result === false) {
                resolve({
                    name: testName,
                    passed: false,
                    skipped: false,
                    error: 'Test returned false',
                    duration: duration,
                    device: device ? getDeviceName(device) : null
                });
            } else if (result && typeof result === 'object') {
                // Test returned structured result
                resolve({
                    name: testName,
                    passed: result.passed !== false,
                    skipped: result.skipped === true,
                    error: result.error || null,
                    duration: duration,
                    device: device ? getDeviceName(device) : null,
                    ...result
                });
            } else {
                // Test passed (returned true, undefined, or truthy value)
                resolve({
                    name: testName,
                    passed: true,
                    skipped: false,
                    error: null,
                    duration: duration,
                    device: device ? getDeviceName(device) : null
                });
            }
        } catch (error) {
            clearTimeout(timeoutId);
            resolve({
                name: testName,
                passed: false,
                skipped: false,
                error: formatError(error, device, testName),
                duration: Date.now() - startTime,
                device: device ? getDeviceName(device) : null
            });
        }
    });
}

/**
 * Loads and validates a test file
 * @param {string} testFile - Path to test file
 * @returns {Promise<Object>} Test module with metadata and runTests function
 */
async function loadTestFile(testFile) {
    if (!fs.existsSync(testFile)) {
        throw new Error(`Test file not found: ${testFile}`);
    }
    
    // Clear require cache to allow reloading
    delete require.cache[require.resolve(testFile)];
    
    const testModule = require(testFile);
    
    // For now, allow test files without metadata (they'll use registry metadata)
    // This provides backward compatibility during migration
    // TODO: After migration, require metadata in all test files
    
    if (typeof testModule.runTests !== 'function') {
        throw new Error(`Test file ${testFile} must export a 'runTests' function`);
    }
    
    return testModule;
}

/**
 * Runs tests from a test file
 * @param {string} testType - Test type name
 * @param {Object} context - Test context: { manager, devices, options }
 * @returns {Promise<Object>} Test results
 */
async function runTest(testType, context) {
    const { manager, devices = [], options = {} } = context;
    
    if (!manager) {
        throw new Error('ManagerMeross instance is required in context');
    }
    
    // Resolve test type (handles aliases)
    const resolvedType = testRegistry.resolveTestType(testType);
    if (!resolvedType) {
        throw new Error(`Unknown test type: ${testType}. Available types: ${getAvailableTestTypes().join(', ')}`);
    }
    
    // Get test file path
    const testFile = getTestFile(resolvedType);
    if (!testFile) {
        throw new Error(`Test file not found for type: ${resolvedType}`);
    }
    
    const startTime = Date.now();
    
    try {
        // Load test module
        const testModule = await loadTestFile(testFile);
        const metadata = testModule.metadata || {};
        
        // Get metadata from registry if not in test file
        const registryMetadata = testRegistry.getTestMetadata(resolvedType);
        const minDevices = metadata.minDevices || (registryMetadata ? registryMetadata.minDevices : 1);
        const testName = metadata.name || resolvedType;
        const description = metadata.description || (registryMetadata ? registryMetadata.description : 'No description');
        
        // Validate devices
        if (devices.length < minDevices) {
            return {
                success: false,
                passed: 0,
                failed: 0,
                skipped: 1,
                duration: Date.now() - startTime,
                error: `Insufficient devices: found ${devices.length}, required ${minDevices}`,
                tests: [{
                    name: testName,
                    passed: false,
                    skipped: true,
                    error: `No suitable devices found (found ${devices.length}, need ${minDevices})`,
                    duration: 0,
                    device: null
                }]
            };
        }
        
        // Run tests
        // Only print initial info if in standalone mode (CLI handles this output)
        if (options.verbose && options.standalone) {
            console.log(`\nRunning ${testName} tests...`);
            console.log(`Description: ${description}`);
            console.log(`Devices: ${devices.length}`);
            devices.forEach((device, idx) => {
                console.log(`  [${idx}] ${getDeviceName(device)}`);
            });
            console.log('');
        }
        
        const testResults = await testModule.runTests(context);
        
        // Ensure testResults is an array
        const resultsArray = Array.isArray(testResults) ? testResults : [testResults];
        
        // Calculate summary
        const passed = resultsArray.filter(r => r.passed && !r.skipped).length;
        const failed = resultsArray.filter(r => !r.passed && !r.skipped).length;
        const skipped = resultsArray.filter(r => r.skipped).length;
        const duration = Date.now() - startTime;
        
        // Only print results if verbose mode is enabled (for standalone execution)
        // CLI will handle output formatting, so we skip it here to avoid duplicates
        if (options.verbose && options.standalone) {
            console.log('\n--- Test Results ---');
            resultsArray.forEach((result, idx) => {
                const status = result.skipped ? 'SKIPPED' : (result.passed ? 'PASSED' : 'FAILED');
                const deviceInfo = result.device ? ` [${result.device}]` : '';
                const durationInfo = result.duration ? ` (${result.duration}ms)` : '';
                console.log(`${idx + 1}. ${result.name || 'Unknown test'}${deviceInfo}: ${status}${durationInfo}`);
                
                if (result.error) {
                    console.log(`   Error: ${result.error}`);
                }
            });
            
            console.log(`\nSummary: ${passed} passed, ${failed} failed, ${skipped} skipped (${duration}ms)`);
        }
        
        return {
            success: failed === 0,
            passed: passed,
            failed: failed,
            skipped: skipped,
            duration: duration,
            tests: resultsArray
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = formatError(error, null, testType);
        
        console.error(`\nTest execution error: ${errorMessage}`);
        
        return {
            success: false,
            passed: 0,
            failed: 1,
            skipped: 0,
            duration: duration,
            error: errorMessage,
            tests: [{
                name: testType,
                passed: false,
                skipped: false,
                error: errorMessage,
                duration: duration,
                device: null
            }]
        };
    }
}

// Test metadata is now managed by test-registry.js

/**
 * Gets available test types
 * @returns {Array<string>} Array of test type names
 */
function getAvailableTestTypes() {
    return testRegistry.getAvailableTestTypes();
}

/**
 * Gets description for a test type
 * @param {string} testType - Test type name or alias
 * @returns {string} Description of the test type
 */
function getTestDescription(testType) {
    return testRegistry.getTestDescription(testType);
}

/**
 * Gets test file path for a given test type
 * @param {string} testType - Test type name or alias
 * @returns {string|null} Path to test file or null if not found
 */
function getTestFile(testType) {
    return testRegistry.getTestFile(testType, __dirname);
}

/**
 * Finds devices for a given test type
 * @param {string} testType - Test type name or alias
 * @param {Object} manager - ManagerMeross instance
 * @returns {Promise<Array>} Array of matching devices
 */
async function findDevicesForTestType(testType, manager) {
    const { OnlineStatus } = require('./test-helper');
    const abilities = testRegistry.getRequiredAbilities(testType);
    
    if (!abilities || abilities.length === 0) {
        return [];
    }
    
    const allDevices = manager.devices.list();
    if (!allDevices || allDevices.length === 0) {
        const { waitForDevices } = require('./test-helper');
        const deviceList = await waitForDevices(manager, 1000);
        return deviceList.filter(d => d);
    }
    
    const matchingDevices = [];
    const seenUuids = new Set();
    
    // Import MerossHubDevice for filtering (lazy import to avoid circular dependency)
    let MerossHubDevice = null;
    try {
        MerossHubDevice = require('meross-iot').MerossHubDevice;
    } catch (e) {
        // Fallback if import fails
    }
    
    for (const device of allDevices) {
        const uuid = device.uuid;
        if (seenUuids.has(uuid)) {
            continue;
        }
        
        if (device.onlineStatus !== OnlineStatus.ONLINE) {
            continue;
        }
        
        // Filter out subdevices when searching for hub abilities
        // Subdevices inherit hub abilities but we want the actual hub device
        const isSubdevice = device.constructor.name === 'MerossSubDevice' ||
                           device.constructor.name === 'HubTempHumSensor' ||
                           device.constructor.name === 'HubWaterLeakSensor' ||
                           device.constructor.name === 'HubSmokeDetector' ||
                           device.constructor.name === 'HubThermostatValve' ||
                           (device.subdeviceId || device._subdeviceId) ||
                           (device.hub || device._hub);
        
        // Check if this is a hub ability search - if so, exclude subdevices
        const isHubAbilitySearch = abilities.some(ability => 
            ability.startsWith('Appliance.Hub.')
        );
        
        if (isHubAbilitySearch && isSubdevice) {
            // Skip subdevices when searching for hub abilities
            continue;
        }
        
        const hasAbility = abilities.some(ability => 
            device.abilities && device.abilities[ability]
        );
        
        if (hasAbility) {
            seenUuids.add(uuid);
            matchingDevices.push(device);
        }
    }
    
    // For garage, also try by device type if no matches found
    if (testType.toLowerCase() === 'garage' && matchingDevices.length === 0) {
        for (const device of allDevices) {
            const uuid = device.uuid;
            if (seenUuids.has(uuid)) {
                continue;
            }
            
            const subdeviceType = device.type || device._type;
            const matchesType = device.deviceType === 'msg100' || subdeviceType === 'msg100';
            
            if (matchesType && device.onlineStatus === OnlineStatus.ONLINE) {
                seenUuids.add(uuid);
                matchingDevices.push(device);
            }
        }
    }
    
    return matchingDevices;
}

module.exports = {
    runTest,
    runSingleTest,
    getAvailableTestTypes,
    getTestDescription,
    getTestFile,
    findDevicesForTestType,
    getDeviceName,
    formatError
};
