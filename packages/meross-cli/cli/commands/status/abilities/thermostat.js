'use strict';

const chalk = require('chalk');
const { hasAbility } = require('./utils');

const THERMOSTAT_MODE_LABELS = {
    heat: 'Heat',
    cool: 'Cool',
    economy: 'Economy',
    auto: 'Auto',
    manual: 'Manual'
};

const MODE_NAMESPACES = [
    'Appliance.Control.Thermostat.Mode',
    'Appliance.Control.Thermostat.ModeB'
];

function fetch(device, ctx) {
    if (hasAbility(ctx.abilities, MODE_NAMESPACES)) {
        ctx.fetchPromises.push(
            device.thermostat.get({ channel: ctx.primaryChannel })
                .then(result => { ctx.thermostatState = result; })
                .catch(() => { ctx.thermostatState = null; })
        );
    }

    if (ctx.abilities['Appliance.Control.Thermostat.WindowOpened']) {
        ctx.fetchPromises.push(
            (async () => {
                try {
                    const response = await device.thermostat.getWindowOpened({ channel: ctx.primaryChannel });
                    ctx.thermostatResponses.windowOpened = response;
                    return response;
                } catch {
                    return null;
                }
            })()
        );
    }

    if (ctx.abilities['Appliance.Control.Thermostat.Overheat']) {
        ctx.fetchPromises.push(
            (async () => {
                try {
                    const response = await device.thermostat.getOverheat({ channel: ctx.primaryChannel });
                    ctx.thermostatResponses.overheat = response;
                    return response;
                } catch {
                    return null;
                }
            })()
        );
    }

    if (ctx.abilities['Appliance.Control.Thermostat.Calibration']) {
        ctx.fetchPromises.push(
            (async () => {
                try {
                    const response = await device.thermostat.getCalibration({ channel: ctx.primaryChannel });
                    ctx.thermostatResponses.calibration = response;
                    return response;
                } catch {
                    return null;
                }
            })()
        );
    }

    if (ctx.abilities['Appliance.Control.Thermostat.Frost']) {
        ctx.fetchPromises.push(
            (async () => {
                try {
                    const response = await device.thermostat.getFrost({ channel: ctx.primaryChannel });
                    ctx.thermostatResponses.frost = response;
                    return response;
                } catch {
                    return null;
                }
            })()
        );
    }
}

function displayThermostatState(ctx) {
    if (!ctx.thermostatState) {
        return;
    }

    const currentTemp = ctx.thermostatState.currentTemperatureCelsius;
    if (currentTemp !== undefined && currentTemp !== null) {
        ctx.sensorLines.push(`    ${chalk.white.bold('Temperature')}: ${chalk.italic(`${currentTemp.toFixed(1)}°C`)}`);
    }
    const targetTemp = ctx.thermostatState.targetTemperatureCelsius;
    if (targetTemp !== undefined && targetTemp !== null) {
        ctx.sensorLines.push(`    ${chalk.white.bold('Target Temperature')}: ${chalk.italic(`${targetTemp.toFixed(1)}°C`)}`);
    }
    if (ctx.thermostatState.warning) {
        ctx.sensorLines.push(`    ${chalk.white.bold('Warning')}: ${chalk.italic('Active')}`);
    }
    ctx.hasReadings = true;
}

