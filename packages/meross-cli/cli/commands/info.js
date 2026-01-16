'use strict';

const chalk = require('chalk');
const { OnlineStatus } = require('meross-iot');
const { getTransportModeName } = require('../helpers/client');

/**
 * Displays formatted info rows with proper alignment.
 */
function _displayInfoRows(infoData, maxLabelLength) {
    infoData.forEach(([label, value]) => {
        const padding = ' '.repeat(maxLabelLength - label.length);
        const displayValue = value === 'Not available' ? chalk.gray.bold(value) : value;
        console.log(`  ${chalk.white.bold(label)}:${padding} ${chalk.italic(displayValue)}`);
    });
}

/**
 * Builds basic device information array.
 */
function _buildBasicDeviceInfo(device, manager) {
    const info = [
        ['Name', chalk.bold(device.name || 'Unknown')],
        ['Type', device.deviceType || 'unknown'],
        ['UUID', chalk.cyan(device.uuid || 'unknown')],
        ['Firmware', device.firmwareVersion || 'unknown'],
        ['Hardware', device.hardwareVersion || 'unknown']
    ];

    const status = device.deviceConnected ? chalk.green('Yes') : chalk.red('No');
    const onlineStatus = device.isOnline
        ? chalk.green('Online')
        : chalk.red('Offline');

    info.push(['Connected', status]);
    info.push(['Online', onlineStatus]);
    info.push(['Transport', getTransportModeName(manager.defaultTransportMode)]);

    return info;
}

/**
 * Fetches network info if needed and displays it.
 */
async function _displayNetworkInfo(device, maxLabelLength) {
    // Use device getters for network info (already populated from System.All)
    const lanIp = device.lanIp;
    const macAddress = device.macAddress;

    // If not available and device is connected, try to fetch System.All to populate it
    if (device.deviceConnected && (!lanIp || !macAddress)) {
        try {
            await device.getSystemAllData();
        } catch (error) {
            // Silently fail - network info is not critical
        }
    }

    // Always show network info (use getters again after potential fetch)
    const networkInfo = [
        ['IP', device.lanIp || 'Not available'],
        ['MAC', device.macAddress || 'Not available']
    ];

    console.log();
    _displayInfoRows(networkInfo, maxLabelLength);
}

/**
 * Displays channel information.
 */
function _displayChannels(device) {
    if (!device.channels || device.channels.length === 0) {
        return;
    }

    console.log(`\n${chalk.bold.underline('Channels')}`);
    console.log(`  Total: ${chalk.cyan(device.channels.length)} channel${device.channels.length !== 1 ? 's' : ''}\n`);
    device.channels.forEach((channel) => {
        const channelLabel = channel.isMasterChannel ? 'Master' : `Channel ${channel.index}`;
        const channelName = channel.name ? ` (${channel.name})` : '';
        console.log(`  ${chalk.white.bold(channelLabel)}:${channelName} - Index: ${chalk.cyan(channel.index)}`);
    });
}

/**
 * Extracts HTTP device info properties for display.
 *
 * Collects HTTP metadata properties (domain, reservedDomain, subType, region, etc.)
 * that are now directly accessible on the device instance for formatting in the CLI output.
 *
 * @param {Object} device - MerossDevice instance
 * @returns {Array<Array<string>>} Array of [label, value] pairs for display
 */
function _buildHttpInfoData(device) {
    const httpInfoData = [];

    if (device.domain) {
        httpInfoData.push(['MQTT Domain', device.domain]);
    }
    if (device.reservedDomain) {
        httpInfoData.push(['Reserved Domain', device.reservedDomain]);
    }
    if (device.subType) {
        httpInfoData.push(['Sub Type', device.subType]);
    }
    if (device.region) {
        httpInfoData.push(['Region', device.region]);
    }
    if (device.skillNumber) {
        httpInfoData.push(['Skill Number', device.skillNumber]);
    }
    if (device.devIconId) {
        httpInfoData.push(['Icon ID', device.devIconId]);
    }
    if (device.bindTime) {
        httpInfoData.push(['Bind Time', device.bindTime.toLocaleString()]);
    }
    if (device.onlineStatus !== undefined) {
        const onlineStatusText = device.onlineStatus === OnlineStatus.ONLINE ? chalk.green('Online') :
            device.onlineStatus === OnlineStatus.OFFLINE ? chalk.red('Offline') :
                chalk.yellow('Unknown');
        httpInfoData.push(['Online Status', onlineStatusText]);
    }

    return httpInfoData;
}

/**
 * Displays HTTP device info section if properties are available.
 *
 * @param {Object} device - MerossDevice instance
 */
function _displayHttpInfo(device) {
    const httpInfoData = _buildHttpInfoData(device);

    if (httpInfoData.length === 0) {
        return;
    }

    console.log(`\n${chalk.bold.underline('HTTP Device Info')}`);
    const httpMaxLabelLength = Math.max(...httpInfoData.map(([label]) => label.length));
    _displayInfoRows(httpInfoData, httpMaxLabelLength);
}

/**
 * Builds ability categories grouped by namespace type.
 */
function _buildAbilityCategories(abilityNames) {
    return {
        'Config': abilityNames.filter(a => a.includes('.Config.')),
        'System': abilityNames.filter(a => a.includes('.System.')),
        'Control': abilityNames.filter(a => a.includes('.Control.')),
        'Digest': abilityNames.filter(a => a.includes('.Digest.')),
        'Other': abilityNames.filter(a =>
            !a.includes('.Config.') &&
            !a.includes('.System.') &&
            !a.includes('.Control.') &&
            !a.includes('.Digest.')
        )
    };
}

/**
 * Displays device capabilities.
 */
function _displayCapabilities(device) {
    if (!device.deviceConnected) {
        console.log(`\n${chalk.yellow('Device is not connected. Connect to see capabilities.')}`);
        return;
    }

    try {
        const abilities = device.abilities;

        if (!abilities) {
            return;
        }

        const abilityNames = Object.keys(abilities);
        const abilityCount = abilityNames.length;
        const categories = _buildAbilityCategories(abilityNames);

        console.log(`\n${chalk.bold.underline('Capabilities')}`);
        console.log(`  Total: ${chalk.cyan(abilityCount)} abilities\n`);

        // Show abilities grouped by category
        Object.entries(categories).forEach(([category, items]) => {
            if (items.length > 0) {
                console.log(`  ${chalk.white.bold(category)}:`);
                items.forEach(ability => {
                    console.log(`    - ${ability}`);
                });
                console.log();
            }
        });
    } catch (error) {
        // Silently fail - abilities are not critical
    }
}

async function showDeviceInfo(manager, uuid) {
    const device = manager.devices.get(uuid);

    if (!device) {
        console.error(`Device with UUID ${chalk.cyan(uuid)} not found.`);
        process.exit(1);
    }

    // Format device information nicely
    console.log(`\n${chalk.bold.underline('Device Information')}\n`);

    const info = _buildBasicDeviceInfo(device, manager);
    const maxLabelLength = Math.max(...info.map(([label]) => label.length));
    _displayInfoRows(info, maxLabelLength);

    await _displayNetworkInfo(device, maxLabelLength);
    _displayChannels(device);
    _displayHttpInfo(device);
    _displayCapabilities(device);
}

module.exports = { showDeviceInfo };

