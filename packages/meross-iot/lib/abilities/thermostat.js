'use strict';

const ThermostatState = require('../states/thermostat-state');
const {
    ThermostatModeCodec,
    ThermostatModeBModeCodec,
    ThermostatModeBStateCodec,
    ThermostatModeBWorkingCodec,
    ThermostatModeBOnOffCodec
} = require('../enums');
const { getCachedOrFetch } = require('../utilities/cache');
const { normalizeChannel } = require('../utilities/options');
const { MerossDeviceError } = require('../exception');
const { registerNamespaceDescriptor } = require('../dispatcher');

/**
 * Creates a thermostat feature object for a device.
 *
 * Provides control over thermostat mode, temperature settings, schedules, and various configuration options.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Thermostat feature object with set(), get(), and configuration methods
 */
function createThermostatAbility(device) {
    /**
     * Aligns temperature value to device units and validates range.
     *
     * @param {number} temperature - Temperature in Celsius
     * @param {number} [channel=0] - Channel to get temperature limits for (default: 0)
     * @returns {number} Temperature in device units (tenths of degrees)
     * @throws {MerossDeviceError} If temperature is out of valid range (code COMMAND_FAILED)
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
            throw new MerossDeviceError(
                `Temperature ${temperature}°C is out of range (${minSetableTemp}-${maxSetableTemp}°C) for this device`,
                'COMMAND_FAILED',
                { temperature, minSetableTemp, maxSetableTemp, deviceUuid: device.uuid }
            );
        }

        const quotient = temperature / 0.5;
        const rounded = Math.round(quotient);
        const finalTemp = rounded * 0.5;

        return Math.round(finalTemp * 10);
    }

    /**
     * @param {number} channel
     * @param {boolean|number} windowOpened
     * @returns {Promise<Object>}
     */
    async function setWindowOpened(channel, windowOpened) {
        const requestPayload = { 'windowOpened': [{ channel, 'status': windowOpened ? 1 : 0 }] };
        const { payload } = await device.publishMessage('SET', 'Appliance.Control.Thermostat.WindowOpened', requestPayload);
        return payload;
    }

    /**
     * Encodes a string ModeB field through its codec or passes numeric wire values through.
     *
     * @param {Object} data
     * @param {string} field
     * @param {{ toWire: (s: string) => number|undefined }} codec
     * @param {string} label
     * @returns {void}
     * @throws {MerossDeviceError}
     */
    function encodeModeBField(data, field, codec, label) {
        const value = data[field];
        if (value === undefined || value === null) {
            return;
        }
        if (typeof value === 'string') {
            const wire = codec.toWire(value);
            if (wire === undefined) {
                throw new MerossDeviceError(
                    `Invalid thermostat ModeB ${field}.`,
                    'VALIDATION_ERROR',
                    { field, [field]: value, deviceUuid: device.uuid }
                );
            }
            data[field] = wire;
            return;
        }
        if (typeof value !== 'number') {
            throw new MerossDeviceError(
                `Invalid thermostat ModeB ${field}. Expected ${label} string or wire number.`,
                'VALIDATION_ERROR',
                { field, [field]: value, deviceUuid: device.uuid }
            );
        }
    }

    /**
     * Throws early when ModeB is not advertised, avoiding a cryptic protocol-level failure.
     *
     * @param {number} channel
     * @param {Object} options
     * @returns {Promise<Object>}
     * @throws {MerossDeviceError} COMMAND_FAILED when ModeB is not supported.
     */
    async function setModeB(channel, options) {
        if (!device.abilities || !device.abilities['Appliance.Control.Thermostat.ModeB']) {
            throw new MerossDeviceError(
                'Device does not support Appliance.Control.Thermostat.ModeB namespace',
                'COMMAND_FAILED',
                { namespace: 'Appliance.Control.Thermostat.ModeB', channel, options, deviceUuid: device.uuid }
            );
        }

        const data = { ...options, channel };
        if (data.state === undefined || data.state === null) {
            data.state = ThermostatModeBStateCodec.toWire('working');
        }
        encodeModeBField(data, 'state', ThermostatModeBStateCodec, 'working, standby, or off');
        encodeModeBField(data, 'mode', ThermostatModeBModeCodec, 'manual, schedule, or timer');
        encodeModeBField(data, 'working', ThermostatModeBWorkingCodec, 'heating or cooling');
        encodeModeBField(data, 'onoff', ThermostatModeBOnOffCodec, 'open or closed');

        const { payload } = await device.publishMessage('SET', 'Appliance.Control.Thermostat.ModeB', { 'modeB': [data] });
        return payload;
    }

    /**
     * Maps user-facing Celsius field names to the device's on-wire keys, converting
     * each value through alignThermostatTemperature. Mutates `data` in place.
     *
     * @param {Object} data
     * @param {number} channel
     */
    function convertTemperatureFields(data, channel) {
        const mapping = [
            ['heatTemperature', 'heatTemp'],
            ['coolTemperature', 'coolTemp'],
            ['ecoTemperature', 'ecoTemp'],
            ['manualTemperature', 'manualTemp']
        ];
        for (const [source, target] of mapping) {
            if (data[source] !== undefined) {
                data[target] = alignThermostatTemperature(data[source], channel);
                delete data[source];
            }
        }
    }

    /**
     * Builds the Mode payload, optionally merging the device's current state when
     * `partialUpdate` is set. A failed GET is swallowed intentionally — a transient
     * fetch error should not block an otherwise valid SET.
     *
     * @param {Function} getCurrent - Bound reference to the ability's `get()`.
     * @param {number} channel
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function buildModePayload(getCurrent, channel, options) {
        let data = { ...options };

        if (options.partialUpdate) {
            try {
                const current = await getCurrent({ channel });
                if (current?.mode && Array.isArray(current.mode) && current.mode.length > 0) {
                    data = { ...current.mode[0], ...data };
                }
            } catch (_e) {
                // Intentional: a failed refresh must not prevent the SET.
            }
        }

        data.channel = channel;

        if (data.mode !== undefined && data.mode !== null) {
            if (typeof data.mode === 'string') {
                const wire = ThermostatModeCodec.toWire(data.mode);
                if (wire === undefined) {
                    throw new MerossDeviceError(
                        'Invalid thermostat mode. Expected heat, cool, economy, auto, or manual.',
                        'VALIDATION_ERROR',
                        { field: 'mode', mode: data.mode, deviceUuid: device.uuid }
                    );
                }
                data.mode = wire;
            } else if (typeof data.mode !== 'number') {
                throw new MerossDeviceError(
                    'Invalid thermostat mode. Expected heat, cool, economy, auto, or manual.',
                    'VALIDATION_ERROR',
                    { field: 'mode', mode: data.mode, deviceUuid: device.uuid }
                );
            }
        }

        if (typeof data.onoff === 'boolean') {
            data.onoff = data.onoff ? 1 : 0;
        }

        convertTemperatureFields(data, channel);
        delete data.partialUpdate;

        return data;
    }

    return {
        /**
         * Sets the thermostat mode, mode B, or window opened status.
         *
         * Dispatches to one of three specialised helpers based on which option keys
         * are present, keeping this dispatcher's cyclomatic complexity minimal.
         *
         * @param {Object} options - Thermostat options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @param {'heat'|'cool'|'economy'|'auto'|'manual'} [options.mode] - Thermostat mode
         * @param {boolean|number} [options.onoff] - On/off state
         * @param {number} [options.heatTemperature] - Heat temperature in Celsius
         * @param {number} [options.coolTemperature] - Cool temperature in Celsius
         * @param {number} [options.ecoTemperature] - Eco temperature in Celsius
         * @param {number} [options.manualTemperature] - Manual temperature in Celsius
         * @param {boolean} [options.partialUpdate=false] - If true, fetches current state and merges
         * @param {'working'|'standby'|'off'} [options.state] - Mode B operational state
         * @param {'manual'|'schedule'|'timer'} [options.mode] - Mode B control mode (ModeB namespace)
         * @param {'heating'|'cooling'} [options.working] - Mode B heat/cool activity
         * @param {'open'|'closed'} [options.onoff] - Mode B valve position
         * @param {boolean} [options.windowOpened] - Window opened status
         * @returns {Promise<Object>} Response from the device
         * @throws {MerossDeviceError} If mode value is invalid, temperature is out of range, or transport fails (DEVICE_UNCONNECTED, COMMAND_TIMEOUT, COMMAND_FAILED)
         */
        async set(options = {}) {
            const channel = normalizeChannel(options);

            if (options.windowOpened !== undefined) {
                return setWindowOpened(channel, options.windowOpened);
            }

            if (options.state !== undefined) {
                return setModeB(channel, options);
            }

            const modeData = await buildModePayload(this.get.bind(this), channel, options);
            const { payload } = await device.publishMessage('SET', 'Appliance.Control.Thermostat.Mode', { 'mode': [modeData] });
            return payload;
        },

        /**
         * Gets the current thermostat state for a channel.
         *
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get state for (default: 0)
         * @returns {Promise<ThermostatState|undefined>} Promise that resolves with thermostat state or undefined
         * @throws {MerossDeviceError} If device is not connected (DEVICE_UNCONNECTED) or command times out (COMMAND_TIMEOUT)
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            return getCachedOrFetch(
                device,
                '_thermostatStateByChannel',
                channel,
                () =>
                    device.publishMessage('GET', 'Appliance.Control.Thermostat.Mode', {
                        mode: [{ channel }]
                    })
            );
        },

        /**
         * Gets the thermostat mode B from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get mode B for (default: 0)
         * @returns {Promise<Object>} Response containing thermostat mode B
         * @throws {MerossDeviceError} If the device does not support the ModeB namespace (code COMMAND_FAILED)
         */
        async getModeB(options = {}) {
            const channel = normalizeChannel(options);
            if (!device.abilities || !device.abilities['Appliance.Control.Thermostat.ModeB']) {
                throw new MerossDeviceError(
                    'Device does not support Appliance.Control.Thermostat.ModeB namespace',
                    'COMMAND_FAILED',
                    { namespace: 'Appliance.Control.Thermostat.ModeB', channel, deviceUuid: device.uuid }
                );
            }

            const payload = { 'modeB': [{ channel }] };
            const { payload: modeBPayload } = await device.publishMessage('GET', 'Appliance.Control.Thermostat.ModeB', payload);
            return modeBPayload;
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
            const { payload: response } = await device.publishMessage('GET', 'Appliance.Control.Thermostat.WindowOpened', payload);
            return response;
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
            const { payload: response } = await device.publishMessage('GET', 'Appliance.Control.Thermostat.Schedule', payload);
            return response;
        },

        /**
         * Sets the thermostat schedule.
         *
         * @param {Object} scheduleData - Schedule data object (array of schedule items)
         * @returns {Promise<Object>} Response from the device
         */
        async setSchedule(scheduleData) {
            const payload = { schedule: Array.isArray(scheduleData) ? scheduleData : [scheduleData] };
            const { payload: response } = await device.publishMessage('SET', 'Appliance.Control.Thermostat.Schedule', payload);
            return response;
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
            const { payload: response } = await device.publishMessage('GET', 'Appliance.Control.Thermostat.Timer', payload);
            return response;
        },

        /**
         * Sets the thermostat timer configuration.
         *
         * @param {Object} timerData - Timer data object (array of timer items)
         * @returns {Promise<Object>} Response from the device
         */
        async setTimer(timerData) {
            const payload = { timer: Array.isArray(timerData) ? timerData : [timerData] };
            const { payload: response } = await device.publishMessage('SET', 'Appliance.Control.Thermostat.Timer', payload);
            return response;
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
            const { payload: response } = await device.publishMessage('SETACK', 'Appliance.Control.Thermostat.Alarm', payload);
            return response;
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
            const { payload: response } = await device.publishMessage('GET', 'Appliance.Control.Thermostat.HoldAction', payload);
            return response;
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
                throw new MerossDeviceError('holdActionData is required', 'VALIDATION_ERROR', { field: 'holdActionData' });
            }
            const payload = { holdAction: Array.isArray(options.holdActionData) ? options.holdActionData : [options.holdActionData] };
            const { payload: response } = await device.publishMessage('SET', 'Appliance.Control.Thermostat.HoldAction', payload);
            return response;
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
            const { payload: response } = await device.publishMessage('GET', 'Appliance.Control.Thermostat.Overheat', payload);
            return response;
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
                throw new MerossDeviceError('overheatData is required', 'VALIDATION_ERROR', { field: 'overheatData' });
            }
            const payload = { overheat: Array.isArray(options.overheatData) ? options.overheatData : [options.overheatData] };
            const { payload: response } = await device.publishMessage('SET', 'Appliance.Control.Thermostat.Overheat', payload);
            return response;
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
            const { payload: response } = await device.publishMessage('GET', 'Appliance.Control.Thermostat.DeadZone', payload);
            return response;
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
                throw new MerossDeviceError('deadZoneData is required', 'VALIDATION_ERROR', { field: 'deadZoneData' });
            }
            const payload = { deadZone: Array.isArray(options.deadZoneData) ? options.deadZoneData : [options.deadZoneData] };
            const { payload: response } = await device.publishMessage('SET', 'Appliance.Control.Thermostat.DeadZone', payload);
            return response;
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
            const { payload: response } = await device.publishMessage('GET', 'Appliance.Control.Thermostat.Calibration', payload);
            return response;
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
                throw new MerossDeviceError('calibrationData is required', 'VALIDATION_ERROR', { field: 'calibrationData' });
            }
            const payload = { calibration: Array.isArray(options.calibrationData) ? options.calibrationData : [options.calibrationData] };
            const { payload: response } = await device.publishMessage('SET', 'Appliance.Control.Thermostat.Calibration', payload);
            return response;
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
            const { payload: response } = await device.publishMessage('GET', 'Appliance.Control.Thermostat.Sensor', payload);
            return response;
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
                throw new MerossDeviceError('sensorData is required', 'VALIDATION_ERROR', { field: 'sensorData' });
            }
            const payload = { sensor: Array.isArray(options.sensorData) ? options.sensorData : [options.sensorData] };
            const { payload: response } = await device.publishMessage('SET', 'Appliance.Control.Thermostat.Sensor', payload);
            return response;
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
            const { payload: response } = await device.publishMessage('GET', 'Appliance.Control.Thermostat.SummerMode', payload);
            return response;
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
                throw new MerossDeviceError('summerModeData is required', 'VALIDATION_ERROR', { field: 'summerModeData' });
            }
            const payload = { summerMode: Array.isArray(options.summerModeData) ? options.summerModeData : [options.summerModeData] };
            const { payload: response } = await device.publishMessage('SET', 'Appliance.Control.Thermostat.SummerMode', payload);
            return response;
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
            const { payload: response } = await device.publishMessage('GET', 'Appliance.Control.Thermostat.Frost', payload);
            return response;
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
                throw new MerossDeviceError('frostData is required', 'VALIDATION_ERROR', { field: 'frostData' });
            }
            const payload = { frost: Array.isArray(options.frostData) ? options.frostData : [options.frostData] };
            const { payload: response } = await device.publishMessage('SET', 'Appliance.Control.Thermostat.Frost', payload);
            return response;
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
            const { payload: response } = await device.publishMessage('GET', 'Appliance.Control.Thermostat.AlarmConfig', payload);
            return response;
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
                throw new MerossDeviceError('alarmConfigData is required', 'VALIDATION_ERROR', { field: 'alarmConfigData' });
            }
            const payload = { alarmConfig: Array.isArray(options.alarmConfigData) ? options.alarmConfigData : [options.alarmConfigData] };
            const { payload: response } = await device.publishMessage('SET', 'Appliance.Control.Thermostat.AlarmConfig', payload);
            return response;
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
            const { payload: response } = await device.publishMessage('GET', 'Appliance.Control.Thermostat.CompressorDelay', payload);
            return response;
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
                throw new MerossDeviceError('delayData is required', 'VALIDATION_ERROR', { field: 'delayData' });
            }
            const payload = { delay: Array.isArray(options.delayData) ? options.delayData : [options.delayData] };
            const { payload: response } = await device.publishMessage('SET', 'Appliance.Control.Thermostat.CompressorDelay', payload);
            return response;
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
            const { payload: response } = await device.publishMessage('GET', 'Appliance.Control.Thermostat.CtlRange', payload);
            return response;
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
                throw new MerossDeviceError('ctlRangeData is required', 'VALIDATION_ERROR', { field: 'ctlRangeData' });
            }
            const payload = { ctlRange: Array.isArray(options.ctlRangeData) ? options.ctlRangeData : [options.ctlRangeData] };
            const { payload: response } = await device.publishMessage('SET', 'Appliance.Control.Thermostat.CtlRange', payload);
            return response;
        }
    };
}

