'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const { TimerType, TimerUtils } = require('meross-iot');
const { timeToMinutes } = TimerUtils;

/**
 * Collects parameters for setTimerX with interactive prompts.
 */
async function collectSetTimerXParams(methodMetadata, device) {
    const params = {};
    const channel = methodMetadata.params.find(p => p.name === 'timerx')?.properties?.find(prop => prop.name === 'channel')?.default || 0;

    // Show existing timers
    let hasTimers = false;
    try {
        if (typeof device.getTimerX === 'function') {
            console.log(chalk.dim('Fetching existing timers...'));
            const response = await device.getTimerX({ channel });
            if (response && response.timerx && Array.isArray(response.timerx) && response.timerx.length > 0) {
                hasTimers = true;
                console.log(chalk.cyan(`\nExisting Timers (Channel ${channel}):`));
                response.timerx.forEach((timer, index) => {
                    const timeMinutes = timer.time || 0;
                    const hours = Math.floor(timeMinutes / 60);
                    const minutes = timeMinutes % 60;
                    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                    const alias = timer.alias || `Timer ${index + 1}`;
                    const enabled = timer.enable === 1 ? chalk.green('Enabled') : chalk.red('Disabled');
                    const action = timer.extend?.toggle?.onoff === 1 ? 'ON' : 'OFF';
                    console.log(chalk.dim(`  [${timer.id}] ${alias} - ${timeStr} (Action: ${action}) - ${enabled}`));
                });
                console.log();
            }
        }
    } catch (e) {
        // Failed to fetch, continue
    }

    if (!hasTimers) {
        console.log(chalk.yellow('No timers currently set.\n'));
    }

    // Collect timer configuration
    const aliasAnswer = await inquirer.prompt([{
        type: 'input',
        name: 'alias',
        message: 'Timer Name',
        default: 'My Timer',
        validate: (value) => {
            if (!value || value.trim() === '') {
                return 'Timer name is required';
            }
            return true;
        }
    }]);

    const actionAnswer = await inquirer.prompt([{
        type: 'list',
        name: 'on',
        message: 'Action when timer triggers',
        choices: [
            { name: 'Turn Device ON', value: true },
            { name: 'Turn Device OFF', value: false }
        ]
    }]);

    const typeAnswer = await inquirer.prompt([{
        type: 'list',
        name: 'type',
        message: 'Timer Type',
        choices: [
            { name: 'Single Point Weekly Cycle (repeats every week)', value: TimerType.SINGLE_POINT_WEEKLY_CYCLE },
            { name: 'Single Point Single Shot (one time only)', value: TimerType.SINGLE_POINT_SINGLE_SHOT }
        ],
        default: 0
    }]);

    // Get current time for context
    let currentTimeStr = '';
    try {
        if (typeof device.getSystemTime === 'function') {
            const timeResponse = await device.getSystemTime();
            if (timeResponse && timeResponse.time && timeResponse.time.timestamp) {
                const date = new Date(timeResponse.time.timestamp * 1000);
                const hours = date.getHours();
                const minutes = date.getMinutes();
                currentTimeStr = ` (Device time: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')})`;
            }
        }
    } catch (e) {
        // Failed to get device time
    }
    if (!currentTimeStr) {
        const now = new Date();
        currentTimeStr = ` (Current time: ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')})`;
    }

    const timeAnswer = await inquirer.prompt([{
        type: 'input',
        name: 'time',
        message: `Time (HH:MM format, 24-hour)${currentTimeStr}`,
        validate: (value) => {
            if (!value || value.trim() === '') {
                return 'Time is required';
            }
            try {
                timeToMinutes(value.trim());
                return true;
            } catch (e) {
                return e.message;
            }
        }
    }]);

    const daysAnswer = await inquirer.prompt([{
        type: 'checkbox',
        name: 'days',
        message: 'Days of week',
        choices: [
            { name: 'Monday', value: 'monday' },
            { name: 'Tuesday', value: 'tuesday' },
            { name: 'Wednesday', value: 'wednesday' },
            { name: 'Thursday', value: 'thursday' },
            { name: 'Friday', value: 'friday' },
            { name: 'Saturday', value: 'saturday' },
            { name: 'Sunday', value: 'sunday' }
        ],
        validate: (answer) => {
            if (answer.length === 0) {
                return 'Please select at least one day';
            }
            return true;
        }
    }]);

    const enableAnswer = await inquirer.prompt([{
        type: 'list',
        name: 'enabled',
        message: 'Timer Status',
        choices: [
            { name: 'Enabled', value: true },
            { name: 'Disabled', value: false }
        ],
        default: 0
    }]);

    // Pass user-friendly format to API (API handles conversion)
    params.channel = channel;
    params.alias = aliasAnswer.alias;
    params.time = timeAnswer.time;
    params.days = daysAnswer.days;
    params.on = actionAnswer.on;
    params.type = typeAnswer.type;
    params.enabled = enableAnswer.enabled;

    return params;
}

/**
 * Collects parameters for deleteTimerX with interactive prompts.
 */
async function collectDeleteTimerXParams(methodMetadata, device) {
    const params = {};
    const channel = methodMetadata.params.find(p => p.name === 'channel')?.default || 0;

    try {
        if (typeof device.getTimerX === 'function') {
            console.log(chalk.dim('Fetching existing timers...'));
            const response = await device.getTimerX({ channel });
            if (response && response.timerx && Array.isArray(response.timerx) && response.timerx.length > 0) {
                const items = response.timerx;
                console.log(chalk.cyan(`\nExisting Timers (Channel ${channel}):`));
                items.forEach((item, index) => {
                    const timeMinutes = item.time || 0;
                    const hours = Math.floor(timeMinutes / 60);
                    const minutes = timeMinutes % 60;
                    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                    const alias = item.alias || `Timer ${index + 1}`;
                    const enabled = item.enable === 1 ? chalk.green('Enabled') : chalk.red('Disabled');
                    const action = item.extend?.toggle?.onoff === 1 ? 'ON' : 'OFF';
                    console.log(chalk.dim(`  [${item.id}] ${alias} - ${timeStr} (Action: ${action}) - ${enabled}`));
                });
                console.log();

                // Allow selection from list
                const choices = items.map(item => {
                    const timeMinutes = item.time || 0;
                    const hours = Math.floor(timeMinutes / 60);
                    const minutes = timeMinutes % 60;
                    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                    const alias = item.alias || 'Unnamed Timer';
                    return {
                        name: `${alias} - ${timeStr}`,
                        value: item.id
                    };
                });

                choices.push(new inquirer.Separator());
                choices.push({
                    name: 'Enter ID Manually',
                    value: '__manual__'
                });

                const selected = await inquirer.prompt([{
                    type: 'list',
                    name: 'id',
                    message: 'Select timer to delete:',
                    choices
                }]);

                if (selected.id === '__manual__') {
                    const manualAnswer = await inquirer.prompt([{
                        type: 'input',
                        name: 'id',
                        message: 'Timer ID',
                        validate: (value) => {
                            if (!value || value.trim() === '') {
                                return 'ID is required';
                            }
                            return true;
                        }
                    }]);
                    params.timerId = manualAnswer.id;
                } else {
                    params.timerId = selected.id;
                }

                params.channel = channel;
                return params;
            }
        }
    } catch (e) {
        // Failed to fetch, continue with generic collection
    }

    return null; // Return null to fall back to generic collection
}

module.exports = { collectSetTimerXParams, collectDeleteTimerXParams };

