'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { question, clearScreen, renderSimpleHeader, clearMenuArea, SIMPLE_CONTENT_START_LINE } = require('../../utils/terminal');
const DeviceSniffer = require('./device-sniffer');
const AppSniffer = require('./fake-app');

/**
 * Display welcome message and instructions
 */
function _printWelcomeMessage(currentUser = null, deviceCount = null) {
    clearScreen();
    renderSimpleHeader(currentUser, deviceCount);
    clearMenuArea(SIMPLE_CONTENT_START_LINE);

    console.log(chalk.bold('=== Device Sniffer ===\n'));
    console.log('This utility will help you capture MQTT messages between the Meross app');
    console.log('and your device. All collected information will be saved to a ZIP archive.\n');
    console.log(chalk.yellow('IMPORTANT:'));
    console.log('- The sniffer does not support MFA login. Please disable MFA if needed.');
    console.log('- Make sure the app is NOT connected to the same WiFi as the Meross device.');
    console.log('- Disable WiFi on your phone and use cellular data to ensure MQTT interception.\n');
}

/**
 * Collect device information (system data and abilities)
 * @param {Object} device - Device instance
 * @returns {Promise<Object>} Device info object
 */
async function _collectDeviceInfo(device) {
    const spinner = ora('Collecting device information...').start();

    try {
        // Ensure device is connected and get system data
        if (!device.deviceConnected) {
            spinner.fail('Device is not connected. Please ensure device is online.');
            throw new Error('Device not connected');
        }

        // Get system data (populates MAC address, MQTT host/port)
        const systemData = await device.system.getAllData();

        // Get abilities
        let abilitiesData = null;
        try {
            abilitiesData = await device.system.getAbilities();
        } catch (err) {
            spinner.warn('Could not collect device abilities');
        }

        spinner.succeed('Device information collected');

        return {
            systemData,
            abilitiesData,
            macAddress: device.macAddress,
            mqttHost: device.mqttHost,
            mqttPort: device.mqttPort,
            uuid: device.uuid,
            name: device.name,
            deviceType: device.deviceType
        };
    } catch (error) {
        spinner.fail(`Error collecting device info: ${error.message}`);
        throw error;
    }
}

/**
 * Display setup instructions
 */
function _displaySetupInstructions(currentUser = null, deviceCount = null) {
    clearScreen();
    renderSimpleHeader(currentUser, deviceCount);
    clearMenuArea(SIMPLE_CONTENT_START_LINE);

    console.log(chalk.bold('=== Setup Instructions ===\n'));
    console.log('To intercept commands, you need to:');
    console.log('1. Disconnect the real device from power (so it goes offline)');
    console.log('2. Disable WiFi on your phone (use cellular data)');
    console.log('3. Open the Meross app and issue commands');
    console.log('4. Commands will be intercepted by this sniffer\n');

    console.log(chalk.yellow('ATTENTION:'));
    console.log('If both the app and device are on the same WiFi, communication');
    console.log('will happen locally and NOT be intercepted. Use cellular data!\n');
}

/**
 * Start both sniffers
 * @param {Object} options - Sniffer options
 * @returns {Promise<{deviceSniffer: DeviceSniffer, appSniffer: AppSniffer}>}
 */
async function _startSniffers(options) {
    const { deviceInfo, userId, cloudKey, logger } = options;

    const spinner = ora('Starting sniffers...').start();

    try {
        // Start device sniffer
        const deviceSniffer = new DeviceSniffer({
            uuid: deviceInfo.uuid,
            macAddress: deviceInfo.macAddress,
            userId,
            cloudKey,
            mqttHost: deviceInfo.mqttHost,
            mqttPort: deviceInfo.mqttPort,
            logger
        });

        // Start app sniffer
        const appSniffer = new AppSniffer({
            userId,
            cloudKey,
            deviceUuid: deviceInfo.uuid,
            mqttHost: deviceInfo.mqttHost,
            mqttPort: deviceInfo.mqttPort,
            logger
        });

        await Promise.all([
            deviceSniffer.start(5000),
            appSniffer.start(5000)
        ]);

        spinner.succeed('Both sniffers started successfully');
        return { deviceSniffer, appSniffer };
    } catch (error) {
        spinner.fail(`Error starting sniffers: ${error.message}`);
        throw error;
    }
}

