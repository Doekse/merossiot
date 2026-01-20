/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Error Handling and MFA Example
 *
 * Demonstrates how to handle various error scenarios:
 * - Authentication errors
 * - MFA (Multi-Factor Authentication)
 * - Token expiration
 * - Bad domain errors
 * - Device command errors
 * - Network and HTTP errors
 * - Validation and resource errors
 */

const { ManagerMeross, MerossHttpClient } = require('../index.js');

async function connectWithMFA(email, password, mfaCode) {
    try {
        const httpClient = await MerossHttpClient.fromUserPassword({
            email: email,
            password: password,
            mfaCode: mfaCode,
            logger: console.log
        });

        const meross = new ManagerMeross({
            httpClient: httpClient,
            logger: console.log
        });

        await meross.connect();
        return meross;
    } catch (error) {
        throw error;
    }
}

(async () => {
    try {
        const httpClient = await MerossHttpClient.fromUserPassword({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
            // mfaCode: '123456'  // Provide MFA code if required
        });

        const meross = new ManagerMeross({
            httpClient: httpClient,
            logger: console.log
        });

        console.log('Connecting to Meross Cloud...');
        await meross.connect();
        console.log('✓ Connected successfully');

    } catch (error) {
        console.error(`\n✗ Connection error: ${error.message}`);

        if (error instanceof ManagerMeross.MerossErrorMFARequired) {
            console.error('\n  MFA (Multi-Factor Authentication) is required.');
            console.error(`  Error Code: ${error.code}`);
            console.error('  Please provide mfaCode in the options or use connectWithMFA().');
            
            // Example: Prompt for MFA code (in real app, use readline or similar)
            // const mfaCode = await promptForMFACode();
            // const meross = await connectWithMFA('your@email.com', 'yourpassword', mfaCode);

        } else if (error instanceof ManagerMeross.MerossErrorWrongMFA) {
            console.error('\n  MFA code is incorrect.');
            console.error(`  Error Code: ${error.code}`);
            console.error('  Please check your MFA code and try again.');
            
        } else if (error instanceof ManagerMeross.MerossErrorAuthentication) {
            console.error('\n  Authentication failed.');
            console.error(`  Error Code: ${error.code}`);
            console.error('  Please check your email and password.');
            
        } else if (error instanceof ManagerMeross.MerossErrorTokenExpired) {
            console.error('\n  Authentication token has expired.');
            console.error(`  Error Code: ${error.code}`);
            console.error('  The library will automatically attempt to login again.');
            
        } else if (error instanceof ManagerMeross.MerossErrorBadDomain) {
            console.error('\n  Bad domain error.');
            console.error(`  Error Code: ${error.code}`);
            console.error('  The API domain may be incorrect.');
            console.error('  Consider enabling autoRetryOnBadDomain option.');
            
        } else if (error instanceof ManagerMeross.MerossErrorCommand) {
            console.error('\n  Device command error.');
            console.error(`  Error Code: ${error.code}`);
            console.error(`  Device: ${error.deviceUuid || 'Unknown'}`);
            console.error(`  Error: ${JSON.stringify(error.errorPayload || error.message)}`);
            
        } else if (error instanceof ManagerMeross.MerossErrorCommandTimeout) {
            console.error('\n  Command timeout.');
            console.error(`  Error Code: ${error.code}`);
            console.error(`  Device: ${error.deviceUuid || 'Unknown'}`);
            console.error(`  Timeout: ${error.timeout}ms`);
            console.error(`  Command: ${JSON.stringify(error.command || {})}`);
            
        } else if (error instanceof ManagerMeross.MerossErrorMqtt) {
            console.error('\n  MQTT error.');
            console.error(`  Error Code: ${error.code}`);
            console.error(`  Topic: ${error.topic || 'Unknown'}`);
            if (error.mqttMessage) {
                console.error(`  Message: ${JSON.stringify(error.mqttMessage)}`);
            }
            
        } else if (error instanceof ManagerMeross.MerossErrorUnauthorized) {
            console.error('\n  Unauthorized access.');
            console.error(`  Error Code: ${error.code}`);
            console.error(`  HTTP Status: ${error.httpStatusCode || 401}`);
            console.error('  Authentication token may be invalid or expired.');
            
        } else if (error instanceof ManagerMeross.MerossErrorHttpApi) {
            console.error('\n  HTTP API error.');
            console.error(`  Error Code: ${error.code}`);
            console.error(`  Status: ${error.httpStatusCode || 'Unknown'}`);
            
            // Show error chaining if available
            if (error.cause) {
                console.error(`  Caused by: ${error.cause.message}`);
            }
            
        } else if (error instanceof ManagerMeross.MerossErrorApiLimitReached) {
            console.error('\n  API rate limit reached.');
            console.error(`  Error Code: ${error.code}`);
            console.error('  Please wait before making more requests.');
            
        } else if (error instanceof ManagerMeross.MerossErrorResourceAccessDenied) {
            console.error('\n  Resource access denied.');
            console.error(`  Error Code: ${error.code}`);
            console.error('  You may not have permission to access this resource.');
            
        } else if (error instanceof ManagerMeross.MerossErrorTooManyTokens) {
            console.error('\n  Too many authentication tokens.');
            console.error(`  Error Code: ${error.code}`);
            console.error('  You have issued too many tokens without logging out. Please log out from other sessions.');
            
        } else if (error instanceof ManagerMeross.MerossErrorUnconnected) {
            console.error('\n  Device is not connected.');
            console.error(`  Error Code: ${error.code}`);
            if (error.deviceUuid) {
                console.error(`  Device: ${error.deviceUuid}`);
            }
            console.error('  Please wait for the device to connect before sending commands.');
            
        } else if (error instanceof ManagerMeross.MerossErrorValidation) {
            console.error('\n  Validation error.');
            console.error(`  Error Code: ${error.code}`);
            if (error.field) {
                console.error(`  Field: ${error.field}`);
            }
            console.error('  Check your input parameters.');
            
        } else if (error instanceof ManagerMeross.MerossErrorNotFound) {
            console.error('\n  Resource not found.');
            console.error(`  Error Code: ${error.code}`);
            if (error.resourceType) {
                console.error(`  Type: ${error.resourceType}`);
            }
            if (error.resourceId) {
                console.error(`  ID: ${error.resourceId}`);
            }
            
        } else if (error instanceof ManagerMeross.MerossErrorNetworkTimeout) {
            console.error('\n  Network request timeout.');
            console.error(`  Error Code: ${error.code}`);
            if (error.timeout) {
                console.error(`  Timeout: ${error.timeout}ms`);
            }
            if (error.url) {
                console.error(`  URL: ${error.url}`);
            }
            
        } else if (error instanceof ManagerMeross.MerossErrorParse) {
            console.error('\n  Parse error.');
            console.error(`  Error Code: ${error.code}`);
            if (error.format) {
                console.error(`  Format: ${error.format}`);
            }
            console.error('  Data could not be parsed correctly.');
            
        } else if (error instanceof ManagerMeross.MerossErrorRateLimit) {
            console.error('\n  Request rate limit exceeded.');
            console.error(`  Error Code: ${error.code}`);
            console.error('  Please wait before making more requests.');
            
        } else if (error instanceof ManagerMeross.MerossErrorOperationLocked) {
            console.error('\n  Operation is locked.');
            console.error(`  Error Code: ${error.code}`);
            console.error('  The operation may become available after a delay.');
            
        } else if (error instanceof ManagerMeross.MerossErrorUnsupported) {
            console.error('\n  Unsupported operation.');
            console.error(`  Error Code: ${error.code}`);
            if (error.operation) {
                console.error(`  Operation: ${error.operation}`);
            }
            if (error.reason) {
                console.error(`  Reason: ${error.reason}`);
            }
            
        } else if (error instanceof ManagerMeross.MerossErrorInitialization) {
            console.error('\n  Initialization failed.');
            console.error(`  Error Code: ${error.code}`);
            if (error.component) {
                console.error(`  Component: ${error.component}`);
            }
            if (error.reason) {
                console.error(`  Reason: ${error.reason}`);
            }
            
        } else if (error instanceof ManagerMeross.MerossErrorUnknownDeviceType) {
            console.error('\n  Unknown or unsupported device type.');
            console.error(`  Error Code: ${error.code}`);
            if (error.deviceType) {
                console.error(`  Device Type: ${error.deviceType}`);
            }
            
        } else if (error instanceof ManagerMeross.MerossError) {
            console.error(`\n  Meross Error: ${error.message}`);
            console.error(`  Error Code: ${error.code}`);
            if (error.errorCode !== null && error.errorCode !== undefined) {
                console.error(`  API Error Code: ${error.errorCode}`);
            }
            
        } else {
            console.error('\n  Unexpected error occurred.');
            if (error.stack) {
                console.error(`  Stack: ${error.stack}`);
            }
        }
        
        process.exit(1);
    }
})();