function displayThermostatResponses(ctx) {
    if (ctx.thermostatResponses.windowOpened && ctx.thermostatResponses.windowOpened.windowOpened) {
        const wo = ctx.thermostatResponses.windowOpened.windowOpened[0];
        if (wo && wo.status !== undefined) {
            ctx.sensorLines.push(`    ${chalk.white.bold('Window Opened')}: ${chalk.italic(wo.status === 1 ? 'Open' : 'Closed')}`);
            ctx.hasReadings = true;
        }
    }

    if (ctx.thermostatResponses.overheat && ctx.thermostatResponses.overheat.overheat) {
        const oh = ctx.thermostatResponses.overheat.overheat[0];
        if (oh) {
            if (oh.currentTemp !== undefined) {
                ctx.sensorLines.push(`    ${chalk.white.bold('External Sensor')}: ${chalk.italic(`${(oh.currentTemp / 10.0).toFixed(1)}°C`)}`);
                ctx.hasReadings = true;
            }
            if (oh.warning !== undefined && oh.warning === 1) {
                ctx.sensorLines.push(`    ${chalk.white.bold('Overheat Warning')}: ${chalk.italic('Active')}`);
                ctx.hasReadings = true;
            }
        }
    }

    if (ctx.thermostatResponses.calibration && ctx.thermostatResponses.calibration.calibration) {
        const cal = ctx.thermostatResponses.calibration.calibration[0];
        if (cal && cal.humiValue !== undefined) {
            ctx.sensorLines.push(`    ${chalk.white.bold('Sensor Humidity')}: ${chalk.italic(`${(cal.humiValue / 10.0).toFixed(1)}%`)}`);
            ctx.hasReadings = true;
        }
    }

    if (ctx.thermostatResponses.frost && ctx.thermostatResponses.frost.frost) {
        const frost = ctx.thermostatResponses.frost.frost[0];
        if (frost && frost.warning !== undefined && frost.warning === 1) {
            ctx.sensorLines.push(`    ${chalk.white.bold('Frost Warning')}: ${chalk.italic('Active')}`);
            ctx.hasReadings = true;
        }
    }
}

function display(_device, ctx) {
    displayThermostatState(ctx);
    displayThermostatResponses(ctx);
}

function displayConfig(_device, ctx) {
    if (!ctx.thermostatState) {
        return;
    }

    const configInfo = [];
    const { thermostatState } = ctx;

    if (thermostatState.mode !== undefined) {
        const modeName = THERMOSTAT_MODE_LABELS[thermostatState.mode] || `Mode ${thermostatState.mode}`;
        const onoffStatus = thermostatState.isOn ? chalk.green('On') : chalk.red('Off');
        const targetTemp = thermostatState.targetTemperatureCelsius !== undefined
            ? `${thermostatState.targetTemperatureCelsius.toFixed(1)}°C`
            : '';
        configInfo.push(['Mode', `${onoffStatus} - ${modeName} ${targetTemp}`.trim()]);
    }

    if (thermostatState.heatTemperatureCelsius !== undefined) {
        configInfo.push(['Comfort Temperature', `${thermostatState.heatTemperatureCelsius.toFixed(1)}°C`]);
    }
    if (thermostatState.coolTemperatureCelsius !== undefined) {
        configInfo.push(['Cool Temperature', `${thermostatState.coolTemperatureCelsius.toFixed(1)}°C`]);
    }
    if (thermostatState.ecoTemperatureCelsius !== undefined) {
        configInfo.push(['Economy Temperature', `${thermostatState.ecoTemperatureCelsius.toFixed(1)}°C`]);
    }
    if (thermostatState.manualTemperatureCelsius !== undefined) {
        configInfo.push(['Away Temperature', `${thermostatState.manualTemperatureCelsius.toFixed(1)}°C`]);
    }

    if (thermostatState.minTemperatureCelsius !== undefined && thermostatState.maxTemperatureCelsius !== undefined) {
        configInfo.push(['Temperature Range', `${thermostatState.minTemperatureCelsius.toFixed(1)}°C - ${thermostatState.maxTemperatureCelsius.toFixed(1)}°C`]);
    }

    if (thermostatState.workingMode !== undefined) {
        const labels = {
            heating: chalk.green('Heating'),
            cooling: chalk.cyan('Cooling')
        };
        const stateColor = labels[thermostatState.workingMode] ?? chalk.gray.bold(thermostatState.workingMode);
        configInfo.push(['Status', stateColor]);
    }

    if (configInfo.length > 0) {
        ctx.configItems.push(...configInfo);
        ctx.hasReadings = true;
    }
}

module.exports = { fetch, display, displayConfig };
