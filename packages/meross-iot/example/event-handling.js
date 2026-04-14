/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Event Handling Examples
 *
 * Demonstrates how to handle various events emitted by the ManagerMeross
 * instance and devices.
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

        // Manager-level events apply to all devices
        meross.on('deviceReady', (device) => {
            console.log(`\n[Manager] Device ready: ${device.name} (${device.uuid})`);
        });

        meross.on('connected', (device) => {
            console.log(`\n[Manager] Device connected: ${device.uuid}`);
        });

        meross.on('disconnected', (device, reason) => {
            console.log(`\n[Manager] Device disconnected: ${device.uuid}${reason ? ` - ${reason}` : ''}`);
        });

        meross.on('error', (error, device) => {
            if (device) {
                console.error(`\n[Manager] Device error (${device.uuid}): ${error.message}`);
            } else {
                console.error(`\n[Manager] System error: ${error.message}`);
            }
        });

        meross.on('reconnected', (device) => {
            console.log(`\n[Manager] Device reconnected: ${device.uuid}`);
        });

        meross.on('deviceUpdate', (device, change) => {
            console.log(`\n[Manager] Device update from ${device.uuid}:`);
            console.log(`  Type: ${change.type}`);
            console.log(`  Source: ${change.source}`);
            console.log(`  Value: ${JSON.stringify(change.value, null, 2)}`);
        });

        // Device-level events are specific to individual devices
        meross.on('deviceReady', (device) => {
            device.on('connected', () => {
                console.log(`\n[Device] ${device.name} connected`);
            });

            device.on('disconnected', (error) => {
                console.log(`\n[Device] ${device.name} disconnected${error ? `: ${error}` : ''}`);
            });

            device.on('error', (error) => {
                console.error(`\n[Device] ${device.name} error: ${error.message}`);
            });

            device.on('reconnected', () => {
                console.log(`\n[Device] ${device.name} reconnected`);
            });

            // Track previous status to show changes
            let previousStatus = device.onlineStatus;
            
            // Unified stateChange event handles all state changes
            device.on('stateChange', (event) => {
                if (event.type === 'online') {
                    const statusNames = {
                        0: 'Not Online',
                        1: 'Online',
                        2: 'Offline',
                        3: 'Upgrading'
                    };
                    const newStatus = event.value;
                    console.log(`\n[Device] ${device.name} status changed:`);
                    console.log(`  ${statusNames[previousStatus] || previousStatus} → ${statusNames[newStatus] || newStatus}`);
                    previousStatus = newStatus;
                } else if (event.type === 'properties') {
                    const properties = event.value;
                    console.log(`\n[Device] ${device.name} properties changed:`);
                    if (properties.macAddress) console.log(`  MAC: ${properties.macAddress}`);
                    if (properties.lanIp) console.log(`  LAN IP: ${properties.lanIp}`);
                    if (properties.mqttHost) console.log(`  MQTT Host: ${properties.mqttHost}`);
                    if (properties.deviceType) console.log(`  Device Type: ${properties.deviceType}`);
                } else {
                    // Other state changes (toggle, light, thermostat, etc.)
                    console.log(`\n[Device] ${device.name} state change (${event.type}, channel ${event.channel}):`);
                    console.log(`  Value: ${JSON.stringify(event.value, null, 2)}`);
                }
            });
        });

        console.log('Connecting to Meross Cloud...');
        await meross.connect();
        console.log('✓ Connected. Listening for events...');
        console.log('(Press Ctrl+C to exit)\n');

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

