'use strict';

const chalk = require('chalk');
const ora = require('ora');
const { getPrimaryChannel } = require('../../utils/device');
const {
    createStatusContext,
    collectFetchPromises,
    displayStatus,
    displayConfig
} = require('./abilities');

/**
 * Displays device status using feature-based API.
 *
 * Aggregates data from multiple device features and displays sensor readings,
 * configuration, and state information. Uses cached state when available to
 * minimize API calls, but fetches fresh data when needed.
 *
 * @param {Object} device - Device instance
 * @returns {Promise<boolean>} True if any readings were displayed, false otherwise
 */
async function displayDeviceStatus(device) {
    if (!device.deviceConnected) {
        return false;
    }

    try {
        const isMqttConnected = device.deviceConnected && device.mqttHost;
        if (isMqttConnected) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        const ctx = createStatusContext(device, {
            abilities: device.abilities || {},
            primaryChannel: getPrimaryChannel(device),
            isMqttConnected
        });

        collectFetchPromises(device, ctx);

        if (ctx.fetchPromises.length > 0) {
            const spinner = ora('Fetching device data').start();
            await Promise.allSettled(ctx.fetchPromises);
            spinner.stop();
        }

        displayStatus(device, ctx);

        if (ctx.hasReadings && ctx.sensorLines.length > 0) {
            console.log(`\n  ${chalk.bold.underline('Status')}`);
            ctx.sensorLines.forEach(line => console.log(line));
        }

        displayConfig(device, ctx);

        if (ctx.configItems.length > 0) {
            console.log(`\n  ${chalk.bold.underline('Configuration')}`);
            ctx.configItems.forEach(([label, value]) => {
                console.log(`    ${chalk.white.bold(label)}: ${chalk.italic(value)}`);
            });
        }

        return ctx.hasReadings;
    } catch {
        // Status display is optional, continue without it if errors occur
        return false;
    }
}

module.exports = { displayDeviceStatus };
