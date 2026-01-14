# MerossIot

![npm version (alpha)](https://img.shields.io/npm/v/meross-iot/alpha)
![GitHub release](https://img.shields.io/github/v/release/Doekse/merossiot?include_prerelease)
![npm downloads](https://img.shields.io/npm/dm/meross-iot)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![alpha](https://img.shields.io/badge/status-alpha-red.svg)

A Node.js library for controlling Meross cloud devices. This library allows you to login into Meross cloud server, read registered devices, and open connections to the MQTT cloud server to get device data.

This code tries to closely mirror the [MerossIot Python project](https://github.com/albertogeniola/MerossIot) to provide a similar API and functionality for Node.js. This library was created for use in creating a Meross integration for the [Homey](https://homey.app) smart home platform.

The library can control devices locally via HTTP or via cloud MQTT server.

## Requirements

- Node.js >= 18

## Installation

**⚠️ Pre-release**: This is currently an unstable pre-release. Use with caution.

```bash
# Install alpha version
npm install meross-iot@alpha

# Or install specific version
npm install meross-iot@0.2.0
```

## Usage & Documentation

Refer to the [example/README.md](example/README.md) for detailed usage instructions, or simply have a look at the `/example` directory.

If you are really impatient to use this library, refer to the following snippet of code that looks for a device and turns it on/off.

```javascript
const { MerossManager, MerossHttpClient } = require('meross-iot');

(async () => {
  // Create HTTP client using factory method
  const httpClient = await MerossHttpClient.fromUserPassword({
    email: 'your@email.com',
    password: 'yourpassword'
  });

  // Create manager with HTTP client
  const meross = new MerossManager({
    httpClient: httpClient
  });

  // Listen for device events
  meross.on('deviceInitialized', (deviceId, deviceDef, device) => {
    console.log(`Device found: ${deviceDef.devName} (${deviceDef.deviceType})`);
  });

  // Connect and discover devices
  await meross.connect();
  
  // Find a device and control it
  const devices = meross.getAllDevices();
  if (devices.length > 0) {
    const device = devices[0];
    
    // Example: Toggle a switch
    if (device.abilities && device.abilities['Appliance.Control.ToggleX']) {
      await device.setToggleX({ channel: 0, onoff: true }); // Turn on channel 0
    }
  }
})();
```

The `example/` directory contains focused examples for different use cases:
- **`basic-usage.js`** - Simple connection and device discovery
- **`device-control.js`** - Controlling switches, lights, and monitoring devices
- **`event-handling.js`** - Handling events from devices and the manager
- **`subscription-manager.js`** - Automatic polling and unified update streams with SubscriptionManager
- **`token-reuse.js`** - Saving and reusing authentication tokens
- **`statistics.js`** - Enabling and viewing API call statistics
- **`error-handling.js`** - Comprehensive error handling and MFA
- **`hub-devices.js`** - Working with hub devices and subdevices
- **`transport-modes.js`** - Understanding different transport modes
- **`multiple-accounts.js`** - Using multiple Meross accounts simultaneously
- **`factory-pattern-usage.js`** - Recommended factory pattern for creating HTTP clients and managers
- **`timer-usage.js`** - Creating and managing device timers

## Supported Devices

This library should support al wifi based devices Meross currently has on the market. I've tested the code with the following devices: 

- MSS315 Smart Wi-Fi Plug Mini
- MSP844 Smart Fast Charging Power Strip
- MS130H Smart Temperature and Humidity Sensor Kit
- MS600 Smart Presence Sensor
- MOP320MA Smart Outdoor Plug with Energy Monitor
- MSS815MA Smart in-Wall Switch
- MSS715MA Smart DIY Switch with Energy Monitor
- MTS215MA Smart Thermostat
- MA151H Smart Smoke Alarm  
- MSH450 Smart Hub
- MSH400HK Smart Hub
- MSH300HK Smart Hub
- MSL120HK Smart LED Light Bulb Pro
- MSL100HK Smart LED Light Bulb
- MS400H Smart Water Leak Sensor


## Unsupported Device?

If your device is not supported or you're experiencing issues with a specific device, you may ask the developers to add specific support for that device. To do so, you will need to "sniff" low-level communication between your Meross App and the specific device. Such data can help the developers to add support for that device.

Please create an issue on GitHub and include:
- Device model name/number
- Device type
- Any error messages or unexpected behavior
- Sniffed device data (if available)

[Create an issue →](https://github.com/Doekse/merossiot/issues)

## Changelog

### [0.2.1] - 2026-01-14

#### Fixed
- Fixed syntax error in `device-control.js` example - missing closing brace for `deviceInitialized` event handler

### [0.2.0] - 2026-01-14

#### Changed
- **BREAKING**: `SubscriptionManager` now uses EventEmitter pattern instead of callbacks
  - `subscribe(device, config, onUpdate)` → `subscribe(device, config)` (no callback, no return value)
  - `unsubscribe(deviceUuid, subscriptionId)` → `unsubscribe(deviceUuid)` (no subscription ID needed)
  - `subscribeToDeviceList(onUpdate)` → `subscribeToDeviceList()` (no callback, no return value)
  - `unsubscribeFromDeviceList(subscriptionId)` → `unsubscribeFromDeviceList()` (no subscription ID needed)
  - Listen for updates using: `on('deviceUpdate:${deviceUuid}', handler)` and `on('deviceListUpdate', handler)`
  - Use standard EventEmitter methods: `on()`, `once()`, `off()`, `removeAllListeners()`
  - Configuration is now per-device subscription (merged aggressively) rather than per-listener

#### Added
- `subscription-manager.js` example demonstrating EventEmitter-based SubscriptionManager usage
- Enhanced documentation for SubscriptionManager with JSDoc comments explaining implementation rationale

### [0.1.0] - 2026-01-10

#### Added
- Initial release of MerossIot Node.js library
- Meross Cloud authentication and token management
- Device discovery and enumeration
- MQTT cloud server connection support
- HTTP local device control support
- Support for various device types (switches, lights, sensors, etc.)
- Hub device and subdevice support
- Event handling for device updates and state changes
- Error handling with comprehensive error types
- Statistics tracking for API calls
- Command-line interface (CLI) for testing and debugging
- TypeScript type definitions
- Examples in the `example/` directory

#### Known Issues
- This is an initial, pre-stable release. Please expect bugs. 
- Some edge cases may not be fully handled yet.

<details>
<summary>Older</summary>

<!-- Older changelog entries will appear here -->

</details>

## Disclaimer

**All product and company names or logos are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them or any associated subsidiaries! This personal project is maintained in spare time and has no business goal.**
**MEROSS is a trademark of Chengdu Meross Technology Co., Ltd.**
