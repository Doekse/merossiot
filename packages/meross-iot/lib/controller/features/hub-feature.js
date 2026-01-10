'use strict';

const { parsePushNotification } = require('../../model/push');

/**
 * Push notification namespace to data key mapping for hub features.
 *
 * Maps Meross push notification namespaces to their corresponding data keys in the notification payload.
 */
const PUSH_MAP = {
    // Basic hub functionality
    'Appliance.Hub.Online': 'online',
    'Appliance.Hub.ToggleX': 'togglex',
    'Appliance.Hub.Battery': 'battery',
    'Appliance.Hub.Sensor.WaterLeak': 'waterLeak',

    // Sensor hub functionality
    'Appliance.Hub.Sensor.All': 'all',
    'Appliance.Hub.Sensor.TempHum': 'tempHum',
    'Appliance.Hub.Sensor.Alert': 'alert',
    'Appliance.Hub.Sensor.Smoke': 'smokeAlarm',
    'Appliance.Control.Sensor.LatestX': 'latest',

    // MTS100 thermostat hub functionality
    'Appliance.Hub.Mts100.All': 'all',
    'Appliance.Hub.Mts100.Mode': 'mode',
    'Appliance.Hub.Mts100.Temperature': 'temperature'
};

/**
 * Hub feature module.
 * Provides functionality for hub devices including sensor management, MTS100 thermostat control,
 * and automatic routing of push notifications to subdevices.
 */
