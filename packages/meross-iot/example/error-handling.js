/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Connection errors and MFA
 *
 * Demonstrates `connect()` failure handling via `describeMerossError`. For command
 * failures on a device, catch `MerossErrorCommand` / `MerossErrorCommandTimeout` where you
 * call `device.toggle.set` (see `device-control.js`). Retry backoff is app-specific.
 */

const Meross = require('../index.js');

/**
 * Logs a human-readable explanation for errors thrown during {@link ManagerMeross.connect}
 * or other Meross operations. See `index.js` exports for the full set of `MerossError*` classes.
 *
 * @param {Error} error - Thrown value
 * @param {object} M - Module default export (class with `MerossError*` attached)
 * @returns {void}
 */
function describeMerossError(error, M) {
    if (error instanceof M.MerossErrorMFARequired) {
        console.error('\n  MFA (Multi-Factor Authentication) is required.');
        console.error(`  Error Code: ${error.code}`);
        console.error('  Pass `mfaCode` in connect options or use connectWithMFA().');
        return;
    }
    if (error instanceof M.MerossErrorWrongMFA) {
        console.error('\n  MFA code is incorrect.');
        console.error(`  Error Code: ${error.code}`);
        return;
    }
    if (error instanceof M.MerossErrorAuthentication) {
        console.error('\n  Authentication failed.');
        console.error(`  Error Code: ${error.code}`);
        return;
    }
    if (error instanceof M.MerossErrorTokenExpired) {
        console.error('\n  Authentication token has expired.');
        console.error(`  Error Code: ${error.code}`);
        return;
    }
    if (error instanceof M.MerossErrorBadDomain) {
        console.error('\n  Bad domain error.');
        console.error(`  Error Code: ${error.code}`);
        return;
    }
    if (error instanceof M.MerossErrorCommand) {
        console.error('\n  Device command error.');
        console.error(`  Error Code: ${error.code}`);
        console.error(`  Device: ${error.deviceUuid || 'Unknown'}`);
        console.error(`  Error: ${JSON.stringify(error.errorPayload || error.message)}`);
        return;
    }
    if (error instanceof M.MerossErrorCommandTimeout) {
        console.error('\n  Command timeout.');
        console.error(`  Error Code: ${error.code}`);
        console.error(`  Device: ${error.deviceUuid || 'Unknown'}`);
        console.error(`  Timeout: ${error.timeout}ms`);
        return;
    }
    if (error instanceof M.MerossErrorMqtt) {
        console.error('\n  MQTT error.');
        console.error(`  Error Code: ${error.code}`);
        console.error(`  Topic: ${error.topic || 'Unknown'}`);
        return;
    }
    if (error instanceof M.MerossErrorUnauthorized) {
        console.error('\n  Unauthorized access.');
        console.error(`  Error Code: ${error.code}`);
        return;
    }
    if (error instanceof M.MerossErrorHttpApi) {
        console.error('\n  HTTP API error.');
        console.error(`  Error Code: ${error.code}`);
        if (error.cause) {
            console.error(`  Caused by: ${error.cause.message}`);
        }
        return;
    }
    if (error instanceof M.MerossErrorApiLimitReached) {
        console.error('\n  API rate limit reached.');
        console.error(`  Error Code: ${error.code}`);
        return;
    }
    if (error instanceof M.MerossErrorResourceAccessDenied) {
        console.error('\n  Resource access denied.');
        console.error(`  Error Code: ${error.code}`);
        return;
    }
    if (error instanceof M.MerossErrorTooManyTokens) {
        console.error('\n  Too many authentication tokens.');
        console.error(`  Error Code: ${error.code}`);
        return;
    }
    if (error instanceof M.MerossErrorUnconnected) {
        console.error('\n  Device is not connected.');
        console.error(`  Error Code: ${error.code}`);
        return;
    }
    if (error instanceof M.MerossErrorValidation) {
        console.error('\n  Validation error.');
        console.error(`  Error Code: ${error.code}`);
        if (error.field) {
            console.error(`  Field: ${error.field}`);
        }
        return;
    }
    if (error instanceof M.MerossErrorNotFound) {
        console.error('\n  Resource not found.');
        console.error(`  Error Code: ${error.code}`);
        return;
    }
    if (error instanceof M.MerossErrorNetworkTimeout) {
        console.error('\n  Network request timeout.');
        console.error(`  Error Code: ${error.code}`);
        return;
    }
    if (error instanceof M.MerossErrorParse) {
        console.error('\n  Parse error.');
        console.error(`  Error Code: ${error.code}`);
        return;
    }
    if (error instanceof M.MerossErrorRateLimit) {
        console.error('\n  Request rate limit exceeded.');
        console.error(`  Error Code: ${error.code}`);
        return;
    }
    if (error instanceof M.MerossErrorOperationLocked) {
        console.error('\n  Operation is locked.');
        console.error(`  Error Code: ${error.code}`);
        return;
    }
    if (error instanceof M.MerossErrorUnsupported) {
        console.error('\n  Unsupported operation.');
        console.error(`  Error Code: ${error.code}`);
        return;
    }
    if (error instanceof M.MerossErrorInitialization) {
        console.error('\n  Initialization failed.');
        console.error(`  Error Code: ${error.code}`);
        return;
    }
    if (error instanceof M.MerossErrorUnknownDeviceType) {
        console.error('\n  Unknown or unsupported device type.');
        console.error(`  Error Code: ${error.code}`);
        return;
    }
    if (error instanceof M.MerossError) {
        console.error(`\n  Meross Error: ${error.message}`);
        console.error(`  Error Code: ${error.code}`);
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
