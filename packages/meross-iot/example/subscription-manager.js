/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * ManagerSubscription Example
 * 
 * Demonstrates how to use ManagerSubscription for automatic polling and
 * unified update streams. ManagerSubscription combines push notifications
 * with periodic polling to provide a single event stream for device updates.
 * 
 * This example shows the property access pattern: `meross.subscription`
 */

const { ManagerMeross, MerossHttpClient } = require('../index.js');

(async () => {
    try {
        // Create HTTP client using factory method
        const httpClient = await MerossHttpClient.fromUserPassword({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
        });

        // Create manager with HTTP client and subscription options
        const meross = new ManagerMeross({
            httpClient: httpClient,
            logger: console.log,
            subscription: {
                deviceStateInterval: 30000,  // Poll device state every 30 seconds
                electricityInterval: 30000,  // Poll electricity every 30 seconds
                consumptionInterval: 60000,  // Poll consumption every 60 seconds
                smartCaching: true,          // Skip polling when cache is fresh
                cacheMaxAge: 10000,          // Consider cache fresh for 10 seconds
                logger: (msg) => console.log(`[Subscription] ${msg}`)
            }
        });

        console.log('Connecting to Meross Cloud...');
        await meross.connect();
        console.log('✓ Connected\n');

        // Access subscription manager using property access pattern
        const subscriptionManager = meross.subscription;

        // ===== Example 1: Subscribe to Device Updates =====
        console.log('=== Example 1: Device Updates ===\n');

        meross.on('deviceInitialized', (deviceId, deviceDef, device) => {
            console.log(`Device found: ${deviceDef.devName} (${deviceId})`);

            // Subscribe to device updates
            subscriptionManager.subscribe(device, {
                deviceStateInterval: 30000,
                smartCaching: true
            });

            const eventName = `deviceUpdate:${deviceId}`;

            // Listen for device updates
            subscriptionManager.on(eventName, (update) => {
                console.log(`\n[Update] ${deviceDef.devName}:`);
                console.log(`  Source: ${update.source}`);
                console.log(`  Timestamp: ${new Date(update.timestamp).toISOString()}`);

                // Handle toggle state changes
                if (update.changes.toggle) {
                    for (const [channel, onoff] of Object.entries(update.changes.toggle)) {
                        const isOn = onoff === 1;
                        console.log(`  Toggle channel ${channel}: ${isOn ? 'ON' : 'OFF'}`);
                    }
                }

                // Handle light state changes
                if (update.changes.light) {
                    for (const [channel, lightState] of Object.entries(update.changes.light)) {
                        if (lightState.onoff !== undefined) {
                            console.log(`  Light channel ${channel}: ${lightState.onoff === 1 ? 'ON' : 'OFF'}`);
                        }
                        if (lightState.brightness !== undefined) {
                            console.log(`  Brightness channel ${channel}: ${lightState.brightness}%`);
                        }
                    }
                }

                // Handle electricity data
                if (update.changes.electricity) {
                    for (const [channel, electricity] of Object.entries(update.changes.electricity)) {
                        if (electricity.power !== undefined) {
                            console.log(`  Power channel ${channel}: ${electricity.power.toFixed(2)} W`);
                        }
                        if (electricity.voltage !== undefined) {
                            console.log(`  Voltage channel ${channel}: ${electricity.voltage.toFixed(1)} V`);
                        }
                    }
                }

                // Show full state if no specific changes (full refresh)
                if (Object.keys(update.changes).length === 0) {
                    console.log(`  Full state refresh`);
                    if (update.state.toggle) {
                        console.log(`  Current toggle states:`, update.state.toggle);
                    }
                }
            });

            // Handle errors for this device
            subscriptionManager.on('error', (error, context) => {
                if (context === deviceId) {
                    console.error(`[Error] ${deviceDef.devName}: ${error.message}`);
                }
            });
        });

        // ===== Example 2: Device List Updates =====
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

        // ===== Example 3: Multiple Listeners =====
        console.log('\n=== Example 3: Multiple Listeners ===\n');

        // You can add multiple listeners to the same device
        const devices = meross.devices.list();
        if (devices.length > 0) {
            const firstDevice = devices[0].dev;
            if (firstDevice) {
                subscriptionManager.subscribe(firstDevice);
                const eventName = `deviceUpdate:${firstDevice.uuid}`;

                // First listener - logs updates
                subscriptionManager.on(eventName, (update) => {
                    console.log(`[Listener 1] Device ${firstDevice.name} updated`);
                });

                // Second listener - processes changes
                subscriptionManager.on(eventName, (update) => {
                    if (update.changes.toggle) {
                        console.log(`[Listener 2] Toggle state changed`);
                    }
                });

                console.log(`Added multiple listeners to ${firstDevice.name}`);
                console.log(`Total listeners: ${subscriptionManager.listenerCount(eventName)}`);
            }
        }

        // ===== Example 4: One-Time Events =====
        console.log('\n=== Example 4: One-Time Events ===\n');

        if (devices.length > 0) {
            const firstDevice = devices[0].dev;
            if (firstDevice) {
                const eventName = `deviceUpdate:${firstDevice.uuid}`;

                // Listen for only the next update
                subscriptionManager.once(eventName, (update) => {
                    console.log(`[One-Time] Received first update from ${firstDevice.name}`);
                    console.log(`  This listener will be removed after this event`);
                });
            }
        }

        // ===== Example 5: Unsubscribing =====
        console.log('\n=== Example 5: Unsubscribing ===\n');

        // Wait a bit, then demonstrate unsubscribing
        setTimeout(() => {
            if (devices.length > 0) {
                const firstDevice = devices[0].dev;
                if (firstDevice) {
                    const eventName = `deviceUpdate:${firstDevice.uuid}`;
                    const listenerCount = subscriptionManager.listenerCount(eventName);

                    console.log(`Removing all listeners from ${firstDevice.name}`);
                    subscriptionManager.removeAllListeners(eventName);

                    // Unsubscribe to stop polling (if no listeners remain)
                    subscriptionManager.unsubscribe(firstDevice.uuid);
                    console.log(`Unsubscribed from ${firstDevice.name}`);
                }
            }
        }, 10000);

        // ===== Cleanup on Exit =====
        process.on('SIGINT', async () => {
            console.log('\n\nShutting down...');

            // Destroy subscription manager to stop all polling
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
