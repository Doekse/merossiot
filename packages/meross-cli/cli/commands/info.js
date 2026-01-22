'use strict';

const chalk = require('chalk');
const { OnlineStatus } = require('meross-iot');
const { getTransportModeName } = require('../helpers/client');

/**
 * Displays formatted info rows with aligned labels.
 *
 * @param {Array<Array<string>>} infoData - Array of [label, value] pairs
 * @param {number} maxLabelLength - Maximum label length for alignment
 */
function _displayInfoRows(infoData, maxLabelLength) {
    infoData.forEach(([label, value]) => {
        const padding = ' '.repeat(maxLabelLength - label.length);
        const displayValue = value === 'Not available' ? chalk.gray.bold(value) : value;
        console.log(`  ${chalk.white.bold(label)}:${padding} ${chalk.italic(displayValue)}`);
    });
}

/**
 * Builds basic device information array for display.
 *
 * @param {Object} device - Device instance
 * @param {Object} manager - ManagerMeross instance
 * @returns {Array<Array<string>>} Array of [label, value] pairs
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
    info.push(['Transport', getTransportModeName(manager.transport.defaultMode)]);

    return info;
}

/**
 * Fetches and displays network information.
 *
 * Attempts to populate network info via System.All if not already cached, since
 * network properties may not be available immediately after device initialization.
 *
 * @param {Object} device - Device instance
 * @param {number} maxLabelLength - Maximum label length for alignment
 */
async function _displayNetworkInfo(device, maxLabelLength) {
    const lanIp = device.lanIp;
    const macAddress = device.macAddress;

    if (device.deviceConnected && (!lanIp || !macAddress)) {
        try {
            await device.system.getAllData();
        } catch (error) {
            // Network info is optional, continue without it
        }
    }

    const networkInfo = [
        ['IP', device.lanIp || 'Not available'],
        ['MAC', device.macAddress || 'Not available']
    ];

    console.log();
    _displayInfoRows(networkInfo, maxLabelLength);
}

/**
 * Displays device channel information.
 *
 * @param {Object} device - Device instance
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
 * Groups device abilities by namespace category for organized display.
 *
 * @param {Array<string>} abilityNames - Array of ability namespace strings
 * @returns {Object} Object with category keys and arrays of ability names
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
 * Displays device abilities (raw namespace list) when verbose mode is enabled.
 *
 * @param {Object} device - Device instance
 * @param {Object} manager - ManagerMeross instance (to check verbose state)
 */
function _displayAbilities(device, manager) {
    // Check verbose mode via environment variable or manager logger option
    const isVerbose = process.env.MEROSS_VERBOSE === 'true' ||
        (manager && manager.options && manager.options.logger !== null);

    if (!isVerbose) {
        return;
    }

    if (!device.deviceConnected) {
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

        console.log(`\n${chalk.bold.underline('Abilities (Raw Namespaces)')}`);
        console.log(`  Total: ${chalk.cyan(abilityCount)} abilities\n`);

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
        // Abilities display is optional, continue without it
    }
}

/**
 * Displays device capabilities using the normalized capabilities map.
 *
 * @param {Object} device - Device instance
 */
