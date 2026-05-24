'use strict';

/**
 * Connect with {@link Meross.connect} and list registered devices.
 */

const Meross = require('../index.js');
const { getCredentials, shutdown } = require('./shared.js');

(async () => {
    try {
        console.log('Connecting to Meross cloud…');
        const meross = await Meross.connect({
            ...getCredentials(),
            logger: console.log
        });

        const devices = meross.devices.list();
        console.log(`\nConnected — ${devices.length} device(s) in registry:\n`);

        for (const device of devices) {
            const online = device.isOnline;
            console.log(`  ${device.name || 'Unknown'}`);
            console.log(`    UUID:   ${device.uuid}`);
            console.log(`    Type:   ${device.deviceType}`);
            console.log(`    Online: ${online ? 'yes' : 'no'}`);
        }

        await shutdown(meross);
        console.log('\nDone.');
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
