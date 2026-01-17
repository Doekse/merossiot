/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Basic Usage Example
 *
 * Demonstrates the simplest way to connect to Meross Cloud and discover devices
 * using the factory pattern.
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
            console.log(`Device found: ${device.name} (${deviceId})`);
            console.log(`  Type: ${device.deviceType}`);
            console.log(`  Status: ${device.onlineStatus === 1 ? 'Online' : 'Offline'}`);
        });

        console.log('Connecting to Meross Cloud...');
        const deviceCount = await meross.connect();
        console.log(`\n✓ Successfully connected to ${deviceCount} device(s)`);

        const devices = meross.devices.list();
        console.log('\nAll devices:');
        devices.forEach(device => {
            console.log(`  - ${device.name || 'Unknown'}`);
        });

        console.log('\nListening for events... (Press Ctrl+C to exit)');
        
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