/**
 * Sniff messages and collect commands
 * @param {Object} options - Sniffing options
 * @returns {Promise<Array>} Array of captured messages
 */
async function _sniffMessages(options) {
    const { deviceSniffer, currentUser, deviceCount } = options;

    clearScreen();
    renderSimpleHeader(currentUser, deviceCount);
    clearMenuArea(SIMPLE_CONTENT_START_LINE);

    console.log(chalk.bold('=== Sniffing Phase ===\n'));
    console.log('Waiting for messages from the Meross app...');
    console.log('Issue commands in the app while the device is offline.\n');

    const messages = [];
    const seenMessages = new Set();
    let residualTimeout = 30000; // 30 seconds

    while (true) {
        try {
            const startTime = Date.now();

            // Wait for message with timeout
            const messagePromise = deviceSniffer.waitForMessage(['SET', 'GET']);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout')), residualTimeout);
            });

            const captured = await Promise.race([messagePromise, timeoutPromise]);

            const elapsed = Date.now() - startTime;
            residualTimeout -= elapsed;

            // Create unique key for deduplication
            const messageKey = `${captured.method}${captured.namespace}${JSON.stringify(captured.payload)}`;

            if (seenMessages.has(messageKey)) {
                // Duplicate message, continue waiting
                if (residualTimeout > 0) {
                    continue;
                } else {
                    break;
                }
            }

            seenMessages.add(messageKey);

            clearScreen();
            renderSimpleHeader(currentUser, deviceCount);
            clearMenuArea(SIMPLE_CONTENT_START_LINE);

            console.log(chalk.bold('=== Sniffing Phase ===\n'));
            console.log(chalk.green('✓ New message received:'));
            console.log(`  Method: ${chalk.cyan(captured.method)}`);
            console.log(`  Namespace: ${chalk.cyan(captured.namespace)}`);
            console.log(`  Payload: ${chalk.gray(JSON.stringify(captured.payload, null, 2))}\n`);

            // Prompt user for description
            const { description } = await inquirer.prompt([{
                type: 'input',
                name: 'description',
                message: 'Describe the command you issued in the app (or press Enter to skip):',
                default: '?'
            }]);

            // Store captured message (without response yet)
            messages.push({
                description: description || 'Unknown',
                request: {
                    method: captured.method,
                    namespace: captured.namespace,
                    payload: captured.payload,
                    raw: captured.message
                },
                response: null,
                responseError: null,
                timestamp: new Date().toISOString()
            });

            // Ask if user wants to sniff again or continue
            const { action } = await inquirer.prompt([{
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                    { name: 'Sniff for more commands', value: 'sniff' },
                    { name: 'Continue to replay phase', value: 'continue' }
                ]
            }]);

            if (action === 'continue') {
                break;
            }

            // Reset timeout for next capture
            residualTimeout = 30000;

            clearScreen();
            renderSimpleHeader(currentUser, deviceCount);
            clearMenuArea(SIMPLE_CONTENT_START_LINE);

            console.log(chalk.bold('=== Sniffing Phase ===\n'));
            console.log(chalk.yellow('Waiting for more messages...\n'));

        } catch (error) {
            if (error.message === 'Timeout') {
                if (messages.length === 0) {
                    // No messages captured yet, ask if they want to continue waiting
                    const { continueSniffing } = await inquirer.prompt([{
                        type: 'confirm',
                        name: 'continueSniffing',
                        message: 'No messages received. Continue waiting?',
                        default: false
                    }]);

                    if (!continueSniffing) {
                        break;
                    }

                    residualTimeout = 30000; // Reset timeout
                } else {
                    // Already have messages, ask what to do
                    const { action } = await inquirer.prompt([{
                        type: 'list',
                        name: 'action',
                        message: 'Timeout reached. What would you like to do?',
                        choices: [
                            { name: 'Continue waiting for more messages', value: 'wait' },
                            { name: 'Continue to replay phase', value: 'continue' }
                        ]
                    }]);

                    if (action === 'continue') {
                        break;
                    }

                    residualTimeout = 30000; // Reset timeout
                }
            } else {
                throw error;
            }
        }
    }

    return messages;
}

