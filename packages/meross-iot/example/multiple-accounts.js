/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

const { ManagerMeross, MerossHttpClient } = require('../index.js');

/**
 * Multiple Accounts Example
 *
 * Demonstrates how to use multiple Meross accounts simultaneously. Each
 * ManagerMeross instance manages one account and its own MQTT connections.
 * To use multiple accounts, create separate HTTP clients and managers for
 * each account.
 */

(async () => {
    try {
        console.log('Connecting to multiple Meross accounts...\n');

        const httpClient1 = await MerossHttpClient.fromUserPassword({
            email: 'account1@example.com',
            password: 'password1',
            logger: (msg) => console.log(`[Account 1 HTTP] ${msg}`)
        });

        const httpClient2 = await MerossHttpClient.fromUserPassword({
            email: 'account2@example.com',
            password: 'password2',
            logger: (msg) => console.log(`[Account 2 HTTP] ${msg}`)
        });

        const account1 = new ManagerMeross({
            httpClient: httpClient1,
            logger: (msg) => console.log(`[Account 1] ${msg}`),
            transportMode: ManagerMeross.TransportMode.MQTT_ONLY
        });

        const account2 = new ManagerMeross({
            httpClient: httpClient2,
            logger: (msg) => console.log(`[Account 2] ${msg}`),
            transportMode: ManagerMeross.TransportMode.MQTT_ONLY
        });

        account1.on('deviceInitialized', (deviceId, device) => {
            console.log(`\n[Account 1] Device initialized: ${device.name} (${deviceId})`);

            device.on('connected', async () => {
                console.log(`[Account 1] Device connected: ${device.name}`);
            });
        });

        account2.on('deviceInitialized', (deviceId, device) => {
            console.log(`\n[Account 2] Device initialized: ${device.name} (${deviceId})`);

            device.on('connected', async () => {
                console.log(`[Account 2] Device connected: ${device.name}`);
            });
        });

        // Connect both accounts in parallel for efficiency
        const [deviceCount1, deviceCount2] = await Promise.all([
            account1.connect(),
            account2.connect()
        ]);

        console.log(`\n✓ Account 1: Connected to ${deviceCount1} device(s)`);
        console.log(`✓ Account 2: Connected to ${deviceCount2} device(s)`);

        const account1Devices = account1.devices.list();
        const account2Devices = account2.devices.list();

        console.log(`\nAccount 1 devices:`);
        account1Devices.forEach(device => {
            console.log(`  - ${device.name || 'Unknown'} (${device.uuid})`);
        });

        console.log(`\nAccount 2 devices:`);
        account2Devices.forEach(device => {
            console.log(`  - ${device.name || 'Unknown'} (${device.uuid})`);
        });

        if (account1Devices.length > 0) {
            const device = account1Devices[0];
            console.log(`\nControlling device from Account 1: ${device.name}`);
            // await device.setToggleX({ channel: 1, onoff: true });
        }

        if (account2Devices.length > 0) {
            const device = account2Devices[0];
            console.log(`\nControlling device from Account 2: ${device.name}`);
            // await device.setToggleX({ channel: 1, onoff: true });
        }

        console.log('\nListening for device events... (Press Ctrl+C to exit)');

        process.on('SIGINT', async () => {
            console.log('\n\nShutting down...');
            try {
                await Promise.all([
                    account1.logout(),
                    account2.logout()
                ]);
                console.log('Logged out from all accounts');
            } catch (error) {
                console.error(`Error during logout: ${error.message}`);
            }
            account1.disconnectAll(true);
            account2.disconnectAll(true);
            process.exit(0);
        });
        
    } catch (error) {
        console.error(`\n✗ Connection error: ${error.message}`);
        if (error.stack) {
            console.error(`  Stack: ${error.stack}`);
        }
        process.exit(1);
    }
})();

