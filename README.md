# Meross IoT for Node.js

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![GitHub stars](https://img.shields.io/github/stars/Doekse/merossiot?style=social)

This monorepo contains the Meross IoT library and CLI tool for Node.js.

## Requirements

- Node.js >= 18

## Installation and Getting Started

### Installing the npm packages

**⚠️ Pre-release**: These packages are currently in early development. Use with caution.

#### meross-iot (Library)

The main library for controlling Meross cloud devices:

```bash
# Install latest version
npm install meross-iot

# Or install specific version
npm install meross-iot@0.1.0
```

See [packages/meross-iot/README.md](./packages/meross-iot/README.md) for detailed usage and examples.

#### meross-cli (Command-line tool)

Command-line interface for testing and managing Meross devices:

```bash
# Install latest version globally
npm install -g meross-cli

# Or install specific version
npm install -g meross-cli@0.1.0

# Or use via npx (no installation needed)
npx meross-cli
```

See [packages/meross-cli/README.md](./packages/meross-cli/README.md) for detailed usage and examples.

### Development Setup

This is a monorepo using npm workspaces. To set up for development:

```bash
# Install all dependencies
npm install
```

## Usage & Documentation

### Packages

#### [meross-iot](./packages/meross-iot/)

The main library for controlling Meross cloud devices. See [packages/meross-iot/README.md](./packages/meross-iot/README.md) for details.

#### [meross-cli](./packages/meross-cli/)

Command-line interface for testing and managing Meross devices. See [packages/meross-cli/README.md](./packages/meross-cli/README.md) for details.

### Development

```bash
# Run linting across all packages
npm run lint

# Work on a specific package
cd packages/meross-iot
# or
cd packages/meross-cli
```

## Changelog

See individual package changelogs:
- [meross-iot CHANGELOG](./packages/meross-iot/CHANGELOG.md)
- [meross-cli CHANGELOG](./packages/meross-cli/CHANGELOG.md)

## Credits

This project was inspired by the following open-source projects:
- [MerossIot (Python)](https://github.com/albertogeniola/MerossIot) by Alberto Geniola - Original Python implementation that provided insights into the Meross Cloud API
- [merossiot (Node.js)](https://github.com/Apollon77/merossiot) by Ingo Fischer - Node.js implementation that served as initial reference

While this codebase started from those projects, it has been significantly rewritten and restructured into a new architecture. This is an independent project.

## Disclaimer

**All product and company names or logos are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them or any associated subsidiaries! This personal project is maintained in spare time and has no business goal.**
**MEROSS is a trademark of Chengdu Meross Technology Co., Ltd.**
