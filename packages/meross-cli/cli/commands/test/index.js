'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const testRunner = require('../../tests/test-runner');

async function selectDeviceForTest(manager, testType) {
    const findSpinner = ora(`Finding devices for test type: ${chalk.cyan(testType)}`).start();
    const devices = await testRunner.findDevicesForTestType(testType, manager);
    findSpinner.stop();

    if (devices.length === 0) {
        console.log(chalk.yellow(`\n⚠ No devices found for test type: ${chalk.cyan(testType)}`));
        return { selectedDevices: null, testAll: false };
    }

    if (devices.length === 1) {
        const device = devices[0];
        console.log(chalk.green(`\n✓ Found 1 device: ${chalk.bold(device.name || device.uuid)}`));
        return { selectedDevices: [device], testAll: false };
    }

    // Multiple devices - let user choose with arrow-based selection
    const choices = [
        ...devices.map((device, index) => {
            const name = device.name || 'Unknown';
            const uuid = device.uuid || 'unknown';
            const type = device.deviceType || 'unknown';
            return {
                name: `${name} (${type}) - ${uuid}`,
                value: `device_${index}`
            };
        }),
        new inquirer.Separator(),
        {
            name: 'Test all devices',
            value: 'all'
        }
    ];

    const { deviceChoice } = await inquirer.prompt([{
        type: 'list',
        name: 'deviceChoice',
        message: 'Select device to test:',
        choices
    }]);

    if (deviceChoice === 'all') {
        return { selectedDevices: devices, testAll: true };
    } else if (deviceChoice.startsWith('device_')) {
        const index = parseInt(deviceChoice.replace('device_', ''), 10);
        const selectedDevice = devices[index];
        console.log(`\nSelected device: ${chalk.bold(selectedDevice.name || selectedDevice.uuid || 'Unknown')}`);
        return { selectedDevices: [selectedDevice], testAll: false };
    }

    // Fallback (shouldn't happen)
    return { selectedDevices: null, testAll: false };
}

async function runTestCommand(manager, testType, allowDeviceSelection = false) {
    let selectedDevices = null;

    // If device selection is allowed, let user select device
    if (allowDeviceSelection) {
        const selection = await selectDeviceForTest(manager, testType);
        if (!selection || !selection.selectedDevices || selection.selectedDevices.length === 0) {
            // User cancelled or no devices found
            return;
        }
        selectedDevices = selection.selectedDevices;
    } else {
        // Auto-discover devices
        const findSpinner = ora(`Finding devices for test type: ${chalk.cyan(testType)}`).start();
        selectedDevices = await testRunner.findDevicesForTestType(testType, manager);
        findSpinner.stop();

        if (selectedDevices.length === 0) {
            console.log(chalk.yellow(`\n⚠ No devices found for test type: ${chalk.cyan(testType)}`));
            return;
        }

        const deviceNames = selectedDevices.map(d => {
            return d.name || d.uuid || 'Unknown';
        });
        console.log(chalk.green(`\n✓ Found ${selectedDevices.length} device${selectedDevices.length > 1 ? 's' : ''}: ${chalk.bold(deviceNames.join(', '))}`));
    }

    // Prepare context object for test runner
    const context = {
        manager,
        devices: selectedDevices,
        options: {
            timeout: 30000,
            verbose: true
        }
    };

    // Start spinner for test execution
    const testSpinner = ora({
        text: `Running tests for device type: ${chalk.cyan(testType)}`,
        spinner: 'dots'
    }).start();

    try {
        const results = await testRunner.runTest(testType, context);
        testSpinner.stop();

        // Print detailed results with improved formatting
        if (results.tests && results.tests.length > 0) {
            console.log(chalk.bold('\nTest Results:\n'));

            results.tests.forEach((test) => {
                let icon, statusColor, statusText;
                if (test.skipped) {
                    icon = chalk.yellow('⏭');
                    statusColor = chalk.yellow;
                    statusText = 'SKIPPED';
                } else if (test.passed) {
                    icon = chalk.green('✓');
                    statusColor = chalk.green;
                    statusText = 'PASSED';
                } else {
                    icon = chalk.red('✗');
                    statusColor = chalk.red;
                    statusText = 'FAILED';
                }

                const deviceInfo = test.device ? chalk.gray(` [${test.device}]`) : '';
                const testName = chalk.white(test.name);

                console.log(`${icon} ${testName}${deviceInfo} ${statusColor(`- ${statusText}`)}`);

                if (!test.passed && !test.skipped && test.error) {
                    console.log(`   ${chalk.red('Error:')} ${chalk.gray(test.error)}`);
                }
            });

            // Summary with colors
            const passedColor = results.passed > 0 ? chalk.green : chalk.gray;
            const failedColor = results.failed > 0 ? chalk.red : chalk.gray;
            const skippedColor = results.skipped > 0 ? chalk.yellow : chalk.gray;

            console.log(`${chalk.bold('\nSummary:')} ${passedColor(`${results.passed} passed`)}` +
                ` ${failedColor(`${results.failed} failed`)}` +
                ` ${skippedColor(`${results.skipped} skipped`)}${chalk.gray(` (${(results.duration / 1000).toFixed(2)}s)`)}`);
        }

        if (results.error) {
            console.error(chalk.red(`\n✗ Test error: ${results.error}`));
            if (results.stack) {
                console.error(chalk.gray(results.stack));
            }
            if (!allowDeviceSelection) {
                process.exit(1);
            }
            return;
        }

        if (results.success) {
            console.log(chalk.green('\n✓ All tests completed successfully'));
        } else {
            console.log(chalk.red(`\n✗ Tests failed (${results.failed} failure(s))`));
            if (!allowDeviceSelection) {
                process.exit(1);
            }
        }
    } catch (error) {
        testSpinner.stop();
        console.error(chalk.red(`\n✗ Error running tests: ${error.message}`));
        if (error.stack) {
            console.error(chalk.gray(error.stack));
        }
        if (!allowDeviceSelection) {
            process.exit(1);
        }
    }
}

module.exports = {
    runTestCommand,
    selectDeviceForTest
};

