/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Factory Pattern Usage Example
 *
 * Demonstrates the factory pattern for creating HTTP clients, which enables
 * dependency injection and improves testability.
 */

const { ManagerMeross, MerossHttpClient } = require('../index.js');

// Example 1: Using factory method
(async () => {
    try {
        console.log('=== Factory Pattern Example ===\n');

        const httpClient = await MerossHttpClient.fromUserPassword({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
        });

        console.log('✓ HTTP client created and authenticated\n');

        const manager = new ManagerMeross({
            httpClient: httpClient,
            logger: console.log
        });

        // HTTP client is already authenticated, so no login needed
        console.log('Discovering devices...');
        const deviceCount = await manager.devices.initialize();
        console.log(`✓ Found ${deviceCount} device(s)\n`);

        const devices = manager.devices.list();
        devices.forEach(device => {
            console.log(`  - ${device.name} (${device.uuid.substring(0, 8)}...)`);
        });

        console.log('\n✓ Factory pattern example complete!\n');

    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();

// Example 2: Using saved credentials
(async () => {
    try {
        // Reuse credentials from a previous session to avoid re-authentication
        const savedCredentials = {
            token: 'savedToken',
            key: 'savedKey',
            userId: 'userId123',
            domain: 'iotx-eu.meross.com',
            mqttDomain: 'eu-iotx.meross.com'
        };

        const httpClient = MerossHttpClient.fromCredentials(savedCredentials, {
            logger: console.log
        });

        const manager = new ManagerMeross({
            httpClient: httpClient
        });

        await manager.devices.initialize();
        console.log('✓ Saved credentials example complete!\n');

    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
})();


