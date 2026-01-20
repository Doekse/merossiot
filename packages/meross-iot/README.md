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
npm install meross-iot@0.6.0
```

## Usage & Documentation

Refer to the [example/README.md](example/README.md) for detailed usage instructions, or simply have a look at the `/example` directory.

If you are really impatient to use this library, refer to the following snippet of code that looks for a device and turns it on/off.

```javascript
const { ManagerMeross, MerossHttpClient } = require('meross-iot');

(async () => {
  // Create HTTP client using factory method
  const httpClient = await MerossHttpClient.fromUserPassword({
    email: 'your@email.com',
    password: 'yourpassword'
  });

  // Create manager with HTTP client
  const meross = new ManagerMeross({
    httpClient: httpClient
  });

  // Listen for device events
  meross.on('deviceInitialized', (deviceId, device) => {
    console.log(`Device found: ${device.name} (${device.deviceType})`);
  });

  // Connect and discover devices
  await meross.connect();
  
  // Find a device and control it
  const devices = meross.devices.list();
  if (devices.length > 0) {
    const device = devices[0];
    
    // Example: Toggle a switch
    if (device.toggle) {
      await device.toggle.set({ channel: 0, on: true }); // Turn on channel 0
    }
  }
})();
```

The `example/` directory contains focused examples for different use cases:
- **`basic-usage.js`** - Simple connection and device discovery
- **`device-control.js`** - Controlling switches, lights, and monitoring devices
- **`event-handling.js`** - Handling events from devices and the manager
- **`subscription-manager.js`** - Automatic polling and unified update streams with ManagerSubscription
- **`token-reuse.js`** - Saving and reusing authentication tokens
- **`statistics.js`** - Enabling and viewing API call statistics
- **`error-handling.js`** - Comprehensive error handling and MFA
- **`hub-devices.js`** - Working with hub devices and subdevices
- **`transport-modes.js`** - Understanding different transport modes
- **`multiple-accounts.js`** - Using multiple Meross accounts simultaneously
- **`factory-pattern-usage.js`** - Recommended factory pattern for creating HTTP clients and managers
- **`timer-usage.js`** - Creating and managing device timers
- **`selective-initialization.js`** - Selectively initializing devices and subdevices

## Adding and Removing Devices

You can dynamically add and remove devices from the manager after initialization:

```javascript
// Add a single device
const device = await manager.devices.initializeDevice('device-uuid');

// Add a subdevice (hub will be auto-initialized if needed)
const subdevice = await manager.devices.initializeDevice({ 
  hubUuid: 'hub-uuid', 
  id: 'subdevice-id' 
});

// Remove a device
const removed = await manager.devices.remove('device-uuid');

// Remove a subdevice
const removed = await manager.devices.remove({ 
  hubUuid: 'hub-uuid', 
  id: 'subdevice-id' 
});
```

When removing a hub device, all its subdevices are automatically removed as well.

## API Organization

The library follows a modular architecture with specialized managers for different concerns:

- **`manager.devices`** - Device discovery, initialization, and lifecycle management
- **`manager.mqtt`** - MQTT connection management and message publishing
- **`manager.http`** - LAN HTTP communication with devices
- **`manager.transport`** - Transport mode selection and message routing
- **`manager.subscription`** - Automatic polling and unified update streams

This organization makes the API more discoverable and easier to use. For example:

```javascript
// Discover devices without initializing
const availableDevices = await manager.devices.discover({ onlineOnly: true });

// Initialize devices
const count = await manager.devices.initialize();

// Encode and send a message via MQTT
const data = manager.mqtt.encode('GET', 'Appliance.Control.ToggleX', {}, device.uuid);
manager.mqtt.send(device, data);

// Send a message via LAN HTTP
await manager.http.send(device, '192.168.1.100', data);

