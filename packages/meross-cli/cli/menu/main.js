'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const { MerossHubDevice, MerossSubDevice, createDebugUtils, TransportMode } = require('meross-iot');
const testRunner = require('../tests/test-runner');
const { clearScreen, renderLogoAtTop, renderSimpleHeader, clearMenuArea, CONTENT_START_LINE, SIMPLE_CONTENT_START_LINE, createRL, question, promptForPassword } = require('../utils/terminal');
const { formatDevice } = require('../utils/display');
const { listDevices, showStats, dumpRegistry, listMqttConnections, getDeviceStatus, showDeviceInfo, controlDeviceMenu, runTestCommand, snifferMenu } = require('../commands');
const { addUser, getUser, listUsers } = require('../config/users');
const { createMerossInstance, connectMeross, disconnectMeross } = require('../helpers/meross');
const { showSettingsMenu } = require('./settings');

// Helper functions
function _getDeviceCount(manager) {
    if (!manager) {return 0;}
    return manager.getAllDevices().filter(d => !(d instanceof MerossSubDevice)).length;
}

function _renderMainMenuHeader(currentUser, manager) {
    clearScreen();
    const deviceCount = _getDeviceCount(manager);
    renderSimpleHeader(currentUser, deviceCount);
}

async function _promptForCredentials(rl) {
    const email = await question(rl, 'Email: ');
    const password = await promptForPassword(rl, 'Password: ');
    const mfaCode = await question(rl, 'MFA Code (optional, press Enter to skip): ');

    return {
        email: email.trim(),
        password,
        mfaCode: mfaCode.trim() || null
    };
}

async function _handleStoredUserLogin(loginChoice) {
    const userName = loginChoice.replace('user_', '');
    const userData = getUser(userName);
    if (!userData) {
        return { success: false };
    }

    const manager = await createMerossInstance(
        userData.email,
        userData.password,
        userData.mfaCode,
        TransportMode.MQTT_ONLY,
        10000,
        false,
        false
    );

    return { success: true, manager, userName };
}

async function _handleAddNewUser(rl) {
    const name = await question(rl, 'User name: ');
    if (!name || !name.trim()) {
        console.error('\nError: User name cannot be empty.');
        return { success: false };
    }

    const email = await question(rl, 'Email: ');
    if (!email || !email.trim()) {
        console.error('\nError: Email cannot be empty.');
        return { success: false };
    }

    const password = await promptForPassword(rl, 'Password: ');
    if (!password) {
        console.error('\nError: Password cannot be empty.');
        return { success: false };
    }

    const mfaCode = await question(rl, 'MFA Code (optional, press Enter to skip): ');

    const result = addUser(name.trim(), email.trim(), password, mfaCode.trim() || null);
    if (!result.success) {
        console.error(`\nError: ${result.error}`);
        return { success: false };
    }

    console.log(`\nUser "${name.trim()}" added successfully.`);
    const userData = getUser(name.trim());
    if (!userData) {
        return { success: false };
    }

    const manager = await createMerossInstance(
        userData.email,
        userData.password,
        userData.mfaCode,
        TransportMode.MQTT_ONLY,
        10000,
        false,
        false
    );

    return { success: true, manager, userName: name.trim() };
}

async function _handleManualLogin(rl) {
    const credentials = await _promptForCredentials(rl);
    const manager = await createMerossInstance(
        credentials.email,
        credentials.password,
        credentials.mfaCode,
        TransportMode.MQTT_ONLY,
        10000,
        false,
        false
    );

    return { success: true, manager, credentials };
}

async function _handleNoStoredUsersLogin(rl) {
    process.stdout.write('\nNo stored users found. Please enter credentials:\n\n');
    const credentials = await _promptForCredentials(rl);
    const manager = await createMerossInstance(
        credentials.email,
        credentials.password,
        credentials.mfaCode,
        TransportMode.MQTT_ONLY,
        10000,
        false,
        false
    );

    return { success: true, manager, credentials };
}

async function _saveCredentialsPrompt(rl, currentCredentials) {
    const { saveCredentials } = await inquirer.prompt([{
        type: 'confirm',
        name: 'saveCredentials',
        message: 'Would you like to save these credentials for future use?',
        default: false
    }]);

    if (!saveCredentials) {
        return null;
    }

    const { userName } = await inquirer.prompt([{
        type: 'input',
        name: 'userName',
        message: 'Enter a name for this user account:',
        validate: (input) => {
            if (!input || !input.trim()) {
                return 'User name cannot be empty';
            }
            return true;
        }
    }]);

    if (!userName || !userName.trim()) {
        return null;
    }

    const result = addUser(userName.trim(), currentCredentials.email, currentCredentials.password, currentCredentials.mfaCode);
    if (result.success) {
        console.log(`\nCredentials saved as user "${userName.trim()}".\n`);
        return userName.trim();
    }

    return null;
}

