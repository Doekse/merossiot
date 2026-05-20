'use strict';

const chalk = require('chalk');

function fetch(device, ctx) {
    if (ctx.abilities['Appliance.Control.Sensor.LatestX']) {
        ctx.fetchPromises.push(
            device.presence.get({ channel: ctx.primaryChannel }).catch(() => null)
        );
    }
}

function display(device, ctx) {
    const presence = device.presence.getPresence({ channel: ctx.primaryChannel });
    if (presence) {
        const presenceState = presence.isPresent ? chalk.green('Present') : chalk.yellow('Absent');
        ctx.sensorLines.push(`    ${chalk.white.bold('Presence')}: ${chalk.italic(presenceState)}`);

        if (presence.distance !== null && presence.distance !== undefined) {
            ctx.sensorLines.push(`    ${chalk.white.bold('Distance')}: ${chalk.italic(`${presence.distance.toFixed(2)} m`)}`);
        }

        if (presence.timestamp) {
            ctx.sensorLines.push(`    ${chalk.white.bold('Last Detection')}: ${chalk.italic(presence.timestamp.toLocaleString())}`);
        }

        ctx.hasReadings = true;
    }

    const light = device.presence.getLight({ channel: ctx.primaryChannel });
    if (light && light.value !== undefined) {
        ctx.sensorLines.push(`    ${chalk.white.bold('Light')}: ${chalk.italic(`${light.value} lx`)}`);
        ctx.hasReadings = true;
    }
}

module.exports = { fetch, display };
