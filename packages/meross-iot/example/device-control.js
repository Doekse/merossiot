/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Device Control Examples
 * 
 * This example demonstrates how to control different types of Meross devices:
 * - Toggle switches (on/off)
 * - Smart lights (color, brightness)
 * - Electricity monitoring
 * - Multi-channel devices
 */

const { ManagerMeross, MerossHttpClient } = require('../index.js');

(async () => {
    try {
        // Create HTTP client using factory method
        const httpClient = await MerossHttpClient.fromUserPassword({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
        });

        // Create manager with HTTP client
        const meross = new ManagerMeross({
            httpClient: httpClient,
            logger: console.log
        });

        meross.on('deviceInitialized', (deviceId, deviceDef, device) => {
    device.on('connected', async () => {
        console.log(`\n[Connected] ${deviceDef.devName}`);
        
        try {
            // Example 1: Toggle Control (Switches/Plugs)
            if (device.abilities && device.abilities['Appliance.Control.ToggleX']) {
                console.log('  Supports ToggleX control');
                
                // Turn on channel 1
                await device.setToggleX({ channel: 1, onoff: true });
                console.log('  ✓ Turned on channel 1');
                
                // Wait 2 seconds
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Turn off channel 1
                await device.setToggleX({ channel: 1, onoff: false });
                console.log('  ✓ Turned off channel 1');
                
                // Alternative: Use simpler methods for single-channel devices
                // await device.turnOn({ channel: 1 });
                // await device.turnOff({ channel: 1 });
            }
            
            // Example 2: Light Control
            if (device.abilities && device.abilities['Appliance.Control.Light']) {
                console.log('  Supports Light control');
                
                // Get current light state
                const lightState = await device.getLightState({ channel: 0 });
                console.log(`  Current brightness: ${lightState.luminance || 'N/A'}%`);
                
                // Set brightness to 50%
                await device.setLightColor({ channel: 0, luminance: 50 });
                console.log('  ✓ Set brightness to 50%');
                
                // Set RGB color (if supported)
                if (device.getSupportsRgb && device.getSupportsRgb()) {
                    await device.setLightColor({ channel: 0, rgb: [255, 0, 0] }); // Red
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
            const allData = await device.getSystemAllData();
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

