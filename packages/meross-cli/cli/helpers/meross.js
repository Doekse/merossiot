'use strict';

const ManagerMeross = require('meross-iot');
const ora = require('ora');
const { handleError } = require('../utils/error-handler');

/**
 * Applies CLI runtime settings after a manager exists (transport, timeout, stats, verbose).
 *
 * @param {import('meross-iot')} manager - Manager instance
 * @param {{ transportMode?: number, timeout?: number, enableStats?: boolean, verbose?: boolean }} settings - Runtime options
 * @returns {void}
 */
function applyMerossRuntimeSettings(manager, settings) {
    if (!settings) {
        return;
    }
    if (settings.verbose) {
        manager.logger = console.log;
    }
    if (settings.timeout !== null && settings.timeout !== undefined) {
        manager.timeout = settings.timeout;
    }
    if (settings.transportMode !== null && settings.transportMode !== undefined) {
        manager.transport.defaultMode = settings.transportMode;
    }
    if (settings.enableStats) {
        manager.statistics.enable();
    }
}

/**
 * Connects via {@link ManagerMeross.connect} and applies runtime settings (CLI one-shot commands).
 *
 * @param {Object} connectOpts - Password or credential options for {@link ManagerMeross.connect}
 * @param {{ transportMode?: number, timeout?: number, enableStats?: boolean, verbose?: boolean }} settings - Runtime options
 * @returns {Promise<import('meross-iot')>}
 */
async function createAndConnect(connectOpts, settings) {
    const manager = await ManagerMeross.connect(connectOpts);
    applyMerossRuntimeSettings(manager, settings);
    return manager;
}

/**
 * Builds an authenticated manager via {@link ManagerMeross.authenticate} without calling
 * {@link ManagerMeross#connect}, so callers can run discovery and selective
 * {@link ManagerDevices#initialize} (interactive menu).
 *
 * @param {Object} connectOpts - Same shape as {@link ManagerMeross.connect} (email/password or token credentials)
 * @param {{ transportMode?: number, timeout?: number, enableStats?: boolean, verbose?: boolean }} [settings] - Runtime options
 * @returns {Promise<import('meross-iot')>}
 */
async function createMerossInstance(connectOpts, settings = {}) {
    const manager = await ManagerMeross.authenticate(connectOpts);
    applyMerossRuntimeSettings(manager, settings);

    if (settings.verbose) {
        manager.on('deviceReady', (device) => {
            console.log(`Device ready: ${device?.uuid || 'unknown'}`);
        });
        manager.on('connected', (device) => {
            console.log(`Device connected: ${device?.uuid || 'unknown'}`);
        });
        manager.on('error', (error, device) => {
            const deviceId = device?.uuid || null;
            console.error(`Error${deviceId ? ` (${deviceId})` : ''}: ${error.message}`);
        });
    }

    return manager;
}

async function connectMeross(manager) {
    const spinner = ora('Connecting to Meross cloud...').start();
    try {
        const deviceCount = await manager.connect();
        spinner.succeed(`Connected to ${deviceCount} device(s)`);

        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
    } catch (error) {
        spinner.stop();
        handleError(error, { verbose: process.env.MEROSS_VERBOSE === 'true' });
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
    applyMerossRuntimeSettings,
    createAndConnect,
    createMerossInstance,
    connectMeross,
    disconnectMeross
};
