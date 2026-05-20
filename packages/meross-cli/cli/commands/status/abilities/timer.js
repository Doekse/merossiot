'use strict';

const chalk = require('chalk');

function fetch(device, ctx) {
    ctx.fetchPromises.push(
        device.timer.count()
            .then(count => { ctx.timerCount = count; })
            .catch(() => { ctx.timerCount = 0; })
    );
}

function display(_device, ctx) {
    if (ctx.timerCount === null) {
        return;
    }

    ctx.sensorLines.push(`    ${chalk.white.bold('Timers')}: ${chalk.italic(`${ctx.timerCount} active`)}`);
    ctx.hasReadings = true;
}

module.exports = { fetch, display };
