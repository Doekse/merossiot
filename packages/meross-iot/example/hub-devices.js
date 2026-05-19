'use strict';

/**
 * Hub hosts, {@link MerossHubDevice#getSubdevices}, and subdevice control.
 */

const Meross = require('../index.js');
const { getCredentials, bindShutdown } = require('./shared.js');
const { onEachDevice, runWhenConnected } = require('./on-each-device.js');

(async () => {
    try {
        console.log('Connecting…');
        const meross = await Meross.connect({
            ...getCredentials(),
            logger: console.log
        });

        bindShutdown(meross);

        const hubs = meross.devices.find({ deviceClass: 'hub' });
        console.log(`Hubs in registry: ${hubs.length}`);

        /**
         * @param {import('../index').MerossDevice} device
         * @returns {Promise<void>}
         */
        async function exploreHub(device) {
            if (typeof device.getSubdevices !== 'function') {
                return;
            }

            console.log(`\n[Hub] ${device.name} (${device.deviceType})`);
            const subdevices = device.getSubdevices();
            console.log(`  ${subdevices.length} subdevice(s):`);

            for (const sub of subdevices) {
                const online = sub.onlineStatus === Meross.OnlineStatus.ONLINE;
                console.log(`    - ${sub.name || sub.subdeviceId}  online=${online}`);
            }

            const first = subdevices.find((s) => s.toggle);
            if (first) {
                console.log(`  Toggling ${first.name || first.subdeviceId}…`);
                await first.toggle.set({ channel: 0, on: true });
                await new Promise((r) => setTimeout(r, 1500));
                await first.toggle.set({ channel: 0, on: false });
            }

            for (const sub of subdevices) {
                sub.on('stateChange', (ev) => {
                    console.log(`  [${sub.name}] ${ev.type}`);
                });
            }
        }

        onEachDevice(meross, (device) => {
            runWhenConnected(device, () => exploreHub(device));
        });

        console.log('\nWatching hubs (Ctrl+C to exit)…');
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
