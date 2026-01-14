# Examples

This directory contains focused examples demonstrating different aspects of the MerossIot library.

## Available Examples

### `basic-usage.js`
The simplest example showing how to connect to Meross Cloud and discover devices. Perfect for getting started.

**Run:**
```bash
node example/basic-usage.js
```

### `device-control.js`
Demonstrates how to control different types of Meross devices:
- Toggle switches (on/off)
- Smart lights (brightness, color)
- Electricity monitoring
- Multi-channel devices

**Run:**
```bash
node example/device-control.js
```

### `event-handling.js`
Shows how to handle various events emitted by the library:
- Device initialization
- Connection/disconnection events
- Push notifications
- Online status changes
- Error events

**Run:**
```bash
node example/event-handling.js
```

### `token-reuse.js`
Demonstrates how to save and reuse authentication tokens to avoid repeated logins:
- Saving token data to file
- Loading saved tokens
- Encoding credentials for cross-platform storage
- Token expiration handling

**Run:**
```bash
node example/token-reuse.js
```

### `statistics.js`
Shows how to enable and use statistics tracking for monitoring API calls:
- Enabling statistics
- Viewing HTTP statistics
- Viewing MQTT statistics
- Statistics by device, URL, or time window

**Run:**
```bash
node example/statistics.js
```

### `error-handling.js`
Demonstrates comprehensive error handling:
- Authentication errors
- MFA (Multi-Factor Authentication) handling
- Token expiration
- Device command errors
- Retry logic

**Run:**
```bash
node example/error-handling.js
```

### `hub-devices.js`
Shows how to work with Meross Hub devices and their subdevices:
- Detecting hub devices
- Listing subdevices
- Controlling subdevices
- Reading sensor data from subdevices

**Run:**
```bash
node example/hub-devices.js
```

### `transport-modes.js`
Explains the different transport modes available:
- `MQTT_ONLY`: Always use cloud MQTT
- `LAN_HTTP_FIRST`: Try local HTTP first, fallback to MQTT
- `LAN_HTTP_FIRST_ONLY_GET`: Use LAN HTTP for reads, MQTT for writes
- Error budget management

**Run:**
```bash
node example/transport-modes.js
```

### `multiple-accounts.js`
Demonstrates how to use multiple Meross accounts simultaneously:
- Creating multiple MerossManager instances
- Managing devices from different accounts
- Independent MQTT connections per account

**Run:**
```bash
node example/multiple-accounts.js
```

### `factory-pattern-usage.js`
Demonstrates the factory pattern for creating HTTP clients and managers:
- Using `MerossHttpClient.fromUserPassword()` for authentication
- Dependency injection pattern with `MerossManager`
- Reusing saved credentials with `MerossHttpClient.fromCredentials()`

**Run:**
```bash
node example/factory-pattern-usage.js
```

### `timer-usage.js`
Shows how to create and manage device timers:
- Creating daily, weekday, and custom timers
- One-time timers
- Listing and finding timers by alias
- Deleting timers
- Using timer utility functions

**Run:**
```bash
node example/timer-usage.js
```

### `subscription-manager.js`
Demonstrates how to use SubscriptionManager for automatic polling and unified update streams:
- Subscribing to device updates with automatic polling
- Listening to device state changes via EventEmitter
- Monitoring device list changes (additions, removals)
- Multiple listeners per device
- One-time event listeners
- Smart caching to reduce network traffic
- Unsubscribing and cleanup

**Run:**
```bash
node example/subscription-manager.js
```

## Configuration

Before running any example, update the credentials using the factory pattern:

```javascript
const { MerossManager, MerossHttpClient } = require('meross-iot');

// Create HTTP client using factory method
const httpClient = await MerossHttpClient.fromUserPassword({
    email: 'your@email.com',      // ← Update this
    password: 'yourpassword',      // ← Update this
    logger: console.log
});

// Create manager with HTTP client (dependency injection)
const meross = new MerossManager({
    httpClient: httpClient,
    logger: console.log
});

await meross.connect();
```

## Common Options

### MerossHttpClient Options (Factory Pattern)

When using `MerossHttpClient.fromUserPassword()`:
- `email`: Your Meross account email (required)
- `password`: Your Meross account password (required)
- `mfaCode`: Multi-factor authentication code (if MFA is enabled)
- `logger`: Logger function for debug output
- `enableStats`: Enable statistics tracking (default: false)
- `maxStatsSamples`: Maximum samples to keep in statistics (default: 1000)

### MerossManager Options

When creating `MerossManager`:
- `httpClient`: MerossHttpClient instance (required)
- `logger`: Logger function for debug output
- `transportMode`: Transport mode (MQTT_ONLY, LAN_HTTP_FIRST, etc.)
- `timeout`: Request timeout in milliseconds (default: 10000)
- `autoRetryOnBadDomain`: Automatically retry on domain redirect errors (default: true)
- `maxErrors`: Maximum errors allowed per device before skipping LAN HTTP (default: 1)
- `errorBudgetTimeWindow`: Time window in milliseconds for error budget (default: 60000)
- `enableStats`: Enable statistics tracking (default: false)
- `maxStatsSamples`: Maximum samples to keep in statistics (default: 1000)
- `requestBatchSize`: Number of concurrent requests per device (default: 1)
- `requestBatchDelay`: Delay in milliseconds between batches (default: 200)
- `enableRequestThrottling`: Enable/disable request throttling (default: true)

### SubscriptionManager Options

When calling `meross.getSubscriptionManager()`:
- `logger`: Logger function for debug output
- `deviceStateInterval`: Device state polling interval in milliseconds (default: 30000)
- `electricityInterval`: Electricity metrics polling interval in milliseconds (default: 30000)
- `consumptionInterval`: Power consumption polling interval in milliseconds (default: 60000)
- `httpDeviceListInterval`: HTTP device list polling interval in milliseconds (default: 120000)
- `smartCaching`: Skip polling when cached data is fresh (default: true)
- `cacheMaxAge`: Maximum cache age in milliseconds before considering data stale (default: 10000)

When calling `subscriptionManager.subscribe(device, config)`:
- `deviceStateInterval`: Override device state polling interval for this device
- `electricityInterval`: Override electricity polling interval for this device
- `consumptionInterval`: Override consumption polling interval for this device
- `smartCaching`: Override smart caching setting for this device
- `cacheMaxAge`: Override cache max age for this device

Configuration is merged aggressively (shortest intervals win) to ensure all listeners receive updates at least as frequently as required.


## Environment Variables

You can also set credentials via environment variables:

```bash
export MEROSS_EMAIL="your@email.com"
export MEROSS_PASSWORD="yourpassword"
node example/basic-usage.js
```

