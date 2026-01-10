/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Event Handling Examples
 * 
 * This example demonstrates how to handle various events emitted by
 * the MerossManager instance and devices.
 */

const { MerossManager, MerossHttpClient } = require('../index.js');

// ===== Manager-Level Events =====

// Device initialized (discovered)
meross.on('deviceInitialized', (deviceId, deviceDef, device) => {
    console.log(`\n[Manager] Device initialized: ${deviceDef.devName} (${deviceId})`);
});

// Device connected
meross.on('connected', (deviceId) => {
    console.log(`\n[Manager] Device connected: ${deviceId}`);
});

// Device disconnected
meross.on('close', (deviceId, error) => {
    console.log(`\n[Manager] Device closed: ${deviceId}${error ? ` - ${error}` : ''}`);
});

// Device error
meross.on('error', (error, deviceId) => {
    if (deviceId) {
        console.error(`\n[Manager] Device error (${deviceId}): ${error.message}`);
    } else {
        console.error(`\n[Manager] System error: ${error.message}`);
    }
});

// Device reconnected
meross.on('reconnect', (deviceId) => {
    console.log(`\n[Manager] Device reconnected: ${deviceId}`);
});

// Push notification from any device
meross.on('pushNotification', (deviceId, notification, device) => {
    console.log(`\n[Manager] Push notification from ${deviceId}:`);
    console.log(`  Namespace: ${notification.namespace}`);
    console.log(`  Data: ${JSON.stringify(notification.rawData, null, 2)}`);
});

// Raw data from any device
meross.on('rawData', (deviceId, message) => {
    console.log(`\n[Manager] Raw data from ${deviceId}`);
    // Uncomment to see raw messages:
    // console.log(`  Message: ${JSON.stringify(message, null, 2)}`);
});

// ===== Device-Level Events =====

meross.on('deviceInitialized', (deviceId, deviceDef, device) => {
    // Device connected
    device.on('connected', () => {
        console.log(`\n[Device] ${deviceDef.devName} connected`);
    });
    
    // Device disconnected
    device.on('close', (error) => {
        console.log(`\n[Device] ${deviceDef.devName} closed${error ? `: ${error}` : ''}`);
    });
    
    // Device error
    device.on('error', (error) => {
        console.error(`\n[Device] ${deviceDef.devName} error: ${error.message}`);
    });
    
    // Device reconnected
    device.on('reconnect', () => {
        console.log(`\n[Device] ${deviceDef.devName} reconnected`);
    });
    
    // Push notification from this device
    device.on('pushNotification', (notification) => {
        console.log(`\n[Device] ${deviceDef.devName} push notification:`);
        console.log(`  Namespace: ${notification.namespace}`);
        console.log(`  Data: ${JSON.stringify(notification.rawData, null, 2)}`);
    });
    
    // Data received from this device
    device.on('data', (namespace, payload) => {
        console.log(`\n[Device] ${deviceDef.devName} data (${namespace}):`);
        console.log(`  Payload: ${JSON.stringify(payload, null, 2)}`);
    });
    
    // Online status changed
    device.on('onlineStatusChange', (newStatus, oldStatus) => {
        const statusNames = { 
            0: 'Not Online', 
            1: 'Online', 
            2: 'Offline', 
            3: 'Upgrading' 
        };
        console.log(`\n[Device] ${deviceDef.devName} status changed:`);
        console.log(`  ${statusNames[oldStatus] || oldStatus} → ${statusNames[newStatus] || newStatus}`);
    });
    
    // Raw send data (for debugging)
    device.on('rawSendData', (message) => {
        console.log(`\n[Device] ${deviceDef.devName} sending:`);
        // Uncomment to see outgoing messages:
        // console.log(`  Message: ${JSON.stringify(message, null, 2)}`);
    });
});

// ===== Main Execution =====

(async () => {
    try {
        // Create HTTP client using factory method
        const httpClient = await MerossHttpClient.fromUserPassword({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
        });

        // Create manager with HTTP client
        const meross = new MerossManager({
            httpClient: httpClient,
            logger: console.log
        });

        console.log('Connecting to Meross Cloud...');
        await meross.connect();
        console.log('✓ Connected. Listening for events...');
        console.log('(Press Ctrl+C to exit)\n');
        
        // Keep running to receive events
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

