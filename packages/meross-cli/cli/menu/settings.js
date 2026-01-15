'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const { MerossSubDevice, createDebugUtils, TransportMode } = require('meross-iot');
const { getTransportModeName } = require('../helpers/client');
const { clearScreen, renderSimpleHeader, clearMenuArea, SIMPLE_CONTENT_START_LINE } = require('../utils/terminal');
const { showStats } = require('../commands');
const { getUser, listUsers, addUser, removeUser } = require('../config/users');

async function showSettingsMenu(rl, currentManager, currentUser, timeout, enableStats, verbose,
    setTransportMode, setTimeout, setEnableStats, setVerbose,
    userManagementCallbacks) {
    // Wrap setters to update parent values
    const wrappedSetTimeout = (newTimeout) => {
        setTimeout(newTimeout);
    };
    const wrappedSetEnableStats = (enabled) => {
        setEnableStats(enabled);
    };
    const wrappedSetVerbose = (enabled) => {
        setVerbose(enabled);
    };

    while (true) {
        // Clear screen and render simple header
        clearScreen();
        const deviceCount = currentManager ? currentManager.devices.list().filter(d => !(d instanceof MerossSubDevice)).length : 0;
        renderSimpleHeader(currentUser, deviceCount);
        clearMenuArea(SIMPLE_CONTENT_START_LINE);

        const debug = currentManager ? createDebugUtils(currentManager) : null;
        const currentStatsEnabled = debug ? debug.isStatsEnabled() : enableStats;
        const currentTransportMode = currentManager
            ? getTransportModeName(currentManager.defaultTransportMode)
            : getTransportModeName(TransportMode.MQTT_ONLY);
        const currentVerboseState = currentManager && currentManager.options ? (currentManager.options.logger !== null) : verbose;

        process.stdout.write(chalk.bold('=== Settings Menu ===\n\n'));
        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'Settings Menu',
            choices: [
                {
                    name: `Transport Mode: ${currentTransportMode}`,
                    value: 'transport'
                },
                {
                    name: `Statistics: ${currentStatsEnabled ? 'Enabled' : 'Disabled'}`,
                    value: 'stats'
                },
                {
                    name: `User Management${currentUser ? ` (${currentUser})` : ''}`,
                    value: 'users'
                },
                {
                    name: `Timeout: ${timeout}ms`,
                    value: 'timeout'
                },
                {
                    name: `Verbose Logging: ${currentVerboseState ? 'Enabled' : 'Disabled'}`,
                    value: 'verbose'
                },
                {
                    name: 'Error Budget Management',
                    value: 'error-budget'
                },
                new inquirer.Separator(),
                {
                    name: 'Back to main menu',
                    value: 'back'
                }
            ]
        }]);

        if (action === 'transport') {
            await showTransportModeSettings(rl, currentManager, currentUser, setTransportMode);
        } else if (action === 'stats') {
            await showStatisticsSettings(rl, currentManager, currentUser, currentStatsEnabled, wrappedSetEnableStats);
        } else if (action === 'users') {
            const result = await showUserManagementMenu(rl, currentManager, currentUser, userManagementCallbacks);
            if (result && result.action === 'switch') {
                return result;
            } else if (result && result.action === 'save') {
                return result;
            }
        } else if (action === 'timeout') {
            await showTimeoutSettings(rl, currentManager, currentUser, timeout, wrappedSetTimeout);
        } else if (action === 'verbose') {
            const currentVerboseState = currentManager && currentManager.options ? (currentManager.options.logger !== null) : verbose;
            await showVerboseSettings(rl, currentManager, currentUser, currentVerboseState, wrappedSetVerbose);
        } else if (action === 'error-budget') {
            await showErrorBudgetSettings(rl, currentManager, currentUser);
        } else if (action === 'back') {
            break;
        }
    }
    return null;
}

