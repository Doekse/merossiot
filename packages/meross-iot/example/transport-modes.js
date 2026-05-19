'use strict';

/**
 * {@link ManagerTransport#defaultMode}: MQTT-only vs LAN-first routing.
 */

const Meross = require('../index.js');
const { getCredentials, bindShutdown } = require('./shared.js');

(async () => {
    try {
        console.log('Connecting…');
        const meross = await Meross.connect({
            ...getCredentials(),
            logger: console.log
        });

        bindShutdown(meross);

        // meross.transport.defaultMode = Meross.TransportMode.LAN_HTTP_FIRST;
        // meross.transport.defaultMode = Meross.TransportMode.LAN_HTTP_FIRST_ONLY_GET;
        meross.transport.defaultMode = Meross.TransportMode.MQTT_ONLY;

        console.log(`Transport mode: ${meross.transport.defaultMode}`);
        console.log(`Devices: ${meross.devices.list().length}`);

        const device = meross.devices.list().find((d) => d.toggle);
        if (device) {
            console.log(`\nToggling ${device.name} via current transport…`);
            await device.toggle.set({ channel: 0, on: true });
            await new Promise((r) => setTimeout(r, 1000));
            await device.toggle.set({ channel: 0, on: false });
            console.log('Done.');
        } else {
            console.log('\nNo toggle-capable device found.');
        }

        if (device && meross.transport.isOutOfBudget(device.uuid)) {
            console.log(`Device ${device.uuid} is out of LAN error budget — using MQTT fallback.`);
        }

        console.log('\nCtrl+C to exit.');
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
