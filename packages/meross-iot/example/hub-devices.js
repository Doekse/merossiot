/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Hub Devices and Subdevices Example
 * 
 * This example demonstrates how to work with Meross Hub devices
 * and their subdevices (sensors, switches, etc.).
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

        meross.on('deviceInitialized', (deviceId, device) => {
            // Check if this is a hub device
            if (device.getSubdevices) {
                console.log(`\n[Hub Device] ${device.name} (${deviceId})`);
                console.log(`  Type: ${device.deviceType}`);
                
                device.on('connected', async () => {
                    console.log(`\n[Hub Connected] ${device.name}`);
            
            try {
                // Get all subdevices
                const subdevices = device.getSubdevices();
                console.log(`\n  Found ${subdevices.length} subdevice(s):`);
                
                subdevices.forEach(subdevice => {
                    console.log(`    - ${subdevice.name || 'Unknown'} (${subdevice.type || 'Unknown'})`);
                    console.log(`      ID: ${subdevice.subdeviceId}`);
                    console.log(`      Online: ${subdevice.onlineStatus === 1 ? 'Yes' : 'No'}`);
                });
                
                // Example: Control a subdevice
                if (subdevices.length > 0) {
                    const subdevice = subdevices[0];
                    console.log(`\n  Controlling subdevice: ${subdevice.name}`);
                    
                    // Check what capabilities the subdevice has
                    if (subdevice.abilities) {
                        console.log(`    Abilities: ${Object.keys(subdevice.abilities).join(', ')}`);
                    }
                    
                    // Example: Toggle a subdevice switch
                    if (subdevice.abilities && subdevice.abilities['Appliance.Control.ToggleX']) {
                        // Turn on
                        await subdevice.setToggleX({ channel: 0, onoff: true });
                        console.log('    ✓ Turned on');
                        
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        // Turn off
                        await subdevice.setToggleX({ channel: 0, onoff: false });
                        console.log('    ✓ Turned off');
                    }
                    
                    // Example: Read sensor data
                    // Note: For temperature/humidity sensors, use getLastSampledTemperature/Humidity
                    // These methods return cached values from the last push notification
                    if (typeof subdevice.getLastSampledTemperature === 'function') {
                        const temp = subdevice.getLastSampledTemperature();
                        console.log(`    Temperature: ${temp !== null && temp !== undefined ? `${temp}°C` : 'N/A'}`);
                    }
                    
                    if (typeof subdevice.getLastSampledHumidity === 'function') {
                        const humidity = subdevice.getLastSampledHumidity();
                        console.log(`    Humidity: ${humidity !== null && humidity !== undefined ? `${humidity}%` : 'N/A'}`);
                    }
                }
                
                // Listen for subdevice events
                subdevices.forEach(subdevice => {
                    subdevice.on('connected', () => {
                        console.log(`\n  [Subdevice Connected] ${subdevice.name}`);
                    });
                    
                    subdevice.on('pushNotification', (notification) => {
                        console.log(`\n  [Subdevice Push] ${subdevice.name}:`);
                        console.log(`    Namespace: ${notification.namespace}`);
                        console.log(`    Data: ${JSON.stringify(notification.rawData, null, 2)}`);
                    });
                });
                
            } catch (error) {
                console.error(`  Error: ${error.message}`);
            }
                });
            } else {
                // Regular device (not a hub)
                console.log(`\n[Regular Device] ${device.name} (${deviceId})`);
            }
        });

        console.log('Connecting to Meross Cloud...');
        await meross.connect();
        console.log('✓ Connected. Discovering devices...');
        
        // Find hub devices specifically using property access pattern
        const hubDevices = meross.devices.find({
            deviceClass: 'hub'
        });
        
        console.log(`\nFound ${hubDevices.length} hub device(s)`);
        
        // Keep running
        console.log('\nListening... (Press Ctrl+C to exit)');
        
        process.on('SIGINT', async () => {
            console.log('\n\nShutting down...');
            await meross.logout();
            meross.disconnectAll(true);
            process.exit(0);
        });
        
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();

