'use strict';

const chalk = require('chalk');
const ora = require('ora');
const { MerossHubDevice, MerossSubDevice, OnlineStatus, parsePushNotification } = require('meross-iot');
const { formatDevice } = require('../utils/display');

async function listDevices(manager) {
    const hubs = manager.getAllDevices().filter(device => device instanceof MerossHubDevice);
    if (hubs.length > 0) {
        const spinner = ora('Loading devices and refreshing hub status').start();
        // Refresh hub state to update subdevice online status
        // This queries the hub for current subdevice status
        const refreshPromises = hubs
            .filter(hub => hub.onlineStatus === OnlineStatus.ONLINE)
            .map(async hub => {
                try {
                    // Refresh state (queries sensors/MTS100 which may include online status)
                    await hub.refreshState().catch(err => {
                        const logger = manager.options?.logger || console.debug;
                        logger(`Failed to refresh hub ${hub.uuid}: ${err.message}`);
                    });

                    // Also explicitly query online status and route to subdevices
                    // Some hubs (e.g., msh300hk) may not include online status in sensor responses
                    try {
                        if (typeof hub.getHubOnline === 'function') {
                            const onlineResponse = await hub.getHubOnline();
                            if (onlineResponse && onlineResponse.online) {
                                // Parse and route the online status notification to subdevices
                                const notification = parsePushNotification('Appliance.Hub.Online', onlineResponse, hub.uuid);
                                if (notification && typeof notification.routeToSubdevices === 'function') {
                                    notification.routeToSubdevices(hub);
                                }
                            }
                        }
                    } catch (onlineErr) {
                        // Log but don't fail - online status query might not be supported
                        const logger = manager.options?.logger || console.debug;
                        logger(`Failed to query online status for hub ${hub.uuid}: ${onlineErr.message}`);
                    }
                } catch (err) {
                    const logger = manager.options?.logger || console.debug;
                    logger(`Error refreshing hub ${hub.uuid}: ${err.message}`);
                }
            });
        await Promise.all(refreshPromises);
        spinner.stop();
    }

    const allDevices = manager.getAllDevices();
    const devices = allDevices.filter(device => !(device instanceof MerossSubDevice));

    if (devices.length === 0) {
        console.log(chalk.yellow('No devices found.'));
        return;
    }

    console.log(`\n${chalk.bold.underline('Devices')}\n`);
    devices.forEach((device, index) => {
        const info = formatDevice(device);

        console.log(`  [${index}] ${chalk.bold.underline(info.name)}`);

        const deviceInfo = [
            ['Type', info.type],
            ['UUID', chalk.cyan(info.uuid)]
        ];

        if (device.channels && device.channels.length > 0) {
            deviceInfo.push(['Channels', chalk.cyan(device.channels.length.toString())]);
        }

        const maxLabelLength = Math.max(...deviceInfo.map(([label]) => label.length));

        deviceInfo.forEach(([label, value]) => {
            const padding = ' '.repeat(maxLabelLength - label.length);
            console.log(`  ${chalk.white.bold(label)}:${padding} ${chalk.italic(value)}`);
        });

        const statusColor = info.status === 'connected' ? chalk.green('Connected') : chalk.red('Disconnected');
        const onlineColor = info.online === 'online' ? chalk.green('Online') : chalk.red('Offline');

        const fwHwPadding = ' '.repeat(Math.max(0, 'Hardware'.length - 'Firmware'.length));
        console.log(`  ${chalk.white.bold('Hardware')}: ${chalk.italic(info.hardware)}    ${chalk.white.bold('Firmware')}:${fwHwPadding} ${chalk.italic(info.firmware)}`);

        const statusOnlinePadding = ' '.repeat(Math.max(0, 'Online'.length - 'Status'.length));
        console.log(`  ${chalk.white.bold('Status')}: ${chalk.italic(statusColor)}  ${chalk.white.bold('Online')}:${statusOnlinePadding} ${chalk.italic(onlineColor)}`);

        if (device instanceof MerossHubDevice) {
            const subdevices = device.getSubdevices();
            if (subdevices.length > 0) {
                console.log(`\n  ${chalk.white.bold(`Subdevices (${chalk.cyan(subdevices.length)}):`)}`);
                subdevices.forEach((subdevice) => {
                    const subName = subdevice.name || subdevice.subdeviceId;
                    const subType = subdevice.type || 'unknown';
                    const subId = subdevice.subdeviceId;
                    const subOnline = subdevice.onlineStatus === OnlineStatus.ONLINE ? 'online' : 'offline';
                    const subOnlineColor = subOnline === 'online' ? chalk.green('Online') : chalk.red('Offline');
                    console.log(`    ${chalk.bold(subName)} (${subType}) - ID: ${chalk.cyan(subId)} [${subOnlineColor}]`);
                });
            } else {
                console.log(`\n  ${chalk.white.bold('Subdevices: 0')}`);
            }
        }

        console.log('');
    });
}

module.exports = { listDevices };

