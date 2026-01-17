/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Selective Device Initialization Example
 *
 * Demonstrates how to discover and selectively initialize devices and subdevices
 * instead of initializing all devices at once. Useful for platforms that allow
 * users to choose which devices to add during pairing.
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

        // Create manager with HTTP client
        const meross = new ManagerMeross({
            httpClient: httpClient,
            logger: console.log
        });

        console.log('=== Selective Device Initialization Example ===\n');

        // Example 1: Discover available devices without initializing
        // This is useful for showing users a list of devices to choose from
        console.log('1. Discovering available devices...');
        const availableDevices = await meross.devices.discover({ onlineOnly: true });
        console.log(`   Found ${availableDevices.length} online device(s):`);
        availableDevices.forEach(device => {
            console.log(`     - ${device.devName || 'Unknown'} (${device.deviceType})`);
        });

        // Example 2: Discover available subdevices without initializing
        // This is useful for showing users a list of subdevices (e.g., smoke alarms) to choose from
        console.log('\n2. Discovering available subdevices...');
        const availableSubdevices = await meross.devices.discoverSubdevices({ onlineOnly: true });
        console.log(`   Found ${availableSubdevices.length} subdevice(s):`);
        availableSubdevices.forEach(subdevice => {
            console.log(`     - ${subdevice.subdeviceName || 'Unknown'} (${subdevice.subdeviceType}) on hub ${subdevice.hubName}`);
        });

        // Example 3: Initialize a single base device by UUID
        // The hub auto-initializes if a subdevice is requested, but for base devices
        // you can initialize them individually
        if (availableDevices.length > 0) {
            console.log('\n3. Initializing only the first device...');
            const firstDevice = availableDevices[0];
            const device = await meross.devices.initializeDevice(firstDevice.uuid);
            if (device) {
                console.log(`   ✓ Initialized: ${device.name} (${device.uuid})`);
                meross.authenticated = true;
            }
        }

        // Example 4: Initialize a single subdevice by identifier
        // The parent hub is automatically initialized if not already initialized
        if (availableSubdevices.length > 0) {
            console.log('\n4. Initializing a specific subdevice...');
            const firstSubdevice = availableSubdevices[0];
            const subdevice = await meross.devices.initializeDevice({
                hubUuid: firstSubdevice.hubUuid,
                id: firstSubdevice.subdeviceId
            });
            if (subdevice) {
                console.log(`   ✓ Initialized: ${subdevice.name} (${subdevice.subdeviceId})`);
                console.log(`     Hub: ${subdevice.hub.name} (${subdevice.hub.uuid})`);
            }
        }

        // Example 5: Initialize multiple devices using UUID filter
        // More efficient than calling initializeDevice() multiple times
        if (availableDevices.length >= 2) {
            console.log('\n5. Initializing multiple devices using filter...');
            const selectedUuids = availableDevices.slice(0, 2).map(d => d.uuid);
            const deviceCount = await meross.devices.initialize({ uuids: selectedUuids });
            console.log(`   ✓ Initialized ${deviceCount} device(s)`);
        }

        // Example 6: Filter devices by type during discovery
        // Useful for showing only specific device types in selection UIs
        console.log('\n6. Discovering smart plugs only...');
        const smartPlugs = await meross.devices.discover({
            deviceTypes: ['mss315', 'mss425'],
            onlineOnly: true
        });
        console.log(`   Found ${smartPlugs.length} smart plug(s)`);

        // Example 7: Filter subdevices by type during discovery
        // Useful for showing only specific subdevice types (e.g., smoke alarms) in selection UIs
        console.log('\n7. Discovering smoke alarms only...');
        const smokeAlarms = await meross.devices.discoverSubdevices({
            subdeviceType: 'ma151',
            onlineOnly: true
        });
        console.log(`   Found ${smokeAlarms.length} smoke alarm(s)`);

        console.log('\n=== Initialized Devices ===');
        const initializedDevices = meross.devices.list();
        console.log(`Total initialized: ${initializedDevices.length}`);
        initializedDevices.forEach(device => {
            if (device.subdeviceId) {
                console.log(`  - [Subdevice] ${device.name} (${device.subdeviceId}) on hub ${device.hub.uuid}`);
            } else {
                console.log(`  - [Device] ${device.name} (${device.uuid})`);
            }
        });

        console.log('\n✓ Selective initialization complete!');

        // Cleanup
        await meross.logout();
        meross.disconnectAll(true);

    } catch (error) {
        console.error(`Error: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
})();
