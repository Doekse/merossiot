# Meross CLI

![npm version (alpha)](https://img.shields.io/npm/v/meross-cli/alpha)
![GitHub release](https://img.shields.io/github/v/release/Doekse/merossiot?include_prerelease)
![npm downloads](https://img.shields.io/npm/dm/meross-cli)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![alpha](https://img.shields.io/badge/status-alpha-red.svg)

Command-line interface for controlling and managing Meross smart home devices.

**⚠️ Pre-release**: This is currently an unstable pre-release. Use with caution.

## Requirements

- Node.js >= 18
- `meross-iot` library (installed automatically as a dependency)

## Installation

```bash
# Install alpha version globally
npm install -g meross-cli@alpha

# Or install specific version
npm install -g meross-cli@0.6.0
```

Or use via npx:

```bash
npx meross-cli@alpha
```

## Usage & Documentation

The CLI provides interactive commands for:
- Listing devices
- Getting device status and information
- Testing device functionality
- Listening to device events
- Viewing statistics
- Controlling devices

### Quick Start

```bash
# List all devices
meross-cli list --email user@example.com --password mypass

# Get device information
meross-cli info <uuid> --email user@example.com --password mypass

# Get device status
meross-cli status --email user@example.com --password mypass

# Control a device
meross-cli control <uuid> toggle.set --channel 0 --on true

# Start interactive menu mode
meross-cli
```

### Environment Variables

You can set these environment variables instead of using command-line options:

- `MEROSS_EMAIL` - Meross account email
- `MEROSS_PASSWORD` - Meross account password
- `MEROSS_MFA_CODE` - Multi-factor authentication code
- `MEROSS_TOKEN_DATA` - Path to token data JSON file
- `MEROSS_API_URL` - Meross API base URL (optional)

## Supported Devices

The CLI supports all devices that are supported by the underlying `meross-iot` library. See the [meross-iot README](../meross-iot/README.md) for a list of supported devices.

## Changelog

### [0.6.0] - 2026-01-20

#### Added
- Enhanced `info` command with normalized capabilities display
  - Displays user-friendly device capabilities using the new `device.capabilities` map
  - Shows channel information and supported features in an organized format
  - Verbose mode support for displaying raw abilities (namespaces) when `MEROSS_VERBOSE=true` is set

<details>
<summary>Older</summary>

### [0.5.0] - 2026-01-20

#### Changed
- **BREAKING**: Updated to use feature-based API architecture from `meross-iot` v0.6.0
  - Updated all commands and helpers to use new feature-based API (`device.feature.method()`)
  - Updated all test files to use new API structure
  - Breaking changes include:
    - `device.setLightColor()` → `device.light.set()`
    - `device.getLightState()` → `device.light.get()`
    - Similar changes for all features (toggle, thermostat, etc.)

### [0.4.0] - 2026-01-19

#### Changed
- **BREAKING**: Updated to use new manager module structure from `meross-iot` v0.5.0
  - Updated to use manager properties (`manager.devices`, `manager.mqtt`, `manager.http`, etc.) instead of direct methods
  - Updated all commands and helpers to use new property-based access patterns
- **BREAKING**: Updated to use standardized error handling from `meross-iot` v0.5.0
  - Updated to use new `MerossError*` error class names
  - Replaced inline error handling with centralized `handleError()` function
  - All error handling now uses the new error handler utility for consistent, user-friendly formatted messages

#### Added
- Centralized error handler utility (`cli/utils/error-handler.js`) with formatted error messages
- Enhanced error display with better context and user-friendly formatting

### [0.3.0] - 2026-01-16

#### Changed
- **BREAKING**: Updated to use simplified device API from `meross-iot` v0.4.0
  - Updated to use `initializeDevices()` instead of `getDevices()`
  - Updated to use direct device properties instead of `cachedHttpInfo`
  - Updated to use camelCase property names consistently
  - Updated all tests and commands to use new API patterns

### [0.2.0] - 2026-01-15

#### Changed
- **BREAKING**: Updated to use new Manager-prefix naming pattern from `meross-iot` package
  - `MerossManager` → `ManagerMeross` (internal usage)
  - `SubscriptionManager` → `ManagerSubscription` (internal usage)
- **BREAKING**: Updated to use new property-based access patterns from `meross-iot` package
  - Uses `meross.subscription` instead of `getSubscriptionManager()`
  - Uses `meross.devices.get()`, `meross.devices.find()`, and `meross.devices.list()` instead of wrapper methods

### [0.1.0] - 2026-01-10

#### Added
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

#### Known Issues
- This is an initial, pre-stable release. Please expect bugs.
- Some edge cases may not be fully handled yet.

</details>

## Disclaimer

**All product and company names or logos are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them or any associated subsidiaries! This personal project is maintained in spare time and has no business goal.**
**MEROSS is a trademark of Chengdu Meross Technology Co., Ltd.**
