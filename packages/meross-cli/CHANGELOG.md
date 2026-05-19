# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-05-19

### Added
- `cli/utils/device.js` helpers for multi-channel control defaults (`getChannelIds`, `getPrimaryChannel`, `resolveControlChannel`)
- Optional `subdeviceId` support in `executeControlCommand` for hub subdevice control

### Changed
- **BREAKING**: Updated for `meross-iot` v0.10.0 API simplification
  - Uses `Meross` default export with `Meross.connect()` / `Meross.authenticate()` entry points
  - Interactive menu authenticates before selective device initialization
  - Error handling uses consolidated `MerossError` hierarchy and `error.code` discriminators
  - Device initialization events: `deviceReady` / `ready` instead of `deviceInitialized`
  - Status and tests use `device.getState()` instead of `getUnifiedState()`
  - Transport and statistics accessed via `meross.transport` and `meross.statistics`
- Status display aligned with ability-based state and multi-channel feature helpers
- `mqtt` command reads connection state from `meross.mqtt.connections`
- Integration tests drop defensive fallbacks; failures surface real API errors

### Fixed
- Hub status display no longer calls redundant `getBattery`
- Thermostat status section indentation in `device-status.js`
- `execute.js` errors aligned with `meross-iot` exception types

## [0.6.1] - 2026-01-22

### Changed
- Code formatting improvements (removed trailing whitespace)

## [0.6.0] - 2026-01-20

### Added
- Enhanced `info` command with normalized capabilities display
  - Displays user-friendly device capabilities using the new `device.capabilities` map
  - Shows channel information and supported features in an organized format
  - Verbose mode support for displaying raw abilities (namespaces) when `MEROSS_VERBOSE=true` is set

## [0.5.0] - 2026-01-20

### Changed
- **BREAKING**: Updated to use feature-based API architecture from `meross-iot` v0.6.0
  - Updated all commands and helpers to use new feature-based API (`device.feature.method()`)
  - Updated all test files to use new API structure
  - Breaking changes include:
    - `device.setLightColor()` → `device.light.set()`
    - `device.getLightState()` → `device.light.get()`
    - Similar changes for all features (toggle, thermostat, etc.)

## [0.4.0] - 2026-01-19

### Changed
- **BREAKING**: Updated to use new manager module structure from `meross-iot` v0.5.0
  - Updated to use manager properties (`manager.devices`, `manager.mqtt`, `manager.http`, etc.) instead of direct methods
  - Updated all commands and helpers to use new property-based access patterns
- **BREAKING**: Updated to use standardized error handling from `meross-iot` v0.5.0
  - Updated to use new `MerossError*` error class names
  - Replaced inline error handling with centralized `handleError()` function
  - All error handling now uses the new error handler utility for consistent, user-friendly formatted messages

### Added
- Centralized error handler utility (`cli/utils/error-handler.js`) with formatted error messages
- Enhanced error display with better context and user-friendly formatting

## [0.3.0] - 2026-01-16

### Changed
- **BREAKING**: Updated to use simplified device API from `meross-iot` v0.4.0
  - Updated to use `initializeDevices()` instead of `getDevices()`
  - Updated to use direct device properties instead of `cachedHttpInfo`
  - Updated to use camelCase property names consistently
  - Updated all tests and commands to use new API patterns

## [0.2.0] - 2026-01-15

### Changed
- **BREAKING**: Updated to use new Manager-prefix naming pattern from `meross-iot` package
  - `MerossManager` → `ManagerMeross` (internal usage)
  - `SubscriptionManager` → `ManagerSubscription` (internal usage)
- **BREAKING**: Updated to use new property-based access patterns from `meross-iot` package
  - Uses `meross.subscription` instead of `getSubscriptionManager()`
  - Uses `meross.devices.get()`, `meross.devices.find()`, and `meross.devices.list()` instead of wrapper methods

## [0.1.0] - 2026-01-10

### Added
- Initial release of Meross CLI tool
- Interactive command-line interface for Meross device management
- Device listing and discovery
- Device information and status commands
- Device control commands with interactive menus
- Support for various device types (switches, lights, thermostats, sensors, etc.)
- Hub device and subdevice support
- MQTT event monitoring
- Device testing functionality
- Statistics tracking and display
- Environment variable support for credentials
- Token caching and reuse

### Known Issues
- This is an initial, pre-stable release. Please expect bugs.
- Some edge cases may not be fully handled yet.
