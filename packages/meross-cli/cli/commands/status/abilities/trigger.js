'use strict';

const chalk = require('chalk');

function fetch(device, ctx) {
    ctx.fetchPromises.push(
        device.trigger.count()
            .then(count => { ctx.triggerCount = count; })
            .catch(() => { ctx.triggerCount = 0; })
    );
}

function display(_device, ctx) {
    if (ctx.triggerCount === null) {
        return;
    }

    ctx.sensorLines.push(`    ${chalk.white.bold('Triggers')}: ${chalk.italic(`${ctx.triggerCount} active`)}`);
    ctx.hasReadings = true;
}

module.exports = { fetch, display };
