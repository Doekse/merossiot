/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Token Reuse and Credentials Management
 *
 * Demonstrates how to save and reuse authentication tokens to avoid repeated
 * logins and MFA requests using the factory pattern.
 */

const { ManagerMeross, MerossHttpClient } = require('../index.js');
const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(__dirname, 'token-data.json');

function saveTokenData(meross) {
    const tokenData = meross.getTokenData();
    if (tokenData) {
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2));
        console.log('✓ Token data saved to', TOKEN_FILE);
    }
}

function loadTokenData() {
    if (fs.existsSync(TOKEN_FILE)) {
        const data = fs.readFileSync(TOKEN_FILE, 'utf8');
        return JSON.parse(data);
    }
    return null;
}

(async () => {
    try {
        let httpClient;

        const savedTokenData = loadTokenData();

        if (savedTokenData) {
            console.log('Found saved token data, attempting to reuse...');
            httpClient = MerossHttpClient.fromCredentials(savedTokenData, {
                logger: console.log
            });
        } else {
            console.log('No saved token data, performing login...');
            httpClient = await MerossHttpClient.fromUserPassword({
                email: 'your@email.com',
                password: 'yourpassword',
                logger: console.log
            });
        }

        const meross = new ManagerMeross({
            httpClient: httpClient,
            logger: console.log
        });

        console.log('Connecting to Meross Cloud...');
        await meross.connect();
        console.log('✓ Connected successfully');

        saveTokenData(meross);

        const devices = meross.devices.list();
        console.log(`\nFound ${devices.length} device(s)`);

        const tokenData = meross.getTokenData();
        if (tokenData) {
            console.log('\nCurrent token info:');
            console.log(`  User: ${tokenData.userEmail}`);
            console.log(`  Domain: ${tokenData.domain}`);
            console.log(`  MQTT Domain: ${tokenData.mqttDomain}`);
            console.log(`  Issued: ${tokenData.issuedOn}`);
        }

        console.log('\nListening... (Press Ctrl+C to exit)');
        
        process.on('SIGINT', async () => {
            console.log('\n\nShutting down...');
            await meross.logout();
            meross.disconnectAll(true);
            process.exit(0);
        });
        
    } catch (error) {
        console.error(`Error: ${error.message}`);

        // Delete invalid token file to force re-authentication on next run
        if (fs.existsSync(TOKEN_FILE)) {
            fs.unlinkSync(TOKEN_FILE);
            console.log('Deleted invalid token file');
        }
        
        process.exit(1);
    }
})();
