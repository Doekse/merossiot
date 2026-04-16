/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Discovery, filters, and targeted initialization
 *
 * {@link ManagerMeross.connect} already loads your online devices. This script shows the
 * discovery APIs you use for **pairing UIs** (list candidates, filter by type) and for
 * **adding** a device or subdevice by id (`initializeDevice`). Those calls are idempotent:
 * if the device is already in the registry, you get the existing instance back.
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

        const online = await meross.devices.discover({ onlineOnly: true });
        console.log(`\nOnline devices (cloud list): ${online.length}`);
        online.slice(0, 8).forEach((d) => {
            console.log(`  - ${d.devName || '?'}  ${d.deviceType}  ${d.uuid}`);
        });
        if (online.length > 8) {
            console.log(`  … and ${online.length - 8} more`);
        }

        const subdevices = await meross.devices.discoverSubdevices({ onlineOnly: true });
        console.log(`\nSubdevices (hub metadata): ${subdevices.length}`);
        subdevices.slice(0, 5).forEach((s) => {
            console.log(`  - ${s.subdeviceName || '?'}  (${s.subdeviceType})  hub ${s.hubName}`);
        });

        const plugs = await meross.devices.discover({
            deviceTypes: ['mss315', 'mss425'],
            onlineOnly: true
        });
        console.log(`\nFiltered example (smart plugs): ${plugs.length} match(es)`);

        const alarms = await meross.devices.discoverSubdevices({
            subdeviceType: 'ma151',
            onlineOnly: true
        });
        console.log(`Filtered example (smoke alarms ma151): ${alarms.length} match(es)`);

        if (online.length > 0) {
            const d = await meross.devices.initializeDevice(online[0].uuid);
            console.log(`\ninitializeDevice(uuid) → ${d ? d.name : 'null'} (same instance if already loaded)`);
        }

        if (online.length >= 2) {
            const uuids = online.slice(0, 2).map((x) => x.uuid);
            const n = await meross.devices.initialize({ uuids });
            console.log(`\ninitialize({ uuids }) → ${n} device(s) in scope`);
        }

        if (subdevices.length > 0) {
            const s = subdevices[0];
            const sub = await meross.devices.initializeDevice({
                hubUuid: s.hubUuid,
                id: s.subdeviceId
            });
            if (sub) {
                console.log(`\nSubdevice by id → ${sub.name} on hub ${sub.hub.name}`);
            }
        }

        console.log('\n--- Registry ---');
        meross.devices.list().forEach((device) => {
            const label = device.subdeviceId
                ? `[Sub] ${device.name} (${device.subdeviceId})`
                : `[Dev] ${device.name} (${device.uuid})`;
            console.log(`  ${label}`);
        });

        await meross.logout();
        meross.disconnectAll(true);
        console.log('\nDone.');
    } catch (error) {
        console.error(`Error: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
})();
