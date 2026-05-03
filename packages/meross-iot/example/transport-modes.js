/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Transport Modes Example
 *
 * Demonstrates the different transport modes available for communicating
 * with devices. Set {@link ManagerMeross#transport}'s `defaultMode` at any time after connect:
 * - MQTT_ONLY: Always use cloud MQTT
 * - LAN_HTTP_FIRST: Try local HTTP first, fallback to MQTT
 * - LAN_HTTP_FIRST_ONLY_GET: Try local HTTP for GET requests only, use MQTT for SET
 */

const Meross = require('../index.js');

(async () => {
    try {
        console.log('Connecting to Meross Cloud...');
        const meross = await Meross.connect({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
        });

        // Example 1: MQTT Only (default)
        // meross.transport.defaultMode = Meross.TransportMode.MQTT_ONLY;

        // Example 2: LAN HTTP First
        // meross.transport.defaultMode = Meross.TransportMode.LAN_HTTP_FIRST;

        // Example 3: LAN HTTP First (GET only)
        // meross.transport.defaultMode = Meross.TransportMode.LAN_HTTP_FIRST_ONLY_GET;

        meross.transport.defaultMode = Meross.TransportMode.MQTT_ONLY;
        meross.logger = (msg) => console.log(`[MQTT Only] ${msg}`);

        const deviceCount = meross.devices.list().length;
        console.log(`\n✓ Successfully connected to ${deviceCount} device(s)`);

        const devices = meross.devices.list();
        if (devices.length > 0) {
            const device = devices[0];
            if (device.toggle) {
                console.log(`\nToggling ${device.name || 'device'}...`);
                await device.toggle();
                console.log('✓ Device toggled');
            }
        }

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