// Example: Handling device command errors
async function handleDeviceCommands(meross) {
    meross.on('deviceInitialized', (deviceId, device) => {
        device.on('connected', async () => {
            try {
                await device.toggle.set({ channel: 1, on: true });
                console.log('✓ Command succeeded');
            } catch (error) {
                if (error instanceof ManagerMeross.MerossErrorCommand) {
                    console.error(`Command failed: ${error.message}`);
                    console.error(`Error Code: ${error.code}`);
                    console.error(`Device returned: ${JSON.stringify(error.errorPayload)}`);
                } else if (error instanceof ManagerMeross.MerossErrorCommandTimeout) {
                    console.error(`Command timed out after ${error.timeout}ms`);
                    console.error(`Error Code: ${error.code}`);
                    console.error(`Operational (retryable): ${error.isOperational}`);
                    // Consider retrying or using a different transport mode
                } else if (error instanceof ManagerMeross.MerossErrorUnconnected) {
                    console.error(`Device is not connected: ${error.message}`);
                    console.error(`Error Code: ${error.code}`);
                    // Wait for device to connect before retrying
                } else if (error instanceof ManagerMeross.MerossErrorValidation) {
                    console.error(`Validation error: ${error.message}`);
                    console.error(`Error Code: ${error.code}`);
                    if (error.field) {
                        console.error(`Invalid field: ${error.field}`);
                    }
                } else {
                    console.error(`Unexpected error: ${error.message}`);
                    if (error instanceof ManagerMeross.MerossError) {
                        console.error(`Error Code: ${error.code}`);
                    }
                }
            }
        });
    });
}

// Example: Retry logic for failed commands
// Exponential backoff increases delay between retries to avoid overwhelming the device
// Only retries operational (recoverable) errors
async function retryCommand(device, commandFn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await commandFn();
        } catch (error) {
            if (i === maxRetries - 1) {
                throw error;
            }
            // Only retry operational errors (timeouts, network issues, etc.)
            if (error instanceof ManagerMeross.MerossError && error.isOperational) {
                console.log(`Attempt ${i + 1} failed (${error.code}), retrying...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            } else {
                // Don't retry non-operational errors (programming errors, invalid args, etc.)
                throw error;
            }
        }
    }
}

