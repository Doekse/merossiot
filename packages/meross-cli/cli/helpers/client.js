'use strict';

const fs = require('fs');
const { TransportMode } = require('meross-iot');

/**
 * Builds auth-only connect options plus runtime settings from CLI flags and env.
 *
 * Separates credentials (used by {@link Meross.connect}) from transport,
 * timeout, stats, and verbose flags that apply after connection.
 *
 * @param {Object} opts - Parsed CLI options and env-backed values
 * @returns {{ connectOpts: Object, settings: Object }} Connect payload and runtime settings
 */
function processOptions(opts) {
    const email = opts.email || process.env.MEROSS_EMAIL || null;
    const password = opts.password || process.env.MEROSS_PASSWORD || null;
    const mfaCode = opts.mfaCode || process.env.MEROSS_MFA_CODE || null;

    let tokenData = null;
    const tokenDataPath = opts.tokenData || process.env.MEROSS_TOKEN_DATA || null;
    if (tokenDataPath && fs.existsSync(tokenDataPath)) {
        try {
            tokenData = JSON.parse(fs.readFileSync(tokenDataPath, 'utf8'));
        } catch (error) {
            throw new Error(`Error reading token data file: ${error.message}`);
        }
    }

    const timeout = opts.timeout ? parseInt(opts.timeout, 10) : 10000;
    const enableStats = opts.enableStats || false;
    const verbose = opts.verbose || false;

    /** @type {Object} */
    let connectOpts;

    if (tokenData) {
        connectOpts = {
            token: tokenData.token,
            key: tokenData.key,
            userId: tokenData.userId,
            domain: tokenData.domain
        };
        if (tokenData.mqttDomain) {
            connectOpts.mqttDomain = tokenData.mqttDomain;
        }
        if (verbose) {
            connectOpts.logger = console.log;
        }
    } else if (email && password) {
        connectOpts = {
            email,
            password
        };
        if (mfaCode) {
            connectOpts.mfaCode = mfaCode;
        }
        if (verbose) {
            connectOpts.logger = console.log;
        }
    } else {
        throw new Error('Email and password are required (or provide token data).\nUse --email and --password options or set MEROSS_EMAIL and MEROSS_PASSWORD environment variables.');
    }

    const transportModeStr = opts.transportMode || 'mqtt_only';
    let transportMode = TransportMode.MQTT_ONLY;
    if (transportModeStr === 'lan_http_first') {
        transportMode = TransportMode.LAN_HTTP_FIRST;
    } else if (transportModeStr === 'lan_http_first_only_get') {
        transportMode = TransportMode.LAN_HTTP_FIRST_ONLY_GET;
    }

    return {
        connectOpts,
        settings: {
            transportMode,
            timeout,
            enableStats,
            verbose
        }
    };
}

function getTransportModeName(mode) {
    const modeMap = {
        [TransportMode.MQTT_ONLY]: 'MQTT Only',
        [TransportMode.LAN_HTTP_FIRST]: 'LAN HTTP First',
        [TransportMode.LAN_HTTP_FIRST_ONLY_GET]: 'LAN HTTP First (GET only)'
    };
    return modeMap[mode] || `Unknown (${mode})`;
}

module.exports = {
    processOptions,
    getTransportModeName
};
