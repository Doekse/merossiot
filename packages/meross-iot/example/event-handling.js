'use strict';

/**
 * Manager lifecycle events and {@link ManagerSubscription} state updates.
 */

const Meross = require('../index.js');
const { getCredentials, bindShutdown } = require('./shared.js');
const { onEachDevice } = require('./on-each-device.js');

(async () => {
    try {
        console.log('Connecting…');
        const meross = await Meross.connect({
            ...getCredentials(),
            logger: console.log
        });

        bindShutdown(meross);

        meross.on('deviceReady', (d) => console.log(`[mgr] deviceReady ${d.name}`));
        meross.on('connected', (d) => console.log(`[mgr] connected ${d.uuid}`));
        meross.on('disconnected', (d, reason) => {
            console.log(`[mgr] disconnected ${d.uuid} ${reason || ''}`);
        });

        const sub = meross.subscription;
        sub.on('error', (err, ctx) => console.error('[subscription]', ctx, err.message));

        onEachDevice(meross, (device) => {
            sub.subscribe(device, { pushOnly: true });

            sub.on(`deviceUpdate:${device.uuid}`, (update) => {
                const types = update.changes
                    ? Object.keys(update.changes).join(', ')
                    : 'refresh';
                console.log(`[sub] ${update.device.name} source=${update.source} ${types}`);
            });
        });

        console.log('\nListening (Ctrl+C to exit)…');
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
