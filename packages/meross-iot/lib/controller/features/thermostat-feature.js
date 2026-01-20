'use strict';

const ThermostatState = require('../../model/states/thermostat-state');
const { normalizeChannel } = require('../../utilities/options');
const { buildStateChanges } = require('../../utilities/state-changes');
const { MerossErrorValidation, MerossErrorCommand } = require('../../model/exception');

/**
 * Creates a thermostat feature object for a device.
 *
 * Provides control over thermostat mode, temperature settings, schedules, and various configuration options.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Thermostat feature object with set(), get(), and configuration methods
 */
function createThermostatFeature(device) {
    /**
     * Aligns temperature value to device units and validates range.
     *
     * @param {number} temperature - Temperature in Celsius
     * @param {number} [channel=0] - Channel to get temperature limits for (default: 0)
     * @returns {number} Temperature in device units (tenths of degrees)
     * @throws {import('../lib/errors/errors').CommandError} If temperature is out of valid range
     * @private
     */
    function alignThermostatTemperature(temperature, channel = 0) {
        const THERMOSTAT_MIN_SETTABLE_TEMP = 5.0;
        const THERMOSTAT_MAX_SETTABLE_TEMP = 35.0;

        let minSetableTemp = THERMOSTAT_MIN_SETTABLE_TEMP;
        let maxSetableTemp = THERMOSTAT_MAX_SETTABLE_TEMP;

        const channelState = device._thermostatStateByChannel.get(channel);
        if (channelState) {
            if (channelState.minTemperatureCelsius !== undefined) {
                minSetableTemp = channelState.minTemperatureCelsius;
            }
            if (channelState.maxTemperatureCelsius !== undefined) {
                maxSetableTemp = channelState.maxTemperatureCelsius;
            }
        }

        if (temperature < minSetableTemp || temperature > maxSetableTemp) {
            throw new MerossErrorCommand(
                `Temperature ${temperature}°C is out of range (${minSetableTemp}-${maxSetableTemp}°C) for this device`,
                { temperature, minSetableTemp, maxSetableTemp },
                device.uuid
            );
        }

        const quotient = temperature / 0.5;
        const rounded = Math.round(quotient);
        const finalTemp = rounded * 0.5;

        return Math.round(finalTemp * 10);
    }

    return {
        /**
         * Sets the thermostat mode, mode B, or window opened status.
         *
         * @param {Object} options - Thermostat options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @param {number} [options.mode] - Thermostat mode (from ThermostatMode enum or numeric value)
         * @param {number} [options.onoff] - On/off state (0=off, 1=on)
         * @param {number} [options.heatTemperature] - Heat temperature in Celsius
         * @param {number} [options.coolTemperature] - Cool temperature in Celsius
         * @param {number} [options.ecoTemperature] - Eco temperature in Celsius
         * @param {number} [options.manualTemperature] - Manual temperature in Celsius
         * @param {boolean} [options.partialUpdate=false] - If true, fetches current state and merges
         * @param {number} [options.state] - Mode B state (for ModeB namespace)
         * @param {boolean} [options.windowOpened] - Window opened status
         * @returns {Promise<Object>} Response from the device
         * @throws {import('../lib/errors/errors').CommandError} If mode value is invalid or temperature is out of range
         * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
         * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
         */
        async set(options = {}) {
            const channel = normalizeChannel(options);

            // Handle window opened
            if (options.windowOpened !== undefined) {
                const payload = { 'windowOpened': [{ channel, 'status': options.windowOpened ? 1 : 0 }] };
                return await device.publishMessage('SET', 'Appliance.Control.Thermostat.WindowOpened', payload);
            }

            // Handle mode B
            if (options.state !== undefined) {
                if (!device.abilities || !device.abilities['Appliance.Control.Thermostat.ModeB']) {
                    throw new MerossErrorCommand(
                        'Device does not support Appliance.Control.Thermostat.ModeB namespace',
                        { namespace: 'Appliance.Control.Thermostat.ModeB', channel, options },
                        device.uuid
                    );
                }

                const processedModeData = { ...options };
                processedModeData.channel = channel;

                if (typeof processedModeData.state !== 'number') {
                    processedModeData.state = 1;
                }

                const payload = { 'modeB': [processedModeData] };
                const response = await device.publishMessage('SET', 'Appliance.Control.Thermostat.ModeB', payload);
                if (response?.modeB) {
                    updateThermostatModeB(device, response.modeB, 'response');
                }
                return response;
            }

            // Handle regular mode
            let processedModeData = { ...options };

            if (options.partialUpdate) {
                try {
                    const currentResponse = await this.get({ channel });
                    if (currentResponse?.mode && Array.isArray(currentResponse.mode) && currentResponse.mode.length > 0) {
                        const currentState = currentResponse.mode[0];
                        processedModeData = { ...currentState, ...processedModeData };
                    }
                } catch (e) {
                    // If fetch fails, continue with provided options only
                }
            }

            processedModeData.channel = channel;

            if (processedModeData.mode !== undefined && processedModeData.mode !== null && typeof processedModeData.mode !== 'number') {
                processedModeData.mode = 0;
            }

            if (processedModeData.heatTemperature !== undefined) {
                processedModeData.heatTemp = alignThermostatTemperature(processedModeData.heatTemperature, channel);
                delete processedModeData.heatTemperature;
            }
            if (processedModeData.coolTemperature !== undefined) {
                processedModeData.coolTemp = alignThermostatTemperature(processedModeData.coolTemperature, channel);
                delete processedModeData.coolTemperature;
            }
            if (processedModeData.ecoTemperature !== undefined) {
                processedModeData.ecoTemp = alignThermostatTemperature(processedModeData.ecoTemperature, channel);
                delete processedModeData.ecoTemperature;
            }
            if (processedModeData.manualTemperature !== undefined) {
                processedModeData.manualTemp = alignThermostatTemperature(processedModeData.manualTemperature, channel);
                delete processedModeData.manualTemperature;
            }

            delete processedModeData.partialUpdate;

            const payload = { 'mode': [processedModeData] };
            const response = await device.publishMessage('SET', 'Appliance.Control.Thermostat.Mode', payload);
            if (response?.mode) {
                updateThermostatMode(device, response.mode, 'response');
                device.lastFullUpdateTimestamp = Date.now();
            }
            return response;
        },

        /**
         * Gets the current thermostat state for a channel.
         *
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get state for (default: 0)
         * @returns {Promise<ThermostatState|undefined>} Promise that resolves with thermostat state or undefined
         * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
         * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            const CACHE_MAX_AGE = 5000; // 5 seconds
            const cacheAge = Date.now() - (device.lastFullUpdateTimestamp || 0);

            // Use cache if fresh, otherwise fetch
            if (device.lastFullUpdateTimestamp && cacheAge < CACHE_MAX_AGE) {
                const cached = device._thermostatStateByChannel.get(channel);
                if (cached) {
                    return cached;
                }
            }

            // Fetch fresh state
            const payload = { 'mode': [{ channel }] };
            const response = await device.publishMessage('GET', 'Appliance.Control.Thermostat.Mode', payload);

            if (response?.mode) {
                updateThermostatMode(device, response.mode, 'response');
                device.lastFullUpdateTimestamp = Date.now();
            }

            return device._thermostatStateByChannel.get(channel);
        },

        /**
         * Gets the thermostat mode B from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get mode B for (default: 0)
         * @returns {Promise<Object>} Response containing thermostat mode B
         * @throws {import('../lib/errors/errors').CommandError} If the device does not support the ModeB namespace
         */
        async getModeB(options = {}) {
            const channel = normalizeChannel(options);
            if (!device.abilities || !device.abilities['Appliance.Control.Thermostat.ModeB']) {
                throw new MerossErrorCommand(
                    'Device does not support Appliance.Control.Thermostat.ModeB namespace',
                    { namespace: 'Appliance.Control.Thermostat.ModeB', channel },
                    device.uuid
                );
            }

            const payload = { 'modeB': [{ channel }] };
            const response = await device.publishMessage('GET', 'Appliance.Control.Thermostat.ModeB', payload);
            if (response?.modeB) {
                updateThermostatModeB(device, response.modeB, 'response');
                device.lastFullUpdateTimestamp = Date.now();
            }
            return response;
        },

        /**
         * Gets the thermostat window opened status from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get window opened status for (default: 0)
         * @returns {Promise<Object>} Response containing window opened status
         */
        async getWindowOpened(options = {}) {
            const channel = normalizeChannel(options);
            const payload = { 'windowOpened': [{ channel }] };
            return await device.publishMessage('GET', 'Appliance.Control.Thermostat.WindowOpened', payload);
        },

        /**
         * Gets the thermostat schedule from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get schedule for (default: 0)
         * @returns {Promise<Object>} Response containing thermostat schedule
         */
        async getSchedule(options = {}) {
            const channel = normalizeChannel(options);
            const payload = { schedule: [{ channel }] };
            return await device.publishMessage('GET', 'Appliance.Control.Thermostat.Schedule', payload);
        },

        /**
         * Sets the thermostat schedule.
         *
         * @param {Object} scheduleData - Schedule data object (array of schedule items)
         * @returns {Promise<Object>} Response from the device
         */
        async setSchedule(scheduleData) {
            const payload = { schedule: Array.isArray(scheduleData) ? scheduleData : [scheduleData] };
            return await device.publishMessage('SET', 'Appliance.Control.Thermostat.Schedule', payload);
        },

        /**
         * Gets the thermostat timer configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get timer for (default: 0)
         * @returns {Promise<Object>} Response containing thermostat timer data
         */
        async getTimer(options = {}) {
            const channel = normalizeChannel(options);
            const payload = { timer: [{ channel }] };
            return await device.publishMessage('GET', 'Appliance.Control.Thermostat.Timer', payload);
        },

        /**
         * Sets the thermostat timer configuration.
         *
         * @param {Object} timerData - Timer data object (array of timer items)
         * @returns {Promise<Object>} Response from the device
         */
        async setTimer(timerData) {
            const payload = { timer: Array.isArray(timerData) ? timerData : [timerData] };
            return await device.publishMessage('SET', 'Appliance.Control.Thermostat.Timer', payload);
        },

        /**
         * Acknowledges a thermostat alarm (device-initiated SET).
         *
         * @param {Object} [options={}] - Acknowledge options
         * @param {number} [options.channel=0] - Channel to acknowledge alarm for (default: 0)
         * @returns {Promise<Object>} Response from the device
         */
        async acknowledgeAlarm(options = {}) {
            const channel = normalizeChannel(options);
            const payload = {
                alarm: [{
                    channel,
                    temp: 0,
                    type: 0
                }]
            };
            return await device.publishMessage('SETACK', 'Appliance.Control.Thermostat.Alarm', payload);
        },

        /**
         * Gets the thermostat hold action configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get hold action for (default: 0)
         * @returns {Promise<Object>} Response containing hold action configuration
         */
        async getHoldAction(options = {}) {
            const channel = normalizeChannel(options);
            const payload = { holdAction: [{ channel }] };
            return await device.publishMessage('GET', 'Appliance.Control.Thermostat.HoldAction', payload);
        },

        /**
         * Sets the thermostat hold action configuration.
         *
         * @param {Object} options - Hold action options
         * @param {Object|Array} options.holdActionData - Hold action data object (array of hold action items)
         * @returns {Promise<Object>} Response from the device
         */
        async setHoldAction(options = {}) {
            if (!options.holdActionData) {
                throw new MerossErrorValidation('holdActionData is required', 'holdActionData');
            }
            const payload = { holdAction: Array.isArray(options.holdActionData) ? options.holdActionData : [options.holdActionData] };
            return await device.publishMessage('SET', 'Appliance.Control.Thermostat.HoldAction', payload);
        },

        /**
         * Gets the thermostat overheat protection configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get overheat config for (default: 0)
         * @returns {Promise<Object>} Response containing overheat configuration
         */
        async getOverheat(options = {}) {
            const channel = normalizeChannel(options);
            const payload = { overheat: [{ channel }] };
            return await device.publishMessage('GET', 'Appliance.Control.Thermostat.Overheat', payload);
        },

        /**
         * Sets the thermostat overheat protection configuration.
         *
         * @param {Object} options - Overheat options
         * @param {Object|Array} options.overheatData - Overheat data object (array of overheat items)
         * @returns {Promise<Object>} Response from the device
         */
        async setOverheat(options = {}) {
            if (!options.overheatData) {
                throw new MerossErrorValidation('overheatData is required', 'overheatData');
            }
            const payload = { overheat: Array.isArray(options.overheatData) ? options.overheatData : [options.overheatData] };
            return await device.publishMessage('SET', 'Appliance.Control.Thermostat.Overheat', payload);
        },

        /**
         * Gets the thermostat dead zone configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get dead zone for (default: 0)
         * @returns {Promise<Object>} Response containing dead zone configuration
         */
        async getDeadZone(options = {}) {
            const channel = normalizeChannel(options);
            const payload = { deadZone: [{ channel }] };
            return await device.publishMessage('GET', 'Appliance.Control.Thermostat.DeadZone', payload);
        },

        /**
         * Sets the thermostat dead zone configuration.
         *
         * @param {Object} options - Dead zone options
         * @param {Object|Array} options.deadZoneData - Dead zone data object (array of dead zone items)
         * @returns {Promise<Object>} Response from the device
         */
        async setDeadZone(options = {}) {
            if (!options.deadZoneData) {
                throw new MerossErrorValidation('deadZoneData is required', 'deadZoneData');
            }
            const payload = { deadZone: Array.isArray(options.deadZoneData) ? options.deadZoneData : [options.deadZoneData] };
            return await device.publishMessage('SET', 'Appliance.Control.Thermostat.DeadZone', payload);
        },

        /**
         * Gets the thermostat calibration configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get calibration for (default: 0)
         * @returns {Promise<Object>} Response containing calibration configuration
         */
        async getCalibration(options = {}) {
            const channel = normalizeChannel(options);
            const payload = { calibration: [{ channel }] };
            return await device.publishMessage('GET', 'Appliance.Control.Thermostat.Calibration', payload);
        },

        /**
         * Sets the thermostat calibration configuration.
         *
         * @param {Object} options - Calibration options
         * @param {Object|Array} options.calibrationData - Calibration data object (array of calibration items)
         * @returns {Promise<Object>} Response from the device
         */
        async setCalibration(options = {}) {
            if (!options.calibrationData) {
                throw new MerossErrorValidation('calibrationData is required', 'calibrationData');
            }
            const payload = { calibration: Array.isArray(options.calibrationData) ? options.calibrationData : [options.calibrationData] };
            return await device.publishMessage('SET', 'Appliance.Control.Thermostat.Calibration', payload);
        },

        /**
         * Gets the thermostat sensor mode configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get sensor mode for (default: 0)
         * @returns {Promise<Object>} Response containing sensor mode configuration
         */
        async getSensor(options = {}) {
            const channel = normalizeChannel(options);
            const payload = { sensor: [{ channel }] };
            return await device.publishMessage('GET', 'Appliance.Control.Thermostat.Sensor', payload);
        },

        /**
         * Sets the thermostat sensor mode configuration.
         *
         * @param {Object} options - Sensor options
         * @param {Object|Array} options.sensorData - Sensor data object (array of sensor items)
         * @returns {Promise<Object>} Response from the device
         */
        async setSensor(options = {}) {
            if (!options.sensorData) {
                throw new MerossErrorValidation('sensorData is required', 'sensorData');
            }
            const payload = { sensor: Array.isArray(options.sensorData) ? options.sensorData : [options.sensorData] };
            return await device.publishMessage('SET', 'Appliance.Control.Thermostat.Sensor', payload);
        },

        /**
         * Gets the thermostat summer mode configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get summer mode for (default: 0)
         * @returns {Promise<Object>} Response containing summer mode configuration
         */
        async getSummerMode(options = {}) {
            const channel = normalizeChannel(options);
            const payload = { summerMode: [{ channel }] };
            return await device.publishMessage('GET', 'Appliance.Control.Thermostat.SummerMode', payload);
        },

        /**
         * Sets the thermostat summer mode configuration.
         *
         * @param {Object} options - Summer mode options
         * @param {Object|Array} options.summerModeData - Summer mode data object (array of summer mode items)
         * @returns {Promise<Object>} Response from the device
         */
        async setSummerMode(options = {}) {
            if (!options.summerModeData) {
                throw new MerossErrorValidation('summerModeData is required', 'summerModeData');
            }
            const payload = { summerMode: Array.isArray(options.summerModeData) ? options.summerModeData : [options.summerModeData] };
            return await device.publishMessage('SET', 'Appliance.Control.Thermostat.SummerMode', payload);
        },

        /**
         * Gets the thermostat frost protection configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get frost config for (default: 0)
         * @returns {Promise<Object>} Response containing frost configuration
         */
        async getFrost(options = {}) {
            const channel = normalizeChannel(options);
            const payload = { frost: [{ channel }] };
            return await device.publishMessage('GET', 'Appliance.Control.Thermostat.Frost', payload);
        },

        /**
         * Sets the thermostat frost protection configuration.
         *
         * @param {Object} options - Frost options
         * @param {Object|Array} options.frostData - Frost data object (array of frost items)
         * @returns {Promise<Object>} Response from the device
         */
        async setFrost(options = {}) {
            if (!options.frostData) {
                throw new MerossErrorValidation('frostData is required', 'frostData');
            }
            const payload = { frost: Array.isArray(options.frostData) ? options.frostData : [options.frostData] };
            return await device.publishMessage('SET', 'Appliance.Control.Thermostat.Frost', payload);
        },

        /**
         * Gets the thermostat alarm configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get alarm config for (default: 0)
         * @returns {Promise<Object>} Response containing alarm configuration
         */
        async getAlarmConfig(options = {}) {
            const channel = normalizeChannel(options);
            const payload = { alarmConfig: [{ channel }] };
            return await device.publishMessage('GET', 'Appliance.Control.Thermostat.AlarmConfig', payload);
        },

        /**
         * Sets the thermostat alarm configuration.
         *
         * @param {Object} options - Alarm config options
         * @param {Object|Array} options.alarmConfigData - Alarm config data object (array of alarm config items)
         * @returns {Promise<Object>} Response from the device
         */
        async setAlarmConfig(options = {}) {
            if (!options.alarmConfigData) {
                throw new MerossErrorValidation('alarmConfigData is required', 'alarmConfigData');
            }
            const payload = { alarmConfig: Array.isArray(options.alarmConfigData) ? options.alarmConfigData : [options.alarmConfigData] };
            return await device.publishMessage('SET', 'Appliance.Control.Thermostat.AlarmConfig', payload);
        },

        /**
         * Gets the thermostat compressor delay configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get compressor delay for (default: 0)
         * @returns {Promise<Object>} Response containing compressor delay configuration
         */
        async getCompressorDelay(options = {}) {
            const channel = normalizeChannel(options);
            const payload = { delay: [{ channel }] };
            return await device.publishMessage('GET', 'Appliance.Control.Thermostat.CompressorDelay', payload);
        },

        /**
         * Sets the thermostat compressor delay configuration.
         *
         * @param {Object} options - Delay options
         * @param {Object|Array} options.delayData - Delay data object (array of delay items)
         * @returns {Promise<Object>} Response from the device
         */
        async setCompressorDelay(options = {}) {
            if (!options.delayData) {
                throw new MerossErrorValidation('delayData is required', 'delayData');
            }
            const payload = { delay: Array.isArray(options.delayData) ? options.delayData : [options.delayData] };
            return await device.publishMessage('SET', 'Appliance.Control.Thermostat.CompressorDelay', payload);
        },

        /**
         * Gets the thermostat control range configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get control range for (default: 0)
         * @returns {Promise<Object>} Response containing control range configuration
         */
        async getCtlRange(options = {}) {
            const channel = normalizeChannel(options);
            const payload = { ctlRange: [{ channel }] };
            return await device.publishMessage('GET', 'Appliance.Control.Thermostat.CtlRange', payload);
        },

        /**
         * Sets the thermostat control range configuration.
         *
         * @param {Object} options - Control range options
         * @param {Object|Array} options.ctlRangeData - Control range data object (array of ctlRange items)
         * @returns {Promise<Object>} Response from the device
         */
        async setCtlRange(options = {}) {
            if (!options.ctlRangeData) {
                throw new MerossErrorValidation('ctlRangeData is required', 'ctlRangeData');
            }
            const payload = { ctlRange: Array.isArray(options.ctlRangeData) ? options.ctlRangeData : [options.ctlRangeData] };
            return await device.publishMessage('SET', 'Appliance.Control.Thermostat.CtlRange', payload);
        }
    };
}

