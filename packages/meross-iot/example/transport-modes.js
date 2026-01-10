/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Transport Modes Example
 * 
 * This example demonstrates the different transport modes available
 * for communicating with devices:
 * - MQTT_ONLY: Always use cloud MQTT
 * - LAN_HTTP_FIRST: Try local HTTP first, fallback to MQTT
 * - LAN_HTTP_FIRST_ONLY_GET: Try local HTTP for GET requests only, use MQTT for SET
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

// Example 1: MQTT Only (default)
// All communication goes through the cloud MQTT broker
        const mqttOnly = new MerossManager({
            httpClient: httpClient,
            transportMode: MerossManager.TransportMode.MQTT_ONLY,
    logger: (msg) => console.log(`[MQTT Only] ${msg}`)
});

// Example 2: LAN HTTP First
// Tries to communicate via local HTTP first, falls back to MQTT if it fails
        const lanHttpFirst = new MerossManager({
            httpClient: httpClient,
            transportMode: MerossManager.TransportMode.LAN_HTTP_FIRST,
    logger: (msg) => console.log(`[LAN HTTP First] ${msg}`)
});

// Example 3: LAN HTTP First (GET only)
        // Uses local HTTP for GET requests, MQTT for SET requests
        const lanHttpGetOnly = new MerossManager({
            httpClient: httpClient,
            transportMode: MerossManager.TransportMode.LAN_HTTP_FIRST_ONLY_GET,
    logger: (msg) => console.log(`[LAN HTTP GET Only] ${msg}`)
});

        // Use one of the managers
        const meross = mqttOnly;

        console.log('Connecting to Meross Cloud...');
        const deviceCount = await meross.connect();
        console.log(`\n✓ Successfully connected to ${deviceCount} device(s)`);
    
        // Example: Toggle a device
    const devices = meross.getAllDevices();
    if (devices.length > 0) {
        const device = devices[0];
            if (device.toggle) {
                console.log(`\nToggling ${device.dev?.devName || 'device'}...`);
                await device.toggle();
                console.log('✓ Device toggled');
            }
        }

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
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
})();
