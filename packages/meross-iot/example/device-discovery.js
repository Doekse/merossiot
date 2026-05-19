'use strict';

/**
 * Discovery APIs for pairing UIs and targeted {@link ManagerDevices#initializeDevice}.
 */

const Meross = require('../index.js');
const { getCredentials, shutdown } = require('./shared.js');

(async () => {
    try {
        console.log('Connecting (full account enrollment)…');
        const meross = await Meross.connect({
            ...getCredentials(),
            logger: console.log
        });

        const online = await meross.devices.discover({ onlineOnly: true });
        console.log(`\nCloud list (online): ${online.length}`);
        online.slice(0, 8).forEach((d) => {
            console.log(`  - ${d.devName || '?'}  ${d.deviceType}  ${d.uuid}`);
        });
        if (online.length > 8) {
            console.log(`  … and ${online.length - 8} more`);
        }

        const subdevices = await meross.devices.discoverSubdevices({ onlineOnly: true });
        console.log(`\nSubdevice metadata: ${subdevices.length}`);
        subdevices.slice(0, 5).forEach((s) => {
            console.log(`  - ${s.subdeviceName || '?'} (${s.subdeviceType}) on hub ${s.hubName}`);
        });

        const plugs = await meross.devices.discover({
            deviceTypes: ['mss315', 'mss425'],
            onlineOnly: true
        });
        console.log(`\nFiltered plugs (mss315/mss425): ${plugs.length}`);

        const smoke = await meross.devices.discoverSubdevices({
            subdeviceType: 'ma151',
            onlineOnly: true
        });
        console.log(`Filtered smoke alarms (ma151): ${smoke.length}`);

        if (online.length > 0) {
            const d = await meross.devices.initializeDevice(online[0].uuid);
            console.log(`\ninitializeDevice → ${d?.name ?? 'null'} (idempotent if already loaded)`);
        }

        if (online.length >= 2) {
            const uuids = online.slice(0, 2).map((x) => x.uuid);
            const n = await meross.devices.initialize({ uuids });
            console.log(`initialize({ uuids }) → ${n} device(s)`);
        }

        if (subdevices.length > 0) {
            const meta = subdevices[0];
            const sub = await meross.devices.initializeDevice({
                hubUuid: meta.hubUuid,
                id: meta.subdeviceId
            });
            if (sub) {
                console.log(`Subdevice init → ${sub.name} (hub ${sub.hub.name})`);
            }
        }

        console.log('\n--- Registry ---');
        for (const device of meross.devices.list()) {
            if (device.subdeviceId) {
                console.log(`  [sub] ${device.name} (${device.subdeviceId})`);
            } else {
                console.log(`  [dev] ${device.name} (${device.uuid})`);
            }
        }

        await shutdown(meross);
        console.log('\nDone.');
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