async function showTransportModeSettings(rl, currentManager, currentUser, setTransportMode) {
    // Clear screen and render simple header
    clearScreen();
    const deviceCount = currentManager ? currentManager.devices.list().filter(d => !(d instanceof MerossSubDevice)).length : 0;
    renderSimpleHeader(currentUser, deviceCount);
    clearMenuArea(SIMPLE_CONTENT_START_LINE);

    process.stdout.write(chalk.bold('=== Transport Mode Settings ===\n\n'));
    const { mode } = await inquirer.prompt([{
        type: 'list',
        name: 'mode',
        message: 'Transport Mode',
        default: currentManager.defaultTransportMode,
        choices: [
            {
                name: 'MQTT Only (default, works remotely)',
                value: TransportMode.MQTT_ONLY
            },
            {
                name: 'LAN HTTP First (try LAN first, fallback to MQTT)',
                value: TransportMode.LAN_HTTP_FIRST
            },
            {
                name: 'LAN HTTP First (GET only) (LAN for GET, MQTT for SET)',
                value: TransportMode.LAN_HTTP_FIRST_ONLY_GET
            }
        ]
    }]);

    setTransportMode(mode);
    console.log(chalk.green(`\n✓ Transport mode changed to: ${getTransportModeName(mode)}\n`));
}

async function showStatisticsSettings(rl, currentManager, currentUser, enableStats, setEnableStats) {
    // Clear screen and render simple header
    clearScreen();
    const deviceCount = currentManager ? currentManager.devices.list().filter(d => !(d instanceof MerossSubDevice)).length : 0;
    renderSimpleHeader(currentUser, deviceCount);
    clearMenuArea(SIMPLE_CONTENT_START_LINE);

    const debug = createDebugUtils(currentManager);
    const statsEnabled = debug.isStatsEnabled();

    process.stdout.write(chalk.bold('=== Statistics Settings ===\n\n'));
    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'Statistics',
        choices: [
            {
                name: 'View Statistics (current status)',
                value: 'view'
            },
            {
                name: 'Enable Statistics',
                value: 'enable',
                disabled: statsEnabled
            },
            {
                name: 'Disable Statistics',
                value: 'disable',
                disabled: !statsEnabled
            },
            new inquirer.Separator(),
            {
                name: 'Back',
                value: 'back'
            }
        ]
    }]);

    if (action === 'view') {
        console.log('\n');
        showStats(currentManager);
        await inquirer.prompt([{
            type: 'input',
            name: 'continue',
            message: 'Press Enter to continue...'
        }]);
    } else if (action === 'enable') {
        setEnableStats(true);
        console.log(chalk.green('\n✓ Statistics tracking enabled\n'));
    } else if (action === 'disable') {
        setEnableStats(false);
        console.log(chalk.yellow('\n✓ Statistics tracking disabled\n'));
    }
}

// Helper functions for user management menu
function _renderUserManagementHeader(currentManager, currentUser) {
    clearScreen();
    const deviceCount = currentManager ? currentManager.devices.list().filter(d => !(d instanceof MerossSubDevice)).length : 0;
    renderSimpleHeader(currentUser, deviceCount);
    clearMenuArea(SIMPLE_CONTENT_START_LINE);
    process.stdout.write(chalk.bold('=== User Management ===\n\n'));
}

function _getCurrentUserInfo(currentUser) {
    if (!currentUser) {
        return '(not using a stored user)';
    }
    const userData = getUser(currentUser);
    return userData ? `${currentUser} (${userData.email})` : '(not using a stored user)';
}

function _buildUserManagementChoices(currentUserInfo, callbacks) {
    return [
        {
            name: `Current User: ${currentUserInfo}`,
            value: 'current',
            disabled: true
        },
        new inquirer.Separator(),
        {
            name: 'List Users',
            value: 'list'
        },
        {
            name: 'Add User',
            value: 'add'
        },
        {
            name: 'Remove User',
            value: 'remove'
        },
        {
            name: 'Switch User',
            value: 'switch'
        },
        {
            name: 'Show Current User',
            value: 'show'
        },
        {
            name: 'Save Current Credentials',
            value: 'save',
            disabled: !callbacks || !callbacks.onSaveCredentials
        },
        new inquirer.Separator(),
        {
            name: 'Back',
            value: 'back'
        }
    ];
}