function _displayCapabilities(device) {
    if (!device.deviceConnected) {
        console.log(`\n${chalk.yellow('Device is not connected. Connect to see capabilities.')}`);
        return;
    }

    try {
        const capabilities = device.capabilities;

        if (!capabilities) {
            console.log(`\n${chalk.yellow('Capabilities not yet available. Device may need to connect first.')}`);
            return;
        }

        console.log(`\n${chalk.bold.underline('Capabilities')}`);

        // Display channel information
        if (capabilities.channels) {
            console.log(`\n  ${chalk.white.bold('Channels')}:`);
            console.log(`    Count: ${chalk.cyan(capabilities.channels.count)}`);
            console.log(`    IDs: ${chalk.cyan(capabilities.channels.ids.join(', '))}`);
        }

        // Display feature capabilities
        const featureKeys = Object.keys(capabilities).filter(key => key !== 'channels');
        if (featureKeys.length > 0) {
            console.log(`\n  ${chalk.white.bold('Features')}:`);
            featureKeys.forEach(featureKey => {
                const feature = capabilities[featureKey];
                if (feature && feature.supported) {
                    let featureInfo = `    ${chalk.green('✓')} ${chalk.bold(featureKey)}`;
                    if (feature.channels) {
                        featureInfo += ` (channels: ${chalk.cyan(feature.channels.join(', '))})`;
                    }
                    if (feature.multiChannel) {
                        featureInfo += ` ${chalk.gray('[multi-channel]')}`;
                    }
                    if (feature.rgb || feature.luminance || feature.temperature) {
                        const lightFeatures = [];
                        if (feature.rgb) {lightFeatures.push('RGB');}
                        if (feature.luminance) {lightFeatures.push('brightness');}
                        if (feature.temperature) {lightFeatures.push('temperature');}
                        featureInfo += ` ${chalk.gray(`[${lightFeatures.join(', ')}]`)}`;
                    }
                    if (featureKey === 'thermostat') {
                        const thermostatFeatures = [];
                        if (feature.modeB) {thermostatFeatures.push('ModeB');}
                        if (feature.schedule) {thermostatFeatures.push('schedule');}
                        if (feature.windowOpened) {thermostatFeatures.push('window detection');}
                        if (feature.sensor) {thermostatFeatures.push('sensor selection');}
                        if (feature.summerMode) {thermostatFeatures.push('summer mode');}
                        if (feature.holdAction) {thermostatFeatures.push('hold action');}
                        if (feature.calibration) {thermostatFeatures.push('calibration');}
                        if (feature.deadZone) {thermostatFeatures.push('dead zone');}
                        if (feature.frost) {thermostatFeatures.push('frost protection');}
                        if (feature.overheat) {thermostatFeatures.push('overheat protection');}
                        if (thermostatFeatures.length > 0) {
                            featureInfo += ` ${chalk.gray(`[${thermostatFeatures.join(', ')}]`)}`;
                        }
                    }
                    if (feature.light !== undefined || feature.spray !== undefined) {
                        const diffuserFeatures = [];
                        if (feature.light) {diffuserFeatures.push('light');}
                        if (feature.spray) {diffuserFeatures.push('spray');}
                        featureInfo += ` ${chalk.gray(`[${diffuserFeatures.join(', ')}]`)}`;
                    }
                    if (feature.multiple || feature.upgrade) {
                        const controlFeatures = [];
                        if (feature.multiple) {controlFeatures.push('batch');}
                        if (feature.upgrade) {controlFeatures.push('upgrade');}
                        featureInfo += ` ${chalk.gray(`[${controlFeatures.join(', ')}]`)}`;
                    }
                    if (feature.subDeviceList || feature.battery) {
                        const hubFeatures = [];
                        if (feature.subDeviceList) {hubFeatures.push('subdevices');}
                        if (feature.battery) {hubFeatures.push('battery');}
                        featureInfo += ` ${chalk.gray(`[${hubFeatures.join(', ')}]`)}`;
                    }
                    if (featureKey === 'presence' && (feature.presenceEvents !== undefined || feature.lux !== undefined || feature.distance !== undefined)) {
                        const presenceFeatures = [];
                        if (feature.presenceEvents) {presenceFeatures.push('presence events');}
                        if (feature.lux) {presenceFeatures.push('LUX');}
                        if (feature.distance) {presenceFeatures.push('distance');}
                        featureInfo += ` ${chalk.gray(`[${presenceFeatures.join(', ')}]`)}`;
                    }
                    if (featureKey === 'sensor' && (feature.temperature !== undefined || feature.humidity !== undefined || feature.lux !== undefined || feature.waterLeak !== undefined || feature.smoke !== undefined)) {
                        const sensorFeatures = [];
                        if (feature.temperature) {sensorFeatures.push('temperature');}
                        if (feature.humidity) {sensorFeatures.push('humidity');}
                        if (feature.lux) {sensorFeatures.push('LUX');}
                        if (feature.waterLeak) {sensorFeatures.push('water leak');}
                        if (feature.smoke) {sensorFeatures.push('smoke');}
                        featureInfo += ` ${chalk.gray(`[${sensorFeatures.join(', ')}]`)}`;
                    }
                    console.log(featureInfo);
                }
            });
        } else {
            console.log(`\n  ${chalk.gray('No features detected')}`);
        }
    } catch (error) {
        // Capabilities display is optional, continue without it
    }
}

