# Examples

Runnable scripts for the refactored **meross-iot** API. Requires Node.js 18+ and a Meross account.

## Credentials

**Option A — environment variables (recommended):**

```bash
export MEROSS_EMAIL='you@example.com'
export MEROSS_PASSWORD='your-password'
# export MEROSS_MFA_CODE='123456'   # when MFA is enabled
```

**Option B — edit placeholders** in each script (`your@email.com` / `yourpassword`).

From the `packages/meross-iot` directory:

```bash
node example/basic-usage.js
```

## Quick start

```javascript
const Meross = require('meross-iot');

const meross = await Meross.connect({
  email: 'you@example.com',
  password: 'your-password',
});

const device = meross.devices.list()[0];
if (device.toggle) {
  await device.toggle.set({ channel: 0, on: true });
}
```

Use `Meross.authenticate()` when you need discovery or runtime options **before** calling `meross.connect()` — see `authenticate.js`.

## Shared helpers

| File | Purpose |
|------|---------|
| **shared.js** | `getCredentials()`, `shutdown()`, `bindShutdown()` |
| **on-each-device.js** | `onEachDevice()` / `runWhenConnected()` for `deviceReady` race |

## Scripts

| Script | What it demonstrates |
|--------|----------------------|
| **basic-usage.js** | `Meross.connect()` and `meross.devices.list()` |
| **authenticate.js** | `Meross.authenticate()` → discover → `connect()` |
| **device-control.js** | `device.toggle`, `light`, `electricity`, `system` |
| **device-discovery.js** | `discover` / `discoverSubdevices`, `initializeDevice` |
| **event-handling.js** | Manager lifecycle + `meross.subscription` updates |
| **error-handling.js** | `MerossError` subclasses and `code` values |
| **token-reuse.js** | Save/load `getTokenData()` |
| **hub-devices.js** | Hubs, `getSubdevices()`, subdevice toggle |
| **transport-modes.js** | `meross.transport.defaultMode` |
| **statistics.js** | `meross.statistics.enable()` and stats getters |
| **subscription-manager.js** | `meross.subscription` polling and device list |
| **timer-usage.js** | `device.timer` create/list/delete |
| **multiple-accounts.js** | Two `Meross.connect()` instances |

## API patterns

### Entry points

- **`Meross.connect(options)`** — authenticate, enroll all online devices, return a ready manager.
- **`Meross.authenticate(options)`** — credentials only; call `meross.connect()` when ready.

### Device features (capability-based)

Devices expose optional feature objects. Check before use:

```javascript
if (device.toggle) await device.toggle.set({ channel: 0, on: true });
if (device.light) await device.light.set({ channel: 0, luminance: 80 });
if (device.electricity) await device.electricity.get({ channel: 0 });
if (device.timer) await device.timer.set({ time: '18:00', alias: 'Lights', on: true });
```

### Managers on `meross`

| Accessor | Role |
|----------|------|
| `meross.devices` | Registry, discovery, `initialize()` / `initializeDevice()` |
| `meross.transport` | `defaultMode`, `getBudget` / `isOutOfBudget` / `resetBudget` |
| `meross.subscription` | Polling and unified update events |
| `meross.statistics` | Optional HTTP/MQTT diagnostics |
| `meross.auth` | Token/session (usually via `getTokenData()`) |

### Receiving device updates

Use **`meross.subscription`** only. Do not listen on `device.on('stateChange')` or `meross.on('deviceUpdate')` — those exist for internal wiring.

```javascript
const sub = meross.subscription;

sub.subscribe(device, {
  pushOnly: true,
  deviceStateInterval: 30000,
  electricityInterval: 30000,
});

sub.on(`deviceUpdate:${device.uuid}`, (update) => {
  console.log(update.device.name, update.source, update.changes);
});

sub.subscribeToDeviceList();
sub.on('deviceListUpdate', (diff) => { /* added / removed / changed */ });
```

Pass intervals on each `subscribe()` call — `Meross.connect()` does not apply constructor subscription defaults. For hubs, subscribe once and use `update.device` to tell hub vs subdevice (see `hub-devices.js`).

## Further reading

- Package overview: [../README.md](../README.md)
- Type definitions: [../index.d.ts](../index.d.ts)