function _displayUserInfo(user, isCurrent = false) {
    const userInfo = [
        ['Name', chalk.bold(user.name)],
        ['Email', user.email]
    ];
    if (isCurrent) {
        userInfo.push(['Status', chalk.green('Current')]);
    }
    const maxLabelLength = Math.max(...userInfo.map(([label]) => label.length));
    userInfo.forEach(([label, value]) => {
        const padding = ' '.repeat(maxLabelLength - label.length);
        console.log(`  ${chalk.gray.bold(label)}:${padding} ${value}`);
    });
    console.log('');
}

async function _waitForContinue() {
    await inquirer.prompt([{
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...'
    }]);
}

async function _handleListUsers(currentUser) {
    const users = listUsers();
    console.log(`\n${chalk.bold.underline('Stored Users')}\n`);
    if (users.length === 0) {
        console.log(`  ${chalk.yellow('No stored users found.')}\n`);
    } else {
        users.forEach((user) => {
            _displayUserInfo(user, currentUser === user.name);
        });
    }
    await _waitForContinue();
}

async function _handleAddUser() {
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'User name:',
            validate: (value) => value.trim() ? true : 'User name cannot be empty'
        },
        {
            type: 'input',
            name: 'email',
            message: 'Email:',
            validate: (value) => value.trim() ? true : 'Email cannot be empty'
        },
        {
            type: 'password',
            name: 'password',
            message: 'Password:',
            mask: '*',
            validate: (value) => value ? true : 'Password cannot be empty'
        },
        {
            type: 'input',
            name: 'mfaCode',
            message: 'MFA Code (optional, press Enter to skip):',
            default: ''
        }
    ]);

    const result = addUser(answers.name.trim(), answers.email.trim(), answers.password, answers.mfaCode.trim() || null);
    if (result.success) {
        console.log(chalk.green(`\n✓ User "${answers.name.trim()}" added successfully.\n`));
    } else {
        console.error(chalk.red(`\n✗ Error: ${result.error}\n`));
    }
}