module.exports = {
    /**
     * Handles push notifications for hub functionality.
     *
     * Routes notifications to appropriate subdevices based on the namespace. This method is called
     * automatically by the base device when push notifications are received.
     *
     * @param {string} namespace - The namespace of the push notification
     * @param {Object} data - The push notification data
     * @returns {boolean} True if the notification was handled locally, false otherwise
     * @private
     */
    handlePushNotification(namespace, data) {
        const dataKey = PUSH_MAP[namespace];

        if (!dataKey) {
            return false;
        }

        const payload = data[dataKey];
        if (!payload) {
            const logger = this.cloudInst?.options?.logger || console.warn;
            logger(`${this.constructor.name} could not find ${dataKey} attribute in push notification data: ${JSON.stringify(data)}`);
            return false;
        }

        const notification = parsePushNotification(namespace, data, this.uuid);
        if (notification && typeof notification.routeToSubdevices === 'function') {
            notification.routeToSubdevices(this);
        }

        return true;
    },

    /**
     * Collects subdevice IDs, separating sensors from MTS100 thermostats.
     *
     * Uses registered subdevices if available, otherwise falls back to subDeviceList array.
     *
     * @returns {{sensorIds: string[], mts100Ids: string[]}} Object containing arrays of sensor and MTS100 IDs
     * @private
     */
    _collectSubdeviceIds() {
        const subdevices = this.getSubdevices();
        const sensorIds = [];
        const mts100Ids = [];

        if (subdevices.length > 0) {
            // Use registered subdevices
            for (const sub of subdevices) {
                if (sub.type === 'mts100v3') {
                    mts100Ids.push(sub.subdeviceId);
                } else {
                    sensorIds.push(sub.subdeviceId);
                }
            }
        } else if (this.subDeviceList && Array.isArray(this.subDeviceList) && this.subDeviceList.length > 0) {
            // Fallback to old array-based approach if subdevices not yet registered
            for (const sub of this.subDeviceList) {
                const subType = sub.subDeviceType || sub.type;
                const subId = sub.subDeviceId || sub.id;

                if (subType === 'mts100v3') {
                    mts100Ids.push(subId);
                } else {
                    sensorIds.push(subId);
                }
            }
        }

        return { sensorIds, mts100Ids };
    },

    /**
     * Updates sensor subdevices by fetching sensor data, latest readings, and battery status.
     *
     * @param {string[]} sensorIds - Array of sensor subdevice IDs to update
     * @returns {Promise<void>} Promise that resolves when sensor update is complete
     * @private
     */
    async _updateSensorSubdevices(sensorIds) {
        if (sensorIds.length === 0) {
            return;
        }

        await this.getAllSensors(sensorIds);

        try {
            if (typeof this.getLatestHubSensorReadings === 'function') {
                await this.getLatestHubSensorReadings(sensorIds, ['light', 'temp', 'humi']);
            }
        } catch (latestError) {
            const logger = this.cloudInst?.options?.logger || console.debug;
            logger(`Failed to fetch latest sensor readings: ${latestError.message}`);
        }

        try {
            if (typeof this.getHubBattery === 'function') {
                await this.getHubBattery();
            }
        } catch (batteryError) {
            const logger = this.cloudInst?.options?.logger || console.debug;
            logger(`Failed to update battery data: ${batteryError.message}`);
        }
    },

    /**
     * Updates MTS100 thermostat subdevices.
     *
     * @param {string[]} mts100Ids - Array of MTS100 subdevice IDs to update
     * @returns {Promise<void>} Promise that resolves when MTS100 update is complete
     * @private
     */
    async _updateMts100Subdevices(mts100Ids) {
        if (mts100Ids.length === 0) {
            return;
        }

        await this.getMts100All(mts100Ids);
    },

    /**
     * Overrides refreshState to update hub subdevices.
     *
     * Calls the parent refreshState implementation and then updates all hub subdevices
     * automatically (sensors and MTS100 thermostats).
     *
     * @returns {Promise<void>} Promise that resolves when state is refreshed
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async refreshState() {
        const { sensorIds, mts100Ids } = this._collectSubdeviceIds();

        try {
            await this._updateSensorSubdevices(sensorIds);
            await this._updateMts100Subdevices(mts100Ids);
        } catch (error) {
            const logger = this.cloudInst?.options?.logger || console.error;
            logger(`Error occurred during hub subdevice update: ${error.message}`);
        }
    },

    // ===== Basic Hub Functionality =====

    /**
     * Gets the hub's battery status.
     *
     * Automatically routes battery data to the appropriate subdevices when the response is received.
     *
     * @returns {Promise<Object>} Promise that resolves with battery data containing `battery` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getHubBattery() {
        const payload = { 'battery': [] };
        const response = await this.publishMessage('GET', 'Appliance.Hub.Battery', payload, null);

        if (response && response.battery && Array.isArray(response.battery)) {
            for (const batteryData of response.battery) {
                const subdeviceId = batteryData.id;
                const subdevice = this.getSubdevice(subdeviceId);
                if (subdevice && typeof subdevice.handleSubdeviceNotification === 'function') {
                    await subdevice.handleSubdeviceNotification('Appliance.Hub.Battery', batteryData);
                }
            }
        }

        return response;
    },

    /**
     * Gets the hub's online status.
     *
     * @returns {Promise<Object>} Promise that resolves with online status data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getHubOnline() {
        return await this.publishMessage('GET', 'Appliance.Hub.Online', {});
    },

    /**
     * Controls a hub toggleX subdevice (on/off).
     *
     * @param {string} subId - Subdevice ID
     * @param {boolean} onoff - True to turn on, false to turn off
     * @returns {Promise<Object>} Promise that resolves with response data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setHubToggleX(subId, onoff) {
        const payload = { 'togglex': [{ 'id': subId, 'onoff': onoff ? 1 : 0 }] };
        return await this.publishMessage('SET', 'Appliance.Hub.ToggleX', payload);
    },

    /**
     * Gets the hub's exception information.
     *
     * @returns {Promise<Object>} Promise that resolves with exception data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getHubException() {
        return await this.publishMessage('GET', 'Appliance.Hub.Exception', {});
    },

    /**
     * Gets the hub's report information.
     *
     * @returns {Promise<Object>} Promise that resolves with report data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getHubReport() {
        return await this.publishMessage('GET', 'Appliance.Hub.Report', {});
    },

    /**
     * Initiates pairing of a subdevice to the hub.
     *
     * @returns {Promise<Object>} Promise that resolves with response data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setHubPairSubDev() {
        return await this.publishMessage('SET', 'Appliance.Hub.PairSubDev', {});
    },

    /**
     * Controls the beep/buzzer of a hub subdevice.
     *
     * @param {string|Array<string>} subIds - Subdevice ID(s) to control
     * @param {boolean} onoff - True to turn on buzzer, false to turn off
     * @returns {Promise<Object>} Promise that resolves with response data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setHubSubDeviceBeep(subIds, onoff) {
        const payload = { 'alarm': [] };
        const ids = Array.isArray(subIds) ? subIds : [subIds];
        ids.forEach(id => payload.alarm.push({ id, onoff: onoff ? 1 : 0 }));
        return await this.publishMessage('SET', 'Appliance.Hub.SubDevice.Beep', payload);
    },

    /**
     * Gets the beep/buzzer status of hub subdevices.
     *
     * @param {string|Array<string>} subIds - Subdevice ID(s) to query
     * @returns {Promise<Object>} Promise that resolves with beep status data containing `alarm` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getHubSubDeviceBeep(subIds) {
        const payload = { 'alarm': [] };
        const ids = Array.isArray(subIds) ? subIds : [subIds];
        ids.forEach(id => payload.alarm.push({ id }));
        return await this.publishMessage('GET', 'Appliance.Hub.SubDevice.Beep', payload);
    },

    /**
     * Gets the motor adjustment schedule for hub subdevices.
     *
     * @param {string|Array<string>} subIds - Subdevice ID(s) to query
     * @returns {Promise<Object>} Promise that resolves with motor adjustment data containing `adjust` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getHubSubDeviceMotorAdjust(subIds) {
        const payload = { 'adjust': [] };
        const ids = Array.isArray(subIds) ? subIds : [subIds];
        ids.forEach(id => payload.adjust.push({ id }));
        return await this.publishMessage('GET', 'Appliance.Hub.SubDevice.MotorAdjust', payload);
    },

    /**
     * Controls the motor adjustment schedule for hub subdevices.
     *
     * @param {Object|Array<Object>} adjustData - Motor adjustment data
     * @param {string} [adjustData.id] - Subdevice ID
     * @param {number} [adjustData.days] - Days for schedule
     * @param {number} [adjustData.minutes] - Minutes for schedule
     * @param {boolean} [adjustData.enable] - Enable/disable schedule
     * @returns {Promise<Object>} Promise that resolves with response data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setHubSubDeviceMotorAdjust(adjustData) {
        const payload = { 'adjust': Array.isArray(adjustData) ? adjustData : [adjustData] };
        return await this.publishMessage('SET', 'Appliance.Hub.SubDevice.MotorAdjust', payload);
    },

    /**
     * Gets the version information for hub subdevices.
     *
     * @param {string|Array<string>} [subIds=[]] - Subdevice ID(s), empty array gets all
     * @returns {Promise<Object>} Promise that resolves with version data containing `version` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getHubSubDeviceVersion(subIds = []) {
        const payload = { 'version': [] };
        if (Array.isArray(subIds) && subIds.length > 0) {
            subIds.forEach(id => payload.version.push({ id }));
        }
        return await this.publishMessage('GET', 'Appliance.Hub.SubDevice.Version', payload);
    },

    // ===== Sensor Hub Functionality =====

    /**
     * Gets all sensor data for specified sensor IDs.
     *
     * @param {string|Array<string>} sensorIds - Single sensor ID or array of sensor IDs
     * @returns {Promise<Object>} Promise that resolves with sensor data containing `all` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getAllSensors(sensorIds) {
        const payload = { 'all': [] };
        if (Array.isArray(sensorIds)) {
            sensorIds.forEach(id => payload.all.push({ id }));
        } else {
            payload.all.push({ id: sensorIds });
        }

        const response = await this.publishMessage('GET', 'Appliance.Hub.Sensor.All', payload);

        if (response && response.all && Array.isArray(response.all)) {
            for (const sensorData of response.all) {
                const subdeviceId = sensorData.id;
                const subdevice = this.getSubdevice(subdeviceId);
                if (subdevice && typeof subdevice.handleSubdeviceNotification === 'function') {
                    await subdevice.handleSubdeviceNotification('Appliance.Hub.Sensor.All', sensorData);
                }
            }
        }

        return response;
    },

    /**
     * Gets latest sensor readings (temperature, humidity, and light/lux) for specified sensor IDs.
     *
     * This method fetches the most recent readings including lux data which is not available
     * in getAllSensors. The data is automatically routed to the appropriate subdevices.
     *
     * @param {string|Array<string>} sensorIds - Single sensor ID or array of sensor IDs
     * @param {Array<string>} [dataTypes=['light', 'temp', 'humi']] - Array of data types to request
     * @returns {Promise<Object>} Promise that resolves with latest sensor data containing `latest` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getLatestHubSensorReadings(sensorIds, dataTypes = ['light', 'temp', 'humi']) {
        const payload = { 'latest': [] };
        const sensorIdArray = Array.isArray(sensorIds) ? sensorIds : [sensorIds];

        sensorIdArray.forEach(subId => {
            payload.latest.push({
                subId,
                channel: 0,
                data: dataTypes
            });
        });

        const response = await this.publishMessage('GET', 'Appliance.Control.Sensor.LatestX', payload, null);

        if (response && response.latest && Array.isArray(response.latest)) {
            for (const latestData of response.latest) {
                const subdeviceId = latestData.subId;
                const subdevice = this.getSubdevice(subdeviceId);
                if (subdevice && typeof subdevice.handleSubdeviceNotification === 'function') {
                    await subdevice.handleSubdeviceNotification('Appliance.Control.Sensor.LatestX', latestData);
                }
            }
        }

        return response;
    },

    /**
     * Gets temperature and humidity sensor data for specified sensor IDs.
     *
     * @param {string|Array<string>} sensorIds - Single sensor ID or array of sensor IDs
     * @returns {Promise<Object>} Promise that resolves with temperature/humidity data containing `tempHum` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getTempHumSensor(sensorIds) {
        const payload = { 'tempHum': [] };
        if (Array.isArray(sensorIds)) {
            sensorIds.forEach(id => payload.tempHum.push({ id }));
        } else {
            payload.tempHum.push({ id: sensorIds });
        }
        return await this.publishMessage('GET', 'Appliance.Hub.Sensor.TempHum', payload);
    },

    /**
     * Gets alert sensor data for specified sensor IDs.
     *
     * @param {string|Array<string>} sensorIds - Single sensor ID or array of sensor IDs
     * @returns {Promise<Object>} Promise that resolves with alert sensor data containing `alert` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getAlertSensor(sensorIds) {
        const payload = { 'alert': [] };
        if (Array.isArray(sensorIds)) {
            sensorIds.forEach(id => payload.alert.push({ id }));
        } else {
            payload.alert.push({ id: sensorIds });
        }
        return await this.publishMessage('GET', 'Appliance.Hub.Sensor.Alert', payload);
    },

    /**
     * Gets smoke alarm status for specified smoke detector IDs.
     *
     * The data is automatically routed to the appropriate subdevices.
     *
     * @param {string|Array<string>} sensorIds - Single sensor ID or array of sensor IDs
     * @returns {Promise<Object>} Promise that resolves with smoke alarm status data containing `smokeAlarm` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getSmokeAlarmStatus(sensorIds) {
        const payload = { 'smokeAlarm': [] };
        if (Array.isArray(sensorIds)) {
            sensorIds.forEach(id => payload.smokeAlarm.push({ id }));
        } else {
            payload.smokeAlarm.push({ id: sensorIds });
        }

        const response = await this.publishMessage('GET', 'Appliance.Hub.Sensor.Smoke', payload);

        if (response && response.smokeAlarm && Array.isArray(response.smokeAlarm)) {
            for (const smokeData of response.smokeAlarm) {
                const subdeviceId = smokeData.id;
                const subdevice = this.getSubdevice(subdeviceId);
                if (subdevice && typeof subdevice.handleSubdeviceNotification === 'function') {
                    await subdevice.handleSubdeviceNotification('Appliance.Hub.Sensor.Smoke', smokeData);
                }
            }
        }

        return response;
    },

    /**
     * Gets water leak sensor data for specified sensor IDs.
     *
     * @param {string|Array<string>} sensorIds - Single sensor ID or array of sensor IDs
     * @returns {Promise<Object>} Promise that resolves with water leak sensor data containing `waterleak` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getWaterLeakSensor(sensorIds) {
        const payload = { 'waterleak': [] };
        if (Array.isArray(sensorIds)) {
            sensorIds.forEach(id => payload.waterleak.push({ id }));
        } else {
            payload.waterleak.push({ id: sensorIds });
        }
        return await this.publishMessage('GET', 'Appliance.Hub.Sensor.WaterLeak', payload);
    },

    /**
     * Gets sensor adjustment (calibration) settings for specified sensor IDs.
     *
     * @param {string|Array<string>} [sensorIds=[]] - Single sensor ID or array of sensor IDs, empty array gets all
     * @returns {Promise<Object>} Promise that resolves with sensor adjustment data containing `adjust` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getHubSensorAdjust(sensorIds = []) {
        const payload = { 'adjust': [] };
        if (Array.isArray(sensorIds) && sensorIds.length > 0) {
            sensorIds.forEach(id => payload.adjust.push({ id }));
        }
        return await this.publishMessage('GET', 'Appliance.Hub.Sensor.Adjust', payload);
    },

    /**
     * Controls (sets) sensor adjustment (calibration) settings.
     *
     * @param {Object|Array<Object>} adjustData - Sensor adjustment data
     * @param {string} [adjustData.id] - Sensor ID
     * @param {number} [adjustData.temperature] - Temperature adjustment offset
     * @param {number} [adjustData.humidity] - Humidity adjustment offset
     * @returns {Promise<Object>} Promise that resolves with response data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setHubSensorAdjust(adjustData) {
        const payload = { 'adjust': Array.isArray(adjustData) ? adjustData : [adjustData] };
        return await this.publishMessage('SET', 'Appliance.Hub.Sensor.Adjust', payload);
    },

    /**
     * Gets door/window sensor data for specified sensor IDs.
     *
     * @param {string|Array<string>} [sensorIds=[]] - Single sensor ID or array of sensor IDs, empty array gets all (max 16)
     * @returns {Promise<Object>} Promise that resolves with door/window sensor data containing `doorWindow` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getHubSensorDoorWindow(sensorIds = []) {
        const payload = { 'doorWindow': [] };
        if (Array.isArray(sensorIds) && sensorIds.length > 0) {
            sensorIds.forEach(id => payload.doorWindow.push({ id }));
        }
        return await this.publishMessage('GET', 'Appliance.Hub.Sensor.DoorWindow', payload);
    },

    /**
     * Controls (sets) door/window sensor synchronization (if supported).
     *
     * Note: This namespace primarily supports GET and PUSH, SET may not be available for all devices.
     *
     * @param {Object|Array<Object>} doorWindowData - Door/window data
     * @returns {Promise<Object>} Promise that resolves with response data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setHubSensorDoorWindow(doorWindowData) {
        const payload = { 'doorWindow': Array.isArray(doorWindowData) ? doorWindowData : [doorWindowData] };
        return await this.publishMessage('SET', 'Appliance.Hub.Sensor.DoorWindow', payload);
    },

    // ===== MTS100 Thermostat Hub Functionality =====

    /**
     * Gets MTS100 thermostat valve data for specified IDs.
     *
     * @param {Array<string>} ids - Array of MTS100 subdevice IDs
     * @returns {Promise<Object>} Promise that resolves with MTS100 data containing `all` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getMts100All(ids) {
        const payload = { 'all': [] };
        ids.forEach(id => payload.all.push({ id }));
        return await this.publishMessage('GET', 'Appliance.Hub.Mts100.All', payload, null);
    },

    /**
     * Controls MTS100 thermostat mode.
     *
     * @param {string} subId - MTS100 subdevice ID
     * @param {number|import('../lib/enums').ThermostatMode} mode - Mode value from ThermostatMode enum
     * @returns {Promise<Object>} Promise that resolves with response data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setHubMts100Mode(subId, mode) {
        const payload = { 'mode': [{ 'id': subId, 'state': mode }] };
        return await this.publishMessage('SET', 'Appliance.Hub.Mts100.Mode', payload);
    },

    /**
     * Controls MTS100 thermostat temperature settings.
     *
     * Mutates the temp object by adding the subId property before sending the command.
     *
     * @param {string} subId - MTS100 subdevice ID
     * @param {Object} temp - Temperature object (will be mutated with subId)
     * @param {number} [temp.temperature] - Target temperature
     * @param {number} [temp.min] - Minimum temperature
     * @param {number} [temp.max] - Maximum temperature     * @returns {Promise<Object>} Promise that resolves with response data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setHubMts100Temperature(subId, temp) {
        temp.id = subId;
        const payload = { 'temperature': [temp] };
        return await this.publishMessage('SET', 'Appliance.Hub.Mts100.Temperature', payload);
    },

    /**
     * Controls MTS100 thermostat adjustment settings.
     *
     * Mutates the adjustData object by adding the subId property before sending the command.
     *
     * @param {string} subId - MTS100 subdevice ID
     * @param {Object} adjustData - Adjustment data object (will be mutated with subId)
     * @returns {Promise<Object>} Promise that resolves with response data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setHubMts100Adjust(subId, adjustData) {
        adjustData.id = subId;
        const payload = { 'adjust': [adjustData] };
        return await this.publishMessage('SET', 'Appliance.Hub.Mts100.Adjust', payload);
    },

    /**
     * Gets MTS100 adjustment settings for specified IDs.
     *
     * @param {Array<string>} ids - Array of MTS100 subdevice IDs
     * @returns {Promise<Object>} Promise that resolves with adjustment data containing `adjust` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getMts100Adjust(ids) {
        const payload = { 'adjust': [] };
        ids.forEach(id => payload.adjust.push({ id }));
        return await this.publishMessage('GET', 'Appliance.Hub.Mts100.Adjust', payload);
    },

    /**
     * Gets MTS100 super control data for specified IDs.
     *
     * @param {Array<string>} ids - Array of MTS100 subdevice IDs
     * @returns {Promise<Object>} Promise that resolves with super control data containing `superCtl` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getMts100SuperCtl(ids) {
        const payload = { 'superCtl': [] };
        ids.forEach(id => payload.superCtl.push({ id }));
        return await this.publishMessage('GET', 'Appliance.Hub.Mts100.SuperCtl', payload);
    },

    /**
     * Gets MTS100 schedule B data for specified IDs.
     *
     * @param {Array<string>} ids - Array of MTS100 subdevice IDs
     * @returns {Promise<Object>} Promise that resolves with schedule B data containing `scheduleB` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getMts100ScheduleB(ids) {
        const payload = { 'scheduleB': [] };
        ids.forEach(id => payload.scheduleB.push({ id }));
        return await this.publishMessage('GET', 'Appliance.Hub.Mts100.ScheduleB', payload);
    },

    /**
     * Gets MTS100 configuration for specified IDs.
     *
     * @param {Array<string>} ids - Array of MTS100 subdevice IDs
     * @returns {Promise<Object>} Promise that resolves with configuration data containing `config` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getMts100Config(ids) {
        const payload = { 'config': [] };
        ids.forEach(id => payload.config.push({ id }));
        return await this.publishMessage('GET', 'Appliance.Hub.Mts100.Config', payload);
    }
};

