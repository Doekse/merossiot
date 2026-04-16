/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Manager and device events (`deviceUpdate`, `stateChange`, connection lifecycle)
 */

const Meross = require('../index.js');
const { onEachDevice } = require('./on-each-device.js');

(async () => {
    try {
        console.log('Connecting to Meross Cloud...');
        const meross = await Meross.connect({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
        });

        meross.on('connected', (d) => console.log(`[mgr] connected ${d.uuid}`));
        meross.on('disconnected', (d, reason) => console.log(`[mgr] disconnected ${d.uuid} ${reason || ''}`));
        meross.on('deviceUpdate', (d, ch) => {
            console.log(`[mgr] deviceUpdate ${d.name} ${ch.type}`);
        });

        onEachDevice(meross, (device) => {
            let prev = device.onlineStatus;

            device.on('stateChange', (ev) => {
                if (ev.type === 'online') {
                    console.log(`[dev] ${device.name} online → ${ev.value} (was ${prev})`);
                    prev = ev.value;
                }
            });
        });

        console.log('✓ Listening (Ctrl+C to exit)\n');

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
