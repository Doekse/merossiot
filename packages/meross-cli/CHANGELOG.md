# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