async function _selectDevice(manager, message = 'Select device:') {
    const devices = manager.getAllDevices().filter(d => !(d instanceof MerossSubDevice));
    if (devices.length === 0) {
        return null;
    }

    const deviceChoices = devices.map((device) => {
        const info = formatDevice(device);
        return {
            name: `${info.name} (${info.uuid})`,
            value: info.uuid
        };
    });

    const result = await inquirer.prompt([{
        type: 'list',
        name: 'uuid',
        message,
        choices: deviceChoices
    }]);

    return result.uuid;
}

async function _selectDeviceOrAll(manager) {
    const devices = manager.getAllDevices().filter(d => !(d instanceof MerossSubDevice));
    if (devices.length === 0) {
        return null;
    }

    const deviceChoices = [
        { name: 'All devices', value: null },
        ...devices.map((device) => {
            const info = formatDevice(device);
            return {
                name: `${info.name} (${info.uuid})`,
                value: info.uuid
            };
        })
    ];

    const result = await inquirer.prompt([{
        type: 'list',
        name: 'uuid',
        message: 'Select device (or All devices):',
        choices: deviceChoices
    }]);

    return result.uuid;
}

async function _selectSubdevice(manager, uuid) {
    if (!uuid) {
        return null;
    }

    const device = manager.getDevice(uuid);
    if (!(device instanceof MerossHubDevice)) {
        return null;
    }

    const subdevices = device.getSubdevices();
    if (subdevices.length === 0) {
        return null;
    }

    const subdeviceChoices = [
        { name: 'All subdevices', value: null },
        ...subdevices.map((subdevice) => {
            const subName = subdevice.name || subdevice.subdeviceId;
            return {
                name: `${subName} (${subdevice.subdeviceId})`,
                value: subdevice.subdeviceId
            };
        })
    ];

    const { subId } = await inquirer.prompt([{
        type: 'list',
        name: 'subId',
        message: 'Select subdevice (or All subdevices):',
        choices: subdeviceChoices
    }]);

    return subId;
}

async function _handleListCommand(manager, rl) {
    await listDevices(manager);
    await question(rl, '\nPress Enter to return to menu...');
}

async function _handleInfoCommand(manager, rl) {
    const devices = manager.getAllDevices().filter(d => !(d instanceof MerossSubDevice));
    if (devices.length === 0) {
        console.log('\nNo devices found.');
        await question(rl, '\nPress Enter to return to menu...');
        return;
    }

    const uuid = await _selectDevice(manager);
    if (uuid) {
        await showDeviceInfo(manager, uuid);
        await question(rl, '\nPress Enter to return to menu...');
    }
}

async function _handleStatusCommand(manager, rl) {
    const devices = manager.getAllDevices().filter(d => !(d instanceof MerossSubDevice));
    if (devices.length === 0) {
        console.log('\nNo devices found.');
        await question(rl, '\nPress Enter to return to menu...');
        return;
    }

    const uuid = await _selectDeviceOrAll(manager);
    if (uuid === undefined) {
        return;
    }

    const subdeviceId = await _selectSubdevice(manager, uuid);
    await getDeviceStatus(manager, uuid, subdeviceId);
    await question(rl, '\nPress Enter to return to menu...');
}

async function _handleControlCommand(manager, rl, currentUser) {
    await controlDeviceMenu(manager, rl, currentUser);
}

async function _handleStatsCommand(manager, rl) {
    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'Statistics action:',
        choices: [
            { name: 'Show statistics', value: 'get' },
            { name: 'Enable statistics', value: 'on' },
            { name: 'Disable statistics', value: 'off' }
        ]
    }]);

    const debug = createDebugUtils(manager);
    if (action === 'get') {
        showStats(manager);
    } else if (action === 'on') {
        debug.enableStats();
        console.log('\nStatistics tracking enabled');
    } else {
        debug.disableStats();
        console.log('\nStatistics tracking disabled');
    }
    await question(rl, '\nPress Enter to return to menu...');
}

async function _handleMqttConnectionsCommand(manager, rl) {
    const currentVerboseState = manager && manager.options ? (manager.options.logger !== null) : false;
    await listMqttConnections(manager, {
        verbose: currentVerboseState,
        json: false
    });
    await question(rl, '\nPress Enter to return to menu...');
}

