'use strict';

const chalk = require('chalk');
const { shouldFetchFeature } = require('./utils');

function fetch(device, ctx) {
    const hasGarageState = device.garage.isOpen({ channel: ctx.primaryChannel }) !== undefined;
    if (shouldFetchFeature(hasGarageState, ctx.isMqttConnected)) {
        ctx.fetchPromises.push(
            device.garage.get({ channel: ctx.primaryChannel }).catch(() => null)
        );
    }
}

function display(device, ctx) {
    const isOpen = device.garage.isOpen({ channel: ctx.primaryChannel });
    if (isOpen === undefined) {
        return;
    }

    const stateText = isOpen ? chalk.green('Open') : chalk.red('Closed');
    ctx.sensorLines.push(`    ${chalk.white.bold('Garage Door')}: ${chalk.italic(stateText)}`);
    ctx.hasReadings = true;
}

module.exports = { fetch, display };
