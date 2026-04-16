/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Two accounts → two managers (separate MQTT sessions)
 */

const Meross = require('../index.js');
const { onEachDevice } = require('./on-each-device.js');

(async () => {
    try {
        const account1 = await Meross.connect({
            email: 'account1@example.com',
            password: 'password1',
            logger: (m) => console.log(`[A1] ${m}`)
        });
        account1.transportMode = Meross.TransportMode.MQTT_ONLY;

        const account2 = await Meross.connect({
            email: 'account2@example.com',
            password: 'password2',
            logger: (m) => console.log(`[A2] ${m}`)
        });
        account2.transportMode = Meross.TransportMode.MQTT_ONLY;

        onEachDevice(account1, (d) => console.log(`A1 device: ${d.name}`));
        onEachDevice(account2, (d) => console.log(`A2 device: ${d.name}`));

        console.log(`\nA1: ${account1.devices.list().length} device(s)`);
        console.log(`A2: ${account2.devices.list().length} device(s)`);

        process.on('SIGINT', async () => {
            await Promise.all([account1.logout(), account2.logout()]);
            account1.disconnectAll(true);
            account2.disconnectAll(true);
            process.exit(0);
        });
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
})();
