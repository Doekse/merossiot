/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Hub Devices and Subdevices Example
 *
 * Demonstrates how to work with Meross Hub devices and their subdevices
 * (sensors, switches, etc.).
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
            // Hub devices have getSubdevices method; regular devices do not
            if (device.getSubdevices) {
                console.log(`\n[Hub Device] ${device.name} (${deviceId})`);
                console.log(`  Type: ${device.deviceType}`);

                device.on('connected', async () => {
                    console.log(`\n[Hub Connected] ${device.name}`);

            try {
                const subdevices = device.getSubdevices();
                console.log(`\n  Found ${subdevices.length} subdevice(s):`);

                subdevices.forEach(subdevice => {
                    console.log(`    - ${subdevice.name || 'Unknown'} (${subdevice.type || 'Unknown'})`);
                    console.log(`      ID: ${subdevice.subdeviceId}`);
                    console.log(`      Online: ${subdevice.onlineStatus === 1 ? 'Yes' : 'No'}`);
                });

                if (subdevices.length > 0) {
                    const subdevice = subdevices[0];
                    console.log(`\n  Controlling subdevice: ${subdevice.name}`);

                    if (subdevice.abilities) {
                        console.log(`    Abilities: ${Object.keys(subdevice.abilities).join(', ')}`);
                    }

                    // Example: Toggle a subdevice switch
                    if (subdevice.toggle) {
                        await subdevice.toggle.set({ channel: 0, on: true });
                        console.log('    ✓ Turned on');

                        await new Promise(resolve => setTimeout(resolve, 2000));

                        await subdevice.toggle.set({ channel: 0, on: false });
                        console.log('    ✓ Turned off');
                    }

                    // For temperature/humidity sensors, use cached values from push notifications
                    // rather than querying, as sensors update via push notifications
                    if (typeof subdevice.getLastSampledTemperature === 'function') {
                        const temp = subdevice.getLastSampledTemperature();
                        console.log(`    Temperature: ${temp !== null && temp !== undefined ? `${temp}°C` : 'N/A'}`);
                    }

                    if (typeof subdevice.getLastSampledHumidity === 'function') {
                        const humidity = subdevice.getLastSampledHumidity();
                        console.log(`    Humidity: ${humidity !== null && humidity !== undefined ? `${humidity}%` : 'N/A'}`);
                    }
                }

                subdevices.forEach(subdevice => {
                    subdevice.on('connected', () => {
                        console.log(`\n  [Subdevice Connected] ${subdevice.name}`);
                    });

                    subdevice.on('state', (event) => {
                        console.log(`\n  [Subdevice State] ${subdevice.name}:`);
                        console.log(`    Type: ${event.type}`);
                        console.log(`    Channel: ${event.channel}`);
                        console.log(`    Value: ${JSON.stringify(event.value, null, 2)}`);
                    });
                });

            } catch (error) {
                console.error(`  Error: ${error.message}`);
            }
                });
            } else {
                console.log(`\n[Regular Device] ${device.name} (${deviceId})`);
            }
        });

        console.log('Connecting to Meross Cloud...');
        await meross.connect();
        console.log('✓ Connected. Discovering devices...');

        const hubDevices = meross.devices.find({
            deviceClass: 'hub'
        });

        console.log(`\nFound ${hubDevices.length} hub device(s)`);

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

