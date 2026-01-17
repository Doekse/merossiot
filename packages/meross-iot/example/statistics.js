/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Statistics Tracking Example
 *
 * Demonstrates how to enable and use statistics tracking for monitoring
 * HTTP and MQTT API calls.
 */

const { ManagerMeross, MerossHttpClient } = require('../index.js');
const { createDebugUtils } = require('../lib/utilities/debug');

(async () => {
    try {
        const httpClient = await MerossHttpClient.fromUserPassword({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log,
            enableStats: true,
            maxStatsSamples: 1000
        });

        const meross = new ManagerMeross({
            httpClient: httpClient,
            logger: console.log,
            enableStats: true,
            maxStatsSamples: 1000
        });

        const debug = createDebugUtils(meross);

        meross.on('deviceInitialized', (deviceId, device) => {
            device.on('connected', async () => {
                console.log(`\n[Connected] ${device.name}`);

                // Generate API calls to demonstrate statistics tracking
                if (device.toggle) {
                    try {
                        await device.toggle();
                        console.log('✓ Device toggled');
                    } catch (err) {
                        console.error('Toggle error:', err.message);
                    }
                }
            });
        });

        console.log('Connecting to Meross Cloud...');
        const deviceCount = await meross.connect();
        console.log(`\n✓ Successfully connected to ${deviceCount} device(s)`);

        // Allow time for API calls to accumulate before displaying statistics
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('\n=== Statistics ===\n');

        const httpStats = debug.getHttpStats(60000);
        if (httpStats) {
            console.log('HTTP Statistics:');
            console.log(`  Total calls: ${httpStats.globalStats.totalCalls}`);
            console.log('  By HTTP status code:');
            httpStats.globalStats.byHttpResponseCode().forEach(([code, count]) => {
                console.log(`    ${code}: ${count}`);
            });
            console.log('  By API status code:');
            httpStats.globalStats.byApiStatusCode().forEach(([code, count]) => {
                console.log(`    ${code}: ${count}`);
            });
        } else {
            console.log('HTTP Statistics: Not available (stats not enabled)');
        }

        const mqttStats = debug.getMqttStats(60000);
        console.log('\nMQTT Statistics:');
        console.log(`  Total API calls: ${mqttStats.globalStats.totalCalls}`);
        console.log('  By method/namespace:');
        mqttStats.globalStats.byMethodNamespace().forEach(([method, count]) => {
            console.log(`    ${method}: ${count}`);
        });

        const delayedStats = debug.getDelayedMqttStats(60000);
        console.log(`\n  Delayed calls: ${delayedStats.globalStats.totalCalls}`);

        const droppedStats = debug.getDroppedMqttStats(60000);
        console.log(`  Dropped calls: ${droppedStats.globalStats.totalCalls}`);

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