/**
 * Updates the cached thermostat mode state from mode data.
 *
 * Called automatically when thermostat mode push notifications are received or System.All
 * digest is processed. Handles arrays of mode data for multiple channels.
 *
 * @param {Object} device - The device instance
 * @param {Array} modeData - Array of mode data objects
 * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
 */
function updateThermostatMode(device, modeData, source = 'response') {
    if (!modeData || !Array.isArray(modeData)) {return;}

    for (const channelData of modeData) {
        const channelIndex = channelData.channel;
        if (channelIndex === undefined || channelIndex === null) {continue;}

        const oldState = device._thermostatStateByChannel.get(channelIndex);
        const oldValue = oldState ? {
            mode: oldState.mode,
            targetTemp: oldState.targetTemperatureCelsius,
            currentTemp: oldState.currentTemperatureCelsius
        } : undefined;

        let state = device._thermostatStateByChannel.get(channelIndex);
        if (!state) {
            state = new ThermostatState(channelData);
            device._thermostatStateByChannel.set(channelIndex, state);
        } else {
            state.update(channelData);
        }

        const newValue = buildStateChanges(oldValue, {
            mode: state.mode,
            targetTemp: state.targetTemperatureCelsius,
            currentTemp: state.currentTemperatureCelsius
        });

        if (Object.keys(newValue).length > 0) {
            device.emit('state', {
                type: 'thermostat',
                channel: channelIndex,
                value: newValue,
                source,
                timestamp: Date.now()
            });
        }
    }
}

