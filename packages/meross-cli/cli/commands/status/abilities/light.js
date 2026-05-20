'use strict';

const chalk = require('chalk');
const { shouldFetchFeature } = require('./utils');

function fetch(device, ctx) {
    const hasLightState = device.light.isOn({ channel: ctx.primaryChannel }) !== undefined;
    if (shouldFetchFeature(hasLightState, ctx.isMqttConnected)) {
        ctx.fetchPromises.push(
            device.light.get({ channel: ctx.primaryChannel }).catch(() => null)
        );
    }
}

function display(device, ctx) {
    const isOn = device.light.isOn({ channel: ctx.primaryChannel });
    if (isOn === undefined) {
        return;
    }

    const stateColor = isOn ? chalk.green('On') : chalk.red('Off');
    ctx.sensorLines.push(`    ${chalk.white.bold('Light State')}: ${chalk.italic(stateColor)}`);

    const brightness = device.light.getBrightness({ channel: ctx.primaryChannel });
    if (brightness !== undefined && brightness !== null) {
        ctx.sensorLines.push(`    ${chalk.white.bold('Brightness')}: ${chalk.italic(`${brightness}%`)}`);
    }

    const rgb = device.light.getRgbColor({ channel: ctx.primaryChannel });
    if (rgb && Array.isArray(rgb)) {
        ctx.sensorLines.push(`    ${chalk.white.bold('RGB')}: ${chalk.italic(`[${rgb.join(', ')}]`)}`);
    }

    ctx.hasReadings = true;
}

module.exports = { fetch, display };
