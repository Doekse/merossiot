/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Connection errors and MFA
 *
 * Demonstrates `connect()` failure handling via `describeMerossError`. For command
 * failures on a device, catch `MerossDeviceError` where you
 * call `device.toggle.set` (see `device-control.js`). Retry backoff is app-specific.
 */

const Meross = require('../index.js');

/**
 * Logs a human-readable explanation for errors thrown during {@link ManagerMeross.connect}
 * or other Meross operations using category errors + error codes.
 *
 * @param {Error} error - Thrown value
 * @param {object} M - Module default export (class with `MerossError*` attached)
 * @returns {void}
 */
function describeMerossError(error, M) {
    if (error instanceof M.MerossAuthError ||
        error instanceof M.MerossDeviceError ||
        error instanceof M.MerossApiError ||
        error instanceof M.MerossNetworkError ||
        error instanceof M.MerossError) {
        console.error(`\n  Meross Error: ${error.message}`);
        console.error(`  Error Code: ${error.code}`);
        switch (error.code) {
            case 'MFA_REQUIRED':
                console.error('  Pass `mfaCode` in connect options or use connectWithMFA().');
                break;
            case 'MFA_WRONG':
                console.error('  MFA code is incorrect.');
                break;
            case 'COMMAND_TIMEOUT':
                console.error(`  Device: ${error.deviceUuid || 'Unknown'}`);
                console.error(`  Timeout: ${error.timeout || 'n/a'}ms`);
                break;
            case 'HTTP_API_ERROR':
                if (error.httpStatusCode) {
                    console.error(`  HTTP Status: ${error.httpStatusCode}`);
                }
                break;
            default:
                break;
        }
        return;
    }
    console.error('\n  Unexpected error.');
    if (error.stack) {
        console.error(error.stack);
    }
}

async function connectWithMFA(email, password, mfaCode) {
    try {
        const meross = await Meross.connect({
            email: email,
            password: password,
            mfaCode: mfaCode,
            logger: console.log
        });
        return meross;
    } catch (error) {
        throw error;
    }
}

(async () => {
    try {
        console.log('Connecting to Meross Cloud...');
        await Meross.connect({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
            // mfaCode: '123456'  // Provide MFA code if required
        });

        console.log('✓ Connected successfully');

    } catch (error) {
        console.error(`\n✗ ${error.message}`);
        describeMerossError(error, Meross);
        process.exit(1);
    }
})();
