/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Device Control Examples
 *
 * Demonstrates how to control different types of Meross devices:
 * - Toggle switches (on/off)
 * - Smart lights (color, brightness)
 * - Electricity monitoring
 * - Multi-channel devices
 */

const { ManagerMeross, MerossHttpClient } = require('../index.js');

(async () => {
    try {
        const httpClient = await MerossHttpClient.fromUserPassword({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
        });

        const meross = new ManagerMeross({
            httpClient: httpClient,
            logger: console.log
        });

        meross.on('deviceInitialized', (deviceId, device) => {
            device.on('connected', async () => {
                console.log(`\n[Connected] ${device.name}`);

        try {
            // Example 1: Toggle Control (Switches/Plugs)
            if (device.toggle) {
                console.log('  Supports Toggle control');

                await device.toggle.set({ channel: 1, on: true });
                console.log('  ✓ Turned on channel 1');

                await new Promise(resolve => setTimeout(resolve, 2000));

                await device.toggle.set({ channel: 1, on: false });
                console.log('  ✓ Turned off channel 1');

                // Check state
                const isOn = device.toggle.isOn({ channel: 1 });
                console.log(`  Channel 1 is ${isOn ? 'on' : 'off'}`);
            }

            // Example 2: Light Control
            if (device.light) {
                console.log('  Supports Light control');

                const lightState = await device.light.get({ channel: 0 });
                if (lightState) {
                    console.log(`  Current brightness: ${lightState.luminance || 'N/A'}%`);
                }

                await device.light.set({ channel: 0, luminance: 50 });
                console.log('  ✓ Set brightness to 50%');

                // RGB support must be checked separately as not all light devices support it
                if (device.light.supportsRgb({ channel: 0 })) {
                    await device.light.set({ channel: 0, rgb: [255, 0, 0] });
                    console.log('  ✓ Set color to red');
                }
            }

            // Example 3: Electricity Monitoring
            if (device.abilities && device.abilities['Appliance.Control.Electricity']) {
                console.log('  Supports Electricity monitoring');

                const electricity = await device.getElectricity({ channel: 0 });
                if (electricity) {
                    console.log(`  Current: ${electricity.amperage.toFixed(2)} A`);
                    console.log(`  Voltage: ${electricity.voltage.toFixed(1)} V`);
                    console.log(`  Power: ${electricity.wattage.toFixed(2)} W`);
                }
            }

            // Example 4: Get all device data
            const allData = await device.system.getAllData();
            console.log('  System data retrieved');
            
        } catch (error) {
            console.error(`  Error: ${error.message}`);
        }
        });
    });

        console.log('Connecting to Meross Cloud...');
        await meross.connect();
        console.log('✓ Connected. Waiting for devices...');

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

