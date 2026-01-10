'use strict';

const chalk = require('chalk');
const { ThermostatMode } = require('meross-iot');

function displayThermostatValveStatus(subdevice) {
    const temp = subdevice.getLastSampledTemperature();
    const targetTemp = subdevice.getTargetTemperature();
    const isHeating = subdevice.isHeating();
    const battery = subdevice.getCachedBattery();
    const mode = subdevice.getMode();
    const isWindowOpen = subdevice.isWindowOpen();
    const calibration = subdevice.getAdjust();
    const comfortTemp = subdevice.getPresetTemperature('comfort');
    const economyTemp = subdevice.getPresetTemperature('economy');
    const awayTemp = subdevice.getPresetTemperature('away');
    const customTemp = subdevice.getPresetTemperature('custom');

    let hasReadings = false;

    console.log(`\n    ${chalk.bold.underline('Sensors')}`);

    if (temp !== null) {
        console.log(`      ${chalk.white.bold('Temperature')}: ${chalk.italic(`${temp.toFixed(1)}°C`)}`);
        hasReadings = true;
    }

    if (isWindowOpen !== null && isWindowOpen !== undefined) {
        console.log(`      ${chalk.white.bold('Windowopened')}: ${chalk.italic(isWindowOpen ? 'Open' : 'Closed')}`);
        hasReadings = true;
    }

    if (battery !== null && battery !== undefined) {
        console.log(`      ${chalk.white.bold('Battery')}: ${chalk.italic(`${battery}%`)}`);
        hasReadings = true;
    }

    console.log(`\n    ${chalk.bold.underline('Configuration')}`);

    if (mode !== undefined && mode !== null) {
        const modeNames = {
            [ThermostatMode.HEAT]: 'Heat',
            [ThermostatMode.COOL]: 'Cool',
            [ThermostatMode.ECONOMY]: 'Economy',
            [ThermostatMode.AUTO]: 'Auto',
            [ThermostatMode.MANUAL]: 'Manual'
        };
        const modeName = modeNames[mode] || `Mode ${mode}`;
        const onoffStatus = subdevice.isOn() ? 'On' : 'Off';
        console.log(`      ${chalk.white.bold('Mode')}: ${chalk.italic(`${onoffStatus} - ${modeName}${targetTemp !== null ? ` ${targetTemp.toFixed(1)}°C` : ''}`)}`);
        hasReadings = true;
    } else if (targetTemp !== null) {
        console.log(`      ${chalk.white.bold('Target Temperature')}: ${chalk.italic(`${targetTemp.toFixed(1)}°C`)}`);
        hasReadings = true;
    }

    if (comfortTemp !== null) {
        console.log(`      ${chalk.white.bold('Comfort Temperature')}: ${chalk.italic(`${comfortTemp.toFixed(1)}°C`)}`);
    }
    if (economyTemp !== null) {
        console.log(`      ${chalk.white.bold('Economy Temperature')}: ${chalk.italic(`${economyTemp.toFixed(1)}°C`)}`);
    }
    if (awayTemp !== null) {
        console.log(`      ${chalk.white.bold('Away Temperature')}: ${chalk.italic(`${awayTemp.toFixed(1)}°C`)}`);
    }
    if (customTemp !== null) {
        console.log(`      ${chalk.white.bold('Custom Temperature')}: ${chalk.italic(`${customTemp.toFixed(1)}°C`)}`);
    }

    if (calibration !== null) {
        console.log(`      ${chalk.white.bold('Calibration')}: ${chalk.italic(`${calibration.toFixed(1)}°C`)}`);
    }

    if (isHeating !== null && isHeating !== undefined) {
        console.log(`      ${chalk.white.bold('Status')}: ${chalk.italic(isHeating ? 'Heating' : 'Not heating')}`);
        hasReadings = true;
    }

    return hasReadings;
}

module.exports = { displayThermostatValveStatus };

