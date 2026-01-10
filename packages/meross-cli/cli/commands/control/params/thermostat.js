'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const { ThermostatMode } = require('meross-iot');

/**
 * Collects parameters for setThermostatMode with interactive prompts.
 */
async function collectThermostatModeParams(methodMetadata, device) {
    const params = {};
    const channel = methodMetadata.params.find(p => p.name === 'channel')?.default || 0;

    // Display current state
    try {
        if (typeof device.getThermostatMode === 'function') {
            console.log(chalk.dim('Fetching current thermostat state...'));
            const response = await device.getThermostatMode({ channel });
            if (response && response.mode && Array.isArray(response.mode) && response.mode.length > 0) {
                const currentState = response.mode[0];
                console.log(chalk.cyan('\nCurrent Thermostat State:'));
                if (currentState.mode !== undefined) {
                    const modeNames = {
                        [ThermostatMode.HEAT]: 'Heat',
                        [ThermostatMode.COOL]: 'Cool',
                        [ThermostatMode.ECONOMY]: 'Economy',
                        [ThermostatMode.AUTO]: 'Auto',
                        [ThermostatMode.MANUAL]: 'Manual'
                    };
                    const modeName = modeNames[currentState.mode] || `Mode ${currentState.mode}`;
                    console.log(chalk.dim(`  Mode: ${modeName}`));
                }
                if (currentState.onoff !== undefined) {
                    console.log(chalk.dim(`  Power: ${currentState.onoff ? 'On' : 'Off'}`));
                }
                if (currentState.heatTemp !== undefined) {
                    console.log(chalk.dim(`  Heat Temp: ${currentState.heatTemp / 10}°C`));
                }
                if (currentState.coolTemp !== undefined) {
                    console.log(chalk.dim(`  Cool Temp: ${currentState.coolTemp / 10}°C`));
                }
                if (currentState.ecoTemp !== undefined) {
                    console.log(chalk.dim(`  Eco Temp: ${currentState.ecoTemp / 10}°C`));
                }
                if (currentState.manualTemp !== undefined) {
                    console.log(chalk.dim(`  Manual Temp: ${currentState.manualTemp / 10}°C`));
                }
                console.log();
            }
        }
    } catch (e) {
        // Failed to fetch, continue without current state
    }

    // Collect parameters interactively
    params.channel = channel;
    params.partialUpdate = true;

    // Ask which fields to update
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

    // Prompt for each selected field
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