/**
 * Gets thermostat capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Thermostat capability object or null if not supported
 */
function getThermostatCapabilities(device, channelIds) {
    const hasThermostatMode = !!device.abilities['Appliance.Control.Thermostat.Mode'];
    const hasThermostatModeB = !!device.abilities['Appliance.Control.Thermostat.ModeB'];

    if (!hasThermostatMode && !hasThermostatModeB) {return null;}

    return {
        supported: true,
        channels: channelIds,
        modeB: hasThermostatModeB,
        schedule: !!device.abilities['Appliance.Control.Thermostat.Schedule'],
        windowOpened: !!device.abilities['Appliance.Control.Thermostat.WindowOpened'],
        sensor: !!device.abilities['Appliance.Control.Thermostat.Sensor'],
        summerMode: !!device.abilities['Appliance.Control.Thermostat.SummerMode'],
        holdAction: !!device.abilities['Appliance.Control.Thermostat.HoldAction'],
        calibration: !!device.abilities['Appliance.Control.Thermostat.Calibration'],
        deadZone: !!device.abilities['Appliance.Control.Thermostat.DeadZone'],
        frost: !!device.abilities['Appliance.Control.Thermostat.Frost'],
        overheat: !!device.abilities['Appliance.Control.Thermostat.Overheat']
    };
}

