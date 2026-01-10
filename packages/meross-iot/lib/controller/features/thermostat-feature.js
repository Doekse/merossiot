'use strict';

const ThermostatState = require('../../model/states/thermostat-state');
const { normalizeChannel } = require('../../utilities/options');
const { buildStateChanges } = require('../../utilities/state-changes');

/**
 * Thermostat feature module.
 * Provides control over thermostat mode, temperature settings, schedules, and various configuration options.
 */
module.exports = {
    /**
     * Controls the thermostat mode.
     *
     * Supports both ThermostatMode enum objects and numeric values. Temperature values are automatically
     * converted from Celsius to device units and rounded to the nearest 0.5°C increment.
     *
     * @param {Object} options - Thermostat mode options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @param {number|import('../lib/enums').ThermostatMode} [options.mode] - Thermostat mode (from ThermostatMode enum or numeric value)
     * @param {number} [options.onoff] - On/off state (0=off, 1=on)
     * @param {number} [options.heatTemperature] - Heat temperature in Celsius (will be converted to device units)
     * @param {number} [options.coolTemperature] - Cool temperature in Celsius (will be converted to device units)
     * @param {number} [options.ecoTemperature] - Eco temperature in Celsius (will be converted to device units)
     * @param {number} [options.manualTemperature] - Manual temperature in Celsius (will be converted to device units)
     * @param {boolean} [options.partialUpdate=false] - If true, fetches current state and merges with provided options
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').CommandError} If mode value is invalid or temperature is out of range
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setThermostatMode(options = {}) {
        const channel = normalizeChannel(options);
        let processedModeData = { ...options };

        if (options.partialUpdate) {
            try {
                const currentResponse = await this.getThermostatMode({ channel });
                if (currentResponse && currentResponse.mode && Array.isArray(currentResponse.mode) && currentResponse.mode.length > 0) {
                    const currentState = currentResponse.mode[0];
                    processedModeData = { ...currentState, ...processedModeData };
                }
            } catch (e) {
                // If fetch fails, continue with provided options only
            }
        }

        processedModeData.channel = channel;

        // Mode must be a number
        if (processedModeData.mode !== undefined && processedModeData.mode !== null && typeof processedModeData.mode !== 'number') {
            processedModeData.mode = 0;
        }

        if (processedModeData.heatTemperature !== undefined) {
            processedModeData.heatTemp = this._alignThermostatTemperature(processedModeData.heatTemperature, channel);
            delete processedModeData.heatTemperature;
        }
        if (processedModeData.coolTemperature !== undefined) {
            processedModeData.coolTemp = this._alignThermostatTemperature(processedModeData.coolTemperature, channel);
            delete processedModeData.coolTemperature;
        }
        if (processedModeData.ecoTemperature !== undefined) {
            processedModeData.ecoTemp = this._alignThermostatTemperature(processedModeData.ecoTemperature, channel);
            delete processedModeData.ecoTemperature;
        }
        if (processedModeData.manualTemperature !== undefined) {
            processedModeData.manualTemp = this._alignThermostatTemperature(processedModeData.manualTemperature, channel);
            delete processedModeData.manualTemperature;
        }

        delete processedModeData.partialUpdate;

        const payload = { 'mode': [processedModeData] };
        const response = await this.publishMessage('SET', 'Appliance.Control.Thermostat.Mode', payload);
        if (response && response.mode) {
            this._updateThermostatMode(response.mode, 'response');
            this._lastFullUpdateTimestamp = Date.now();
        }
        return response;
    },

    /**
     * Controls the thermostat mode B.
     *
     * Mode B is an alternative mode system used by some thermostat models. Supports both ThermostatModeBState
     * enum objects and numeric values. Throws an error if the device does not support the ModeB namespace.
     *
     * @param {Object} options - Thermostat mode B options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @param {number|import('../lib/enums').ThermostatModeBState} [options.state] - Mode B state (from ThermostatModeBState enum or numeric value)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').CommandError} If the device does not support the ModeB namespace or state value is invalid
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setThermostatModeB(options = {}) {
        const channel = normalizeChannel(options);
        if (!this._abilities || !this._abilities['Appliance.Control.Thermostat.ModeB']) {
            const { CommandError } = require('../../model/exception');
            throw new CommandError(
                'Device does not support Appliance.Control.Thermostat.ModeB namespace',
                { namespace: 'Appliance.Control.Thermostat.ModeB', channel, options },
                this.uuid
            );
        }

        const processedModeData = { ...options };
        processedModeData.channel = channel;

        // State must be a number
        if (processedModeData.state !== undefined && processedModeData.state !== null && typeof processedModeData.state !== 'number') {
            processedModeData.state = 1;
        }

        const payload = { 'modeB': [processedModeData] };
        const response = await this.publishMessage('SET', 'Appliance.Control.Thermostat.ModeB', payload);
        if (response && response.modeB) {
            this._updateThermostatModeB(response.modeB, 'response');
        }
        return response;
    },

    /**
     * Controls the thermostat window opened status.
     *
     * Used to inform the thermostat when a window is opened or closed, which may affect heating/cooling behavior.
     *
     * @param {Object} options - Window opened options
     * @param {number} [options.channel=0] - Channel to control (default: 0)
     * @param {boolean} options.windowOpened - True if window is opened, false if closed
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setThermostatWindowOpened(options = {}) {
        const channel = normalizeChannel(options);
        if (options.windowOpened === undefined) {
            throw new Error('windowOpened is required');
        }
        const payload = { 'windowOpened': [{ channel, 'status': options.windowOpened ? 1 : 0 }] };
        return await this.publishMessage('SET', 'Appliance.Control.Thermostat.WindowOpened', payload);
    },

    /**
     * Gets the current thermostat mode from the device.
     *
     * Use {@link getCachedThermostatState} to get cached state without making a request.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get mode for (default: 0)
     * @returns {Promise<Object>} Response containing thermostat mode
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getThermostatMode(options = {}) {
        const channel = normalizeChannel(options);
        const payload = { 'mode': [{ channel }] };
        const response = await this.publishMessage('GET', 'Appliance.Control.Thermostat.Mode', payload);
        if (response && response.mode) {
            this._updateThermostatMode(response.mode, 'response');
            this._lastFullUpdateTimestamp = Date.now();
        }
        return response;
    },

    /**
     * Gets the current thermostat mode B from the device.
     *
     * Throws an error if the device does not support the ModeB namespace. Use {@link getCachedThermostatModeBState}
     * to get cached state without making a request.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get mode B for (default: 0)
     * @returns {Promise<Object>} Response containing thermostat mode B
     * @throws {import('../lib/errors/errors').CommandError} If the device does not support the ModeB namespace
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getThermostatModeB(options = {}) {
        const channel = normalizeChannel(options);
        if (!this._abilities || !this._abilities['Appliance.Control.Thermostat.ModeB']) {
            const { CommandError } = require('../../model/exception');
            throw new CommandError(
                'Device does not support Appliance.Control.Thermostat.ModeB namespace',
                { namespace: 'Appliance.Control.Thermostat.ModeB', channel },
                this.uuid
            );
        }

        const payload = { 'modeB': [{ channel }] };
        const response = await this.publishMessage('GET', 'Appliance.Control.Thermostat.ModeB', payload);
        if (response && response.modeB) {
            this._updateThermostatModeB(response.modeB, 'response');
            this._lastFullUpdateTimestamp = Date.now();
        }
        return response;
    },

    /**
     * Gets the thermostat window opened status from the device.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get window opened status for (default: 0)
     * @returns {Promise<Object>} Response containing window opened status
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getThermostatWindowOpened(options = {}) {
        const channel = normalizeChannel(options);
        const payload = { 'windowOpened': [{ channel }] };
        return await this.publishMessage('GET', 'Appliance.Control.Thermostat.WindowOpened', payload);
    },

    /**
     * Gets the thermostat schedule from the device.
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get schedule for (default: 0)
     * @returns {Promise<Object>} Response containing thermostat schedule
     */
    async getThermostatSchedule(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            schedule: [{
                channel
            }]
        };
        return await this.publishMessage('GET', 'Appliance.Control.Thermostat.Schedule', payload);
    },

    /**
     * Controls (sets) the thermostat schedule.
     * @param {Object} scheduleData - Schedule data object (array of schedule items)
     * @param {number|null} timeout - Optional timeout in milliseconds
     * @returns {Promise<Object>} Response from the device
     */
    async setThermostatSchedule(scheduleData) {
        const payload = { schedule: Array.isArray(scheduleData) ? scheduleData : [scheduleData] };
        return await this.publishMessage('SET', 'Appliance.Control.Thermostat.Schedule', payload);
    },

    /**
     * Gets the thermostat timer configuration from the device.
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get timer for (default: 0)
     * @returns {Promise<Object>} Response containing thermostat timer data
     */
    async getThermostatTimer(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            timer: [{
                channel
            }]
        };
        return await this.publishMessage('GET', 'Appliance.Control.Thermostat.Timer', payload);
    },

    /**
     * Controls (sets) the thermostat timer configuration.
     * @param {Object} timerData - Timer data object (array of timer items)
     * @param {number|null} timeout - Optional timeout in milliseconds
     * @returns {Promise<Object>} Response from the device
     */
    async setThermostatTimer(timerData) {
        const payload = { timer: Array.isArray(timerData) ? timerData : [timerData] };
        return await this.publishMessage('SET', 'Appliance.Control.Thermostat.Timer', payload);
    },

    /**
     * Acknowledges a thermostat alarm (device-initiated SET).
     *
     * Alarm events are typically initiated by the device via SET. This method sends a SETACK response
     * to acknowledge receipt of the alarm event.
     *
     * @param {Object} [options={}] - Acknowledge options
     * @param {number} [options.channel=0] - Channel to acknowledge alarm for (default: 0)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async acknowledgeThermostatAlarm(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            alarm: [{
                channel,
                temp: 0,
                type: 0
            }]
        };
        return await this.publishMessage('SETACK', 'Appliance.Control.Thermostat.Alarm', payload);
    },

    /**
     * Gets the thermostat hold action configuration from the device.
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get hold action for (default: 0)
     * @returns {Promise<Object>} Response containing hold action configuration
     */
    async getThermostatHoldAction(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            holdAction: [{
                channel
            }]
        };
        return await this.publishMessage('GET', 'Appliance.Control.Thermostat.HoldAction', payload);
    },

    /**
     * Controls (sets) the thermostat hold action configuration.
     * @param {Object} options - Hold action options
     * @param {Object|Array} options.holdActionData - Hold action data object (array of hold action items)
     * @returns {Promise<Object>} Response from the device
     */
    async setThermostatHoldAction(options = {}) {
        if (!options.holdActionData) {
            throw new Error('holdActionData is required');
        }
        const payload = { holdAction: Array.isArray(options.holdActionData) ? options.holdActionData : [options.holdActionData] };
        return await this.publishMessage('SET', 'Appliance.Control.Thermostat.HoldAction', payload);
    },

    /**
     * Gets the thermostat hold action configuration from the device.
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get hold action for (default: 0)
     * @returns {Promise<Object>} Response containing hold action configuration
     */
    async getThermostatHoldAction(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            holdAction: [{
                channel
            }]
        };
        return await this.publishMessage('GET', 'Appliance.Control.Thermostat.HoldAction', payload);
    },

    /**
     * Controls (sets) the thermostat hold action configuration.
     * @param {Object} options - Hold action options
     * @param {Object|Array} options.holdActionData - Hold action data object (array of hold action items)
     * @returns {Promise<Object>} Response from the device
     */
    async setThermostatHoldAction(options = {}) {
        if (!options.holdActionData) {
            throw new Error('holdActionData is required');
        }
        const payload = { holdAction: Array.isArray(options.holdActionData) ? options.holdActionData : [options.holdActionData] };
        return await this.publishMessage('SET', 'Appliance.Control.Thermostat.HoldAction', payload);
    },

    /**
     * Gets the thermostat overheat protection configuration from the device.
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get overheat config for (default: 0)
     * @returns {Promise<Object>} Response containing overheat configuration
     */
    async getThermostatOverheat(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            overheat: [{
                channel
            }]
        };
        return await this.publishMessage('GET', 'Appliance.Control.Thermostat.Overheat', payload);
    },

    /**
     * Controls (sets) the thermostat overheat protection configuration.
     * @param {Object} options - Overheat options
     * @param {Object|Array} options.overheatData - Overheat data object (array of overheat items)
     * @returns {Promise<Object>} Response from the device
     */
    async setThermostatOverheat(options = {}) {
        if (!options.overheatData) {
            throw new Error('overheatData is required');
        }
        const payload = { overheat: Array.isArray(options.overheatData) ? options.overheatData : [options.overheatData] };
        return await this.publishMessage('SET', 'Appliance.Control.Thermostat.Overheat', payload);
    },

    /**
     * Gets the thermostat dead zone configuration from the device.
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get dead zone for (default: 0)
     * @returns {Promise<Object>} Response containing dead zone configuration
     */
    async getThermostatDeadZone(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            deadZone: [{
                channel
            }]
        };
        return await this.publishMessage('GET', 'Appliance.Control.Thermostat.DeadZone', payload);
    },

    /**
     * Controls (sets) the thermostat dead zone configuration.
     * @param {Object} options - Dead zone options
     * @param {Object|Array} options.deadZoneData - Dead zone data object (array of dead zone items)
     * @returns {Promise<Object>} Response from the device
     */
    async setThermostatDeadZone(options = {}) {
        if (!options.deadZoneData) {
            throw new Error('deadZoneData is required');
        }
        const payload = { deadZone: Array.isArray(options.deadZoneData) ? options.deadZoneData : [options.deadZoneData] };
        return await this.publishMessage('SET', 'Appliance.Control.Thermostat.DeadZone', payload);
    },

    /**
     * Gets the thermostat calibration configuration from the device.
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get calibration for (default: 0)
     * @returns {Promise<Object>} Response containing calibration configuration
     */
    async getThermostatCalibration(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            calibration: [{
                channel
            }]
        };
        return await this.publishMessage('GET', 'Appliance.Control.Thermostat.Calibration', payload);
    },

    /**
     * Controls (sets) the thermostat calibration configuration.
     * @param {Object} options - Calibration options
     * @param {Object|Array} options.calibrationData - Calibration data object (array of calibration items)
     * @returns {Promise<Object>} Response from the device
     */
    async setThermostatCalibration(options = {}) {
        if (!options.calibrationData) {
            throw new Error('calibrationData is required');
        }
        const payload = { calibration: Array.isArray(options.calibrationData) ? options.calibrationData : [options.calibrationData] };
        return await this.publishMessage('SET', 'Appliance.Control.Thermostat.Calibration', payload);
    },

    /**
     * Gets the thermostat sensor mode configuration from the device.
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get sensor mode for (default: 0)
     * @returns {Promise<Object>} Response containing sensor mode configuration
     */
    async getThermostatSensor(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            sensor: [{
                channel
            }]
        };
        return await this.publishMessage('GET', 'Appliance.Control.Thermostat.Sensor', payload);
    },

    /**
     * Controls (sets) the thermostat sensor mode configuration.
     * @param {Object} options - Sensor options
     * @param {Object|Array} options.sensorData - Sensor data object (array of sensor items)
     * @returns {Promise<Object>} Response from the device
     */
    async setThermostatSensor(options = {}) {
        if (!options.sensorData) {
            throw new Error('sensorData is required');
        }
        const payload = { sensor: Array.isArray(options.sensorData) ? options.sensorData : [options.sensorData] };
        return await this.publishMessage('SET', 'Appliance.Control.Thermostat.Sensor', payload);
    },

    /**
     * Gets the thermostat summer mode configuration from the device.
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get summer mode for (default: 0)
     * @returns {Promise<Object>} Response containing summer mode configuration
     */
    async getThermostatSummerMode(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            summerMode: [{
                channel
            }]
        };
        return await this.publishMessage('GET', 'Appliance.Control.Thermostat.SummerMode', payload);
    },

    /**
     * Controls (sets) the thermostat summer mode configuration.
     * @param {Object} options - Summer mode options
     * @param {Object|Array} options.summerModeData - Summer mode data object (array of summer mode items)
     * @returns {Promise<Object>} Response from the device
     */
    async setThermostatSummerMode(options = {}) {
        if (!options.summerModeData) {
            throw new Error('summerModeData is required');
        }
        const payload = { summerMode: Array.isArray(options.summerModeData) ? options.summerModeData : [options.summerModeData] };
        return await this.publishMessage('SET', 'Appliance.Control.Thermostat.SummerMode', payload);
    },

    /**
     * Gets the thermostat frost protection configuration from the device.
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get frost config for (default: 0)
     * @returns {Promise<Object>} Response containing frost configuration
     */
    async getThermostatFrost(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            frost: [{
                channel
            }]
        };
        return await this.publishMessage('GET', 'Appliance.Control.Thermostat.Frost', payload);
    },

    /**
     * Controls (sets) the thermostat frost protection configuration.
     * @param {Object} options - Frost options
     * @param {Object|Array} options.frostData - Frost data object (array of frost items)
     * @returns {Promise<Object>} Response from the device
     */
    async setThermostatFrost(options = {}) {
        if (!options.frostData) {
            throw new Error('frostData is required');
        }
        const payload = { frost: Array.isArray(options.frostData) ? options.frostData : [options.frostData] };
        return await this.publishMessage('SET', 'Appliance.Control.Thermostat.Frost', payload);
    },

    /**
     * Gets the thermostat alarm configuration from the device.
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get alarm config for (default: 0)
     * @returns {Promise<Object>} Response containing alarm configuration
     */
    async getThermostatAlarmConfig(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            alarmConfig: [{
                channel
            }]
        };
        return await this.publishMessage('GET', 'Appliance.Control.Thermostat.AlarmConfig', payload);
    },

    /**
     * Controls (sets) the thermostat alarm configuration.
     * @param {Object} options - Alarm config options
     * @param {Object|Array} options.alarmConfigData - Alarm config data object (array of alarm config items)
     * @returns {Promise<Object>} Response from the device
     */
    async setThermostatAlarmConfig(options = {}) {
        if (!options.alarmConfigData) {
            throw new Error('alarmConfigData is required');
        }
        const payload = { alarmConfig: Array.isArray(options.alarmConfigData) ? options.alarmConfigData : [options.alarmConfigData] };
        return await this.publishMessage('SET', 'Appliance.Control.Thermostat.AlarmConfig', payload);
    },

    /**
     * Gets the thermostat compressor delay configuration from the device.
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get compressor delay for (default: 0)
     * @returns {Promise<Object>} Response containing compressor delay configuration
     */
    async getThermostatCompressorDelay(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            delay: [{
                channel
            }]
        };
        return await this.publishMessage('GET', 'Appliance.Control.Thermostat.CompressorDelay', payload);
    },

    /**
     * Controls (sets) the thermostat compressor delay configuration.
     * @param {Object} options - Delay options
     * @param {Object|Array} options.delayData - Delay data object (array of delay items)
     * @returns {Promise<Object>} Response from the device
     */
    async setThermostatCompressorDelay(options = {}) {
        if (!options.delayData) {
            throw new Error('delayData is required');
        }
        const payload = { delay: Array.isArray(options.delayData) ? options.delayData : [options.delayData] };
        return await this.publishMessage('SET', 'Appliance.Control.Thermostat.CompressorDelay', payload);
    },

    /**
     * Gets the thermostat control range configuration from the device.
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get control range for (default: 0)
     * @returns {Promise<Object>} Response containing control range configuration
     */
    async getThermostatCtlRange(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            ctlRange: [{
                channel
            }]
        };
        return await this.publishMessage('GET', 'Appliance.Control.Thermostat.CtlRange', payload);
    },

    /**
     * Controls (sets) the thermostat control range configuration.
     * @param {Object} options - Control range options
     * @param {Object|Array} options.ctlRangeData - Control range data object (array of ctlRange items)
     * @returns {Promise<Object>} Response from the device
     */
    async setThermostatCtlRange(options = {}) {
        if (!options.ctlRangeData) {
            throw new Error('ctlRangeData is required');
        }
        const payload = { ctlRange: Array.isArray(options.ctlRangeData) ? options.ctlRangeData : [options.ctlRangeData] };
        return await this.publishMessage('SET', 'Appliance.Control.Thermostat.CtlRange', payload);
    },

    /**
     * Gets the cached thermostat state for the specified channel.
     *
     * Returns cached state without making a request. Use {@link getThermostatMode} to fetch fresh state
     * from the device. The state object contains enum properties: mode (ThermostatMode), workingMode (ThermostatWorkingMode).
     *
     * @param {number} [channel=0] - Channel to get state for (default: 0)
     * @returns {import('../lib/model/states/thermostat-state').ThermostatState|undefined} Cached thermostat state or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getCachedThermostatState(channel = 0) {
        this.validateState();
        return this._thermostatStateByChannel.get(channel);
    },

    /**
     * Gets the cached thermostat mode B state for the specified channel.
     *
     * Returns cached state without making a request. Use {@link getThermostatModeB} to fetch fresh state
     * from the device. The state object contains enum properties: workingMode (ThermostatWorkingMode), state (ThermostatModeBState).
     *
     * @param {number} [channel=0] - Channel to get state for (default: 0)
     * @returns {import('../lib/model/states/thermostat-state').ThermostatState|undefined} Cached thermostat mode B state or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getCachedThermostatModeBState(channel = 0) {
        this.validateState();
        return this._thermostatStateByChannel.get(channel);
    },

    /**
     * Aligns temperature value to device units and validates range.
     *
     * Converts Celsius temperature to device units (tenths of degrees) and rounds to nearest 0.5°C increment.
     * Validates against device-specific min/max temperature limits if available in cached state.
     *
     * @param {number} temperature - Temperature in Celsius
     * @param {number} [channel=0] - Channel to get temperature limits for (default: 0)
     * @returns {number} Temperature in device units (tenths of degrees)
     * @throws {import('../lib/errors/errors').CommandError} If temperature is out of valid range
     * @private
     */
    _alignThermostatTemperature(temperature, channel = 0) {
        const THERMOSTAT_MIN_SETTABLE_TEMP = 5.0;
        const THERMOSTAT_MAX_SETTABLE_TEMP = 35.0;

        let minSetableTemp = THERMOSTAT_MIN_SETTABLE_TEMP;
        let maxSetableTemp = THERMOSTAT_MAX_SETTABLE_TEMP;

        const channelState = this._thermostatStateByChannel.get(channel);
        if (channelState) {
            if (channelState.minTemperatureCelsius !== undefined) {
                minSetableTemp = channelState.minTemperatureCelsius;
            }
            if (channelState.maxTemperatureCelsius !== undefined) {
                maxSetableTemp = channelState.maxTemperatureCelsius;
            }
        }

        if (temperature < minSetableTemp || temperature > maxSetableTemp) {
            const { CommandError } = require('../../model/exception');
            throw new CommandError(
                `Temperature ${temperature}°C is out of range (${minSetableTemp}-${maxSetableTemp}°C) for this device`,
                { temperature, minSetableTemp, maxSetableTemp },
                this.uuid
            );
        }

        const quotient = temperature / 0.5;
        const rounded = Math.round(quotient);
        const finalTemp = rounded * 0.5;

        return Math.round(finalTemp * 10);
    },

    /**
     * Updates the cached thermostat mode state from mode data.
     *
     * Called automatically when thermostat mode push notifications are received or commands complete.
     * Handles arrays of mode data for multiple channels.
     *
     * @param {Array} modeData - Array of mode data objects
     * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
     * @private
     */
    _updateThermostatMode(modeData, source = 'response') {
        if (!modeData || !Array.isArray(modeData)) {return;}

        for (const channelData of modeData) {
            const channelIndex = channelData.channel;
            if (channelIndex === undefined || channelIndex === null) {continue;}

            // Get old state before updating
            const oldState = this._thermostatStateByChannel.get(channelIndex);
            const oldValue = oldState ? {
                mode: oldState.mode,
                targetTemp: oldState.targetTemperatureCelsius,
                currentTemp: oldState.currentTemperatureCelsius
            } : undefined;

            let state = this._thermostatStateByChannel.get(channelIndex);
            if (!state) {
                state = new ThermostatState(channelData);
                this._thermostatStateByChannel.set(channelIndex, state);
            } else {
                state.update(channelData);
            }

            const newValue = buildStateChanges(oldValue, {
                mode: state.mode,
                targetTemp: state.targetTemperatureCelsius,
                currentTemp: state.currentTemperatureCelsius
            });

            if (Object.keys(newValue).length > 0) {
                this.emit('stateChange', {
                    type: 'thermostat',
                    channel: channelIndex,
                    value: newValue,
                    oldValue,
                    source,
                    timestamp: Date.now()
                });
            }
        }
    },

    /**
     * Updates the cached thermostat mode B state from mode B data.
     *
     * Called automatically when thermostat mode B push notifications are received or commands complete.
     * Handles arrays of mode B data for multiple channels.
     *
     * @param {Array} modeData - Array of mode B data objects
     * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
     * @private
     */
    _updateThermostatModeB(modeData, source = 'response') {
        if (!modeData || !Array.isArray(modeData)) {return;}

        for (const channelData of modeData) {
            const channelIndex = channelData.channel;
            if (channelIndex === undefined || channelIndex === null) {continue;}

            // Get old state before updating
            const oldState = this._thermostatStateByChannel.get(channelIndex);
            const oldValue = oldState ? {
                mode: oldState.mode,
                state: oldState.state,
                targetTemp: oldState.targetTemperatureCelsius,
                currentTemp: oldState.currentTemperatureCelsius
            } : undefined;

            let state = this._thermostatStateByChannel.get(channelIndex);
            if (!state) {
                state = new ThermostatState(channelData);
                this._thermostatStateByChannel.set(channelIndex, state);
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
                this.emit('stateChange', {
                    type: 'thermostat',
                    channel: channelIndex,
                    value: newValue,
                    oldValue,
                    source,
                    timestamp: Date.now()
                });
            }
        }
    }
};

