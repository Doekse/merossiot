# Meross Cloud Tests

This directory contains test files for the Meross Cloud library. The test system uses a custom lightweight test runner with no external test framework dependencies.

## Test System Architecture

The test system is designed for simplicity, maintainability, and excellent error reporting:

- **Custom Test Runner**: Lightweight async execution engine (no Mocha dependency)
- **Explicit Dependency Injection**: All dependencies passed via context object (no globals)
- **Structured Results**: Detailed test results with device context and error information
- **Better Error Reporting**: Rich error messages with device names and stack traces

## Test Files

- `test-runner.js` - Custom lightweight test runner for CLI integration
- `test-registry.js` - Centralized test metadata and auto-discovery
- `test-helper.js` - Pure utility functions for device discovery and connection management
- `test-template.js` - Template/example showing new test file structure
- `test-toggle.js` - Tests for toggle/switch devices
- `test-light.js` - Tests for light/RGB devices
- `test-thermostat.js` - Tests for thermostat devices
- `test-roller-shutter.js` - Tests for roller shutter devices
- `test-garage.js` - Tests for garage door opener devices
- `test-spray.js` - Tests for spray/humidifier devices
- `test-diffuser.js` - Tests for diffuser devices
- `test-electricity.js` - Tests for electricity/consumption monitoring devices
- `test-dnd.js` - Tests for Do-Not-Disturb (DND) mode functionality
- `test-child-lock.js` - Tests for physical lock/child lock functionality
- `test-timer.js` - Tests for timer functionality (TimerX namespace)
- `test-trigger.js` - Tests for trigger functionality (TriggerX namespace)
- `test-alarm.js` - Tests for alarm functionality
- `test-runtime.js` - Tests for runtime information
- `test-encryption.js` - Tests for encryption support
- `test-hub-sensors.js` - Tests for hub sensors (temperature/humidity, water leak, smoke, battery)
- `test-hub-mts100.js` - Tests for hub MTS100 thermostat valves
- `test-screen.js` - Tests for screen brightness
- `test-sensor-history.js` - Tests for sensor history
- `test-smoke-config.js` - Tests for smoke sensor configuration
- `test-temp-unit.js` - Tests for temperature unit configuration
- `test-config.js` - Tests for config features (over temp)
- `test-control.js` - Tests for control features (multiple commands, upgrade, over temp)
- `test-presence.js` - Tests for presence sensor devices

## Running Tests

Tests are only available via the CLI tool. They cannot be run directly with npm or mocha.

### Prerequisites

Set environment variables for authentication:
```bash
export MEROSS_EMAIL="your-email@example.com"
export MEROSS_PASSWORD="your-password"
```

Optional: Use cached credentials (base64 encoded token data):
```bash
export MEROSS_TOKEN_DATA="base64-encoded-credentials"
```

### Run Tests via CLI

Start the CLI in interactive mode:
```bash
npm run cli
# or
meross-cli interactive
```

Then run tests:
```bash
meross> test electricity
meross> test toggle
meross> test light
# etc.
```

Or run directly from command line:
```bash
meross-cli test electricity --email your@email.com --password yourpass
```

### Available Test Types

- `toggle` (or `switch`) - Toggle/switch devices
- `light` (or `rgb`, `lamp`) - Light/RGB devices
- `thermostat` - Thermostat devices
- `roller-shutter` (or `shutter`, `blind`) - Roller shutter devices
- `garage` - Garage door opener devices
- `spray` - Spray/humidifier devices
- `diffuser` - Diffuser devices
- `electricity` - Electricity/consumption monitoring devices
- `dnd` - Do-Not-Disturb mode
- `child-lock` - Physical lock/child lock
- `timer` - Timer functionality
- `trigger` - Trigger functionality
- `alarm` - Alarm functionality
- `runtime` - Runtime information
- `encryption` - Encryption support
- `hub-sensors` (or `hub`) - Hub sensors (temperature/humidity, water leak, smoke, battery)
- `hub-mts100` (or `mts100`) - Hub MTS100 thermostat valves
- `screen` - Screen brightness
- `sensor-history` - Sensor history
- `smoke-config` - Smoke sensor configuration
- `temp-unit` - Temperature unit configuration
- `config` - Config features (over temp)
- `control` - Control features (multiple commands, upgrade, over temp)
- `presence` - Presence sensor devices

## Writing New Tests

### Test File Structure

Each test file follows this structure:

