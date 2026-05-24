'use strict';

/**
 * Two Meross accounts → two independent {@link Meross} manager instances.
 */

const Meross = require('../index.js');
const { onEachDevice } = require('./on-each-device.js');

const ACCOUNT_A = {
    email: process.env.MEROSS_EMAIL_A || 'account1@example.com',
    password: process.env.MEROSS_PASSWORD_A || 'password1'
};

const ACCOUNT_B = {
    email: process.env.MEROSS_EMAIL_B || 'account2@example.com',
    password: process.env.MEROSS_PASSWORD_B || 'password2'
};

(async () => {
    try {
        const [account1, account2] = await Promise.all([
            Meross.connect({
                ...ACCOUNT_A,
                logger: (m) => console.log(`[A1] ${m}`)
            }),
            Meross.connect({
                ...ACCOUNT_B,
                logger: (m) => console.log(`[A2] ${m}`)
            })
        ]);

        account1.transport.defaultMode = 'mqtt';
        account2.transport.defaultMode = 'mqtt';

        onEachDevice(account1, (d) => console.log(`A1: ${d.name}`));
        onEachDevice(account2, (d) => console.log(`A2: ${d.name}`));

        console.log(`\nAccount 1: ${account1.devices.list().length} device(s)`);
        console.log(`Account 2: ${account2.devices.list().length} device(s)`);
        console.log('\nCtrl+C to exit.');

        process.on('SIGINT', async () => {
            const { shutdown } = require('./shared.js');
            await Promise.all([shutdown(account1), shutdown(account2)]);
            process.exit(0);
        });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
