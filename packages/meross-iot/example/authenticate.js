'use strict';

/**
 * Two-step flow: {@link Meross.authenticate} (credentials only), then {@link Meross#connect}.
 *
 * Use this when you need cloud metadata (discovery) or runtime options before MQTT enrollment.
 */

const Meross = require('../index.js');
const { getCredentials, shutdown } = require('./shared.js');

(async () => {
    try {
        console.log('Authenticating (no devices initialized yet)…');
        const meross = await Meross.authenticate({
            ...getCredentials(),
            logger: console.log
        });

        console.log(`Signed in as ${meross.userEmail || '(unknown)'}`);
        console.log(`HTTP domain: ${meross.httpDomain}`);
        console.log(`MQTT domain: ${meross.mqttDomain}`);

        const candidates = await meross.devices.discover({ onlineOnly: true });
        console.log(`\n${candidates.length} online device(s) in cloud account (not initialized):`);
        candidates.slice(0, 5).forEach((d) => {
            console.log(`  - ${d.devName || '?'} (${d.deviceType}) ${d.uuid}`);
        });
        if (candidates.length > 5) {
            console.log(`  … and ${candidates.length - 5} more`);
        }

        meross.transport.defaultMode = Meross.TransportMode.MQTT_ONLY;
        meross.timeout = 15000;

        console.log('\nConnecting (initialize devices)…');
        const count = await meross.connect();
        console.log(`Initialized ${count} device(s). Registry size: ${meross.devices.list().length}`);

        await shutdown(meross);
        console.log('\nDone.');
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();
