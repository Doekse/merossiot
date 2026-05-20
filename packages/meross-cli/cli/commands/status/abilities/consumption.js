'use strict';

const chalk = require('chalk');

function fetch(device, ctx) {
    ctx.fetchPromises.push(
        device.consumption.get({ channel: ctx.primaryChannel })
            .then(result => { ctx.consumptionData = result; })
            .catch(() => { ctx.consumptionData = null; })
    );

    if (ctx.abilities['Appliance.Control.ConsumptionConfig']) {
        ctx.fetchPromises.push(
            (async () => {
                try {
                    const response = await device.consumption.getConfig();
                    ctx.consumptionConfigResponse = response;
                    return response;
                } catch {
                    return null;
                }
            })()
        );
    }
}

function display(_device, ctx) {
    if (ctx.consumptionData && Array.isArray(ctx.consumptionData) && ctx.consumptionData.length > 0) {
        const latest = ctx.consumptionData[ctx.consumptionData.length - 1];
        if (latest && latest.totalConsumptionKwh !== undefined && latest.totalConsumptionKwh !== null) {
            ctx.sensorLines.push(`    ${chalk.white.bold('Consumption')}: ${chalk.italic(`${latest.totalConsumptionKwh.toFixed(2)} kWh`)}`);
        } else {
            ctx.sensorLines.push(`    ${chalk.white.bold('Consumption')}: ${chalk.italic('N/A')}`);
        }
    } else {
        ctx.sensorLines.push(`    ${chalk.white.bold('Consumption')}: ${chalk.italic('N/A')}`);
    }
    ctx.hasReadings = true;

    if (ctx.consumptionConfigResponse && ctx.consumptionConfigResponse.config) {
        const { config } = ctx.consumptionConfigResponse;
        const configLines = [];
        if (config.voltageRatio !== undefined) {
            configLines.push(`voltageRatio: ${config.voltageRatio}`);
        }
        if (config.electricityRatio !== undefined) {
            configLines.push(`electricityRatio: ${config.electricityRatio}`);
        }
        if (config.maxElectricityCurrent !== undefined) {
            configLines.push(`maxCurrent: ${(config.maxElectricityCurrent / 1000.0).toFixed(1)} A`);
        }
        if (configLines.length > 0) {
            ctx.sensorLines.push(`    ${chalk.white.bold('Consumption Config')}: ${chalk.italic(configLines.join(', '))}`);
            ctx.hasReadings = true;
        }
    }
}

module.exports = { fetch, display };
