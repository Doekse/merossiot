'use strict';

/**
 * Control devices via feature objects: toggle, light, electricity, system.
 */

const Meross = require('../index.js');
const { getCredentials, bindShutdown } = require('./shared.js');
const { onEachDevice, runWhenConnected } = require('./on-each-device.js');

(async () => {
    try {
        console.log('Connecting…');
        const meross = await Meross.connect({
            ...getCredentials(),
            logger: console.log
        });

        bindShutdown(meross);

        /**
         * @param {import('../index').MerossDevice} device
         * @returns {Promise<void>}
         */
        async function demoDevice(device) {
            console.log(`\n[${device.name}] (${device.deviceType})`);

            try {
                if (device.toggle) {
                    console.log('  Toggle channel 0 → on');
                    await device.toggle.set({ channel: 0, on: true });
                    await new Promise((r) => setTimeout(r, 1500));
                    await device.toggle.set({ channel: 0, on: false });
                    console.log(`  Toggle state: ${device.toggle.isOn({ channel: 0 }) ? 'on' : 'off'}`);
                }

                if (device.light) {
                    console.log('  Light');
                    const state = await device.light.get({ channel: 0 });
                    if (state?.luminance != null) {
                        console.log(`    Brightness: ${state.luminance}%`);
                    }
                    await device.light.set({ channel: 0, luminance: 50 });
                    if (device.light.supportsRgb({ channel: 0 })) {
                        await device.light.set({ channel: 0, rgb: [255, 128, 0] });
                        console.log(`    RGB: ${device.light.getRgbColor({ channel: 0 })?.join(', ')}`);
                    }
                }

                if (device.electricity) {
                    const power = await device.electricity.get({ channel: 0 });
                    if (power) {
                        console.log(`  Power: ${power.wattage.toFixed(2)} W (${power.voltage} V)`);
                    }
                }

                if (device.system) {
                    await device.system.getAllData();
                    console.log('  system.getAllData() ok');
                }
            } catch (err) {
                console.error(`  ${err.message}`);
            }
        }

        onEachDevice(meross, (device) => {
            runWhenConnected(device, () => demoDevice(device));
        });

        console.log('\nRunning demos when each device is reachable (Ctrl+C to exit)…');
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
