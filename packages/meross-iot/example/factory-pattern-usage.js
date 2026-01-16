/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Factory Pattern Usage Example
 * 
 * This example demonstrates the factory pattern for creating HTTP clients.
 * This approach provides better flexibility and testability.
 */

const { ManagerMeross, MerossHttpClient } = require('../index.js');

// Example 1: Using factory method
(async () => {
    try {
        console.log('=== Factory Pattern Example ===\n');

        // Create HTTP client using factory method
        const httpClient = await MerossHttpClient.fromUserPassword({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
        });

        console.log('✓ HTTP client created and authenticated\n');

        // Create manager with HTTP client (dependency injection)
        const manager = new ManagerMeross({
            httpClient: httpClient,
            logger: console.log
        });

        // Get devices (no login needed - client is already authenticated)
        console.log('Discovering devices...');
        const deviceCount = await manager.getDevices();
        console.log(`✓ Found ${deviceCount} device(s)\n`);

        // Use devices with property access pattern
        const devices = manager.devices.list();
        devices.forEach(device => {
            console.log(`  - ${device.name} (${device.uuid.substring(0, 8)}...)`);
        });

        console.log('\n✓ Factory pattern works!\n');

    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();

// Example 2: Using saved credentials
(async () => {
    try {
        // Load saved credentials (from previous session)
        const savedCredentials = {
            token: 'savedToken',
            key: 'savedKey',
            userId: 'userId123',
            domain: 'iotx-eu.meross.com',
            mqttDomain: 'eu-iotx.meross.com'
        };

        // Create HTTP client from saved credentials
        const httpClient = MerossHttpClient.fromCredentials(savedCredentials, {
            logger: console.log
        });

        // Create manager
        const manager = new ManagerMeross({
            httpClient: httpClient
        });

        // Get devices
        await manager.getDevices();
        console.log('✓ Saved credentials pattern works!\n');

    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
})();


