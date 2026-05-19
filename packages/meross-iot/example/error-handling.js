'use strict';

/**
 * Typed errors from {@link Meross.connect} and device commands.
 */

const Meross = require('../index.js');
const { getCredentials } = require('./shared.js');

/**
 * Prints actionable detail for Meross error subclasses.
 *
 * @param {Error} error - Thrown value
 * @returns {void}
 */
function describeMerossError(error) {
    if (!(error instanceof Meross.MerossError)) {
        console.error('\nUnexpected error (not a MerossError subclass).');
        if (error.stack) {
            console.error(error.stack);
        }
        return;
    }

    console.error(`\n  ${error.name}: ${error.message}`);
    console.error(`  code: ${error.code}`);
    if (error.errorCode != null) {
        console.error(`  api errorCode: ${error.errorCode}`);
    }

    switch (error.code) {
        case 'MFA_REQUIRED':
            console.error('  → Set MEROSS_MFA_CODE or pass mfaCode in connect options.');
            break;
        case 'MFA_WRONG':
            console.error('  → MFA code was rejected; request a new code.');
            break;
        case 'COMMAND_TIMEOUT':
            if (error.deviceUuid) {
                console.error(`  → Device: ${error.deviceUuid}`);
            }
            if (error.timeout) {
                console.error(`  → Timeout: ${error.timeout}ms`);
            }
            break;
        case 'HTTP_API_ERROR':
            if (error.httpStatusCode) {
                console.error(`  → HTTP status: ${error.httpStatusCode}`);
            }
            break;
        default:
            break;
    }
}

(async () => {
    try {
        console.log('Connecting…');
        const meross = await Meross.connect({
            ...getCredentials(),
            logger: console.log
            // mfaCode: process.env.MEROSS_MFA_CODE
        });

        const device = meross.devices.list()[0];
        if (device?.toggle) {
            await device.toggle.set({ channel: 0, on: true });
            console.log('Toggle command succeeded.');
        } else {
            console.log('No toggle-capable device in registry.');
        }

        await meross.logout();
        meross.disconnectAll(true);
        console.log('\nDone.');
    } catch (error) {
        console.error(`\nFailed: ${error.message}`);
        describeMerossError(error);
        process.exit(1);
    }
})();
