/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Error Handling and MFA Example
 * 
 * This example demonstrates how to handle various error scenarios:
 * - Authentication errors
 * - MFA (Multi-Factor Authentication)
 * - Token expiration
 * - Bad domain errors
 * - Device command errors
 */

const { MerossManager, MerossHttpClient } = require('../index.js');

async function connectWithMFA(email, password, mfaCode) {
    try {
        // Create HTTP client with MFA code
        const httpClient = await MerossHttpClient.fromUserPassword({
            email: email,
            password: password,
            mfaCode: mfaCode,
            logger: console.log
        });

        // Create manager with HTTP client
        const meross = new MerossManager({
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
        // Create HTTP client using factory method
        const httpClient = await MerossHttpClient.fromUserPassword({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
            // mfaCode: '123456'  // Provide MFA code if required
        });

        // Create manager with HTTP client
        const meross = new MerossManager({
            httpClient: httpClient,
            logger: console.log
        });
        
        console.log('Connecting to Meross Cloud...');
        await meross.connect();
        console.log('✓ Connected successfully');
        
    } catch (error) {
        console.error(`\n✗ Connection error: ${error.message}`);
        
        // Handle specific error types
        if (error instanceof MerossManager.MFARequiredError) {
            console.error('\n  MFA (Multi-Factor Authentication) is required.');
            console.error('  Please provide mfaCode in the options or use connectWithMFA().');
            
            // Example: Prompt for MFA code (in real app, use readline or similar)
            // const mfaCode = await promptForMFACode();
            // const meross = await connectWithMFA('your@email.com', 'yourpassword', mfaCode);
            
        } else if (error instanceof MerossManager.WrongMFAError) {
            console.error('\n  MFA code is incorrect.');
            console.error('  Please check your MFA code and try again.');
            
        } else if (error instanceof MerossManager.AuthenticationError) {
            console.error('\n  Authentication failed.');
            console.error('  Please check your email and password.');
            
        } else if (error instanceof MerossManager.TokenExpiredError) {
            console.error('\n  Authentication token has expired.');
            console.error('  The library will automatically attempt to login again.');
            
        } else if (error instanceof MerossManager.BadDomainError) {
            console.error('\n  Bad domain error.');
            console.error('  The API domain may be incorrect.');
            console.error('  Consider enabling autoRetryOnBadDomain option.');
            
        } else if (error instanceof MerossManager.CommandError) {
            console.error('\n  Device command error.');
            console.error(`  Device: ${error.deviceUuid || 'Unknown'}`);
            console.error(`  Error: ${JSON.stringify(error.payload || error.message)}`);
            
        } else if (error instanceof MerossManager.CommandTimeoutError) {
            console.error('\n  Command timeout.');
            console.error(`  Device: ${error.deviceUuid || 'Unknown'}`);
            console.error(`  Timeout: ${error.timeout}ms`);
            console.error(`  Command: ${JSON.stringify(error.command || {})}`);
            
        } else if (error instanceof MerossManager.MqttError) {
            console.error('\n  MQTT error.');
            console.error(`  Topic: ${error.topic || 'Unknown'}`);
            if (error.mqttMessage) {
                console.error(`  Message: ${JSON.stringify(error.mqttMessage)}`);
            }
            
        } else if (error instanceof MerossManager.HttpApiError) {
            console.error('\n  HTTP API error.');
            console.error(`  Status: ${error.httpStatusCode || 'Unknown'}`);
            console.error(`  API Status: ${error.apiStatus || 'Unknown'}`);
            
        } else {
            // Generic error
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
    meross.on('deviceInitialized', (deviceId, deviceDef, device) => {
        device.on('connected', async () => {
            try {
                // This might fail if device doesn't support the command
                await device.setToggleX({ channel: 1, onoff: true });
                console.log('✓ Command succeeded');
            } catch (error) {
                if (error instanceof MerossManager.CommandError) {
                    console.error(`Command failed: ${error.message}`);
                    console.error(`Device returned: ${JSON.stringify(error.payload)}`);
                } else if (error instanceof MerossManager.CommandTimeoutError) {
                    console.error(`Command timed out after ${error.timeout}ms`);
                    // You might want to retry or use a different transport mode
                } else {
                    console.error(`Unexpected error: ${error.message}`);
                }
            }
        });
    });
}

// Example: Retry logic for failed commands
async function retryCommand(device, commandFn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await commandFn();
        } catch (error) {
            if (i === maxRetries - 1) {
                throw error; // Re-throw on last attempt
            }
            console.log(`Attempt ${i + 1} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

