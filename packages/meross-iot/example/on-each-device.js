'use strict';

/**
 * Helpers for examples that run logic per device after {@link Meross.connect}.
 *
 * `connect()` initializes devices internally, so `deviceReady` may fire before your
 * listeners are attached. These helpers cover devices already in the registry and
 * devices that become ready later.
 */

/**
 * Invokes `fn(device)` once per device UUID (registry + future `deviceReady` events).
 *
 * @param {import('../index')} meross - Root manager
 * @param {(device: import('../index').MerossDevice) => void} fn - Per-device handler
 * @returns {void}
 */
function onEachDevice(meross, fn) {
    const seen = new Set();

    function run(device) {
        if (!device?.uuid || device.subdeviceId) {
            return;
        }
        if (seen.has(device.uuid)) {
            return;
        }
        seen.add(device.uuid);
        fn(device);
    }

    meross.on('deviceReady', run);
    meross.devices.list().forEach(run);
}

/**
 * Runs `fn` when the device is reachable: immediately if connected, else on `connected`.
 *
 * @param {import('../index').MerossDevice} device - Device instance
 * @param {() => void | Promise<void>} fn - Async-safe handler
 * @returns {void}
 */
function runWhenConnected(device, fn) {
    const exec = () => Promise.resolve(fn()).catch((err) => console.error(err));

    if (device.deviceConnected) {
        exec();
    } else {
        device.once('connected', exec);
    }
}

module.exports = {
    onEachDevice,
    runWhenConnected
};
