'use strict';

/**
 * {@link ManagerSubscription}: per-device polling and `deviceListUpdate` events.
 */

const Meross = require('../index.js');
const { getCredentials, shutdown } = require('./shared.js');
const { onEachDevice } = require('./on-each-device.js');

const POLL_CONFIG = {
    deviceStateInterval: 30000,
    electricityInterval: 30000,
    consumptionInterval: 60000,
    runtimeInterval: 60000,
    smartCaching: true,
    cacheMaxAge: 10000
};

(async () => {
    try {
        console.log('Connecting…');
        const meross = await Meross.connect({
            ...getCredentials(),
            logger: (msg) => console.log(`[meross] ${msg}`)
        });

        const sub = meross.subscription;
        sub.on('error', (err, ctx) => console.error('[subscription]', ctx, err.message));

        onEachDevice(meross, (device) => {
            console.log(`Subscribe → ${device.name} (${device.uuid})`);
            sub.subscribe(device, POLL_CONFIG);

            sub.on(`deviceUpdate:${device.uuid}`, (update) => {
                const types = update.changes
                    ? Object.keys(update.changes).join(', ')
                    : 'refresh';
                console.log(`  [update] ${update.device.name}: ${types} (${update.source})`);
            });
        });

        sub.subscribeToDeviceList();
        sub.on('deviceListUpdate', (update) => {
            console.log(
                `Account devices: +${update.added.length} -${update.removed.length} ~${update.changed.length}`
            );
        });

        process.on('SIGINT', async () => {
            sub.destroy();
            await shutdown(meross);
            process.exit(0);
        });

        console.log('\nRunning (Ctrl+C to exit)…');
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
