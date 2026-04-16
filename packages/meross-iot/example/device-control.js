/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Device control (toggle, light, power monitoring)
 *
 * Uses `on-each-device.js` because `deviceReady` can fire while `connect()` runs.
 */

const Meross = require('../index.js');
const { onEachDevice, runWhenConnected } = require('./on-each-device.js');

(async () => {
    try {
        console.log('Connecting to Meross Cloud...');
        const meross = await Meross.connect({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
        });

        /**
         * @param {Object} device - Device instance
         * @returns {Promise<void>}
         */
        async function runControlDemo(device) {
            console.log(`\n[Reachable] ${device.name}`);

            try {
                if (device.toggle) {
                    console.log('  Toggle');
                    await device.toggle.set({ channel: 1, on: true });
                    await new Promise((r) => setTimeout(r, 2000));
                    await device.toggle.set({ channel: 1, on: false });
                    console.log(`  Channel 1: ${device.toggle.isOn({ channel: 1 }) ? 'on' : 'off'}`);
                }

                if (device.light) {
                    console.log('  Light');
                    const st = await device.light.get({ channel: 0 });
                    if (st) {
                        console.log(`    Brightness: ${st.luminance || 'N/A'}%`);
                    }
                    await device.light.set({ channel: 0, luminance: 50 });
                    if (device.light.supportsRgb({ channel: 0 })) {
                        await device.light.set({ channel: 0, rgb: [255, 0, 0] });
                    }
                }

                if (device.abilities && device.abilities['Appliance.Control.Electricity']) {
                    const electricity = await device.getElectricity({ channel: 0 });
                    if (electricity) {
                        console.log(`  Power: ${electricity.wattage.toFixed(2)} W`);
                    }
                }

                await device.system.getAllData();
                console.log('  system.getAllData ok');
            } catch (error) {
                console.error(`  ${error.message}`);
            }
        }

        onEachDevice(meross, (device) => {
            runWhenConnected(device, () => runControlDemo(device));
        });

        console.log('✓ Connected. Running demos when each device is reachable…');

        process.on('SIGINT', async () => {
            await meross.logout();
            meross.disconnectAll(true);
            process.exit(0);
        });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
