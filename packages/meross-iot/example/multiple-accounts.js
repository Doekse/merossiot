/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

const { MerossManager, MerossHttpClient } = require('../index.js');

/**
 * Example demonstrating how to use multiple Meross accounts simultaneously
 * 
 * Each MerossManager instance manages one account and its own MQTT connections.
 * To use multiple accounts, create separate HTTP clients and managers for each account.
 */

// Main execution
(async () => {
    try {
        console.log('Connecting to multiple Meross accounts...\n');
        
        // Create HTTP clients for both accounts
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
        
        // Create managers for both accounts
        const account1 = new MerossManager({
            httpClient: httpClient1,
            logger: (msg) => console.log(`[Account 1] ${msg}`),
            transportMode: MerossManager.TransportMode.MQTT_ONLY
        });
        
        const account2 = new MerossManager({
            httpClient: httpClient2,
            logger: (msg) => console.log(`[Account 2] ${msg}`),
            transportMode: MerossManager.TransportMode.MQTT_ONLY
        });

        // Handle devices from Account 1
        account1.on('deviceInitialized', (deviceId, deviceDef, device) => {
            console.log(`\n[Account 1] Device initialized: ${deviceDef.devName} (${deviceId})`);
            
            device.on('connected', async () => {
                console.log(`[Account 1] Device connected: ${deviceDef.devName}`);
                // Your device control logic here
            });
        });

        // Handle devices from Account 2
        account2.on('deviceInitialized', (deviceId, deviceDef, device) => {
            console.log(`\n[Account 2] Device initialized: ${deviceDef.devName} (${deviceId})`);
            
            device.on('connected', async () => {
                console.log(`[Account 2] Device connected: ${deviceDef.devName}`);
                // Your device control logic here
            });
        });
        
        // Connect both accounts in parallel
        const [deviceCount1, deviceCount2] = await Promise.all([
            account1.connect(),
            account2.connect()
        ]);
        
        console.log(`\n✓ Account 1: Connected to ${deviceCount1} device(s)`);
        console.log(`✓ Account 2: Connected to ${deviceCount2} device(s)`);
        
        // Get devices from each account
        const account1Devices = account1.getAllDevices();
        const account2Devices = account2.getAllDevices();
        
        console.log(`\nAccount 1 devices:`);
        account1Devices.forEach(device => {
            console.log(`  - ${device.dev?.devName || 'Unknown'} (${device.dev?.uuid || device.uuid})`);
        });
        
        console.log(`\nAccount 2 devices:`);
        account2Devices.forEach(device => {
            console.log(`  - ${device.dev?.devName || 'Unknown'} (${device.dev?.uuid || device.uuid})`);
        });
        
        // Example: Control a device from Account 1
        if (account1Devices.length > 0) {
            const device = account1Devices[0];
            console.log(`\nControlling device from Account 1: ${device.dev?.devName}`);
            // await device.setToggleX({ channel: 1, onoff: true });
        }
        
        // Example: Control a device from Account 2
        if (account2Devices.length > 0) {
            const device = account2Devices[0];
            console.log(`\nControlling device from Account 2: ${device.dev?.devName}`);
            // await device.setToggleX({ channel: 1, onoff: true });
        }
        
        console.log('\nListening for device events... (Press Ctrl+C to exit)');
        
        // Handle graceful shutdown
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