/**
 * Displays subdevice information for hub devices.
 *
 * @param {Object} device - Device instance (should be a hub)
 */
async function _displaySubdevices(device) {
    // Check if device is a hub and has getSubdevices method
    if (!device || typeof device.getSubdevices !== 'function') {
        return;
    }

    const subdevices = device.getSubdevices();
    if (!subdevices || subdevices.length === 0) {
        return;
    }

    console.log(`\n${chalk.bold.underline('Subdevices')}`);
    console.log(`  Total: ${chalk.cyan(subdevices.length)} subdevice${subdevices.length !== 1 ? 's' : ''}\n`);

    for (const subdevice of subdevices) {
        console.log(`  ${chalk.white.bold(subdevice.name || subdevice.subdeviceId)}`);
        console.log(`    Type: ${chalk.cyan(subdevice.type || 'unknown')}`);
        console.log(`    ID: ${chalk.cyan(subdevice.subdeviceId)}`);

        // Display subdevice capabilities if available
        if (subdevice.capabilities) {
            const subCaps = subdevice.capabilities;
            const subFeatureKeys = Object.keys(subCaps).filter(key => key !== 'channels');
            if (subFeatureKeys.length > 0) {
                const subFeatures = [];
                subFeatureKeys.forEach(featureKey => {
                    const feature = subCaps[featureKey];
                    if (feature && feature.supported) {
                        if (featureKey === 'sensor') {
                            const sensorTypes = [];
                            if (feature.temperature) {sensorTypes.push('temperature');}
                            if (feature.humidity) {sensorTypes.push('humidity');}
                            if (feature.lux) {sensorTypes.push('LUX');}
                            if (feature.waterLeak) {sensorTypes.push('water leak');}
                            if (feature.smoke) {sensorTypes.push('smoke');}
                            if (sensorTypes.length > 0) {
                                subFeatures.push(`sensor [${sensorTypes.join(', ')}]`);
                            }
                        } else {
                            subFeatures.push(featureKey);
                        }
                    }
                });
                if (subFeatures.length > 0) {
                    console.log(`    Capabilities: ${chalk.gray(subFeatures.join(', '))}`);
                }
            }
        }
        console.log();
    }
}

/**
 * Displays comprehensive device information.
 *
 * Shows device properties, network info, channels, HTTP metadata, and capabilities
 * in a formatted, human-readable output.
 *
 * @param {Object} manager - ManagerMeross instance
 * @param {string} uuid - Device UUID
 */
async function showDeviceInfo(manager, uuid) {
    const device = manager.devices.get(uuid);

    if (!device) {
        console.error(`Device with UUID ${chalk.cyan(uuid)} not found.`);
        process.exit(1);
    }

    console.log(`\n${chalk.bold.underline('Device Information')}\n`);

    const info = _buildBasicDeviceInfo(device, manager);
    const maxLabelLength = Math.max(...info.map(([label]) => label.length));
    _displayInfoRows(info, maxLabelLength);

    await _displayNetworkInfo(device, maxLabelLength);
    _displayChannels(device);
    _displayHttpInfo(device);
    _displayCapabilities(device);
    _displayAbilities(device, manager);
    await _displaySubdevices(device);
}

module.exports = { showDeviceInfo };

