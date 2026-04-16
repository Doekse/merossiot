/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Basic Usage Example
 *
 * Demonstrates the simplest way to connect to Meross Cloud and discover devices
 * using the static {@link ManagerMeross.connect} factory.
 */

const Meross = require('../index.js');

(async () => {
    try {
        console.log('Connecting to Meross Cloud...');
        const meross = await Meross.connect({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
        });

        const devices = meross.devices.list();
        console.log(`\n✓ Successfully connected to ${devices.length} device(s)`);

        console.log('\nAll devices:');
        devices.forEach(device => {
            console.log(`  - ${device.name || 'Unknown'} (${device.uuid})`);
            console.log(`    Type: ${device.deviceType}`);
            console.log(`    Status: ${device.onlineStatus === 1 ? 'Online' : 'Offline'}`);
        });

        console.log('\nDone (Ctrl+C to exit if you keep the process open).');

    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
