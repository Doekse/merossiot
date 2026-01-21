'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const { TriggerType, TriggerUtils } = require('meross-iot');
const { durationToSeconds, secondsToDuration } = TriggerUtils;

/**
 * Collects parameters for setTriggerX interactively.
 *
 * Displays existing triggers for context, then prompts for trigger configuration.
 * Supports multiple trigger types and flexible duration formats.
 *
 * @param {Object} methodMetadata - Method metadata from control registry
 * @param {Object} device - Device instance
 * @returns {Promise<Object>} Collected parameters object
 */
async function collectSetTriggerXParams(methodMetadata, device) {
    const params = {};
    const channel = methodMetadata.params.find(p => p.name === 'triggerx')?.properties?.find(prop => prop.name === 'channel')?.default || 0;

    let hasTriggers = false;
    try {
        if (device.trigger && typeof device.trigger.get === 'function') {
            console.log(chalk.dim('Fetching existing triggers...'));
            const response = await device.trigger.get({ channel });
            if (response && response.triggerx && Array.isArray(response.triggerx) && response.triggerx.length > 0) {
                hasTriggers = true;
                console.log(chalk.cyan(`\nExisting Triggers (Channel ${channel}):`));
                response.triggerx.forEach((trigger, index) => {
                    const durationSeconds = trigger.rule?.duration || 0;
                    const durationStr = secondsToDuration(durationSeconds);
                    const alias = trigger.alias || `Trigger ${index + 1}`;
                    const enabled = trigger.enable === 1 ? chalk.green('Enabled') : chalk.red('Disabled');
                    console.log(chalk.dim(`  [${trigger.id}] ${alias} - ${durationStr} - ${enabled}`));
                });
                console.log();
            }
        }
    } catch (e) {
        // Continue without existing triggers if fetch fails
    }

    if (!hasTriggers) {
        console.log(chalk.yellow('No triggers currently set.\n'));
    }

    const aliasAnswer = await inquirer.prompt([{
        type: 'input',
        name: 'alias',
        message: 'Trigger Name',
        default: 'My Trigger',
        validate: (value) => {
            if (!value || value.trim() === '') {
                return 'Trigger name is required';
            }
            return true;
        }
    }]);

    const durationAnswer = await inquirer.prompt([{
        type: 'input',
        name: 'duration',
        message: 'Countdown Duration (e.g., "30m", "1h", "600", "30:00")',
        default: '10m',
        validate: (value) => {
            if (!value || value.trim() === '') {
                return 'Duration is required';
            }
            try {
                durationToSeconds(value.trim());
                return true;
            } catch (e) {
                return e.message;
            }
        }
    }]);

    const typeAnswer = await inquirer.prompt([{
        type: 'list',
        name: 'type',
        message: 'Trigger Type',
        choices: [
            { name: 'Single Point Weekly Cycle (repeats every week)', value: TriggerType.SINGLE_POINT_WEEKLY_CYCLE },
            { name: 'Single Point Single Shot (one time only)', value: TriggerType.SINGLE_POINT_SINGLE_SHOT },
            { name: 'Continuous Weekly Cycle (active continuously, repeats weekly)', value: TriggerType.CONTINUOUS_WEEKLY_CYCLE },
            { name: 'Continuous Single Shot (active continuously, one time only)', value: TriggerType.CONTINUOUS_SINGLE_SHOT }
        ],
        default: 0
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
        message: 'Trigger Status',
        choices: [
            { name: 'Enabled', value: true },
            { name: 'Disabled', value: false }
        ],
        default: 0
    }]);

    params.channel = channel;
    params.alias = aliasAnswer.alias;
    params.duration = durationAnswer.duration;
    params.days = daysAnswer.days;
    params.type = typeAnswer.type;
    params.enabled = enableAnswer.enabled;

    return params;
}

/**
 * Collects parameters for trigger.delete interactively.
 *
 * Displays existing triggers and allows selection from a list, or manual ID entry
 * if no triggers are found. Returns null to fall back to generic collection when
 * no triggers are available.
 *
 * @param {Object} methodMetadata - Method metadata from control registry
 * @param {Object} device - Device instance
 * @returns {Promise<Object|null>} Collected parameters object, or null to use generic collection
 */
async function collectDeleteTriggerXParams(methodMetadata, device) {
    const params = {};
    const channel = methodMetadata.params.find(p => p.name === 'channel')?.default || 0;

    try {
        if (device.trigger && typeof device.trigger.get === 'function') {
            // Clear cache to force fresh fetch after potential deletions
            if (device._triggerxStateByChannel) {
                device._triggerxStateByChannel.delete(channel);
            }
            console.log(chalk.dim('Fetching existing triggers...'));
            const response = await device.trigger.get({ channel });
            const items = response && response.triggerx && Array.isArray(response.triggerx) ? response.triggerx : [];
            
            if (items.length > 0) {
                console.log(chalk.cyan(`\nExisting Triggers (Channel ${channel}):`));
                items.forEach((item, index) => {
                    const durationSeconds = item.rule?.duration || 0;
                    const durationStr = secondsToDuration(durationSeconds);
                    const alias = item.alias || `Trigger ${index + 1}`;
                    const enabled = item.enable === 1 ? chalk.green('Enabled') : chalk.red('Disabled');
                    console.log(chalk.dim(`  [${item.id}] ${alias} - ${durationStr} - ${enabled}`));
                });
                console.log();

                const choices = items.map(item => {
                    const durationSeconds = item.rule?.duration || 0;
                    const durationStr = secondsToDuration(durationSeconds);
                    const alias = item.alias || 'Unnamed Trigger';
                    return {
                        name: `${alias} - ${durationStr}`,
                        value: item.id
                    };
                });

                const selected = await inquirer.prompt([{
                    type: 'list',
                    name: 'id',
                    message: 'Select trigger to delete:',
                    choices
                }]);

                params.triggerId = selected.id;
            } else {
                throw new Error(`No triggers found on channel ${channel}. Nothing to delete.`);
            }

            params.channel = channel;
            return params;
        }
    } catch (e) {
        // If it's our "no triggers" error, re-throw it
        if (e.message && e.message.includes('No triggers found')) {
            throw e;
        }
        // If fetch fails, throw error
        throw new Error('Unable to fetch triggers from device. Please try again.');
    }

    // Fallback if trigger feature is not available
    return null;
}

module.exports = { collectSetTriggerXParams, collectDeleteTriggerXParams };

