# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This is a monorepo containing multiple packages. For detailed changelogs, see:
- [meross-iot CHANGELOG](./packages/meross-iot/CHANGELOG.md)
- [meross-cli CHANGELOG](./packages/meross-cli/CHANGELOG.md)

## [Unreleased]

## [0.2.0] - 2026-01-XX

### Changed
- **BREAKING**: `SubscriptionManager` API refactored to use EventEmitter pattern (see `packages/meross-iot/CHANGELOG.md` for details)

## [0.1.0] - 2026-01-10

### Added
- Initial release of MerossIot monorepo
- Meross IoT library (`meross-iot`) for Node.js
- Command-line interface (`meross-cli`) for device management
- Meross Cloud authentication and token management
- Device discovery and enumeration
- MQTT cloud server connection support
- HTTP local device control support
- Support for various device types (switches, lights, sensors, etc.)
- Hub device and subdevice support
- Event handling for device updates and state changes
- TypeScript type definitions
- Examples and documentation

### Known Issues
- This is an initial, pre-stable release. Please expect bugs.
- Some edge cases may not be fully handled yet.
