'use strict';

const chalk = require('chalk');
const ora = require('ora');
const { ThermostatMode } = require('meross-iot');
const { getChannelIds, getPrimaryChannel } = require('../../utils/device');

/**
 * Whether a feature should be fetched over the network (no cache yet, or MQTT not ready).
 *
 * @param {boolean} hasCachedState - True when a sync feature getter reports known state
 * @param {boolean} isMqttConnected - True when the device MQTT session looks ready
 * @returns {boolean}
 */
function shouldFetchFeature(hasCachedState, isMqttConnected) {
    return !hasCachedState || !isMqttConnected;
}

/**
 * Displays device status using feature-based API.
 *
 * Aggregates data from multiple device features and displays sensor readings,
 * configuration, and state information. Uses cached state when available to
 * minimize API calls, but fetches fresh data when needed.
 *
 * @param {Object} device - Device instance
 * @returns {Promise<boolean>} True if any readings were displayed, false otherwise
 */
async function displayDeviceStatus(device) {
    let hasReadings = false;
    const sensorLines = [];
    let hasElectricity = false;

    if (!device.deviceConnected) {
        return hasReadings;
    }

    try {
        const isMqttConnected = device.deviceConnected && device.mqttHost;
        if (isMqttConnected) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        const abilities = device.abilities || {};
        const primaryChannel = getPrimaryChannel(device);
        const fetchPromises = [];
        let consumptionConfigResponse = null;
        const thermostatResponses = {};
        let powerInfo = null;
        let thermostatState = null;
        let consumptionData = null;
        let shutterState = null;
        let timerCount = null;
        let triggerCount = null;

        if (abilities['Appliance.System.All'] && device.system) {
            fetchPromises.push(
                device.system.getAllData().catch(() => null)
            );
        }

        if (device.toggle && (abilities['Appliance.Control.ToggleX'] || abilities['Appliance.Control.Toggle'])) {
            for (const channel of getChannelIds(device)) {
                const hasToggleState = device.toggle.isOn({ channel }) !== undefined;
                if (shouldFetchFeature(hasToggleState, isMqttConnected)) {
                    fetchPromises.push(
                        device.toggle.get({ channel }).catch(() => null)
                    );
                }
            }
        }

        if (device.electricity && abilities['Appliance.Control.Electricity']) {
            fetchPromises.push(
                device.electricity.get({ channel: primaryChannel })
                    .then(result => { powerInfo = result; })
                    .catch(() => { powerInfo = null; })
            );
        }

        if (device.light && abilities['Appliance.Control.Light']) {
            const hasLightState = device.light.isOn({ channel: primaryChannel }) !== undefined;
            if (shouldFetchFeature(hasLightState, isMqttConnected)) {
                fetchPromises.push(
                    device.light.get({ channel: primaryChannel }).catch(() => null)
                );
            }
        }

        if (device.thermostat && abilities['Appliance.Control.Thermostat.Mode']) {
            fetchPromises.push(
                device.thermostat.get({ channel: primaryChannel })
                    .then(result => { thermostatState = result; })
                    .catch(() => { thermostatState = null; })
            );
        }

        if (device.thermostat) {
            if (abilities['Appliance.Control.Thermostat.WindowOpened']) {
                fetchPromises.push(
                    (async () => {
                        try {
                            const response = await device.thermostat.getWindowOpened({ channel: primaryChannel });
                            thermostatResponses.windowOpened = response;
                            return response;
                        } catch {
                            return null;
                        }
                    })()
                );
            }
            if (abilities['Appliance.Control.Thermostat.Overheat']) {
                fetchPromises.push(
                    (async () => {
                        try {
                            const response = await device.thermostat.getOverheat({ channel: primaryChannel });
                            thermostatResponses.overheat = response;
                            return response;
                        } catch {
                            return null;
                        }
                    })()
                );
            }
            if (abilities['Appliance.Control.Thermostat.Calibration']) {
                fetchPromises.push(
                    (async () => {
                        try {
                            const response = await device.thermostat.getCalibration({ channel: primaryChannel });
                            thermostatResponses.calibration = response;
                            return response;
                        } catch {
                            return null;
                        }
                    })()
                );
            }
            if (abilities['Appliance.Control.Thermostat.Frost']) {
                fetchPromises.push(
                    (async () => {
                        try {
                            const response = await device.thermostat.getFrost({ channel: primaryChannel });
                            thermostatResponses.frost = response;
                            return response;
                        } catch {
                            return null;
                        }
                    })()
                );
            }
        }

        if (device.presence && abilities['Appliance.Control.Sensor.LatestX']) {
            fetchPromises.push(
                device.presence.get({ channel: primaryChannel }).catch(() => null)
            );
        }

        if (device.consumption) {
            fetchPromises.push(
                device.consumption.get({ channel: primaryChannel })
                    .then(result => { consumptionData = result; })
                    .catch(() => { consumptionData = null; })
            );

            if (abilities['Appliance.Control.ConsumptionConfig']) {
                fetchPromises.push(
                    (async () => {
                        try {
                            const response = await device.consumption.getConfig();
                            consumptionConfigResponse = response;
                            return response;
                        } catch {
                            return null;
                        }
                    })()
                );
            }
        }

        if (device.garage && abilities['Appliance.GarageDoor.State']) {
            const hasGarageState = device.garage.isOpen({ channel: primaryChannel }) !== undefined;
            if (shouldFetchFeature(hasGarageState, isMqttConnected)) {
                fetchPromises.push(
                    device.garage.get({ channel: primaryChannel }).catch(() => null)
                );
            }
        }

        if (device.rollerShutter && abilities['Appliance.RollerShutter.State']) {
            fetchPromises.push(
                device.rollerShutter.get({ channel: primaryChannel })
                    .then(result => { shutterState = result; })
                    .catch(() => { shutterState = null; })
            );
        }

        if (device.diffuser) {
            if (abilities['Appliance.Control.Diffuser.Light']) {
                fetchPromises.push(
                    device.diffuser.getLight({ channel: primaryChannel }).catch(() => null)
                );
            }
            if (abilities['Appliance.Control.Diffuser.Spray']) {
                fetchPromises.push(
                    device.diffuser.getSpray({ channel: primaryChannel }).catch(() => null)
                );
            }
        }

        if (device.spray && abilities['Appliance.Control.Spray']) {
            const hasSprayState = device.spray.getMode({ channel: primaryChannel }) !== undefined;
            if (shouldFetchFeature(hasSprayState, isMqttConnected)) {
                fetchPromises.push(
                    device.spray.get({ channel: primaryChannel }).catch(() => null)
                );
            }
        }

        if (device.timer) {
            fetchPromises.push(
                device.timer.count()
                    .then(count => { timerCount = count; })
                    .catch(() => { timerCount = 0; })
            );
        }

        if (device.trigger) {
            fetchPromises.push(
                device.trigger.count()
                    .then(count => { triggerCount = count; })
                    .catch(() => { triggerCount = 0; })
            );
        }

        if (fetchPromises.length > 0) {
            const spinner = ora('Fetching device data').start();
            await Promise.allSettled(fetchPromises);
            spinner.stop();
        }

        if (device.electricity && powerInfo && powerInfo.wattage !== undefined) {
            sensorLines.push(`    ${chalk.white.bold('Power')}: ${chalk.italic(`${powerInfo.wattage.toFixed(2)} W`)}`);
            if (powerInfo.voltage !== undefined) {
                sensorLines.push(`    ${chalk.white.bold('Voltage')}: ${chalk.italic(`${powerInfo.voltage.toFixed(1)} V`)}`);
            }
            if (powerInfo.amperage !== undefined) {
                sensorLines.push(`    ${chalk.white.bold('Current')}: ${chalk.italic(`${powerInfo.amperage.toFixed(3)} A`)}`);
            }
            hasReadings = true;
            hasElectricity = true;
        }

        const toggleStatesByChannel = device.toggle
            ? device.toggle.getAll()
            : new Map();

        if (toggleStatesByChannel.size > 0) {
            const deviceChannels = device.channels && device.channels.length > 0 ? device.channels : [];
            const channelsToDisplay = Array.from(toggleStatesByChannel.keys()).sort((a, b) => a - b);
            const isSingleChannel = deviceChannels.length === 1 || (channelsToDisplay.length === 1 && channelsToDisplay[0] === 0);
            const baseLabel = hasElectricity ? 'State' : 'Power';

            /**
             * Formats channel name for status display.
             * @param {number} channelIndex - Channel index
             * @returns {string} Formatted channel name
             */
            const formatChannelName = (channelIndex) => {
                const channel = deviceChannels.find(ch => ch.index === channelIndex);
                if (channel) {
                    const channelLabel = channel.isMasterChannel ? 'Master' : `Channel ${channel.index}`;
                    const channelName = channel.name ? ` (${channel.name})` : '';
                    return `${channelLabel}${channelName}`;
                }
                return `Socket ${channelIndex}`;
            };

            if (isSingleChannel) {
                const channelIndex = channelsToDisplay[0];
                const state = toggleStatesByChannel.get(channelIndex);
                const stateColor = state ? chalk.green('On') : chalk.red('Off');
                sensorLines.push(`    ${chalk.white.bold(baseLabel)}: ${chalk.italic(stateColor)}`);
            } else {
                channelsToDisplay.forEach(channelIndex => {
                    const state = toggleStatesByChannel.get(channelIndex);
                    const stateColor = state ? chalk.green('On') : chalk.red('Off');
                    const channelName = formatChannelName(channelIndex);
                    sensorLines.push(`    ${chalk.white.bold(`${channelName}:`)} ${chalk.italic(stateColor)}`);
                });
            }
            hasReadings = true;
        }

        if (device.presence) {
            const presence = device.presence.getPresence({ channel: primaryChannel });
            if (presence) {
                const presenceState = presence.isPresent ? chalk.green('Present') : chalk.yellow('Absent');
                sensorLines.push(`    ${chalk.white.bold('Presence')}: ${chalk.italic(presenceState)}`);

                if (presence.distance !== null && presence.distance !== undefined) {
                    sensorLines.push(`    ${chalk.white.bold('Distance')}: ${chalk.italic(`${presence.distance.toFixed(2)} m`)}`);
                }

                if (presence.timestamp) {
                    sensorLines.push(`    ${chalk.white.bold('Last Detection')}: ${chalk.italic(presence.timestamp.toLocaleString())}`);
                }

                hasReadings = true;
            }

            const light = device.presence.getLight({ channel: primaryChannel });
            if (light && light.value !== undefined) {
                sensorLines.push(`    ${chalk.white.bold('Light')}: ${chalk.italic(`${light.value} lx`)}`);
                hasReadings = true;
            }
        }

        if (device.light) {
            const isOn = device.light.isOn({ channel: primaryChannel });
            if (isOn !== undefined) {
                const stateColor = isOn ? chalk.green('On') : chalk.red('Off');
                sensorLines.push(`    ${chalk.white.bold('Light State')}: ${chalk.italic(stateColor)}`);

                const brightness = device.light.getBrightness({ channel: primaryChannel });
                if (brightness !== undefined && brightness !== null) {
                    sensorLines.push(`    ${chalk.white.bold('Brightness')}: ${chalk.italic(`${brightness}%`)}`);
                }

                const rgb = device.light.getRgbColor({ channel: primaryChannel });
                if (rgb && Array.isArray(rgb)) {
                    sensorLines.push(`    ${chalk.white.bold('RGB')}: ${chalk.italic(`[${rgb.join(', ')}]`)}`);
                }

                hasReadings = true;
            }
        }

        if (device.thermostat) {
            if (thermostatState) {
                const currentTemp = thermostatState.currentTemperatureCelsius;
                if (currentTemp !== undefined && currentTemp !== null) {
                    sensorLines.push(`    ${chalk.white.bold('Temperature')}: ${chalk.italic(`${currentTemp.toFixed(1)}°C`)}`);
                }
                const targetTemp = thermostatState.targetTemperatureCelsius;
                if (targetTemp !== undefined && targetTemp !== null) {
                    sensorLines.push(`    ${chalk.white.bold('Target Temperature')}: ${chalk.italic(`${targetTemp.toFixed(1)}°C`)}`);
                }
                if (thermostatState.warning) {
                    sensorLines.push(`    ${chalk.white.bold('Warning')}: ${chalk.italic('Active')}`);
                }
                hasReadings = true;
            }

            if (thermostatResponses.windowOpened && thermostatResponses.windowOpened.windowOpened) {
                const wo = thermostatResponses.windowOpened.windowOpened[0];
                if (wo && wo.status !== undefined) {
                    sensorLines.push(`    ${chalk.white.bold('Window Opened')}: ${chalk.italic(wo.status === 1 ? 'Open' : 'Closed')}`);
                    hasReadings = true;
                }
            }

            if (thermostatResponses.overheat && thermostatResponses.overheat.overheat) {
                const oh = thermostatResponses.overheat.overheat[0];
                if (oh) {
                    if (oh.currentTemp !== undefined) {
                        sensorLines.push(`    ${chalk.white.bold('External Sensor')}: ${chalk.italic(`${(oh.currentTemp / 10.0).toFixed(1)}°C`)}`);
                        hasReadings = true;
                    }
                    if (oh.warning !== undefined && oh.warning === 1) {
                        sensorLines.push(`    ${chalk.white.bold('Overheat Warning')}: ${chalk.italic('Active')}`);
                        hasReadings = true;
                    }
                }
            }

            if (thermostatResponses.calibration && thermostatResponses.calibration.calibration) {
                const cal = thermostatResponses.calibration.calibration[0];
                if (cal && cal.humiValue !== undefined) {
                    sensorLines.push(`    ${chalk.white.bold('Sensor Humidity')}: ${chalk.italic(`${(cal.humiValue / 10.0).toFixed(1)}%`)}`);
                    hasReadings = true;
                }
            }

            if (thermostatResponses.frost && thermostatResponses.frost.frost) {
                const frost = thermostatResponses.frost.frost[0];
                if (frost && frost.warning !== undefined && frost.warning === 1) {
                    sensorLines.push(`    ${chalk.white.bold('Frost Warning')}: ${chalk.italic('Active')}`);
                    hasReadings = true;
                }
            }
        }

        if (device.consumption) {
            if (consumptionData && Array.isArray(consumptionData) && consumptionData.length > 0) {
                const latest = consumptionData[consumptionData.length - 1];
                if (latest && latest.totalConsumptionKwh !== undefined && latest.totalConsumptionKwh !== null) {
                    sensorLines.push(`    ${chalk.white.bold('Consumption')}: ${chalk.italic(`${latest.totalConsumptionKwh.toFixed(2)} kWh`)}`);
                } else {
                    sensorLines.push(`    ${chalk.white.bold('Consumption')}: ${chalk.italic('N/A')}`);
                }
            } else {
                sensorLines.push(`    ${chalk.white.bold('Consumption')}: ${chalk.italic('N/A')}`);
            }
            hasReadings = true;
        }

        if (consumptionConfigResponse && consumptionConfigResponse.config) {
            const { config } = consumptionConfigResponse;
            const configLines = [];
            if (config.voltageRatio !== undefined) {
                configLines.push(`voltageRatio: ${config.voltageRatio}`);
            }
            if (config.electricityRatio !== undefined) {
                configLines.push(`electricityRatio: ${config.electricityRatio}`);
            }
            if (config.maxElectricityCurrent !== undefined) {
                configLines.push(`maxCurrent: ${(config.maxElectricityCurrent / 1000.0).toFixed(1)} A`);
            }
            if (configLines.length > 0) {
                sensorLines.push(`    ${chalk.white.bold('Consumption Config')}: ${chalk.italic(configLines.join(', '))}`);
                hasReadings = true;
            }
        }

        if (device.timer && timerCount !== null) {
            sensorLines.push(`    ${chalk.white.bold('Timers')}: ${chalk.italic(`${timerCount} active`)}`);
            hasReadings = true;
        }

        if (device.trigger && triggerCount !== null) {
            sensorLines.push(`    ${chalk.white.bold('Triggers')}: ${chalk.italic(`${triggerCount} active`)}`);
            hasReadings = true;
        }

        if (device.garage) {
            const isOpen = device.garage.isOpen({ channel: primaryChannel });
            if (isOpen !== undefined) {
                const stateText = isOpen ? chalk.green('Open') : chalk.red('Closed');
                sensorLines.push(`    ${chalk.white.bold('Garage Door')}: ${chalk.italic(stateText)}`);
                hasReadings = true;
            }
        }

        if (device.rollerShutter && shutterState) {
            if (shutterState.position !== undefined) {
                sensorLines.push(`    ${chalk.white.bold('Position')}: ${chalk.italic(`${shutterState.position}%`)}`);
            }
            if (shutterState.state !== undefined) {
                const stateNames = { 0: 'Closed', 1: 'Opening', 2: 'Open', 3: 'Closing' };
                const stateName = stateNames[shutterState.state] || `State ${shutterState.state}`;
                sensorLines.push(`    ${chalk.white.bold('State')}: ${chalk.italic(stateName)}`);
            }
            hasReadings = true;
        }

        if (hasReadings && sensorLines.length > 0) {
            console.log(`\n  ${chalk.bold.underline('Status')}`);
            sensorLines.forEach(line => console.log(line));
        }

        const allConfigItems = [];

        if (device.thermostat && thermostatState) {
            const configInfo = [];

            if (thermostatState.mode !== undefined) {
                const modeNames = {
                    [ThermostatMode.HEAT]: 'Heat',
                    [ThermostatMode.COOL]: 'Cool',
                    [ThermostatMode.ECONOMY]: 'Economy',
                    [ThermostatMode.AUTO]: 'Auto',
                    [ThermostatMode.MANUAL]: 'Manual'
                };
                const modeName = modeNames[thermostatState.mode] || `Mode ${thermostatState.mode}`;
                const onoffStatus = thermostatState.isOn ? chalk.green('On') : chalk.red('Off');
                const targetTemp = thermostatState.targetTemperatureCelsius !== undefined
                    ? `${thermostatState.targetTemperatureCelsius.toFixed(1)}°C`
                    : '';
                configInfo.push(['Mode', `${onoffStatus} - ${modeName} ${targetTemp}`.trim()]);
            }

            if (thermostatState.heatTemperatureCelsius !== undefined) {
                configInfo.push(['Comfort Temperature', `${thermostatState.heatTemperatureCelsius.toFixed(1)}°C`]);
            }
            if (thermostatState.coolTemperatureCelsius !== undefined) {
                configInfo.push(['Cool Temperature', `${thermostatState.coolTemperatureCelsius.toFixed(1)}°C`]);
            }
            if (thermostatState.ecoTemperatureCelsius !== undefined) {
                configInfo.push(['Economy Temperature', `${thermostatState.ecoTemperatureCelsius.toFixed(1)}°C`]);
            }
            if (thermostatState.manualTemperatureCelsius !== undefined) {
                configInfo.push(['Away Temperature', `${thermostatState.manualTemperatureCelsius.toFixed(1)}°C`]);
            }

            if (thermostatState.minTemperatureCelsius !== undefined && thermostatState.maxTemperatureCelsius !== undefined) {
                configInfo.push(['Temperature Range', `${thermostatState.minTemperatureCelsius.toFixed(1)}°C - ${thermostatState.maxTemperatureCelsius.toFixed(1)}°C`]);
            }

            if (thermostatState.workingMode !== undefined) {
                const isHeating = thermostatState.workingMode === 1;
                const stateColor = isHeating ? chalk.green('Heating') : chalk.gray.bold('Idle');
                configInfo.push(['Status', stateColor]);
            }

            if (configInfo.length > 0) {
                allConfigItems.push(...configInfo);
            }
        }

        if (allConfigItems.length > 0) {
            console.log(`\n  ${chalk.bold.underline('Configuration')}`);
            allConfigItems.forEach(([label, value]) => {
                console.log(`    ${chalk.white.bold(label)}: ${chalk.italic(value)}`);
            });
            hasReadings = true;
        }

    } catch {
        // Status display is optional, continue without it if errors occur
    }

    return hasReadings;
}

module.exports = { displayDeviceStatus };
