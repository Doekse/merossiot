/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * HTTP / MQTT statistics (`enableStats` + debug utils)
 */

const Meross = require('../index.js');
const { createDebugUtils } = require('../lib/utilities/debug');
const { onEachDevice, runWhenConnected } = require('./on-each-device.js');

(async () => {
    try {
        console.log('Connecting to Meross Cloud...');
        const meross = await Meross.connect({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
        });
        meross.enableStats(1000);

        const debug = createDebugUtils(meross);
        const n = meross.devices.list().length;
        console.log(`\n✓ ${n} device(s). Generating a little traffic…`);

        onEachDevice(meross, (device) => {
            runWhenConnected(device, async () => {
                if (device.toggle) {
                    try {
                        await device.toggle();
                    } catch (err) {
                        console.error(err.message);
                    }
                }
            });
        });

        await new Promise((r) => setTimeout(r, 5000));

        console.log('\n=== Statistics (last 60s) ===\n');

        const httpStats = debug.getHttpStats(60000);
        if (httpStats) {
            console.log(`HTTP calls: ${httpStats.globalStats.totalCalls}`);
        } else {
            console.log('HTTP stats: (none)');
        }

        const mqttStats = debug.getMqttStats(60000);
        console.log(`MQTT calls: ${mqttStats.globalStats.totalCalls}`);

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
