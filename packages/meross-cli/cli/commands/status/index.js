'use strict';

const chalk = require('chalk');
const { MerossHubDevice, MerossSubDevice } = require('meross-iot');
const { displayHubStatus } = require('./hub-status');
const { displayDeviceStatus } = require('./device-status');

async function getDeviceStatus(manager, filterUuid = null, filterSubdeviceId = null) {
    const allDevices = filterUuid ? [manager.devices.get(filterUuid)].filter(Boolean) : manager.devices.list();
    const devices = allDevices.filter(device => !(device instanceof MerossSubDevice));

    if (devices.length === 0) {
        console.log('No devices found.');
        return;
    }

    for (const device of devices) {
        if (!device) {continue;}

        const deviceName = device.name || device.uuid || 'Unknown';
        const deviceUuid = device.uuid || 'unknown';

        console.log(`\n  ${chalk.bold(deviceName)} ${chalk.gray(`(${device.deviceType || 'unknown'})`)}`);
        console.log(`    ${chalk.bold('UUID:')} ${chalk.cyan(chalk.italic(deviceUuid))}`);

        if (!device.deviceConnected) {
            console.log(`\n  ${chalk.yellow('Not connected - cannot read device status')}\n`);
            continue;
        }

        let hasReadings = false;

        // Check if it's a hub device with subdevices
        if (device instanceof MerossHubDevice) {
            hasReadings = await displayHubStatus(device, filterSubdeviceId);
        } else {
            // Regular device - display status based on abilities
            hasReadings = await displayDeviceStatus(device);
        }

        if (!hasReadings) {
            console.log(`\n  ${chalk.white.bold('No device status available')}`);
        }

        console.log('');
    }
}

module.exports = { getDeviceStatus };

