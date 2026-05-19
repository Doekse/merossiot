'use strict';

/**
 * Enable {@link ManagerStatistics} and inspect HTTP/MQTT call counters.
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

        meross.statistics.enable(1000);
        bindShutdown(meross);

        console.log(`\n${meross.devices.list().length} device(s). Generating traffic…`);

        onEachDevice(meross, (device) => {
            runWhenConnected(device, async () => {
                if (!device.toggle) {
                    return;
                }
                try {
                    await device.toggle.set({ channel: 0, on: true });
                    await new Promise((r) => setTimeout(r, 500));
                    await device.toggle.set({ channel: 0, on: false });
                } catch (err) {
                    console.error(`${device.name}: ${err.message}`);
                }
            });
        });

        await new Promise((r) => setTimeout(r, 5000));

        const windowMs = 60000;
        console.log(`\n=== Statistics (last ${windowMs / 1000}s) ===\n`);

        const httpStats = meross.statistics.getHttpStats(windowMs);
        if (httpStats?.globalStats) {
            console.log(`HTTP calls:  ${httpStats.globalStats.totalCalls}`);
        } else {
            console.log('HTTP stats: (none — LAN may be unused in MQTT_ONLY mode)');
        }

        const mqttStats = meross.statistics.getMqttStats(windowMs);
        if (mqttStats?.globalStats) {
            console.log(`MQTT calls: ${mqttStats.globalStats.totalCalls}`);
        }

        const delayed = meross.statistics.getDelayedMqttStats(windowMs);
        if (delayed?.globalStats?.totalCalls) {
            console.log(`MQTT delayed: ${delayed.globalStats.totalCalls}`);
        }

        console.log('\nCtrl+C to exit.');
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