registerNamespaceDescriptor('Appliance.Control.Thermostat.Mode', {
    namespace: 'Appliance.Control.Thermostat.Mode',
    payloadKey: 'mode',
    stateMap: '_thermostatStateByChannel',
    StateClass: ThermostatState,
    eventType: 'thermostat',
    snapshot: (s) => ({
        mode: s.mode,
        targetTemp: s.targetTemperatureCelsius,
        currentTemp: s.currentTemperatureCelsius
    })
});

registerNamespaceDescriptor('Appliance.Control.Thermostat.ModeB', {
    namespace: 'Appliance.Control.Thermostat.ModeB',
    payloadKey: 'modeB',
    stateMap: '_thermostatStateByChannel',
    StateClass: ThermostatState,
    eventType: 'thermostat',
    snapshot: (s) => ({
        mode: s.modeBMode ?? s.mode,
        state: s.state,
        workingMode: s.workingMode,
        targetTemp: s.targetTemperatureCelsius,
        currentTemp: s.currentTemperatureCelsius
    })
});

module.exports = createThermostatAbility;
module.exports.getCapabilities = getThermostatCapabilities;
module.exports.ability = {
    key: 'thermostat',
    namespaces: [
        'Appliance.Control.Thermostat.Mode',
        'Appliance.Control.Thermostat.ModeB'
    ],
    caches: ['_thermostatStateByChannel'],
    create: createThermostatAbility,
    getCapabilities: getThermostatCapabilities
};
