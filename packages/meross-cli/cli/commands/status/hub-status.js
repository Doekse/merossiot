'use strict';

const chalk = require('chalk');
const { displaySubdeviceStatus } = require('./subdevices');

/**
 * Displays hub device status including all subdevices.
 *
 * Refreshes hub state to get latest subdevice data, fetches battery information
 * for sensors, and displays status for each subdevice.
 *
 * @param {Object} device - Hub device instance
 * @param {string|null} filterSubdeviceId - Optional subdevice ID to filter to a single subdevice
 * @returns {Promise<boolean>} True if any readings were displayed, false otherwise
 */
async function displayHubStatus(device, filterSubdeviceId = null) {
    const subdevices = filterSubdeviceId
        ? [device.getSubdevice(filterSubdeviceId)].filter(Boolean)
        : device.getSubdevices();

    if (subdevices.length === 0) {
        if (filterSubdeviceId) {
            console.log(`  Subdevice with ID "${filterSubdeviceId}" not found.\n`);
        } else {
            console.log('  No subdevices found\n');
        }
        return false;
    }

    try {
        await device.refreshState();

        try {
            if (device.hub && typeof device.hub.getBattery === 'function') {
                const batteryResponse = await device.hub.getBattery();
                if (batteryResponse && batteryResponse.battery && Array.isArray(batteryResponse.battery)) {
                    for (const batteryData of batteryResponse.battery) {
                        const subdeviceId = batteryData.id;
                        const subdevice = device.getSubdevice(subdeviceId);
                        if (subdevice && batteryData.value !== undefined && batteryData.value !== null &&
                            batteryData.value !== 0xFFFFFFFF && batteryData.value !== -1) {
                            subdevice._battery = batteryData.value;
                        }
                    }
                }
            }
        } catch {
            // Continue without battery data if fetch fails
        }
    } catch (error) {
        // Continue with cached data if refresh fails
    }

    if (!filterSubdeviceId) {
        const subdeviceCount = device.getSubdevices().length;
        console.log(`\n  ${chalk.white.bold(`Hub with ${chalk.cyan(subdeviceCount)} subdevice(s)`)}`);
    }

    let hasReadings = false;

    for (const subdevice of subdevices) {
        if (!subdevice) {continue;}

        const subName = subdevice.name || subdevice.subdeviceId;
        const subType = subdevice.type || 'unknown';
        const subId = subdevice.subdeviceId;
        console.log(`\n  ${chalk.bold('Subdevice')} ${chalk.bold(subName)} ${chalk.gray(`(${subType})`)}`);
        console.log(`    ${chalk.bold('ID:')} ${chalk.cyan(chalk.italic(subId))}`);

        const subdeviceHasReadings = displaySubdeviceStatus(subdevice);
        if (subdeviceHasReadings) {
            hasReadings = true;
        }
    }

    return hasReadings;
}

module.exports = { displayHubStatus };

