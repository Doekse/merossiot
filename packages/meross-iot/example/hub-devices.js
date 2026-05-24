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

        const sub = meross.subscription;

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
                console.log(`    - ${sub.name || sub.subdeviceId}  online=${sub.isOnline}`);
            }

            const first = subdevices.find((s) => s.toggle);
            if (first) {
                console.log(`  Toggling ${first.name || first.subdeviceId}…`);
                await first.toggle.set({ channel: 0, on: true });
                await new Promise((r) => setTimeout(r, 1500));
                await first.toggle.set({ channel: 0, on: false });
            }

            sub.subscribe(device, { pushOnly: true });
            sub.on(`deviceUpdate:${device.uuid}`, (update) => {
                if (!update.device.subdeviceId) {
                    return;
                }
                const types = update.changes
                    ? Object.keys(update.changes).join(', ')
                    : 'refresh';
                console.log(`  [${update.device.name}] ${types} (${update.source})`);
            });
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