/**
 * Replay captured commands to the device to get responses
 * @param {Object} options - Replay options
 * @returns {Promise<Array>} Updated messages with responses
 */
async function _replayCommands(options) {
    const { messages, device, currentUser, deviceCount } = options;

    if (messages.length === 0) {
        return messages;
    }

    clearScreen();
    renderSimpleHeader(currentUser, deviceCount);
    clearMenuArea(SIMPLE_CONTENT_START_LINE);

    console.log(chalk.bold('=== Replay Phase ===\n'));
    console.log(`Ready to replay ${chalk.cyan(messages.length)} captured command(s) to get device responses.`);
    console.log(chalk.yellow('\nIMPORTANT: Make sure the device is plugged in and online before continuing.\n'));

    const { ready } = await inquirer.prompt([{
        type: 'confirm',
        name: 'ready',
        message: 'Is the device plugged in and online?',
        default: false
    }]);

    if (!ready) {
        console.log(chalk.yellow('\nSkipping replay phase. Commands will be saved without responses.'));
        return messages;
    }

    // Wait a moment for device to be ready
    const spinner = ora('Waiting for device to be ready...').start();
    await new Promise(resolve => setTimeout(resolve, 2000));
    spinner.stop();

    // Replay each command one by one
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];

        clearScreen();
        renderSimpleHeader(currentUser, deviceCount);
        clearMenuArea(SIMPLE_CONTENT_START_LINE);

        console.log(chalk.bold(`=== Replay Phase - Command ${i + 1}/${messages.length} ===\n`));
        console.log(`Description: ${chalk.cyan(msg.description)}`);
        console.log(`Method: ${chalk.cyan(msg.request.method)}`);
        console.log(`Namespace: ${chalk.cyan(msg.request.namespace)}`);
        console.log(`Payload: ${chalk.gray(JSON.stringify(msg.request.payload, null, 2))}\n`);

        if (device && device.deviceConnected) {
            try {
                const replaySpinner = ora('Replaying command to device...').start();
                const response = await device.publishMessage(
                    msg.request.method,
                    msg.request.namespace,
                    msg.request.payload
                );
                replaySpinner.succeed('Response received');

                msg.response = response;
                console.log(chalk.green('\n✓ Response:'));
                console.log(chalk.gray(JSON.stringify(response, null, 2)));
            } catch (err) {
                msg.responseError = err.message;
                console.log(chalk.red(`\n✗ Error replaying command: ${err.message}`));
            }
        } else {
            console.log(chalk.yellow('Device not connected, skipping this command'));
            msg.responseError = 'Device not connected';
        }

        // Ask if user wants to continue (except for last command)
        if (i < messages.length - 1) {
            const { continueReplay } = await inquirer.prompt([{
                type: 'confirm',
                name: 'continueReplay',
                message: 'Continue to next command?',
                default: true
            }]);

            if (!continueReplay) {
                console.log(chalk.yellow('\nStopping replay. Remaining commands will be saved without responses.'));
                break;
            }
        }
    }

    console.log(chalk.green('\n✓ Replay phase completed'));
    return messages;
}

/**
 * Create ZIP archive with all collected data
 * @param {Object} options - Archive options
 * @returns {Promise<string>} Path to created ZIP file
 */
async function _createZipArchive(options) {
    const { deviceInfo, messages, logFile } = options;

    const zipPath = path.join(process.cwd(), `meross-sniffer-${Date.now()}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
        archive.on('error', reject);
        output.on('close', () => resolve(zipPath));

        archive.pipe(output);

        // Add sniffed commands
        const commandsText = messages.map((msg, idx) => {
            let text = `\n${'='.repeat(60)}\n`;
            text += `Command #${idx + 1}: ${msg.description}\n`;
            text += `${'='.repeat(60)}\n\n`;
            text += `Request:\n${msg.request.raw}\n\n`;

            if (msg.response) {
                text += `Response:\n${JSON.stringify(msg.response, null, 2)}\n\n`;
            } else if (msg.responseError) {
                text += `Response Error: ${msg.responseError}\n\n`;
            }

            text += `Timestamp: ${msg.timestamp}\n`;
            return text;
        }).join('\n');

        archive.append(commandsText, { name: 'sniffed_commands.txt' });

        // Add device info
        archive.append(JSON.stringify({
            device: {
                uuid: deviceInfo.uuid,
                name: deviceInfo.name,
                deviceType: deviceInfo.deviceType,
                macAddress: deviceInfo.macAddress,
                mqttHost: deviceInfo.mqttHost,
                mqttPort: deviceInfo.mqttPort
            },
            systemData: deviceInfo.systemData,
            abilitiesData: deviceInfo.abilitiesData
        }, null, 2), { name: 'device_info.json' });

        // Add log file if exists
        if (logFile && fs.existsSync(logFile)) {
            archive.file(logFile, { name: 'sniff_log.txt' });
        }

        // Add metadata
        archive.append(JSON.stringify({
            timestamp: new Date().toISOString(),
            messageCount: messages.length,
            deviceUuid: deviceInfo.uuid
        }, null, 2), { name: 'sniffer_metadata.json' });

        archive.finalize();
    });
}