async function _handleDumpCommand(manager, rl) {
    const { filename } = await inquirer.prompt([{
        type: 'input',
        name: 'filename',
        message: 'Filename (default: device-registry.json):',
        default: 'device-registry.json'
    }]);

    await dumpRegistry(manager, filename || 'device-registry.json');
    await question(rl, '\nPress Enter to return to menu...');
}

async function _handleTestCommand(manager, rl) {
    const availableTypes = testRunner.getAvailableTestTypes();
    const testChoices = availableTypes.map(type => {
        const description = testRunner.getTestDescription(type);
        return {
            name: `${type} - ${description}`,
            value: type
        };
    });

    const { testType } = await inquirer.prompt([{
        type: 'list',
        name: 'testType',
        message: 'Select test type:',
        choices: testChoices
    }]);

    await runTestCommand(manager, testType, true, rl);
    await question(rl, '\nPress Enter to return to menu...');
}

async function _handleSnifferCommand(manager, rl, currentUser = null) {
    await snifferMenu(manager, rl, currentUser);
}

function _buildSettingsCallbacks(
    manager, rl, currentCredentials, currentUserRef, managerRef, transportModeRef, timeoutRef, enableStatsRef, verboseRef
) {
    return {
        onSwitchUser: async (userName, userData) => {
            await disconnectMeross(managerRef.current);
            managerRef.current = await createMerossInstance(
                userData.email,
                userData.password,
                userData.mfaCode,
                transportModeRef.current,
                timeoutRef.current,
                enableStatsRef.current,
                verboseRef.current
            );
            const connected = await connectMeross(managerRef.current, rl);
            if (connected) {
                currentUserRef.current = userName;
                return { success: true };
            }
            return { success: false, error: 'Failed to connect with new user' };
        },
        onSaveCredentials: async (name) => {
            if (!currentCredentials) {
                return { success: false, error: 'No credentials available to save' };
            }
            if (currentUserRef.current) {
                return { success: false, error: `You are already using a stored user account: "${currentUserRef.current}"` };
            }
            const result = addUser(name, currentCredentials.email, currentCredentials.password, currentCredentials.mfaCode);
            if (result.success) {
                currentUserRef.current = name;
            }
            return result;
        }
    };
}

async function _handleSettingsCommand(manager, rl, currentUserRef, currentCredentials) {
    const transportModeRef = { current: manager.defaultTransportMode || TransportMode.MQTT_ONLY };
    const timeoutRef = { current: 10000 };
    const enableStatsRef = { current: manager._mqttStatsCounter !== null || manager.httpClient._httpStatsCounter !== null };
    const verboseRef = { current: manager.options && manager.options.logger !== null };
    const managerRef = { current: manager };

    const setTransportMode = (mode) => {
        transportModeRef.current = mode;
        managerRef.current.defaultTransportMode = mode;
    };
    const setTimeout = (newTimeout) => {
        timeoutRef.current = newTimeout;
    };
    const setEnableStats = (enabled) => {
        enableStatsRef.current = enabled;
        const debug = createDebugUtils(managerRef.current);
        if (enabled) {
            debug.enableStats();
        } else {
            debug.disableStats();
        }
    };
    const setVerbose = (enabled) => {
        verboseRef.current = enabled;
        if (managerRef.current.options) {
            managerRef.current.options.logger = enabled ? console.log : null;
        }
        if (managerRef.current.httpClient && managerRef.current.httpClient.options) {
            managerRef.current.httpClient.options.logger = enabled ? console.log : null;
        }
    };

    const userManagementCallbacks = _buildSettingsCallbacks(
        manager, rl, currentCredentials, currentUserRef, managerRef,
        transportModeRef, timeoutRef, enableStatsRef, verboseRef
    );

    await showSettingsMenu(
        rl,
        managerRef.current,
        currentUserRef.current,
        timeoutRef.current,
        enableStatsRef.current,
        verboseRef.current,
        setTransportMode,
        setTimeout,
        setEnableStats,
        setVerbose,
        userManagementCallbacks
    );

    return { manager: managerRef.current, user: currentUserRef.current };
}

