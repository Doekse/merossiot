#!/usr/bin/env node
'use strict';

const ManagerMeross = require('meross-iot');
const { MerossHubDevice } = require('meross-iot');
const path = require('path');
const testRunner = require('./tests/test-runner');
const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const { detectControlMethods } = require('./control-registry');

// Load package.json for version info
const packageJson = require('../package.json');

// Import from new modules
const { processOptionsAndCreateHttpClient } = require('./helpers/client');
const { printLogo, printVersion } = require('./utils/display');
const { handleError } = require('./utils/error-handler');
const { listDevices, dumpRegistry, listMqttConnections, getDeviceStatus, showDeviceInfo, executeControlCommand, collectControlParameters, runTestCommand } = require('./commands');
const { menuMode } = require('./menu');

// Functions moved to modules - imported above
// menuMode moved to menu/main.js
// Settings menu functions moved to menu/settings.js
// Terminal control functions moved to utils/terminal.js
// question, promptForPassword, createRL moved to utils/terminal.js

// All menu functions moved to menu/ directory

async function main() {
    const program = new Command();

    // Set program name and version
    program
        .name('meross-cli')
        .description('Control and manage your Meross smart home devices from the command line')
        .version(packageJson.version, '-V, --version', 'display version number');

    // Customize help to show logo
    program.configureHelp({
        helpWidth: 120
    });

    // Add custom help text with environment variables
    program.addHelpText('after', `
Environment Variables:
  MEROSS_EMAIL                          Meross account email
  MEROSS_PASSWORD                       Meross account password
  MEROSS_MFA_CODE                       Multi-factor authentication code
  MEROSS_TOKEN_DATA                     Path to token data JSON file
  MEROSS_API_URL                        Meross API base URL (optional)

Examples:
  meross-cli list --email user@example.com --password mypass
  meross-cli info abc123 --email user@example.com --password mypass
  meross-cli status --email user@example.com --password mypass
  meross-cli listen --email user@example.com --password mypass
  meross-cli test light --email user@example.com --password mypass
  meross-cli                                    Start menu mode
    `);

    // Global options
    program
        .option('-e, --email <email>', 'Meross account email (or set MEROSS_EMAIL env var)')
        .option('-p, --password <password>', 'Meross account password (or set MEROSS_PASSWORD env var)')
        .option('-m, --mfa-code <code>', 'Multi-factor authentication code (or set MEROSS_MFA_CODE env var)')
        .option('-t, --token-data <path>', 'Path to token data JSON file (or set MEROSS_TOKEN_DATA env var)')
        .option('-T, --transport-mode <mode>', 'Transport mode: mqtt_only, lan_http_first, lan_http_first_only_get', 'mqtt_only')
        .option('--timeout <ms>', 'Request timeout in milliseconds', '10000')
        .option('--enable-stats', 'Enable statistics tracking')
        .option('-v, --verbose', 'Enable verbose logging');

    // Helper function to connect and setup meross instance
    async function connectMerossInstance(opts) {
        const processed = await processOptionsAndCreateHttpClient({
            email: opts.email,
            password: opts.password,
            mfaCode: opts.mfaCode,
            tokenData: opts.tokenData,
            transportMode: opts.transportMode,
            timeout: opts.timeout,
            enableStats: opts.enableStats,
            verbose: opts.verbose
        });

        const { options, config } = processed;

        const manager = new ManagerMeross(options);

        // Handle device events
        manager.on('deviceInitialized', (deviceId) => {
            if (config.verbose) {
                console.log(`Device initialized: ${deviceId}`);
            }
        });

        manager.on('connected', (deviceId) => {
            if (config.verbose) {
                console.log(`Device connected: ${deviceId}`);
            }
        });

        manager.on('error', (error, deviceId) => {
            if (config.verbose) {
                console.error(chalk.red(`Error${deviceId ? ` (${deviceId})` : ''}: ${error.message}`));
            }
        });

        // Connect
        const spinner = ora('Connecting to Meross cloud...').start();
        try {
            const deviceCount = await manager.connect();
            spinner.succeed(chalk.green(`Connected to ${deviceCount} device(s)`));
        } catch (error) {
            spinner.stop();
            handleError(error, { verbose: config.verbose });
            throw error;
        }

        // Wait a bit for devices to connect
        await new Promise(resolve => setTimeout(resolve, 2000));

        return { manager, config };
    }

    // List command
    program
        .command('list')
        .description('List all devices')
        .action(async () => {
            const opts = program.opts();
            try {
                const { manager, config } = await connectMerossInstance(opts);
                await listDevices(manager);
                const logoutResponse = await manager.logout();
                if (config.verbose && logoutResponse) {
                    console.log('\nLogout response:', JSON.stringify(logoutResponse, null, 2));
                }
            } catch (error) {
                handleError(error, { verbose: opts.verbose, exit: true });
            }
        });

    // Info command
    program
        .command('info <uuid>')
        .description('Show detailed information about a device')
        .action(async (uuid) => {
            const opts = program.opts();
            try {
                // Validate UUID
                if (!uuid || uuid.trim() === '') {
                    console.error(chalk.red('Error: UUID required for info command'));
                    console.error('Usage: meross-cli info <uuid> [options]');
                    process.exit(1);
                }
                const { manager, config } = await connectMerossInstance(opts);
                await showDeviceInfo(manager, uuid.trim());
                const logoutResponse = await manager.logout();
                if (config.verbose && logoutResponse) {
                    console.log('\nLogout response:', JSON.stringify(logoutResponse, null, 2));
                }
            } catch (error) {
                handleError(error, { verbose: opts.verbose, exit: true });
            }
        });

    // Status command
    program
        .command('status [uuid] [subdevice-id]')
        .description('Get device status with sensors and configuration (optional: filter by UUID and/or subdevice ID)')
        .action(async (uuid, subdeviceId) => {
            const opts = program.opts();
            try {
                const { manager, config } = await connectMerossInstance(opts);
                await getDeviceStatus(manager, uuid || null, subdeviceId || null);
                const logoutResponse = await manager.logout();
                if (config.verbose && logoutResponse) {
                    console.log('\nLogout response:', JSON.stringify(logoutResponse, null, 2));
                }
            } catch (error) {
                handleError(error, { verbose: opts.verbose, exit: true });
            }
        });

    // Stats command
    program
        .command('stats [action]')
        .description('Enable/disable statistics or show statistics (default: get)')
        .action(async () => {
            console.log(chalk.yellow('Note: Statistics require an active connection. Connect first or use menu mode.'));
            process.exit(0);
        });

    // MQTT connections command
    program
        .command('mqtt-connections')
        .description('View all active MQTT connections')
        .option('--json', 'Output in JSON format')
        .action(async () => {
            const opts = program.opts();
            try {
                const { manager, config } = await connectMerossInstance(opts);
                await listMqttConnections(manager, {
                    verbose: opts.verbose || false,
                    json: opts.json || false
                });
                const logoutResponse = await manager.logout();
                if (config.verbose && logoutResponse) {
                    console.log('\nLogout response:', JSON.stringify(logoutResponse, null, 2));
                }
            } catch (error) {
                handleError(error, { verbose: opts.verbose, exit: true });
            }
        });

    // Dump command
    program
        .command('dump [file]')
        .description('Dump device registry to JSON file (default: device-registry.json)')
        .action(async (file) => {
            const opts = program.opts();
            try {
                const filename = file || 'device-registry.json';
                // Validate filename to prevent path injection
                if (filename.includes('..') || path.isAbsolute(filename) && !filename.startsWith(process.cwd())) {
                    throw new Error('Invalid file path');
                }
                const { manager, config } = await connectMerossInstance(opts);
                await dumpRegistry(manager, filename);
                const logoutResponse = await manager.logout();
                if (config.verbose && logoutResponse) {
                    console.log('\nLogout response:', JSON.stringify(logoutResponse, null, 2));
                }
            } catch (error) {
                handleError(error, { verbose: opts.verbose, exit: true });
            }
        });

    // Control command helper functions
    function _validateControlUuid(uuid) {
        if (!uuid || uuid.trim() === '') {
            console.error(chalk.red('Error: UUID required for control command'));
            console.error('Usage: meross-cli control <uuid> [method] [options]');
            process.exit(1);
        }
    }

    async function _waitForDeviceConnection(device) {
        if (!device.deviceConnected) {
            console.log(chalk.yellow('Waiting for device to connect...'));
            for (let i = 0; i < 30; i++) {
                await new Promise(resolve => setTimeout(resolve, 500));
                if (device.deviceConnected) {break;}
            }
            if (!device.deviceConnected) {
                console.error(chalk.red('Error: Device did not connect in time'));
                process.exit(1);
            }
        }
    }

    function _resolveDevice(manager, uuid, subdeviceId) {
        let device = manager.devices.get(uuid.trim());
        if (!device) {
            console.error(chalk.red(`Error: Device not found: ${uuid}`));
            process.exit(1);
        }

        if (subdeviceId && device instanceof MerossHubDevice) {
            const subdevices = device.getSubdevices();
            const subdevice = subdevices.find(s => s.subdeviceId === subdeviceId);
            if (!subdevice) {
                console.error(chalk.red(`Error: Subdevice not found: ${subdeviceId}`));
                process.exit(1);
            }
            device = subdevice;
        }

        return device;
    }

    function _listAvailableMethods(availableMethods, uuid) {
        console.log(chalk.bold(`\nAvailable control methods for device ${uuid}:\n`));
        const methodsByCategory = {};
        for (const m of availableMethods) {
            const category = m.category || 'Other';
            if (!methodsByCategory[category]) {
                methodsByCategory[category] = [];
            }
            methodsByCategory[category].push(m);
        }

        for (const [category, methods] of Object.entries(methodsByCategory)) {
            console.log(chalk.bold(`${category  }:`));
            for (const m of methods) {
                console.log(`  ${chalk.cyan(m.methodName)} - ${m.name} - ${m.description}`);
            }
            console.log();
        }
        console.log('Usage: meross-cli control <uuid> <method> [options]');
        console.log('Example: meross-cli control <uuid> setToggleX --channel 0 --on');
    }

    function _findMethodInfo(availableMethods, methodName) {
        const methodInfo = availableMethods.find(m => m.methodName === methodName);
        if (!methodInfo) {
            console.error(chalk.red(`Error: Control method not found: ${methodName}`));
            console.error('\nAvailable methods:');
            availableMethods.forEach(m => {
                console.error(`  - ${m.methodName}`);
            });
            process.exit(1);
        }
        return methodInfo;
    }

    function _buildControlParams(options) {
        const params = {};
        if (options.channel !== undefined) {
            params.channel = parseInt(options.channel, 10);
        }
        if (options.subdeviceId) {
            params.subId = options.subdeviceId;
        }
        if (options.on !== undefined) {
            params.onoff = true;
        } else if (options.off !== undefined) {
            params.onoff = false;
        }
        if (options.rgb) {
            const parts = options.rgb.split(',').map(p => parseInt(p.trim(), 10));
            if (parts.length === 3) {
                params.rgb = parts;
            }
        }
        if (options.brightness !== undefined) {
            params.luminance = parseInt(options.brightness, 10);
        }
        if (options.temperature !== undefined) {
            params.temperature = parseFloat(options.temperature);
        }
        if (options.position !== undefined) {
            params.position = parseInt(options.position, 10);
        }
        if (options.mode !== undefined) {
            params.mode = parseInt(options.mode, 10);
        }
        return params;
    }

    function _checkRequiredParams(params, methodInfo) {
        const requiredParams = methodInfo.params ? methodInfo.params.filter(p => p.required) : [];
        return requiredParams.every(p => {
            if (p.name === 'channel' && params.channel !== undefined) {return true;}
            if (p.name === 'onoff' && params.onoff !== undefined) {return true;}
            if (p.name === 'subId' && params.subId !== undefined) {return true;}
            if (p.name === 'mode' && params.mode !== undefined) {return true;}
            if (p.name === 'position' && params.position !== undefined) {return true;}
            if (p.name === 'rgb' && params.rgb !== undefined) {return true;}
            if (p.name === 'luminance' && params.luminance !== undefined) {return true;}
            if (p.name === 'temperature' && params.temperature !== undefined) {return true;}
            return params[p.name] !== undefined;
        });
    }

    async function _executeControlMethod(manager, uuid, subdeviceId, methodName, methodInfo, params, device) {
        const hasAllRequired = _checkRequiredParams(params, methodInfo);
        if (!hasAllRequired) {
            const collectedParams = await collectControlParameters(methodName, methodInfo, device);
            Object.assign(params, collectedParams);
        }

        console.log(chalk.cyan(`\nExecuting ${methodInfo.name}...`));
        const result = await executeControlCommand(manager, uuid.trim(), subdeviceId, methodName, params);
        console.log(chalk.green('\n✓ Command executed successfully!'));
        if (result) {
            console.log(chalk.dim('\nResponse:'));
            console.log(JSON.stringify(result, null, 2));
        }
    }

    // Control command
    program
        .command('control <uuid> [method]')
        .description('Control a device (list available methods if method not specified)')
        .option('--channel <n>', 'Channel number (default: 0)')
        .option('--subdevice-id <id>', 'Subdevice ID (for hub devices)')
        .option('--on', 'Turn on (for toggle methods)')
        .option('--off', 'Turn off (for toggle methods)')
        .option('--rgb <r,g,b>', 'RGB color (e.g., 255,0,0)')
        .option('--brightness <n>', 'Brightness (0-100)')
        .option('--temperature <n>', 'Temperature value')
        .option('--position <n>', 'Position value (0-100, -1 to stop)')
        .option('--mode <n>', 'Mode value')
        .action(async (uuid, method, options) => {
            const opts = program.opts();
            try {
                _validateControlUuid(uuid);
                const { manager, config } = await connectMerossInstance(opts);

                // Wait for devices to connect
                await new Promise(resolve => setTimeout(resolve, 2000));

                const subdeviceId = options.subdeviceId || null;
                const device = _resolveDevice(manager, uuid, subdeviceId);
                await _waitForDeviceConnection(device);

                // Abilities are already loaded at device creation (single-phase initialization)
                // Detect available methods (filtered by device capabilities)
                const availableMethods = detectControlMethods(device);

                if (!method || method.trim() === '') {
                    _listAvailableMethods(availableMethods, uuid);
                } else {
                    const methodName = method.trim();
                    const methodInfo = _findMethodInfo(availableMethods, methodName);
                    const params = _buildControlParams(options);
                    await _executeControlMethod(manager, uuid, subdeviceId, methodName, methodInfo, params, device);
                }

                const logoutResponse = await manager.logout();
                if (config.verbose && logoutResponse) {
                    console.log('\nLogout response:', JSON.stringify(logoutResponse, null, 2));
                }
            } catch (error) {
                handleError(error, { verbose: opts.verbose, exit: true });
            }
        });

    // Test command
    program
        .command('test <device-type>')
        .description('Run tests for a specific device type (e.g., light, thermostat)')
        .action(async (deviceType) => {
            const opts = program.opts();
            try {
                if (!deviceType || deviceType.trim() === '') {
                    console.error(chalk.red('Error: Device type required for test command'));
                    console.error('Usage: meross-cli test <device-type> [options]');
                    console.error('\nAvailable test types:');
                    const availableTypes = testRunner.getAvailableTestTypes();
                    availableTypes.forEach(type => {
                        const description = testRunner.getTestDescription(type);
                        console.error(`  - ${type} (${description})`);
                    });
                    process.exit(1);
                }
                const { manager, config } = await connectMerossInstance(opts);
                await runTestCommand(manager, deviceType.trim());
                const logoutResponse = await manager.logout();
                if (config.verbose && logoutResponse) {
                    console.log('\nLogout response:', JSON.stringify(logoutResponse, null, 2));
                }
            } catch (error) {
                handleError(error, { verbose: opts.verbose, exit: true });
            }
        });

    // Help command
    program
        .command('help')
        .description('Display help for command')
        .action(() => {
            printLogo(true, 'help');
            program.outputHelp();
        });

    // Hook into help display to show logo
    const originalHelp = program.helpInformation;
    program.helpInformation = function () {
        printLogo(true, 'help');
        return originalHelp.call(this);
    };

    // Handle version command before parsing
    if (process.argv.includes('--version') || process.argv.includes('-V')) {
        printLogo(true, 'version');
        printVersion();
        process.exit(0);
    }

    // Check if no command provided - start menu mode before parsing
    const args = process.argv.slice(2);
    // Check if help/version flags are present
    const isHelpOrVersion = args.includes('--help') || args.includes('-h') || args.includes('--version') || args.includes('-V');
    // Check if there's an actual command (not just options)
    const hasCommand = args.length > 0 && !args[0].startsWith('-') && !isHelpOrVersion;

    // If no command and not help/version, start menu mode
    if (!hasCommand && !isHelpOrVersion) {
        try {
            await menuMode();
            return;
        } catch (error) {
            handleError(error, { verbose: true, exit: true });
        }
    }

    // Parse arguments
    program.parse(process.argv);
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        handleError(error, { verbose: true, exit: true });
    });
}

module.exports = { main };

