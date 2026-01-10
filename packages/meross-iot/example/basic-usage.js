/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Basic Usage Example
 * 
 * This example demonstrates the simplest way to connect to Meross Cloud
 * and discover devices using the factory pattern.
 */

const { MerossManager, MerossHttpClient } = require('../index.js');

(async () => {
    try {
        // Create HTTP client using factory method
        const httpClient = await MerossHttpClient.fromUserPassword({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
        });

        // Create manager with HTTP client (dependency injection)
        const meross = new MerossManager({
            httpClient: httpClient,
            logger: console.log
        });

        // Listen for when devices are discovered
        meross.on('deviceInitialized', (deviceId, deviceDef, device) => {
            console.log(`Device found: ${deviceDef.devName} (${deviceId})`);
            console.log(`  Type: ${deviceDef.deviceType}`);
            console.log(`  Status: ${deviceDef.onlineStatus === 1 ? 'Online' : 'Offline'}`);
        });

        console.log('Connecting to Meross Cloud...');
        const deviceCount = await meross.connect();
        console.log(`\n✓ Successfully connected to ${deviceCount} device(s)`);
        
        // List all devices
        const devices = meross.getAllDevices();
        console.log('\nAll devices:');
        devices.forEach(device => {
            console.log(`  - ${device.dev?.devName || 'Unknown'}`);
        });
        
        // Keep running to receive events
        console.log('\nListening for events... (Press Ctrl+C to exit)');
        
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
