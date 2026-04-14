/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Unified Device Updates Example
 *
 * Demonstrates how to consume the unified event model with manager-level
 * `deviceUpdate` events plus optional ManagerSubscription polling.
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
            logger: console.log,
            subscription: {
                deviceStateInterval: 30000,
                electricityInterval: 30000,
                consumptionInterval: 60000,
                smartCaching: true,
                cacheMaxAge: 10000,
                logger: (msg) => console.log(`[Subscription] ${msg}`)
            }
        });

        console.log('Connecting to Meross Cloud...');
        await meross.connect();
        console.log('✓ Connected\n');

        const subscriptionManager = meross.subscription;

        console.log('=== Example 1: Device Updates ===\n');

        meross.on('deviceReady', (device) => {
            console.log(`Device found: ${device.name} (${device.uuid})`);

            subscriptionManager.subscribe(device, {
                deviceStateInterval: 30000,
                smartCaching: true
            });

            subscriptionManager.on('error', (error, context) => {
                if (context === device.uuid) {
                    console.error(`[Error] ${device.name}: ${error.message}`);
                }
            });
        });

        meross.on('deviceUpdate', (device, change) => {
            console.log(`\n[Update] ${device.name}:`);
            console.log(`  Type: ${change.type}`);
            console.log(`  Source: ${change.source}`);
            console.log(`  Timestamp: ${new Date(change.timestamp).toISOString()}`);
            console.log(`  Value: ${JSON.stringify(change.value, null, 2)}`);
        });

        console.log('\n=== Example 2: Device List Updates ===\n');

        subscriptionManager.subscribeToDeviceList();

        subscriptionManager.on('deviceListUpdate', (update) => {
            console.log('\n[Device List Update]');
            console.log(`  Total devices: ${update.devices.length}`);
            console.log(`  Added: ${update.added.length}`);
            console.log(`  Removed: ${update.removed.length}`);
            console.log(`  Changed: ${update.changed.length}`);

            if (update.added.length > 0) {
                console.log('\n  New devices:');
                update.added.forEach(device => {
                    console.log(`    - ${device.devName} (${device.uuid})`);
                });
            }

            if (update.removed.length > 0) {
                console.log('\n  Removed devices:');
                update.removed.forEach(device => {
                    console.log(`    - ${device.devName} (${device.uuid})`);
                });
            }
        });

        console.log('\n=== Example 3: Multiple Listeners ===\n');

        const devices = meross.devices.list();
        if (devices.length > 0) {
            const firstDevice = devices[0];
            subscriptionManager.subscribe(firstDevice);
            const listener1 = (device, change) => {
                if (device.uuid !== firstDevice.uuid) {
                    return;
                }
                console.log(`[Listener 1] Device ${firstDevice.name} updated`);
            };

            const listener2 = (device, change) => {
                if (device.uuid !== firstDevice.uuid) {
                    return;
                }
                if (change.type === 'toggle') {
                    console.log(`[Listener 2] Toggle state changed`);
                }
            };

            meross.on('deviceUpdate', listener1);
            meross.on('deviceUpdate', listener2);

            console.log(`Added multiple listeners to ${firstDevice.name}`);
            console.log(`Total listeners: ${meross.listenerCount('deviceUpdate')}`);
        }

        console.log('\n=== Example 4: One-Time Events ===\n');

        if (devices.length > 0) {
            const firstDevice = devices[0];
            meross.once('deviceUpdate', (device, update) => {
                if (device.uuid !== firstDevice.uuid) {
                    return;
                }
                console.log(`[One-Time] Received first update from ${firstDevice.name}`);
                console.log(`  This listener will be removed after this event`);
            });
        }

        console.log('\n=== Example 5: Unsubscribing ===\n');

        setTimeout(() => {
            if (devices.length > 0) {
                const firstDevice = devices[0];
                const listenerCount = meross.listenerCount('deviceUpdate');

                console.log(`Removing all listeners from ${firstDevice.name}`);
                meross.removeAllListeners('deviceUpdate');

                subscriptionManager.unsubscribe(firstDevice.uuid);
                console.log(`Unsubscribed from ${firstDevice.name}`);
            }
        }, 10000);

        process.on('SIGINT', async () => {
            console.log('\n\nShutting down...');

            subscriptionManager.destroy();
            console.log('✓ ManagerSubscription destroyed');

            await meross.logout();
            meross.disconnectAll(true);
            process.exit(0);
        });

        console.log('\nListening for updates... (Press Ctrl+C to exit)');
        console.log('ManagerSubscription will automatically:');
        console.log('  - Poll device state every 30 seconds');
        console.log('  - Poll electricity data every 30 seconds');
        console.log('  - Poll consumption data every 60 seconds');
        console.log('  - Skip polling when push notifications are active');
        console.log('  - Skip polling when cached data is fresh\n');

    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