/**
 * Main sniffer menu function
 * @param {Object} manager - ManagerMeross instance
 * @param {Object} rl - Readline interface
 * @param {string|null} currentUser - Current logged in user name
 */
// eslint-disable-next-line max-statements
async function snifferMenu(manager, rl, currentUser = null) {
    let deviceSniffer = null;
    let appSniffer = null;
    const logFile = path.join(process.cwd(), 'sniff.log');

    // Setup logger to write to file
    const logStream = fs.createWriteStream(logFile, { flags: 'w' });
    const logger = (msg) => {
        const timestamp = new Date().toISOString();
        logStream.write(`[${timestamp}] ${msg}\n`);
    };

    const deviceCount = manager.devices.list().filter(d => {
        const { MerossSubDevice } = require('meross-iot');
        return !(d instanceof MerossSubDevice);
    }).length;

    try {
        _printWelcomeMessage(currentUser, deviceCount);

        // Select device
        const devices = manager.devices.list().filter(d => {
            // Filter out subdevices
            const { MerossSubDevice } = require('meross-iot');
            return !(d instanceof MerossSubDevice);
        });

        if (devices.length === 0) {
            clearScreen();
            renderSimpleHeader(currentUser, deviceCount);
            clearMenuArea(SIMPLE_CONTENT_START_LINE);

            console.log(chalk.red('No devices found. Please connect devices first.'));
            await question(rl, '\nPress Enter to return to menu...');
            return;
        }

        const deviceChoices = devices.map((device, idx) => ({
            name: `${device.name || 'Unknown'} (${device.uuid})`,
            value: idx
        }));

        const { deviceIndex } = await inquirer.prompt([{
            type: 'list',
            name: 'deviceIndex',
            message: 'Select device to sniff:',
            choices: deviceChoices
        }]);

        const selectedDevice = devices[deviceIndex];

        if (!selectedDevice.deviceConnected) {
            clearScreen();
            renderSimpleHeader(currentUser, deviceCount);
            clearMenuArea(SIMPLE_CONTENT_START_LINE);

            console.log(chalk.yellow('Warning: Selected device is not connected.'));
            console.log('Some features may not work correctly.\n');
        }

        // Collect device info
        const deviceInfo = await _collectDeviceInfo(selectedDevice);

        if (!deviceInfo.macAddress || !deviceInfo.mqttHost) {
            clearScreen();
            renderSimpleHeader(currentUser, deviceCount);
            clearMenuArea(SIMPLE_CONTENT_START_LINE);

            console.log(chalk.red('Error: Could not get device MAC address or MQTT host.'));
            console.log('Please ensure the device is online and try again.');
            await question(rl, '\nPress Enter to return to menu...');
            return;
        }

        // Display setup instructions
        _displaySetupInstructions(currentUser, deviceCount);

        const { ready } = await inquirer.prompt([{
            type: 'confirm',
            name: 'ready',
            message: 'Are you ready to start sniffing? (Device disconnected, WiFi disabled on phone)',
            default: false
        }]);

        if (!ready) {
            clearScreen();
            renderSimpleHeader(currentUser, deviceCount);
            clearMenuArea(SIMPLE_CONTENT_START_LINE);

            console.log(chalk.yellow('Sniffing cancelled.'));
            await question(rl, '\nPress Enter to return to menu...');
            return;
        }

        // Start sniffers
        const userId = manager.userId;
        const cloudKey = manager.key;

        if (!userId || !cloudKey) {
            clearScreen();
            renderSimpleHeader(currentUser, deviceCount);
            clearMenuArea(SIMPLE_CONTENT_START_LINE);

            console.log(chalk.red('Error: Missing authentication credentials.'));
            await question(rl, '\nPress Enter to return to menu...');
            return;
        }

        try {
            ({ deviceSniffer, appSniffer } = await _startSniffers({
                deviceInfo,
                userId,
                cloudKey,
                logger
            }));
        } catch (error) {
            clearScreen();
            renderSimpleHeader(currentUser, deviceCount);
            clearMenuArea(SIMPLE_CONTENT_START_LINE);

            console.log(chalk.red(`Failed to start sniffers: ${error.message}`));
            console.log(chalk.yellow('\nTroubleshooting tips:'));
            console.log('- Ensure the device is online and connected');
            console.log('- Verify MQTT host/port are correct');
            console.log('- Check that MAC address was collected correctly');
            console.log(`- Device MAC: ${deviceInfo.macAddress || 'NOT AVAILABLE'}`);
            console.log(`- MQTT Host: ${deviceInfo.mqttHost || 'NOT AVAILABLE'}`);
            console.log(`- MQTT Port: ${deviceInfo.mqttPort || 'NOT AVAILABLE'}`);
            throw error;
        }

        // Sniff messages (device should be offline)
        const messages = await _sniffMessages({
            deviceSniffer,
            currentUser,
            deviceCount
        });

        // Stop sniffers
        clearScreen();
        renderSimpleHeader(currentUser, deviceCount);
        clearMenuArea(SIMPLE_CONTENT_START_LINE);

        console.log(chalk.yellow('Stopping sniffers...'));
        await Promise.all([
            deviceSniffer.stop(),
            appSniffer.stop()
        ]);

        // Replay commands to get responses (device should be online now)
        const messagesWithResponses = await _replayCommands({
            messages,
            device: selectedDevice,
            currentUser,
            deviceCount
        });

        // Create ZIP archive
        if (messagesWithResponses.length === 0) {
            clearScreen();
            renderSimpleHeader(currentUser, deviceCount);
            clearMenuArea(SIMPLE_CONTENT_START_LINE);

            console.log(chalk.yellow('No messages were captured.'));
            await question(rl, '\nPress Enter to return to menu...');
            return;
        }

        clearScreen();
        renderSimpleHeader(currentUser, deviceCount);
        clearMenuArea(SIMPLE_CONTENT_START_LINE);

        console.log(chalk.bold('=== Saving Results ===\n'));
        const withResponses = messagesWithResponses.filter(m => m.response !== null).length;
        console.log(`Captured ${chalk.cyan(messagesWithResponses.length)} message(s)`);
        if (withResponses > 0) {
            console.log(`  ${chalk.green(withResponses)} with responses`);
        }

        const spinner = ora('Creating ZIP archive...').start();
        const zipPath = await _createZipArchive({
            deviceInfo,
            messages: messagesWithResponses,
            logFile
        });
        spinner.succeed(`ZIP archive created: ${chalk.cyan(zipPath)}`);

        clearScreen();
        renderSimpleHeader(currentUser, deviceCount);
        clearMenuArea(SIMPLE_CONTENT_START_LINE);

        console.log(chalk.green('✓ Sniffing session completed successfully!'));
        await question(rl, '\nPress Enter to return to menu...');

    } catch (error) {
        clearScreen();
        renderSimpleHeader(currentUser, deviceCount);
        clearMenuArea(SIMPLE_CONTENT_START_LINE);

        console.error(chalk.red(`Error: ${error.message}`));
        if (error.stack && process.env.MEROSS_VERBOSE) {
            console.error(error.stack);
        }

        // Cleanup on error
        if (deviceSniffer) {
            await deviceSniffer.stop().catch(() => {});
        }
        if (appSniffer) {
            await appSniffer.stop().catch(() => {});
        }

        await question(rl, '\nPress Enter to return to menu...');
    } finally {
        if (logStream && !logStream.destroyed) {
            logStream.end();
        }
        process.stdout.write('\x1b[?25h');
    }
}

module.exports = { snifferMenu };
