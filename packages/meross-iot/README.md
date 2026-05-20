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
npm install meross-iot@0.10.0
```

## Usage & Documentation

Runnable examples live in the GitHub repo under [`packages/meross-iot/example/`](https://github.com/Doekse/merossiot/tree/main/packages/meross-iot/example). See [example/README.md](https://github.com/Doekse/merossiot/blob/main/packages/meross-iot/example/README.md) for the full table (not included in the npm tarball).

If you are really impatient to use this library, refer to the following snippet of code that looks for a device and turns it on/off.

```javascript
const Meross = require('meross-iot');

(async () => {
  const meross = await Meross.connect({
    email: 'your@email.com',
    password: 'yourpassword',
  });

  const devices = meross.devices.list();
  if (devices.length > 0) {
    const device = devices[0];
    if (device.toggle) {
      await device.toggle.set({ channel: 0, on: true });
    }
  }
})();
```

Clone the repo or browse GitHub for runnable scripts. Highlights:

- **`basic-usage.js`** — `Meross.connect()` and list devices
- **`authenticate.js`** — `Meross.authenticate()` then selective `connect()`
- **`device-control.js`** — Feature objects: `toggle`, `light`, `electricity`, `system`
- **`device-discovery.js`** — `discover` / `discoverSubdevices` and `initializeDevice`
- **`event-handling.js`** — Manager lifecycle events and `meross.subscription` updates
- **`subscription-manager.js`** — `meross.subscription` polling and list updates
- **`token-reuse.js`** — Persist `getTokenData()` between runs

## Adding and Removing Devices

You can dynamically add and remove devices from the manager after initialization:

```javascript
// Add a single device
const device = await meross.devices.initializeDevice('device-uuid');

// Add a subdevice (hub will be auto-initialized if needed)
const subdevice = await meross.devices.initializeDevice({
  hubUuid: 'hub-uuid',
  id: 'subdevice-id'
});

// Remove a device
const removed = await meross.devices.remove('device-uuid');

// Remove a subdevice
const removed = await meross.devices.remove({
  hubUuid: 'hub-uuid',
  id: 'subdevice-id'
});
```

When removing a hub device, all its subdevices are automatically removed as well.

## API Organization

The library follows a modular architecture with specialized managers on the connected `Meross` instance:

- **`meross.devices`** — device discovery, initialization, and lifecycle management
- **`meross.mqtt`** — MQTT connection management and message publishing
- **`meross.http`** — LAN HTTP communication with devices
- **`meross.transport`** — transport mode selection and message routing
- **`meross.subscription`** — automatic polling and unified update streams
- **`meross.statistics`** — optional HTTP/MQTT request diagnostics

Most apps use feature objects on devices (`device.toggle.set()`, etc.). Lower-level managers (`mqtt`, `http`, `transport`) remain available for advanced use:

```javascript
// Discover devices without initializing (after Meross.authenticate)
const availableDevices = await meross.devices.discover({ onlineOnly: true });

// Initialize all or selected devices
const count = await meross.devices.initialize();

// Prefer feature API for everyday control
await device.toggle.set({ channel: 0, on: true });

// Transport mode (MQTT vs LAN-first)
meross.transport.defaultMode = Meross.TransportMode.LAN_HTTP_FIRST;
```

## Receiving device updates

Subscribe through **`meross.subscription`** — not `device.on('stateChange')` or `meross.on('deviceUpdate')` (those are internal wiring).

```javascript
const sub = meross.subscription;

// Hub UUID covers the hub and all subdevices (shared MQTT connection).
sub.subscribe(hub, { pushOnly: true });

sub.on(`deviceUpdate:${hub.uuid}`, (update) => {
  // update.device — hub or subdevice that changed
  // update.source — 'push' | 'poll' | …
  // update.state — full cached state of update.device
  // update.changes — changed slices only
});