```javascript
'use strict';

/**
 * Test Description
 * Brief description of what this test covers
 */

const { findDevicesByAbility, getDeviceName, OnlineStatus } = require('./test-helper');

// Export metadata object
const metadata = {
    name: 'test-name',
    description: 'Brief description of the test',
    requiredAbilities: ['Appliance.Control.Namespace'],
    aliases: ['alias1', 'alias2'],  // Optional
    minDevices: 1
};

// Export runTests function
async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.Namespace', OnlineStatus.ONLINE);
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should perform test action',
            passed: false,
            skipped: true,
            error: 'No suitable devices found',
            device: null
        });
        return results;
    }
    
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    // Test 1: Perform some action
    try {
        const result = await testDevice.someMethod();
        
        if (!result) {
            results.push({
                name: 'should perform test action',
                passed: false,
                skipped: false,
                error: 'Method returned null or undefined',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should perform test action',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { result: result }
            });
        }
    } catch (error) {
        results.push({
            name: 'should perform test action',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    return results;
}

module.exports = {
    metadata,
    runTests
};
```

### Key Points

1. **Metadata Export**: Every test file must export a `metadata` object with:
   - `name`: Test type identifier
   - `description`: Human-readable description
   - `requiredAbilities`: Array of ability namespaces required
   - `aliases`: Optional array of alternative names
   - `minDevices`: Minimum number of devices required (default: 1)

2. **runTests Function**: Must accept a `context` object with:
   - `manager`: MerossManager instance
   - `devices`: Array of pre-selected devices (optional, will auto-discover if not provided)
   - `options`: Test options (timeout, verbose, etc.)

3. **Return Value**: Must return an array of test result objects:
   ```javascript
   {
       name: 'Test name',
       passed: true/false,
       skipped: true/false,
       error: 'Error message or null',
       device: 'Device name or null',
       details: { /* optional additional info */ }
   }
   ```

4. **No Globals**: All dependencies are passed explicitly via the context object.

5. **Error Handling**: Always wrap test logic in try-catch blocks and return structured results.

### Test Helper Functions

The `test-helper.js` module provides pure utility functions:

- `waitForDevices(manager, timeout)` - Wait for devices to be discovered
- `findDevicesByAbility(manager, namespace, onlineStatus)` - Find devices by ability namespace
- `findDevicesByType(manager, deviceType, onlineStatus)` - Find devices by device type
- `waitForDeviceConnection(device, timeout)` - Wait for device to connect
- `waitForPushNotification(device, namespace, timeout)` - Wait for push notification
- `getDeviceName(device)` - Get device display name
- `deviceHasAbility(device, namespace)` - Check if device has specific ability
- `getDeviceOnlineStatus(device)` - Get device online status

All functions accept explicit parameters - no globals or environment variables.

### Example: Simple Test

```javascript
'use strict';

const { findDevicesByAbility, getDeviceName, OnlineStatus } = require('./test-helper');

const metadata = {
    name: 'simple-test',
    description: 'Tests simple device functionality',
    requiredAbilities: ['Appliance.Control.Simple'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices } = context;
    const results = [];
    
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.Simple', OnlineStatus.ONLINE);
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should find devices',
            passed: false,
            skipped: true,
            error: 'No devices found',
            device: null
        });
        return results;
    }
    
    const device = testDevices[0];
    const deviceName = getDeviceName(device);
    
    try {
        const state = await device.getState();
        results.push({
            name: 'should get device state',
            passed: !!state,
            skipped: false,
            error: state ? null : 'State is null',
            device: deviceName
        });
    } catch (error) {
        results.push({
            name: 'should get device state',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    return results;
}

module.exports = { metadata, runTests };
```

## Test Results Format

Test results are returned in a structured format:

```javascript
{
    success: true/false,           // Overall success status
    passed: 5,                     // Number of passed tests
    failed: 1,                     // Number of failed tests
    skipped: 2,                    // Number of skipped tests
    duration: 12345,               // Duration in milliseconds
    error: 'Error message or null', // Overall error (if any)
    stack: 'Stack trace',          // Stack trace (if error)
    tests: [                       // Array of individual test results
        {
            name: 'Test name',
            passed: true/false,
            skipped: true/false,
            error: 'Error message or null',
            device: 'Device name',
            details: { /* optional */ }
        }
    ]
}
```

## Debugging

The test runner provides detailed error reporting:

- **Device Context**: Each test result includes the device name
- **Error Messages**: Clear error messages with context
- **Stack Traces**: Full stack traces for debugging
- **Progress Indicators**: Shows which device is being tested
- **Structured Output**: Easy to parse and analyze

## Notes

- Tests require actual Meross devices to be available in your account
- Tests will skip if no suitable devices are found
- Some tests may take longer due to device operations (e.g., garage doors, roller shutters)
- Push notification tests may require special setup
- All tests use explicit dependency injection - no globals or environment variables

## Migration from Old System

The old test system used Mocha/Chai and global variables. The new system:

- ✅ No Mocha dependency
- ✅ No global variables
- ✅ Explicit dependency injection
- ✅ Better error reporting
- ✅ Structured results
- ✅ Easier to debug

See `test-template.js` for a complete example of the new structure.
