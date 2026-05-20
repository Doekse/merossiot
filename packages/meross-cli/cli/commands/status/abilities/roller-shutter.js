'use strict';

const chalk = require('chalk');

function fetch(device, ctx) {
    ctx.fetchPromises.push(
        device.rollerShutter.get({ channel: ctx.primaryChannel })
            .then(result => { ctx.shutterState = result; })
            .catch(() => { ctx.shutterState = null; })
    );
}

function display(_device, ctx) {
    if (!ctx.shutterState) {
        return;
    }

    if (ctx.shutterState.position !== undefined) {
        ctx.sensorLines.push(`    ${chalk.white.bold('Position')}: ${chalk.italic(`${ctx.shutterState.position}%`)}`);
    }
    if (ctx.shutterState.state !== undefined) {
        const stateNames = { 0: 'Closed', 1: 'Opening', 2: 'Open', 3: 'Closing' };
        const stateName = stateNames[ctx.shutterState.state] || `State ${ctx.shutterState.state}`;
        ctx.sensorLines.push(`    ${chalk.white.bold('State')}: ${chalk.italic(stateName)}`);
    }
    ctx.hasReadings = true;
}

module.exports = { fetch, display };
