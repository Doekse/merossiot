/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * ManagerSubscription: polling + `deviceUpdate` / `deviceListUpdate`
 *
 * Polling intervals are passed per `subscribe()` (`Meross.connect()` does not pass
 * constructor subscription defaults).
 */

const Meross = require('../index.js');
const { onEachDevice } = require('./on-each-device.js');

const poll = {
    deviceStateInterval: 30000,
    electricityInterval: 30000,
    consumptionInterval: 60000,
    smartCaching: true,
    cacheMaxAge: 10000
};

(async () => {
    try {
        console.log('Connecting…');
        const meross = await Meross.connect({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: (m) => console.log(`[sub] ${m}`)
        });

        const sub = meross.subscription;
        sub.on('error', (err, ctx) => console.error('[sub error]', ctx, err.message));

        onEachDevice(meross, (device) => {
            console.log(`subscribe ${device.name}`);
            sub.subscribe(device, poll);
        });

        meross.on('deviceUpdate', (device, change) => {
            console.log(`update ${device.name}: ${change.type}`);
        });

        sub.subscribeToDeviceList();
        sub.on('deviceListUpdate', (u) => {
            console.log(`device list: +${u.added.length} -${u.removed.length} ~${u.changed.length}`);
        });

        const devices = meross.devices.list();
        if (devices[0]) {
            const d0 = devices[0];
            meross.on('deviceUpdate', (d, c) => {
                if (d.uuid === d0.uuid && c.type === 'toggle') {
                    console.log(`(extra listener) toggle on ${d0.name}`);
                }
            });
        }

        process.on('SIGINT', async () => {
            sub.destroy();
            await meross.logout();
            meross.disconnectAll(true);
            process.exit(0);
        });

        console.log('✓ Running (Ctrl+C to exit)');
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
})();