// Use transport manager for automatic routing
await manager.transport.request(device, '192.168.1.100', data);
```

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

### [0.6.0] - 2026-01-20

#### Changed
- **BREAKING**: Migrated to feature-based API architecture
  - Converted all device methods to feature-based API (`device.feature.method()`)
  - Replaced direct feature imports with factory functions
  - Standardized `get()`/`set()` methods across all 27 features
  - Updated all test files to use new API
  - Updated TypeScript definitions for new API structure
  - Added system device tests (`test-system.js`)
  - Breaking changes include:
    - `device.setLightColor()` → `device.light.set()`
    - `device.getLightState()` → `device.light.get()`
    - Similar changes for all features (toggle, thermostat, etc.)
- Standardized error naming in JSDoc comments to use MerossError* convention
  - Replace shortened error names (HttpApiError, TokenExpiredError, etc.) with full MerossError* names
  - Replace generic {Error} references with specific MerossError* classes where appropriate
  - Fix incorrect import paths in feature files to use MerossError* naming
  - Update all @throws annotations to consistently use MerossError* naming convention

#### Added
- System device tests (`test-system.js`)

### [0.5.0] - 2026-01-19

#### Changed
- **BREAKING**: Standardized error handling with MerossError* naming convention
  - Renamed all error classes to use `MerossError*` prefix for consistency
    - `AuthenticationError` → `MerossErrorAuthentication`
    - `ConnectionError` → `MerossErrorConnection`
    - `DeviceError` → `MerossErrorDevice`
    - `HttpError` → `MerossErrorHttp`
    - `MqttError` → `MerossErrorMqtt`
    - `NetworkError` → `MerossErrorNetwork`
    - `ProtocolError` → `MerossErrorProtocol`
    - `TimeoutError` → `MerossErrorTimeout`
    - `TokenError` → `MerossErrorToken`
    - `ValidationError` → `MerossErrorValidation`
  - All error classes now include `code`, `isOperational`, and `cause` properties
  - Added `toJSON()` method to all error classes for serialization
  - Updated TypeScript definitions to match new error structure
  - Updated error-handling example to use new error class names
- **BREAKING**: Split ManagerMeross into separate lazy-loaded manager modules
  - Manager methods are now accessed via manager properties instead of direct methods:
    - `manager.devices` - device discovery and initialization (ManagerDevices)
    - `manager.mqtt` - MQTT connection management (ManagerMqtt)
    - `manager.http` - LAN HTTP communication (ManagerHttp)
    - `manager.transport` - transport mode selection and routing (ManagerTransport)
    - `manager.statistics` - statistics tracking (ManagerStatistics)
    - `manager.subscription` - device update subscriptions (ManagerSubscription)
  - Extracted DeviceRegistry to standalone module
  - Moved subscription manager to `managers/` directory
  - Updated all examples and TypeScript definitions for new API

#### Added
- Enhanced error context through error chaining via `cause` property
- Error serialization support via `toJSON()` method on all error classes
- Lazy-loaded manager modules for better code organization and performance

<details>
<summary>Older</summary>

### [0.5.0] - 2026-01-19

#### Changed
- **BREAKING**: Standardized error handling with MerossError* naming convention
  - Renamed all error classes to use `MerossError*` prefix for consistency
    - `AuthenticationError` → `MerossErrorAuthentication`
    - `ConnectionError` → `MerossErrorConnection`
    - `DeviceError` → `MerossErrorDevice`
    - `HttpError` → `MerossErrorHttp`
    - `MqttError` → `MerossErrorMqtt`
    - `NetworkError` → `MerossErrorNetwork`
    - `ProtocolError` → `MerossErrorProtocol`
    - `TimeoutError` → `MerossErrorTimeout`
    - `TokenError` → `MerossErrorToken`
    - `ValidationError` → `MerossErrorValidation`
  - All error classes now include `code`, `isOperational`, and `cause` properties
  - Added `toJSON()` method to all error classes for serialization
  - Updated TypeScript definitions to match new error structure
  - Updated error-handling example to use new error class names
- **BREAKING**: Split ManagerMeross into separate lazy-loaded manager modules
  - Manager methods are now accessed via manager properties instead of direct methods:
    - `manager.devices` - device discovery and initialization (ManagerDevices)
    - `manager.mqtt` - MQTT connection management (ManagerMqtt)
    - `manager.http` - LAN HTTP communication (ManagerHttp)
    - `manager.transport` - transport mode selection and routing (ManagerTransport)
    - `manager.statistics` - statistics tracking (ManagerStatistics)
    - `manager.subscription` - device update subscriptions (ManagerSubscription)
  - Extracted DeviceRegistry to standalone module
  - Moved subscription manager to `managers/` directory
  - Updated all examples and TypeScript definitions for new API

#### Added
- Enhanced error context through error chaining via `cause` property
- Error serialization support via `toJSON()` method on all error classes
- Lazy-loaded manager modules for better code organization and performance

### [0.4.0] - 2026-01-16

#### Changed
- **BREAKING**: Renamed `getDevices()` to `initializeDevices()` in `ManagerMeross`
  - The method name better reflects that it performs full device discovery, initialization, and connection setup, not just retrieval
  - Updated `login()` and `connect()` to use `initializeDevices()`
  - Updated all examples and TypeScript definitions
- **BREAKING**: Simplified device API by establishing single source of truth
  - Removed `deviceDef` parameter from `deviceInitialized` event - now just `(deviceId, device)`
  - Removed `cachedHttpInfo` property; all properties are now directly accessible on `MerossDevice`
  - Converted simple getters to direct properties (`macAddress`, `lanIp`, `mqttHost`, etc.)
  - Updated all feature files to use public properties (`abilities`, `lastFullUpdateTimestamp`)
  - Removed unnecessary defensive fallback patterns (`device.dev?.uuid` → `device.uuid`)
  - Fixed subdevice property consistency
- **BREAKING**: Removed snake_case handling, standardized on camelCase
  - Removed snake_case property mappings from `HttpDeviceInfo`, `HttpSubdeviceInfo`, `HardwareInfo`, `FirmwareInfo`, and `TimeInfo`
  - Updated filter parameters to camelCase (`deviceUuids`, `deviceType`, `onlineStatus`, etc.)
  - Changed `subdevice_id` getter to `subdeviceId` in push notification classes
  - Updated `TokenData` interface: `issued_on` → `issuedOn`
  - All JSDoc comments now reflect direct camelCase acceptance

#### Updated
- Updated all examples to use camelCase consistently
- Updated all examples to use `initializeDevices()` instead of `getDevices()`

### [0.3.1] - 2026-01-15

#### Fixed
- Fixed `ManagerSubscription` constructor bug: now properly calls `super()` before accessing `this` to correctly initialize EventEmitter parent class

### [0.3.0] - 2026-01-15

#### Changed
- **BREAKING**: Renamed core classes to follow Manager-prefix naming pattern
  - `MerossManager` → `ManagerMeross` (all imports/exports)
  - `SubscriptionManager` → `ManagerSubscription` (all imports/exports)
- **BREAKING**: Replaced method-based access with property-based access patterns
  - Removed `getSubscriptionManager()` method - use `meross.subscription` property instead
  - Removed wrapper methods - use `meross.devices.*` instead:
    - `getDevice(uuid)` → `meross.devices.get(uuid)`
    - `findDevices(filters)` → `meross.devices.find(filters)`
    - `getAllDevices()` → `meross.devices.list()`
- **BREAKING**: Unified device lookup API in DeviceRegistry
  - Removed `lookupByUuid()` and `lookupByInternalId()` from public API
  - Added unified `get(identifier)` method that handles both base devices and subdevices:
    - Base devices: `meross.devices.get('device-uuid')`
    - Subdevices: `meross.devices.get({ hubUuid: 'hub-uuid', id: 'subdevice-id' })`
- **BREAKING**: Renamed DeviceRegistry methods for cleaner API
  - `getAllDevices()` → `list()` (returns all devices)
  - `findDevices(filters)` → `find(filters)` (search/filter devices)

#### Added
- Property access to subscription manager: `meross.subscription` returns `ManagerSubscription` instance
- Property access to device registry: `meross.devices` returns `DeviceRegistry` instance with full API access
- Unified `get()` method in DeviceRegistry supporting both base devices and subdevices
- Constructor option `subscription` for configuring subscription manager during initialization

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

</details>

## Disclaimer

**All product and company names or logos are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them or any associated subsidiaries! This personal project is maintained in spare time and has no business goal.**
**MEROSS is a trademark of Chengdu Meross Technology Co., Ltd.**
