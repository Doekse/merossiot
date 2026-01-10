# Meross CLI

![npm version (alpha)](https://img.shields.io/npm/v/meross-cli/alpha)
![GitHub release](https://img.shields.io/github/v/release/Doekse/merossiot?include_prerelease)
![npm downloads](https://img.shields.io/npm/dm/meross-cli)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![alpha](https://img.shields.io/badge/status-alpha-red.svg)

Command-line interface for controlling and managing Meross smart home devices.

**⚠️ Alpha Release**: This is currently an alpha/unstable release. Use with caution.

## Requirements

- Node.js >= 18
- `meross-iot` library (installed automatically as a dependency)

## Installation

```bash
# Install alpha version globally
npm install -g meross-cli@alpha

# Or install specific version
npm install -g meross-cli@0.1.0
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
meross-cli control <uuid> setToggleX --channel 0 --on

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

<details>
<summary>Older</summary>

<!-- Older changelog entries will appear here -->

</details>

## Disclaimer

**All product and company names or logos are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them or any associated subsidiaries! This personal project is maintained in spare time and has no business goal.**
**MEROSS is a trademark of Chengdu Meross Technology Co., Ltd.**