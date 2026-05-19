'use strict';

/**
 * Manager lifecycle events and per-device `stateChange` updates.
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
        meross.on('deviceUpdate', (d, change) => {
            console.log(`[mgr] deviceUpdate ${d.name} type=${change.type}`);
        });

        onEachDevice(meross, (device) => {
            let lastOnline = device.onlineStatus;

            device.on('stateChange', (ev) => {
                if (ev.type === 'online' && ev.value !== lastOnline) {
                    console.log(`[dev] ${device.name} online status ${lastOnline} → ${ev.value}`);
                    lastOnline = ev.value;
                } else if (ev.type !== 'online') {
                    console.log(`[dev] ${device.name} ${ev.type} ch=${ev.channel ?? '-'}`);
                }
            });
        });

        console.log('\nListening (Ctrl+C to exit)…');
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
