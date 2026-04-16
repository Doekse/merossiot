/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * {@link ManagerMeross.connect} runs device initialization internally, so `deviceReady` may
 * fire before your code can attach listeners. These helpers cover both devices already in
 * `meross.devices.list()` and devices that appear later.
 */

/**
 * Invokes `fn(device)` once per device (by UUID), for the current registry and future
 * `deviceReady` events.
 *
 * @param {object} manager - ManagerMeross instance (EventEmitter)
 * @param {(device: object) => void} fn - Handler
 * @returns {void}
 */
function onEachDevice(manager, fn) {
    const seen = new Set();

    function run(device) {
        if (!device || !device.uuid || seen.has(device.uuid)) {
            return;
        }
        seen.add(device.uuid);
        fn(device);
    }

    manager.on('deviceReady', run);
    manager.devices.list().forEach(run);
}

/**
 * Runs `fn` when the device is reachable: immediately if already connected, otherwise on
 * the next `connected` event.
 *
 * @param {object} device - Device instance
 * @param {() => void | Promise<void>} fn - May be async (rejections are logged)
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