/**
 * Updates the cached thermostat mode B state from mode B data.
 *
 * Called automatically when thermostat mode B push notifications are received or commands complete.
 * Handles arrays of mode B data for multiple channels.
 *
 * @param {Object} device - The device instance
 * @param {Array} modeData - Array of mode B data objects
 * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
 */
function updateThermostatModeB(device, modeData, source = 'response') {
    if (!modeData || !Array.isArray(modeData)) {return;}

    for (const channelData of modeData) {
        const channelIndex = channelData.channel;
        if (channelIndex === undefined || channelIndex === null) {continue;}

        const oldState = device._thermostatStateByChannel.get(channelIndex);
        const oldValue = oldState ? {
            mode: oldState.mode,
            state: oldState.state,
            targetTemp: oldState.targetTemperatureCelsius,
            currentTemp: oldState.currentTemperatureCelsius
        } : undefined;

        let state = device._thermostatStateByChannel.get(channelIndex);
        if (!state) {
            state = new ThermostatState(channelData);
            device._thermostatStateByChannel.set(channelIndex, state);
        } else {
            state.update(channelData);
        }

        const newValue = buildStateChanges(oldValue, {
            mode: state.mode,
            state: state.state,
            targetTemp: state.targetTemperatureCelsius,
            currentTemp: state.currentTemperatureCelsius
        });

        if (Object.keys(newValue).length > 0) {
            device.emit('state', {
                type: 'thermostat',
                channel: channelIndex,
                value: newValue,
                source,
                timestamp: Date.now()
            });
        }
    }
}

module.exports = createThermostatFeature;
module.exports._updateThermostatMode = updateThermostatMode;
module.exports._updateThermostatModeB = updateThermostatModeB;
