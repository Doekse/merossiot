# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-01-20

### Changed
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

### Added
- System device tests (`test-system.js`)

## [0.5.0] - 2026-01-19

### Changed
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

### Added
- Enhanced error context through error chaining via `cause` property
- Error serialization support via `toJSON()` method on all error classes
- Lazy-loaded manager modules for better code organization and performance

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

