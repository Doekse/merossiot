'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const { ThermostatMode } = require('meross-iot');

/**
 * Collects parameters for thermostat.set interactively.
 *
 * Displays current thermostat state to provide context, then prompts for which
 * fields to update. Supports partial updates to avoid overwriting unchanged values.
 *
 * @param {Object} methodMetadata - Method metadata from control registry
 * @param {Object} device - Device instance
 * @returns {Promise<Object>} Collected parameters object
 */
async function collectThermostatModeParams(methodMetadata, device) {
    const params = {};
    const channel = methodMetadata.params.find(p => p.name === 'channel')?.default || 0;

    try {
        if (device.thermostat) {
            console.log(chalk.dim('Fetching current thermostat state...'));
            const thermostatState = await device.thermostat.get({ channel });
            if (thermostatState) {
                console.log(chalk.cyan('\nCurrent Thermostat State:'));
                if (thermostatState.mode !== undefined) {
                    const modeNames = {
                        [ThermostatMode.HEAT]: 'Heat',
                        [ThermostatMode.COOL]: 'Cool',
                        [ThermostatMode.ECONOMY]: 'Economy',
                        [ThermostatMode.AUTO]: 'Auto',
                        [ThermostatMode.MANUAL]: 'Manual'
                    };
                    const modeName = modeNames[thermostatState.mode] || `Mode ${thermostatState.mode}`;
                    console.log(chalk.dim(`  Mode: ${modeName}`));
                }
                if (thermostatState.isOn !== undefined) {
                    console.log(chalk.dim(`  Power: ${thermostatState.isOn ? 'On' : 'Off'}`));
                }
                if (thermostatState.heatTemperatureCelsius !== undefined) {
                    console.log(chalk.dim(`  Heat Temp: ${thermostatState.heatTemperatureCelsius.toFixed(1)}°C`));
                }
                if (thermostatState.coolTemperatureCelsius !== undefined) {
                    console.log(chalk.dim(`  Cool Temp: ${thermostatState.coolTemperatureCelsius.toFixed(1)}°C`));
                }
                if (thermostatState.ecoTemperatureCelsius !== undefined) {
                    console.log(chalk.dim(`  Eco Temp: ${thermostatState.ecoTemperatureCelsius.toFixed(1)}°C`));
                }
                if (thermostatState.manualTemperatureCelsius !== undefined) {
                    console.log(chalk.dim(`  Manual Temp: ${thermostatState.manualTemperatureCelsius.toFixed(1)}°C`));
                }
                console.log();
            }
        }
    } catch (e) {
        // Continue without current state if fetch fails
    }

    params.channel = channel;
    params.partialUpdate = true;

    const fieldsToUpdate = await inquirer.prompt([{
        type: 'checkbox',
        name: 'fields',
        message: 'Select fields to update (use space to select, enter to confirm):',
        choices: [
            { name: 'Mode (Heat/Cool/Economy/Auto/Manual)', value: 'mode', checked: false },
            { name: 'Power (On/Off)', value: 'onoff', checked: false },
            { name: 'Heat Temperature (°C)', value: 'heatTemperature', checked: false },
            { name: 'Cool Temperature (°C)', value: 'coolTemperature', checked: false },
            { name: 'Eco Temperature (°C)', value: 'ecoTemperature', checked: false },
            { name: 'Manual Temperature (°C)', value: 'manualTemperature', checked: false }
        ],
        validate: (answer) => {
            if (answer.length === 0) {
                return 'Please select at least one field to update';
            }
            return true;
        }
    }]);

    for (const field of fieldsToUpdate.fields) {
        if (field === 'mode') {
            const answer = await inquirer.prompt([{
                type: 'list',
                name: 'mode',
                message: 'Thermostat Mode',
                choices: [
                    { name: 'Heat', value: ThermostatMode.HEAT },
                    { name: 'Cool', value: ThermostatMode.COOL },
                    { name: 'Economy', value: ThermostatMode.ECONOMY },
                    { name: 'Auto', value: ThermostatMode.AUTO },
                    { name: 'Manual', value: ThermostatMode.MANUAL }
                ]
            }]);
            params.mode = answer.mode;
        } else if (field === 'onoff') {
            const answer = await inquirer.prompt([{
                type: 'list',
                name: 'onoff',
                message: 'Power State',
                choices: [
                    { name: 'On', value: 1 },
                    { name: 'Off', value: 0 }
                ]
            }]);
            params.onoff = answer.onoff;
        } else if (field === 'heatTemperature') {
            const answer = await inquirer.prompt([{
                type: 'number',
                name: 'heatTemperature',
                message: 'Heat Temperature (°C)',
                validate: (value) => {
                    if (value === null || value === undefined) {
                        return 'Temperature is required';
                    }
                    return true;
                }
            }]);
            params.heatTemperature = answer.heatTemperature;
        } else if (field === 'coolTemperature') {
            const answer = await inquirer.prompt([{
                type: 'number',
                name: 'coolTemperature',
                message: 'Cool Temperature (°C)',
                validate: (value) => {
                    if (value === null || value === undefined) {
                        return 'Temperature is required';
                    }
                    return true;
                }
            }]);
            params.coolTemperature = answer.coolTemperature;
        } else if (field === 'ecoTemperature') {
            const answer = await inquirer.prompt([{
                type: 'number',
                name: 'ecoTemperature',
                message: 'Eco Temperature (°C)',
                validate: (value) => {
                    if (value === null || value === undefined) {
                        return 'Temperature is required';
                    }
                    return true;
                }
            }]);
            params.ecoTemperature = answer.ecoTemperature;
        } else if (field === 'manualTemperature') {
            const answer = await inquirer.prompt([{
                type: 'number',
                name: 'manualTemperature',
                message: 'Manual Temperature (°C)',
                validate: (value) => {
                    if (value === null || value === undefined) {
                        return 'Temperature is required';
                    }
                    return true;
                }
            }]);
            params.manualTemperature = answer.manualTemperature;
        }
    }

    return params;
}

module.exports = { collectThermostatModeParams };

