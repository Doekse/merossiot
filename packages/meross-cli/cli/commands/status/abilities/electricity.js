'use strict';

const chalk = require('chalk');

function fetch(device, ctx) {
    ctx.fetchPromises.push(
        device.electricity.get({ channel: ctx.primaryChannel })
            .then(result => { ctx.powerInfo = result; })
            .catch(() => { ctx.powerInfo = null; })
    );
}

function display(_device, ctx) {
    if (!ctx.powerInfo || ctx.powerInfo.wattage === undefined) {
        return;
    }

    ctx.sensorLines.push(`    ${chalk.white.bold('Power')}: ${chalk.italic(`${ctx.powerInfo.wattage.toFixed(2)} W`)}`);
    if (ctx.powerInfo.voltage !== undefined) {
        ctx.sensorLines.push(`    ${chalk.white.bold('Voltage')}: ${chalk.italic(`${ctx.powerInfo.voltage.toFixed(1)} V`)}`);
    }
    if (ctx.powerInfo.amperage !== undefined) {
        ctx.sensorLines.push(`    ${chalk.white.bold('Current')}: ${chalk.italic(`${ctx.powerInfo.amperage.toFixed(3)} A`)}`);
    }
    if (ctx.powerInfo.powerFactor !== undefined) {
        ctx.sensorLines.push(`    ${chalk.white.bold('Power Factor')}: ${chalk.italic(ctx.powerInfo.powerFactor.toFixed(2))}`);
    }
    if (ctx.powerInfo.monthlyConsumptionWh !== undefined) {
        ctx.sensorLines.push(`    ${chalk.white.bold('Monthly Consumption')}: ${chalk.italic(`${ctx.powerInfo.monthlyConsumptionWh} Wh`)}`);
    }
    ctx.hasReadings = true;
    ctx.hasElectricity = true;
}

module.exports = { fetch, display };
