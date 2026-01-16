# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-01-16

### Changed
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

### Updated
- Updated all examples to use camelCase consistently
- Updated all examples to use `initializeDevices()` instead of `getDevices()`

## [0.3.1] - 2026-01-15

### Fixed
- Fixed `ManagerSubscription` constructor bug: now properly calls `super()` before accessing `this` to correctly initialize EventEmitter parent class

## [0.3.0] - 2026-01-15

### Changed
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

### Added
- Property access to subscription manager: `meross.subscription` returns `ManagerSubscription` instance
- Property access to device registry: `meross.devices` returns `DeviceRegistry` instance with full API access
- Unified `get()` method in DeviceRegistry supporting both base devices and subdevices
- Constructor option `subscription` for configuring subscription manager during initialization

## [0.2.1] - 2026-01-14

### Fixed
- Fixed syntax error in `example/device-control.js` - missing closing brace for `deviceInitialized` event handler

## [0.2.0] - 2026-01-14

### Changed
- **BREAKING**: `SubscriptionManager` now uses EventEmitter pattern instead of callbacks
  - `subscribe(device, config, onUpdate)` → `subscribe(device, config)` (no callback, no return value)
  - `unsubscribe(deviceUuid, subscriptionId)` → `unsubscribe(deviceUuid)` (no subscription ID needed)
  - `subscribeToDeviceList(onUpdate)` → `subscribeToDeviceList()` (no callback, no return value)
  - `unsubscribeFromDeviceList(subscriptionId)` → `unsubscribeFromDeviceList()` (no subscription ID needed)
  - Listen for updates using: `on('deviceUpdate:${deviceUuid}', handler)` and `on('deviceListUpdate', handler)`
  - Use standard EventEmitter methods: `on()`, `once()`, `off()`, `removeAllListeners()`
  - Configuration is now per-device subscription (merged aggressively) rather than per-listener

### Added
- `subscription-manager.js` example demonstrating EventEmitter-based SubscriptionManager usage
- Enhanced documentation for SubscriptionManager with JSDoc comments explaining implementation rationale

## [0.1.0] - 2026-01-10

### Added
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

### Known Issues
- This is an initial, pre-stable release. Please expect bugs. 
- Some edge cases may not be fully handled yet.

