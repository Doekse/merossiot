'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const { MerossSubDevice, createDebugUtils, TransportMode } = require('meross-iot');
const { formatDevice } = require('../../utils/display');
const { clearScreen, renderSimpleHeader, clearMenuArea, SIMPLE_CONTENT_START_LINE } = require('../../utils/terminal');
const { detectControlMethods } = require('../../control-registry');
const { collectControlParameters } = require('./params');
const { executeControlCommand } = require('./execute');

// Helper function for backward compatibility
async function question(rl, query) {
    // For backward compatibility, use inquirer for better UX
    const result = await inquirer.prompt([{
        type: 'input',
        name: 'value',
        message: query.replace(/:\s*$/, '')
    }]);
    return result.value;
}

/**
 * Interactive device control menu.
 * @param {Object} manager - ManagerMeross instance
 * @param {Object} rl - Readline interface
 * @param {string|null} currentUser - Current logged in user name
 */
async function controlDeviceMenu(manager, rl, currentUser = null) {
    const devices = manager.devices.list().filter(d => !(d instanceof MerossSubDevice));
    if (devices.length === 0) {
        console.log('\nNo devices found.');
        return;
    }

    // Select device
    const deviceChoices = devices.map((device) => {
        const info = formatDevice(device);
        return {
            name: `${info.name} (${info.uuid})`,
            value: info.uuid
        };
    });

    const { uuid } = await inquirer.prompt([{
        type: 'list',
        name: 'uuid',
        message: 'Select device to control:',
        choices: deviceChoices
    }]);

    const device = manager.devices.get(uuid);

    // Wait for device to connect if needed
    if (!device.deviceConnected) {
        console.log(chalk.yellow('\nWaiting for device to connect...'));
        const spinner = ora('Connecting').start();
        let connected = false;
        for (let i = 0; i < 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            if (device.deviceConnected) {
                connected = true;
                break;
            }
        }
        spinner.stop();
        if (!connected) {
            console.log(chalk.red('\nDevice did not connect in time. Please try again.'));
            return;
        }
    }

    // Abilities are already loaded at device creation (single-phase initialization)
    // Detect available control methods (filtered by device capabilities)
    const availableMethods = detectControlMethods(device);
    if (availableMethods.length === 0) {
        console.log(chalk.yellow('\nNo control methods available for this device.'));
        return;
    }

    // Group methods by category
    const methodsByCategory = {};
    for (const method of availableMethods) {
        const category = method.category || 'Other';
        if (!methodsByCategory[category]) {
            methodsByCategory[category] = [];
        }
        methodsByCategory[category].push(method);
    }

    // Control loop
    while (true) {
        clearScreen();
        const deviceCount = manager.devices.list().filter(d => !(d instanceof MerossSubDevice)).length;
        renderSimpleHeader(currentUser, deviceCount);
        clearMenuArea(SIMPLE_CONTENT_START_LINE);

        const info = formatDevice(manager.devices.get(uuid));
        console.log(chalk.bold(`=== Control Device: ${info.name} ===\n`));

        // Build choices grouped by category
        const choices = [];
        for (const [category, methods] of Object.entries(methodsByCategory)) {
            choices.push(new inquirer.Separator(chalk.bold(category)));
            for (const method of methods) {
                choices.push({
                    name: `${method.name} - ${method.description}`,
                    value: method.methodName
                });
            }
        }
        choices.push(new inquirer.Separator());
        choices.push({ name: 'Back to main menu', value: 'back' });

        const { methodName } = await inquirer.prompt([{
            type: 'list',
            name: 'methodName',
            message: 'Select control method:',
            choices
        }]);

        if (methodName === 'back') {
            break;
        }

        // Get method metadata
        const method = availableMethods.find(m => m.methodName === methodName);
        if (!method) {
            console.log(chalk.red('\nMethod not found.'));
            await question(rl, '\nPress Enter to continue...');
            continue;
        }

        try {
            // Collect parameters
            const params = await collectControlParameters(methodName, method, device);

            // Ensure stats are enabled (they should be, but verify)
            const debug = createDebugUtils(manager);
            if (!debug.isStatsEnabled()) {
                console.log(chalk.yellow('\nNote: Statistics tracking is disabled. Enable it in Settings to track control commands.'));
            }

            // Check error budget if using LAN HTTP transport modes
            const transportMode = manager.transport.defaultMode;
            const usesLanHttp = transportMode === TransportMode.LAN_HTTP_FIRST ||
                                transportMode === TransportMode.LAN_HTTP_FIRST_ONLY_GET;
            if (usesLanHttp) {
                const debug = createDebugUtils(manager);
                const budget = debug.getErrorBudget(uuid);
                if (budget < 1) {
                    console.log(chalk.yellow(`\n⚠ Device is out of error budget (${budget} remaining). HTTP requests will be blocked and fallback to MQTT will be used.`));
                    console.log(chalk.dim('   You can reset the error budget in Settings > Error Budget Management.\n'));
                }
            }

            // Execute command
            console.log(chalk.cyan(`\nExecuting ${method.name}...`));
            const spinner = ora('Sending command').start();

            const result = await executeControlCommand(manager, uuid, methodName, params);

            spinner.stop();
            console.log(chalk.green('\n✓ Command executed successfully!'));

            if (result) {
                console.log(chalk.dim('\nResponse:'));
                console.log(JSON.stringify(result, null, 2));
            }

        } catch (error) {
            const { handleError } = require('../../utils/error-handler');
            handleError(error, { verbose: process.env.MEROSS_VERBOSE === 'true' });
        }

        const { continueControl } = await inquirer.prompt([{
            type: 'confirm',
            name: 'continueControl',
            message: '\nControl this device again?',
            default: true
        }]);

        if (!continueControl) {
            break;
        }
    }
}

module.exports = { controlDeviceMenu };

