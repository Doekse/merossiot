'use strict';

const MerossManager = require('meross-iot');
const { MerossHttpClient, TransportMode } = require('meross-iot');
const ora = require('ora');

async function createMerossInstance(optionsOrEmail, password, mfaCode, transportMode, timeout, enableStats, verbose) {
    let httpClient;
    let finalTransportMode;
    let finalTimeout;
    let finalEnableStats;
    let finalVerbose;

    // Handle both old signature (individual params) and new signature (options object)
    if (typeof optionsOrEmail === 'object' && optionsOrEmail !== null && optionsOrEmail.httpClient) {
        // New signature: options object
        const options = optionsOrEmail;
        httpClient = options.httpClient;
        finalTransportMode = options.transportMode || TransportMode.MQTT_ONLY;
        finalTimeout = options.timeout || 10000;
        finalEnableStats = options.enableStats || false;
        finalVerbose = options.verbose || false;
    } else {
        // Old signature: individual parameters
        const email = optionsOrEmail;
        finalTransportMode = transportMode || TransportMode.MQTT_ONLY;
        finalTimeout = timeout || 10000;
        finalEnableStats = enableStats || false;
        finalVerbose = verbose || false;

        // Create HTTP client
        httpClient = await MerossHttpClient.fromUserPassword({
            email,
            password,
            mfaCode,
            logger: finalVerbose ? console.log : null,
            timeout: finalTimeout,
            autoRetryOnBadDomain: true,
            enableStats: finalEnableStats,
            maxStatsSamples: 1000
        });
    }

    const instance = new MerossManager({
        httpClient,
        transportMode: finalTransportMode,
        timeout: finalTimeout,
        enableStats: finalEnableStats,
        logger: finalVerbose ? console.log : null
    });

    instance.on('deviceInitialized', (deviceId) => {
        if (finalVerbose) {
            console.log(`Device initialized: ${deviceId}`);
        }
    });

    instance.on('connected', (deviceId) => {
        if (finalVerbose) {
            console.log(`Device connected: ${deviceId}`);
        }
    });

    instance.on('error', (error, deviceId) => {
        if (finalVerbose) {
            console.error(`Error${deviceId ? ` (${deviceId})` : ''}: ${error.message}`);
        }
    });

    return instance;
}

async function connectMeross(manager) {
    const spinner = ora('Connecting to Meross cloud...').start();
    try {
        const deviceCount = await manager.connect();
        spinner.succeed(`Connected to ${deviceCount} device(s)`);

        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
    } catch (error) {
        spinner.fail(`Connection error: ${error.message}`);
        if (error.stack && process.env.MEROSS_VERBOSE) {
            console.error(error.stack);
        }
        return false;
    }
}

async function disconnectMeross(manager) {
    try {
        if (manager && manager.authenticated) {
            await manager.logout();
            manager.disconnectAll(true);
        }
    } catch (error) {
        // Ignore logout errors
    }
}

module.exports = {
    createMerossInstance,
    connectMeross,
    disconnectMeross
};

