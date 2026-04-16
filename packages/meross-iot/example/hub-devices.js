/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Hubs and subdevices
 *
 * Hub hosts expose `getSubdevices()`. Uses {@link ./on-each-device.js} like other event-driven demos.
 */

const Meross = require('../index.js');
const { onEachDevice, runWhenConnected } = require('./on-each-device.js');

(async () => {
    try {
        console.log('Connecting to Meross Cloud...');
        const meross = await Meross.connect({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
        });

        /**
         * @param {Object} device - Hub or base device
         * @returns {Promise<void>}
         */
        async function exploreHub(device) {
            if (!device.getSubdevices) {
                console.log(`\n[Device] ${device.name}`);
                return;
            }

            console.log(`\n[Hub] ${device.name} (${device.deviceType})`);

            const subdevices = device.getSubdevices();
            console.log(`  ${subdevices.length} subdevice(s)`);
            subdevices.forEach((s) => {
                console.log(`    - ${s.name || '?'}  ${s.subdeviceId}  online=${s.onlineStatus === 1}`);
            });

            const first = subdevices[0];
            if (first && first.toggle) {
                await first.toggle.set({ channel: 0, on: true });
                await new Promise((r) => setTimeout(r, 2000));
                await first.toggle.set({ channel: 0, on: false });
            }

            subdevices.forEach((s) => {
                s.on('stateChange', (ev) => {
                    console.log(`  [${s.name}] ${ev.type} ch${ev.channel}`);
                });
            });
        }

        onEachDevice(meross, (device) => {
            runWhenConnected(device, () => exploreHub(device));
        });

        const hubs = meross.devices.find({ deviceClass: 'hub' });
        console.log(`\n✓ Hub count in registry: ${hubs.length}`);

        process.on('SIGINT', async () => {
            await meross.logout();
            meross.disconnectAll(true);
            process.exit(0);
        });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