async function _handleRemoveUser(currentUser) {
    const users = listUsers();
    if (users.length === 0) {
        console.log(chalk.yellow('\n  No stored users found. Add a user first.\n'));
        return { shouldContinue: true };
    }

    const { userName } = await inquirer.prompt([{
        type: 'list',
        name: 'userName',
        message: 'Select user to remove:',
        choices: users.map(user => ({
            name: `${user.name} (${user.email})${currentUser === user.name ? chalk.yellow(' (current)') : ''}`,
            value: user.name
        }))
    }]);

    const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to remove user "${userName}"?`,
        default: false
    }]);

    if (confirm) {
        const result = removeUser(userName);
        if (result.success) {
            console.log(chalk.green(`\n✓ User "${userName}" removed successfully.\n`));
            if (currentUser === userName) {
                console.log(chalk.yellow('  Note: You are currently using this account. Switch to another user to continue.\n'));
            }
        } else {
            console.error(chalk.red(`\n✗ Error: ${result.error}\n`));
        }
    }
    return { shouldContinue: false };
}

async function _handleSwitchUser(currentUser, callbacks) {
    const users = listUsers();
    if (users.length === 0) {
        console.log(chalk.yellow('\n  No stored users found. Add a user first.\n'));
        return { shouldContinue: true, result: null };
    }

    const { selectedUser } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedUser',
        message: 'Select user to switch to:',
        choices: users.map(user => ({
            name: `${user.name} (${user.email})${currentUser === user.name ? chalk.green(' (current)') : ''}`,
            value: user.name
        }))
    }]);

    const userData = getUser(selectedUser);
    if (!userData) {
        console.error(chalk.red(`\n✗ Error: User "${selectedUser}" not found.\n`));
        return { shouldContinue: true, result: null };
    }

    console.log(`\n  Switching to user "${selectedUser}"...\n`);
    if (callbacks && callbacks.onSwitchUser) {
        const switchResult = await callbacks.onSwitchUser(selectedUser, userData);
        if (switchResult && switchResult.success) {
            console.log(chalk.green(`✓ Switched to user "${selectedUser}" successfully.\n`));
            return { shouldContinue: false, result: { action: 'switched', userName: selectedUser } };
        } else {
            console.error(chalk.red(`\n✗ Failed to switch user: ${switchResult?.error || 'Unknown error'}\n`));
        }
    } else {
        return { shouldContinue: false, result: { action: 'switch', userData, userName: selectedUser } };
    }
    return { shouldContinue: false, result: null };
}

async function _handleShowCurrentUser(currentUser) {
    console.log(`\n${chalk.bold.underline('Current User')}\n`);
    if (currentUser) {
        const userData = getUser(currentUser);
        if (userData) {
            _displayUserInfo({ name: currentUser, email: userData.email });
        } else {
            console.log(`  ${chalk.yellow('Not using a stored user')}\n`);
        }
    } else {
        console.log(`  ${chalk.yellow('Not using a stored user')}\n`);
    }
    await _waitForContinue();
}

async function _handleSaveCredentials(callbacks) {
    if (callbacks && callbacks.onSaveCredentials) {
        const { name } = await inquirer.prompt([{
            type: 'input',
            name: 'name',
            message: 'Enter a name for this user account:',
            validate: (value) => value.trim() ? true : 'User name cannot be empty'
        }]);

        const saveResult = await callbacks.onSaveCredentials(name.trim());
        if (saveResult && saveResult.success) {
            console.log(chalk.green(`\n✓ Credentials saved as user "${name.trim()}".\n`));
            return { action: 'saved', userName: name.trim() };
        } else {
            console.error(chalk.red(`\n✗ Error saving credentials: ${saveResult?.error || 'Unknown error'}\n`));
        }
    } else {
        return { action: 'save' };
    }
    return null;
}

async function showUserManagementMenu(rl, currentManager, currentUser, callbacks) {
    while (true) {
        _renderUserManagementHeader(currentManager, currentUser);

        const currentUserInfo = _getCurrentUserInfo(currentUser);
        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'User Management',
            choices: _buildUserManagementChoices(currentUserInfo, callbacks)
        }]);

        if (action === 'list') {
            await _handleListUsers(currentUser);
        } else if (action === 'add') {
            await _handleAddUser();
        } else if (action === 'remove') {
            const result = await _handleRemoveUser(currentUser);
            if (result.shouldContinue) {
                continue;
            }
        } else if (action === 'switch') {
            const result = await _handleSwitchUser(currentUser, callbacks);
            if (result.shouldContinue) {
                continue;
            }
            if (result.result) {
                return result.result;
            }
        } else if (action === 'show') {
            await _handleShowCurrentUser(currentUser);
        } else if (action === 'save') {
            const result = await _handleSaveCredentials(callbacks);
            if (result) {
                return result;
            }
        } else if (action === 'back') {
            break;
        }
    }
    return { action: 'back' };
}

async function showTimeoutSettings(rl, currentManager, currentUser, timeout, setTimeout) {
    // Clear screen and render simple header
    clearScreen();
    const deviceCount = currentManager ? currentManager.devices.list().filter(d => !(d instanceof MerossSubDevice)).length : 0;
    renderSimpleHeader(currentUser, deviceCount);
    clearMenuArea(SIMPLE_CONTENT_START_LINE);

    process.stdout.write(chalk.bold('=== Timeout Settings ===\n\n'));
    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'Timeout Settings',
        choices: [
            {
                name: `Change Timeout (current: ${timeout}ms)`,
                value: 'change'
            },
            {
                name: 'Back',
                value: 'back'
            }
        ]
    }]);

    if (action === 'change') {
        const { newTimeout } = await inquirer.prompt([{
            type: 'number',
            name: 'newTimeout',
            message: 'Enter timeout in milliseconds',
            default: timeout,
            validate: (value) => {
                if (isNaN(value) || value <= 0) {
                    return 'Timeout must be a positive number';
                }
                return true;
            }
        }]);

        setTimeout(newTimeout);
        console.log(chalk.green(`\n✓ Timeout changed to: ${newTimeout}ms\n`));
    }
}

async function showVerboseSettings(rl, currentManager, currentUser, verbose, setVerbose) {
    // Clear screen and render simple header
    clearScreen();
    const deviceCount = currentManager ? currentManager.devices.list().filter(d => !(d instanceof MerossSubDevice)).length : 0;
    renderSimpleHeader(currentUser, deviceCount);
    clearMenuArea(SIMPLE_CONTENT_START_LINE);

    process.stdout.write(chalk.bold('=== Verbose Logging Settings ===\n\n'));
    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'Verbose Logging',
        choices: [
            {
                name: 'Enable Verbose Logging',
                value: 'enable',
                disabled: verbose
            },
            {
                name: 'Disable Verbose Logging',
                value: 'disable',
                disabled: !verbose
            },
            new inquirer.Separator(),
            {
                name: 'Back',
                value: 'back'
            }
        ]
    }]);

    if (action === 'enable') {
        setVerbose(true);
        console.log(chalk.green('\n✓ Verbose logging enabled\n'));
    } else if (action === 'disable') {
        setVerbose(false);
        console.log(chalk.yellow('\n✓ Verbose logging disabled\n'));
    }
}

async function showErrorBudgetSettings(rl, currentManager, currentUser) {
    if (!currentManager) {
        console.log(chalk.yellow('\n⚠ No active connection. Please connect first.\n'));
        await inquirer.prompt([{
            type: 'input',
            name: 'continue',
            message: 'Press Enter to continue...'
        }]);
        return;
    }

    const debug = createDebugUtils(currentManager);

    while (true) {
        // Clear screen and render simple header
        clearScreen();
        const deviceCount = currentManager.devices.list().filter(d => !(d instanceof MerossSubDevice)).length;
        renderSimpleHeader(currentUser, deviceCount);
        clearMenuArea(SIMPLE_CONTENT_START_LINE);

        process.stdout.write(chalk.bold('=== Error Budget Management ===\n\n'));

        // Get error budget configuration
        const maxErrors = currentManager._errorBudgetManager?._maxErrors || 1;
        const timeWindowMs = currentManager._errorBudgetManager?._window || 60000;
        const timeWindowSec = Math.floor(timeWindowMs / 1000);

        console.log(chalk.dim(`Configuration: Max ${maxErrors} error(s) per ${timeWindowSec} seconds\n`));

        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'Error Budget Management',
            choices: [
                {
                    name: 'View Error Budgets (all devices)',
                    value: 'view-all'
                },
                {
                    name: 'View Error Budget (specific device)',
                    value: 'view-device'
                },
                {
                    name: 'Reset Error Budget (specific device)',
                    value: 'reset-device'
                },
                {
                    name: 'Reset All Error Budgets',
                    value: 'reset-all'
                },
                new inquirer.Separator(),
                {
                    name: 'Back',
                    value: 'back'
                }
            ]
        }]);

        if (action === 'back') {
            break;
        } else if (action === 'view-all') {
            const devices = currentManager.devices.list().filter(d => !(d instanceof MerossSubDevice));
            if (devices.length === 0) {
                console.log(chalk.yellow('\n  No devices found.\n'));
            } else {
                console.log('\n');
                devices.forEach(device => {
                    const uuid = device.uuid;
                    const name = device.name || 'Unknown';
                    const budget = debug.getErrorBudget(uuid);
                    const isOutOfBudget = budget < 1;
                    const status = isOutOfBudget
                        ? chalk.red(`Out of budget (${budget} remaining)`)
                        : chalk.green(`OK (${budget} remaining)`);
                    console.log(`  ${chalk.bold(name)} (${chalk.cyan(uuid.substring(0, 8))}...): ${status}`);
                });
                console.log('');
            }
            await inquirer.prompt([{
                type: 'input',
                name: 'continue',
                message: 'Press Enter to continue...'
            }]);
        } else if (action === 'view-device') {
            const devices = currentManager.devices.list().filter(d => !(d instanceof MerossSubDevice));
            if (devices.length === 0) {
                console.log(chalk.yellow('\n  No devices found.\n'));
                await inquirer.prompt([{
                    type: 'input',
                    name: 'continue',
                    message: 'Press Enter to continue...'
                }]);
                continue;
            }

            const deviceChoices = devices.map(device => {
                const uuid = device.uuid;
                const name = device.name || 'Unknown';
                const budget = debug.getErrorBudget(uuid);
                const isOutOfBudget = budget < 1;
                const status = isOutOfBudget ? chalk.red('(Out of budget)') : chalk.green('(OK)');
                return {
                    name: `${name} ${status}`,
                    value: uuid
                };
            });

            const { deviceUuid } = await inquirer.prompt([{
                type: 'list',
                name: 'deviceUuid',
                message: 'Select device:',
                choices: deviceChoices
            }]);

            const budget = debug.getErrorBudget(deviceUuid);
            const isOutOfBudget = budget < 1;
            const device = devices.find(d => {
                const dev = d.dev || {};
                return (dev.uuid || d.uuid) === deviceUuid;
            });
            const dev = device?.dev || {};
            const name = dev.devName || 'Unknown';

            console.log(`\n${chalk.bold('Device:')} ${name}`);
            console.log(`${chalk.bold('UUID:')} ${deviceUuid}`);
            console.log(`${chalk.bold('Error Budget:')} ${isOutOfBudget ? chalk.red(budget) : chalk.green(budget)}`);
            console.log(`${chalk.bold('Status:')} ${isOutOfBudget ? chalk.red('Out of budget - HTTP blocked, using MQTT') : chalk.green('OK - HTTP allowed')}`);
            console.log(`${chalk.bold('Configuration:')} Max ${maxErrors} error(s) per ${timeWindowSec} seconds\n`);

            await inquirer.prompt([{
                type: 'input',
                name: 'continue',
                message: 'Press Enter to continue...'
            }]);
        } else if (action === 'reset-device') {
            const devices = currentManager.devices.list().filter(d => !(d instanceof MerossSubDevice));
            if (devices.length === 0) {
                console.log(chalk.yellow('\n  No devices found.\n'));
                await inquirer.prompt([{
                    type: 'input',
                    name: 'continue',
                    message: 'Press Enter to continue...'
                }]);
                continue;
            }

            const deviceChoices = devices.map(device => {
                const uuid = device.uuid;
                const name = device.name || 'Unknown';
                const budget = debug.getErrorBudget(uuid);
                const isOutOfBudget = budget < 1;
                const status = isOutOfBudget ? chalk.red('(Out of budget)') : chalk.green('(OK)');
                return {
                    name: `${name} ${status}`,
                    value: uuid
                };
            });

            const { deviceUuid } = await inquirer.prompt([{
                type: 'list',
                name: 'deviceUuid',
                message: 'Select device to reset:',
                choices: deviceChoices
            }]);

            const device = devices.find(d => {
                const dev = d.dev || {};
                return (dev.uuid || d.uuid) === deviceUuid;
            });
            const dev = device?.dev || {};
            const name = dev.devName || 'Unknown';

            const { confirm } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirm',
                message: `Reset error budget for "${name}"?`,
                default: false
            }]);

            if (confirm) {
                debug.resetErrorBudget(deviceUuid);
                console.log(chalk.green(`\n✓ Error budget reset for "${name}"\n`));
            }

            await inquirer.prompt([{
                type: 'input',
                name: 'continue',
                message: 'Press Enter to continue...'
            }]);
        } else if (action === 'reset-all') {
            const { confirm } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirm',
                message: 'Reset error budgets for all devices?',
                default: false
            }]);

            if (confirm) {
                const devices = currentManager.devices.list().filter(d => !(d instanceof MerossSubDevice));
                let resetCount = 0;
                devices.forEach(device => {
                    const uuid = device.uuid;
                    if (uuid) {
                        debug.resetErrorBudget(uuid);
                        resetCount++;
                    }
                });
                console.log(chalk.green(`\n✓ Error budgets reset for ${resetCount} device(s)\n`));
            }

            await inquirer.prompt([{
                type: 'input',
                name: 'continue',
                message: 'Press Enter to continue...'
            }]);
        }
    }
}

module.exports = {
    showSettingsMenu,
    showTransportModeSettings,
    showStatisticsSettings,
    showUserManagementMenu,
    showTimeoutSettings,
    showVerboseSettings,
    showErrorBudgetSettings
};

