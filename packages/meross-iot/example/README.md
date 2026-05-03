# Examples

Scripts in this folder are **small, runnable demos**. They assume Node 18+ and valid Meross credentials.

## Configure credentials

Edit the `email` / `password` fields in each script (or use saved tokens in `token-reuse.js` / `device-discovery.js` patterns).

```javascript
const Meross = require('meross-iot'); // or require('../index.js') from this repo

const meross = await Meross.connect({
    email: 'you@example.com',
    password: '…',
    logger: console.log, // optional
});

// Runtime settings (any time after connect):
// meross.transportMode = Meross.TransportMode.LAN_HTTP_FIRST;
// meross.timeout = 15000;
// meross.enableStats();
```

Environment variables (if you wire them in your own code): `MEROSS_EMAIL`, `MEROSS_PASSWORD`.

## Helper: `on-each-device.js`

`ManagerMeross.connect()` initializes devices internally, so `deviceReady` may fire before your code runs. Examples that need per-device setup import:

```javascript
const { onEachDevice, runWhenConnected } = require('./on-each-device.js');

onEachDevice(meross, (device) => {
    runWhenConnected(device, async () => {
        /* device is on the network */
    });
});
```

## Catalogue

| Script | Purpose |
|--------|---------|
| **basic-usage.js** | Connect and list devices |
| **device-control.js** | Toggle, light, electricity, `system.getAllData` |
| **event-handling.js** | Manager `deviceUpdate` and device `stateChange` |
| **token-reuse.js** | Save/load `getTokenData()` to skip password login |
| **device-discovery.js** | `discover` / `discoverSubdevices` filters, `initializeDevice`, `initialize({ uuids })` |
| **statistics.js** | `statistics.enable()` + `statistics.getMqttStats` / `getHttpStats` |
| **error-handling.js** | `connect()` failures, `describeMerossError` helper |
| **hub-devices.js** | Hubs, `getSubdevices()`, subdevice toggle |
| **transport-modes.js** | `meross.transport.defaultMode` (MQTT vs LAN-first) |
| **multiple-accounts.js** | Two `Meross.connect()` calls → two managers |
| **timer-usage.js** | `setTimerX`, list/delete timers |
| **subscription-manager.js** | `meross.subscription`, polling, `deviceListUpdate` |

## Run

From the `meross-iot` package directory:

```bash
node example/basic-usage.js
```

## Subscription polling

Intervals are usually passed to `meross.subscription.subscribe(device, { deviceStateInterval, … })`. Default constructor options for the subscription manager are not applied when you only use `Meross.connect()` (auth-only factory); pass the config you need on each `subscribe()` call.

## Further reading

- Package overview: [../README.md](../README.md)
- Type definitions: `index.d.ts` (`ManagerMeross`, `MerossError*`)
