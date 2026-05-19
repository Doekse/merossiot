'use strict';

/**
 * Persist {@link Meross#getTokenData} between runs to avoid password login / MFA.
 */

const fs = require('fs');
const path = require('path');
const Meross = require('../index.js');
const { getCredentials, bindShutdown } = require('./shared.js');

const TOKEN_FILE = path.join(__dirname, 'token-data.json');

/**
 * @param {import('../index')} meross
 * @returns {void}
 */
function saveTokenData(meross) {
    const tokenData = meross.getTokenData();
    if (!tokenData) {
        return;
    }
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2));
    console.log(`Saved token data → ${TOKEN_FILE}`);
}

/**
 * @returns {import('../index').TokenData | null}
 */
function loadTokenData() {
    if (!fs.existsSync(TOKEN_FILE)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
}

(async () => {
    try {
        const saved = loadTokenData();
        let meross;

        if (saved?.token && saved?.key && saved?.userId && saved?.domain) {
            console.log('Reusing saved credentials…');
            meross = await Meross.connect({
                token: saved.token,
                key: saved.key,
                userId: saved.userId,
                domain: saved.domain,
                mqttDomain: saved.mqttDomain,
                logger: console.log
            });
        } else {
            console.log('No valid token file — password login…');
            meross = await Meross.connect({
                ...getCredentials(),
                logger: console.log
            });
        }

        saveTokenData(meross);
        bindShutdown(meross);

        const tokenData = meross.getTokenData();
        console.log('\nSession:');
        console.log(`  User:   ${tokenData?.userEmail ?? meross.userEmail}`);
        console.log(`  Domain: ${tokenData?.domain ?? meross.httpDomain}`);
        console.log(`  MQTT:   ${tokenData?.mqttDomain ?? meross.mqttDomain}`);
        console.log(`  Issued: ${tokenData?.issuedOn ?? 'n/a'}`);

        console.log(`\n${meross.devices.list().length} device(s) in registry.`);
        console.log('Press Ctrl+C to exit (token file kept for next run).');
    } catch (error) {
        console.error(`Error: ${error.message}`);

        if (fs.existsSync(TOKEN_FILE)) {
            fs.unlinkSync(TOKEN_FILE);
            console.log('Removed invalid token file — run again with password login.');
        }
        process.exit(1);
    }
})();