sub.subscribeToDeviceList();
sub.on('deviceListUpdate', (diff) => {
  // diff.added, diff.removed, diff.changed
});
```

See `example/event-handling.js`, `example/subscription-manager.js`, and `example/hub-devices.js`.

Manager lifecycle (`deviceReady`, `connected`, `disconnected`) stays on the root `meross` instance.

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

See **[CHANGELOG.md](CHANGELOG.md)** for the full release history.

### [0.10.0] - 2026-05-19

Major API simplification release. Highlights:

#### Added
- `Meross.authenticate()` and `Meross.connect()` static entry points
- Multi-channel `getAll()` on toggle, timer, and trigger abilities
- Namespace dispatcher with header-timestamp ordering for state updates
- Unit test suite (198 tests)

#### Changed
- **BREAKING**: `ManagerMeross` → `Meross`; removed public `MerossHttpClient` export
- **BREAKING**: Consolidated error classes (`MerossAuthError`, `MerossDeviceError`, etc.) with string `code` discriminators
- **BREAKING**: `device.getUnifiedState()` → `device.getState()`; `deviceInitialized` → `ready` / `deviceReady`
- **BREAKING**: Conditional ability initialization; trimmed public module exports
- Internal layout: `lib/abilities/`, `manager/`, `lib/device/`

<details>
<summary>Older releases</summary>

### [0.9.1] - 2026-01-22

#### Fixed
- Improve heartbeat offline detection by using response silence (≥ heartbeat interval) instead of treating individual command errors/timeouts as offline signals

### [0.9.0] - 2026-01-22

#### Added
- Signal strength property (`device.signalStrength`) from Appliance.System.Runtime
  - Provides signal strength percentage (1-100) on production firmware
  - Automatically updated when runtime data is fetched
  - Available in TypeScript definitions
- Runtime polling support in ManagerSubscription
  - Added `runtimeInterval` option (default: 60000ms) for periodic runtime data polling
  - Runtime data (signal strength, network type, IoT status) requires polling as it doesn't support push notifications
  - Respects smart caching configuration to reduce network traffic
  - Polling automatically skips when device is offline

### [0.8.0] - 2026-01-22

#### Added
- Device initialization tracking with `deviceInitialized` event and `ready()` method
  - Device emits `deviceInitialized` event after receiving System.All data
  - `device.ready()` returns a promise that resolves when device is fully initialized
  - Initialization timeout detection with `MerossErrorInitialization` error
- Heartbeat monitoring utility for online/offline detection
  - Periodic heartbeat checks to monitor device connectivity
  - Tracks command responses and failures to detect connectivity issues
  - Updates device online status when connectivity problems are detected
  - Uses exponential backoff when device is offline
- Alarm control methods for alarm devices (e.g., MSH450 Internal Siren)
  - `alarm.set()` method to control alarm on/off state with optional duration
  - `alarm.setConfig()` method to configure alarm volume, tone, and enable state
  - Updated TypeScript definitions for new alarm methods
- Additional device property tracking
  - Track chipType, homekitVersion, wifi info, network stats
  - Extract network properties from System.Debug responses (RSSI, signal, SSID, channel, SNR, etc.)
  - Property update logic moved to system feature module

#### Changed
- Moved System.All handling to system feature module
  - System.All property extraction logic moved from device.js to system feature
  - System feature handles hardware, firmware, and network property updates
  - Device delegates System.All updates to system feature module
- Skip polling for offline devices in subscription manager
  - Polling methods check online status before making requests
  - Avoids API calls when devices are known to be offline

#### Fixed
- DND capability check now uses `Appliance.System.DNDMode` namespace (was incorrectly using `Appliance.Control.DNDMode`)
- Prevent redundant ability updates when abilities haven't changed
- Device initialization event now properly emitted by device itself after System.All is received

### [0.7.2] - 2026-01-21

#### Changed
- Optimized ManagerSubscription polling behavior for better efficiency
  - Changed default `deviceStateInterval` from 30000ms to 0 (push-only by default after initial state)
  - Device state is now polled once on initial subscription to establish baseline, then relies on push notifications
  - Implemented per-namespace push tracking instead of global push active state for more granular control
  - Removed unnecessary push-active checks from electricity/consumption polling (these features don't support push notifications)
  - Polling now skips when recent push notifications were received for the specific namespace being polled

#### Added
- Added `pushNotificationReceived` event to MerossDevice that emits the namespace for push activity tracking
  - Allows subscription manager to track push notifications per-namespace for selective polling optimization

#### Fixed
- Removed default channel initialization for subdevices that could cause incorrect channel setup

### [0.7.1] - 2026-01-21

#### Fixed
- Prefer Consumption/ConsumptionX/ConsumptionH in the right order and fallback sequence when fetching usage history
- Poll electricity via the feature-based API and honor channel cache data in ManagerSubscription

### [0.7.0] - 2026-01-20

#### Added
- Normalized device capabilities map (`device.capabilities`)
  - Provides user-friendly capability discovery without needing to know Meross namespace strings
  - Includes channel information and feature-specific capabilities (toggle, light, thermostat, etc.)
  - Each feature now exports `getCapabilities()` function to provide capability information
  - Capabilities are automatically built when device abilities are updated
  - TypeScript definitions updated with `DeviceCapabilities` interface

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