async function menuMode() {
    const rl = createRL();

    // Clear screen and render logo at top
    clearScreen();
    renderLogoAtTop('menu');

    // Prompt for login
    let currentManager = null;
    let currentUser = null;
    let currentCredentials = null;

    const users = listUsers();
    const hasStoredUsers = users.length > 0;

    // Clear menu area and show login prompt
    clearMenuArea(CONTENT_START_LINE);

    // Handle login flow
    if (hasStoredUsers) {
        const choices = [
            ...users.map(user => ({
                name: `${user.name} (${user.email})`,
                value: `user_${user.name}`
            })),
            new inquirer.Separator(),
            {
                name: 'Add new user',
                value: 'add_user'
            },
            {
                name: 'Enter credentials manually',
                value: 'manual'
            }
        ];

        const { loginChoice } = await inquirer.prompt([{
            type: 'list',
            name: 'loginChoice',
            message: 'Select login option:',
            choices
        }]);

        if (loginChoice.startsWith('user_')) {
            const result = await _handleStoredUserLogin(loginChoice);
            if (!result.success) {
                rl.close();
                return;
            }
            currentManager = result.manager;
            currentUser = result.userName;
        } else if (loginChoice === 'add_user') {
            const result = await _handleAddNewUser(rl);
            if (!result.success) {
                rl.close();
                return;
            }
            currentManager = result.manager;
            currentUser = result.userName;
        } else if (loginChoice === 'manual') {
            const result = await _handleManualLogin(rl);
            if (!result.success) {
                rl.close();
                return;
            }
            currentManager = result.manager;
            currentCredentials = result.credentials;
        }
    } else {
        const result = await _handleNoStoredUsersLogin(rl);
        if (!result.success) {
            rl.close();
            return;
        }
        currentManager = result.manager;
        currentCredentials = result.credentials;
    }

    // Connect
    const connected = await connectMeross(currentManager, rl);
    if (!connected) {
        console.error('Failed to connect. Exiting.');
        rl.close();
        return;
    }

    // Offer to save credentials if logged in manually
    if (currentCredentials && !currentUser) {
        const savedUserName = await _saveCredentialsPrompt(rl, currentCredentials);
        if (savedUserName) {
            currentUser = savedUserName;
        }
    }

    // Render simple header after successful login (no big logo)
    _renderMainMenuHeader(currentUser, currentManager);

    // Main menu loop
    const currentUserRef = { current: currentUser };
    while (true) {
        _renderMainMenuHeader(currentUserRef.current, currentManager);
        clearMenuArea(SIMPLE_CONTENT_START_LINE);
        process.stdout.write(chalk.bold('=== Meross CLI Menu ===\n\n'));

        const { command } = await inquirer.prompt([{
            type: 'list',
            name: 'command',
            message: 'Select a command:',
            choices: [
                { name: 'List devices', value: 'list' },
                { name: 'Device info', value: 'info' },
                { name: 'Device status', value: 'status' },
                { name: 'Control device', value: 'control' },
                { name: 'Statistics', value: 'stats' },
                { name: 'MQTT connections', value: 'mqtt-connections' },
                { name: 'Dump registry', value: 'dump' },
                { name: 'Run tests', value: 'test' },
                { name: 'Device Sniffer', value: 'sniffer' },
                { name: 'Settings', value: 'settings' },
                new inquirer.Separator(),
                { name: 'Exit', value: 'exit' }
            ]
        }]);

        if (command === 'exit') {
            break;
        }

        try {
            _renderMainMenuHeader(currentUserRef.current, currentManager);
            clearMenuArea(SIMPLE_CONTENT_START_LINE);

            if (command === 'list') {
                await _handleListCommand(currentManager, rl);
            } else if (command === 'info') {
                await _handleInfoCommand(currentManager, rl);
            } else if (command === 'status') {
                await _handleStatusCommand(currentManager, rl);
            } else if (command === 'control') {
                await _handleControlCommand(currentManager, rl, currentUserRef.current);
            } else if (command === 'stats') {
                await _handleStatsCommand(currentManager, rl);
            } else if (command === 'mqtt-connections') {
                await _handleMqttConnectionsCommand(currentManager, rl);
            } else if (command === 'dump') {
                await _handleDumpCommand(currentManager, rl);
            } else if (command === 'test') {
                await _handleTestCommand(currentManager, rl);
            } else if (command === 'sniffer') {
                await _handleSnifferCommand(currentManager, rl, currentUserRef.current);
            } else if (command === 'settings') {
                const result = await _handleSettingsCommand(currentManager, rl, currentUserRef, currentCredentials);
                if (result.manager) {
                    currentManager = result.manager;
                }
                if (result.user) {
                    currentUserRef.current = result.user;
                }
            }
        } catch (error) {
            console.error(`\nError: ${error.message}`);
            if (error.stack && process.env.MEROSS_VERBOSE) {
                console.error(error.stack);
            }
            await question(rl, '\nPress Enter to return to menu...');
        }
    }

    // Cleanup
    rl.close();
    console.log('\nLogging out from Meross cloud...');
    try {
        await disconnectMeross(currentManager);
        console.log('Logged out successfully.');
    } catch (error) {
        console.error(`Error during logout: ${error.message}`);
    }
    console.log('Goodbye!');
}

module.exports = {
    menuMode
};

