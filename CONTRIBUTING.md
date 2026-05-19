# Contributing to MerossIot

Thank you for your interest in contributing to MerossIot! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/merossiot.git`
3. Install dependencies: `npm install`
4. Create a branch for your changes: `git checkout -b feature/your-feature-name`

## Development Setup

This is a monorepo using npm workspaces. The main packages are:
- `packages/meross-iot` - Core library
- `packages/meross-cli` - CLI tool

### Running Linting

```bash
# Lint all packages
npm run lint

# Fix linting issues
npm run lint:fix
```

### Testing

```bash
# Run unit tests for all workspaces
npm test

# meross-iot only
npm test -w meross-iot
```

CI runs `npm test` on every push and pull request. Please add or update tests when changing library behavior. Hardware-specific flows can still be exercised manually via `meross-cli`.

## Submitting Changes

1. **Write clear commit messages**: Follow conventional commit format when possible
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `refactor:` for code refactoring
   - `test:` for test changes

2. **Update documentation**: If you add features or change behavior, update the relevant README files

3. **Update CHANGELOG**: Add entries to the appropriate package CHANGELOG.md file following the [Keep a Changelog](https://keepachangelog.com/) format

4. **Create a Pull Request**:
   - Provide a clear description of your changes
   - Reference any related issues
   - Include screenshots or examples if applicable

## Code Style

- Follow the existing code style
- Use 4 spaces for indentation
- Follow ESLint rules (run `npm run lint` to check)
- Use single quotes for strings
- Add JSDoc comments for public APIs

## Reporting Issues

When reporting issues, please include:
- Device model name/number
- Device type
- Node.js version
- Error messages or unexpected behavior
- Steps to reproduce
- Any relevant logs

## Adding Support for New Devices

If you're adding support for a new device type:
1. Check if similar device types already exist for reference
2. Add appropriate ability files in `packages/meross-iot/lib/abilities/`
3. Update device factory if needed
4. Add examples or tests if possible
5. Update documentation

## Questions?

Feel free to open an issue for questions or discussions about contributions.
