'use strict';

const { parsePushNotification } = require('../../model/push');

const PUSH_MAP = {
    'Appliance.Hub.Online': 'online',
    'Appliance.Hub.ToggleX': 'togglex',
    'Appliance.Hub.Battery': 'battery',
    'Appliance.Hub.Sensor.WaterLeak': 'waterLeak',
    'Appliance.Hub.Sensor.All': 'all',
    'Appliance.Hub.Sensor.TempHum': 'tempHum',
    'Appliance.Hub.Sensor.Alert': 'alert',
    'Appliance.Hub.Sensor.Smoke': 'smokeAlarm',
    'Appliance.Control.Sensor.LatestX': 'latest',
    'Appliance.Hub.Mts100.All': 'all',
    'Appliance.Hub.Mts100.Mode': 'mode',
    'Appliance.Hub.Mts100.Temperature': 'temperature'
};

/**
 * Handles push notifications for hub functionality.
 *
 * Routes notifications to appropriate subdevices based on the namespace.
 *
 * @param {Object} device - The device instance
 * @param {string} namespace - The namespace of the push notification
 * @param {Object} data - The push notification data
 * @returns {boolean} True if the notification was handled locally, false otherwise
 */
function handlePushNotification(device, namespace, data) {
    const dataKey = PUSH_MAP[namespace];

    if (!dataKey) {
        return false;
    }

    const payload = data[dataKey];
    if (!payload) {
        const logger = device.cloudInst?.options?.logger || console.warn;
        logger(`${device.constructor.name} could not find ${dataKey} attribute in push notification data: ${JSON.stringify(data)}`);
        return false;
    }

    const notification = parsePushNotification(namespace, data, device.uuid);
    if (notification && typeof notification.routeToSubdevices === 'function') {
        notification.routeToSubdevices(device);
    }

    return true;
}

/**
 * Creates a hub feature object for a device.
 *
 * Provides functionality for hub devices including sensor management, MTS100 thermostat control,
 * and automatic routing of push notifications to subdevices.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Hub feature object with various hub methods
 */
function createHubFeature(device) {
    /**
     * Collects subdevice IDs, separating sensors from MTS100 thermostats.
     *
     * @returns {{sensorIds: string[], mts100Ids: string[]}} Object containing arrays of sensor and MTS100 IDs
     * @private
     */
    function collectSubdeviceIds() {
        const subdevices = device.getSubdevices();
        const sensorIds = [];
        const mts100Ids = [];

        if (subdevices.length > 0) {
            for (const sub of subdevices) {
                if (sub.type === 'mts100v3') {
                    mts100Ids.push(sub.subdeviceId);
                } else {
                    sensorIds.push(sub.subdeviceId);
                }
            }
        } else if (device.subDeviceList && Array.isArray(device.subDeviceList) && device.subDeviceList.length > 0) {
            for (const sub of device.subDeviceList) {
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
    }

    /**
     * Updates sensor subdevices by fetching sensor data, latest readings, and battery status.
     *
     * @param {string[]} sensorIds - Array of sensor subdevice IDs to update
     * @returns {Promise<void>} Promise that resolves when sensor update is complete
     * @private
     */
    async function updateSensorSubdevices(sensorIds) {
        if (sensorIds.length === 0) {
            return;
        }

        await hubFeature.getAllSensors(sensorIds);

        try {
            if (typeof hubFeature.getLatestSensorReadings === 'function') {
                await hubFeature.getLatestSensorReadings({ sensorIds, dataTypes: ['light', 'temp', 'humi'] });
            }
        } catch (latestError) {
            const logger = device.cloudInst?.options?.logger || console.debug;
            logger(`Failed to fetch latest sensor readings: ${latestError.message}`);
        }

        try {
            if (typeof hubFeature.getBattery === 'function') {
                await hubFeature.getBattery();
            }
        } catch (batteryError) {
            const logger = device.cloudInst?.options?.logger || console.debug;
            logger(`Failed to update battery data: ${batteryError.message}`);
        }
    }

    /**
     * Updates MTS100 thermostat subdevices.
     *
     * @param {string[]} mts100Ids - Array of MTS100 subdevice IDs to update
     * @returns {Promise<void>} Promise that resolves when MTS100 update is complete
     * @private
     */
    async function updateMts100Subdevices(mts100Ids) {
        if (mts100Ids.length === 0) {
            return;
        }

        await hubFeature.getMts100All({ ids: mts100Ids });
    }

    const hubFeature = {
        /**
         * Refreshes hub device state and all registered subdevices.
         *
         * @returns {Promise<void>} Promise that resolves when state is refreshed
         */
        async refreshState() {
            const { sensorIds, mts100Ids } = collectSubdeviceIds();

            try {
                await updateSensorSubdevices(sensorIds);
                await updateMts100Subdevices(mts100Ids);
            } catch (error) {
                const logger = device.cloudInst?.options?.logger || console.error;
                logger(`Error occurred during hub subdevice update: ${error.message}`);
            }
        },

        /**
         * Gets the hub's battery status.
         *
         * @returns {Promise<Object>} Promise that resolves with battery data containing `battery` array
         */
        async getBattery() {
            const payload = { 'battery': [] };
            const response = await device.publishMessage('GET', 'Appliance.Hub.Battery', payload, null);

            if (response && response.battery && Array.isArray(response.battery)) {
                for (const batteryData of response.battery) {
                    const subdeviceId = batteryData.id;
                    const subdevice = device.getSubdevice(subdeviceId);
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
         */
        async getOnline() {
            return await device.publishMessage('GET', 'Appliance.Hub.Online', {});
        },

        /**
         * Controls a hub toggleX subdevice (on/off).
         *
         * @param {Object} options - Toggle options
         * @param {string} options.subId - Subdevice ID
         * @param {boolean} options.on - True to turn on, false to turn off
         * @returns {Promise<Object>} Promise that resolves with response data
         */
        async setToggle(options) {
            const { subId, on } = options;
            const payload = { 'togglex': [{ 'id': subId, 'onoff': on ? 1 : 0 }] };
            return await device.publishMessage('SET', 'Appliance.Hub.ToggleX', payload);
        },

        /**
         * Gets the hub's exception information.
         *
         * @returns {Promise<Object>} Promise that resolves with exception data
         */
        async getException() {
            return await device.publishMessage('GET', 'Appliance.Hub.Exception', {});
        },

        /**
         * Gets the hub's report information.
         *
         * @returns {Promise<Object>} Promise that resolves with report data
         */
        async getReport() {
            return await device.publishMessage('GET', 'Appliance.Hub.Report', {});
        },

        /**
         * Initiates pairing of a subdevice to the hub.
         *
         * @returns {Promise<Object>} Promise that resolves with response data
         */
        async pairSubDev() {
            return await device.publishMessage('SET', 'Appliance.Hub.PairSubDev', {});
        },

        /**
         * Controls the beep/buzzer of a hub subdevice.
         *
         * @param {Object} options - Beep options
         * @param {string|Array<string>} options.subIds - Subdevice ID(s) to control
         * @param {boolean} options.onoff - True to turn on buzzer, false to turn off
         * @returns {Promise<Object>} Promise that resolves with response data
         */
        async setSubDeviceBeep(options) {
            const { subIds, onoff } = options;
            const payload = { 'alarm': [] };
            const ids = Array.isArray(subIds) ? subIds : [subIds];
            ids.forEach(id => payload.alarm.push({ id, onoff: onoff ? 1 : 0 }));
            return await device.publishMessage('SET', 'Appliance.Hub.SubDevice.Beep', payload);
        },

        /**
         * Gets the beep/buzzer status of hub subdevices.
         *
         * @param {Object} options - Get options
         * @param {string|Array<string>} options.subIds - Subdevice ID(s) to query
         * @returns {Promise<Object>} Promise that resolves with beep status data containing `alarm` array
         */
        async getSubDeviceBeep(options) {
            const { subIds } = options;
            const payload = { 'alarm': [] };
            const ids = Array.isArray(subIds) ? subIds : [subIds];
            ids.forEach(id => payload.alarm.push({ id }));
            return await device.publishMessage('GET', 'Appliance.Hub.SubDevice.Beep', payload);
        },

        /**
         * Gets the motor adjustment schedule for hub subdevices.
         *
         * @param {Object} options - Get options
         * @param {string|Array<string>} options.subIds - Subdevice ID(s) to query
         * @returns {Promise<Object>} Promise that resolves with motor adjustment data containing `adjust` array
         */
        async getSubDeviceMotorAdjust(options) {
            const { subIds } = options;
            const payload = { 'adjust': [] };
            const ids = Array.isArray(subIds) ? subIds : [subIds];
            ids.forEach(id => payload.adjust.push({ id }));
            return await device.publishMessage('GET', 'Appliance.Hub.SubDevice.MotorAdjust', payload);
        },

        /**
         * Controls the motor adjustment schedule for hub subdevices.
         *
         * @param {Object} options - Motor adjustment options
         * @param {Object|Array<Object>} options.adjustData - Motor adjustment data
         * @returns {Promise<Object>} Promise that resolves with response data
         */
        async setSubDeviceMotorAdjust(options) {
            const { adjustData } = options;
            const payload = { 'adjust': Array.isArray(adjustData) ? adjustData : [adjustData] };
            return await device.publishMessage('SET', 'Appliance.Hub.SubDevice.MotorAdjust', payload);
        },

        /**
         * Gets the version information for hub subdevices.
         *
         * @param {Object} [options={}] - Get options
         * @param {string|Array<string>} [options.subIds=[]] - Subdevice ID(s), empty array gets all
         * @returns {Promise<Object>} Promise that resolves with version data containing `version` array
         */
        async getSubDeviceVersion(options = {}) {
            const { subIds = [] } = options;
            const payload = { 'version': [] };
            if (Array.isArray(subIds) && subIds.length > 0) {
                subIds.forEach(id => payload.version.push({ id }));
            }
            return await device.publishMessage('GET', 'Appliance.Hub.SubDevice.Version', payload);
        },

        /**
         * Gets all sensor data for specified sensor IDs.
         *
         * @param {string|Array<string>} sensorIds - Single sensor ID or array of sensor IDs
         * @returns {Promise<Object>} Promise that resolves with sensor data containing `all` array
         */
        async getAllSensors(sensorIds) {
            const payload = { 'all': [] };
            if (Array.isArray(sensorIds)) {
                sensorIds.forEach(id => payload.all.push({ id }));
            } else {
                payload.all.push({ id: sensorIds });
            }

            const response = await device.publishMessage('GET', 'Appliance.Hub.Sensor.All', payload);

            if (response && response.all && Array.isArray(response.all)) {
                for (const sensorData of response.all) {
                    const subdeviceId = sensorData.id;
                    const subdevice = device.getSubdevice(subdeviceId);
                    if (subdevice && typeof subdevice.handleSubdeviceNotification === 'function') {
                        await subdevice.handleSubdeviceNotification('Appliance.Hub.Sensor.All', sensorData);
                    }
                }
            }

            return response;
        },

        /**
         * Gets latest sensor readings for specified sensor IDs.
         *
         * @param {Object} options - Get options
         * @param {string|Array<string>} options.sensorIds - Single sensor ID or array of sensor IDs
         * @param {Array<string>} [options.dataTypes=['light', 'temp', 'humi']] - Array of data types to request
         * @returns {Promise<Object>} Promise that resolves with latest sensor data containing `latest` array
         */
        async getLatestSensorReadings(options) {
            const { sensorIds, dataTypes = ['light', 'temp', 'humi'] } = options;
            const payload = { 'latest': [] };
            const sensorIdArray = Array.isArray(sensorIds) ? sensorIds : [sensorIds];

            sensorIdArray.forEach(subId => {
                payload.latest.push({
                    subId,
                    channel: 0,
                    data: dataTypes
                });
            });

            const response = await device.publishMessage('GET', 'Appliance.Control.Sensor.LatestX', payload, null);

            if (response && response.latest && Array.isArray(response.latest)) {
                for (const latestData of response.latest) {
                    const subdeviceId = latestData.subId;
                    const subdevice = device.getSubdevice(subdeviceId);
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
         * @param {Object} options - Get options
         * @param {string|Array<string>} options.sensorIds - Single sensor ID or array of sensor IDs
         * @returns {Promise<Object>} Promise that resolves with temperature/humidity data containing `tempHum` array
         */
        async getTempHumSensor(options) {
            const { sensorIds } = options;
            const payload = { 'tempHum': [] };
            if (Array.isArray(sensorIds)) {
                sensorIds.forEach(id => payload.tempHum.push({ id }));
            } else {
                payload.tempHum.push({ id: sensorIds });
            }
            return await device.publishMessage('GET', 'Appliance.Hub.Sensor.TempHum', payload);
        },

        /**
         * Gets alert sensor data for specified sensor IDs.
         *
         * @param {Object} options - Get options
         * @param {string|Array<string>} options.sensorIds - Single sensor ID or array of sensor IDs
         * @returns {Promise<Object>} Promise that resolves with alert sensor data containing `alert` array
         */
        async getAlertSensor(options) {
            const { sensorIds } = options;
            const payload = { 'alert': [] };
            if (Array.isArray(sensorIds)) {
                sensorIds.forEach(id => payload.alert.push({ id }));
            } else {
                payload.alert.push({ id: sensorIds });
            }
            return await device.publishMessage('GET', 'Appliance.Hub.Sensor.Alert', payload);
        },

        /**
         * Gets smoke alarm status for specified smoke detector IDs.
         *
         * @param {Object} options - Get options
         * @param {string|Array<string>} options.sensorIds - Single sensor ID or array of sensor IDs
         * @returns {Promise<Object>} Promise that resolves with smoke alarm status data containing `smokeAlarm` array
         */
        async getSmokeAlarmStatus(options) {
            const { sensorIds } = options;
            const payload = { 'smokeAlarm': [] };
            if (Array.isArray(sensorIds)) {
                sensorIds.forEach(id => payload.smokeAlarm.push({ id }));
            } else {
                payload.smokeAlarm.push({ id: sensorIds });
            }

            const response = await device.publishMessage('GET', 'Appliance.Hub.Sensor.Smoke', payload);

            if (response && response.smokeAlarm && Array.isArray(response.smokeAlarm)) {
                for (const smokeData of response.smokeAlarm) {
                    const subdeviceId = smokeData.id;
                    const subdevice = device.getSubdevice(subdeviceId);
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
         * @param {Object} options - Get options
         * @param {string|Array<string>} options.sensorIds - Single sensor ID or array of sensor IDs
         * @returns {Promise<Object>} Promise that resolves with water leak sensor data containing `waterleak` array
         */
        async getWaterLeakSensor(options) {
            const { sensorIds } = options;
            const payload = { 'waterleak': [] };
            if (Array.isArray(sensorIds)) {
                sensorIds.forEach(id => payload.waterleak.push({ id }));
            } else {
                payload.waterleak.push({ id: sensorIds });
            }
            return await device.publishMessage('GET', 'Appliance.Hub.Sensor.WaterLeak', payload);
        },

        /**
         * Gets sensor adjustment (calibration) settings for specified sensor IDs.
         *
         * @param {Object} [options={}] - Get options
         * @param {string|Array<string>} [options.sensorIds=[]] - Single sensor ID or array of sensor IDs, empty array gets all
         * @returns {Promise<Object>} Promise that resolves with sensor adjustment data containing `adjust` array
         */
        async getSensorAdjust(options = {}) {
            const { sensorIds = [] } = options;
            const payload = { 'adjust': [] };
            if (Array.isArray(sensorIds) && sensorIds.length > 0) {
                sensorIds.forEach(id => payload.adjust.push({ id }));
            }
            return await device.publishMessage('GET', 'Appliance.Hub.Sensor.Adjust', payload);
        },

        /**
         * Controls (sets) sensor adjustment (calibration) settings.
         *
         * @param {Object} options - Set options
         * @param {Object|Array<Object>} options.adjustData - Sensor adjustment data
         * @returns {Promise<Object>} Promise that resolves with response data
         */
        async setSensorAdjust(options) {
            const { adjustData } = options;
            const payload = { 'adjust': Array.isArray(adjustData) ? adjustData : [adjustData] };
            return await device.publishMessage('SET', 'Appliance.Hub.Sensor.Adjust', payload);
        },

        /**
         * Gets door/window sensor data for specified sensor IDs.
         *
         * @param {Object} [options={}] - Get options
         * @param {string|Array<string>} [options.sensorIds=[]] - Single sensor ID or array of sensor IDs, empty array gets all (max 16)
         * @returns {Promise<Object>} Promise that resolves with door/window sensor data containing `doorWindow` array
         */
        async getSensorDoorWindow(options = {}) {
            const { sensorIds = [] } = options;
            const payload = { 'doorWindow': [] };
            if (Array.isArray(sensorIds) && sensorIds.length > 0) {
                sensorIds.forEach(id => payload.doorWindow.push({ id }));
            }
            return await device.publishMessage('GET', 'Appliance.Hub.Sensor.DoorWindow', payload);
        },

        /**
         * Controls (sets) door/window sensor synchronization (if supported).
         *
         * @param {Object} options - Set options
         * @param {Object|Array<Object>} options.doorWindowData - Door/window data
         * @returns {Promise<Object>} Promise that resolves with response data
         */
        async setSensorDoorWindow(options) {
            const { doorWindowData } = options;
            const payload = { 'doorWindow': Array.isArray(doorWindowData) ? doorWindowData : [doorWindowData] };
            return await device.publishMessage('SET', 'Appliance.Hub.Sensor.DoorWindow', payload);
        },

        /**
         * Gets MTS100 thermostat valve data for specified IDs.
         *
         * @param {Object} options - Get options
         * @param {Array<string>} options.ids - Array of MTS100 subdevice IDs
         * @returns {Promise<Object>} Promise that resolves with MTS100 data containing `all` array
         */
        async getMts100All(options) {
            const { ids } = options;
            const payload = { 'all': [] };
            ids.forEach(id => payload.all.push({ id }));
            return await device.publishMessage('GET', 'Appliance.Hub.Mts100.All', payload, null);
        },

        /**
         * Controls MTS100 thermostat mode.
         *
         * @param {Object} options - Mode options
         * @param {string} options.subId - MTS100 subdevice ID
         * @param {number|import('../lib/enums').ThermostatMode} options.mode - Mode value from ThermostatMode enum
         * @returns {Promise<Object>} Promise that resolves with response data
         */
        async setMts100Mode(options) {
            const { subId, mode } = options;
            const payload = { 'mode': [{ 'id': subId, 'state': mode }] };
            return await device.publishMessage('SET', 'Appliance.Hub.Mts100.Mode', payload);
        },

        /**
         * Controls MTS100 thermostat temperature settings.
         *
         * @param {Object} options - Temperature options
         * @param {string} options.subId - MTS100 subdevice ID
         * @param {Object} options.temp - Temperature object (will be mutated with subId)
         * @returns {Promise<Object>} Promise that resolves with response data
         */
        async setMts100Temperature(options) {
            const { subId, temp } = options;
            temp.id = subId;
            const payload = { 'temperature': [temp] };
            return await device.publishMessage('SET', 'Appliance.Hub.Mts100.Temperature', payload);
        },

        /**
         * Controls MTS100 thermostat adjustment settings.
         *
         * @param {Object} options - Adjustment options
         * @param {string} options.subId - MTS100 subdevice ID
         * @param {Object} options.adjustData - Adjustment data object (will be mutated with subId)
         * @returns {Promise<Object>} Promise that resolves with response data
         */
        async setMts100Adjust(options) {
            const { subId, adjustData } = options;
            adjustData.id = subId;
            const payload = { 'adjust': [adjustData] };
            return await device.publishMessage('SET', 'Appliance.Hub.Mts100.Adjust', payload);
        },

        /**
         * Gets MTS100 adjustment settings for specified IDs.
         *
         * @param {Object} options - Get options
         * @param {Array<string>} options.ids - Array of MTS100 subdevice IDs
         * @returns {Promise<Object>} Promise that resolves with adjustment data containing `adjust` array
         */
        async getMts100Adjust(options) {
            const { ids } = options;
            const payload = { 'adjust': [] };
            ids.forEach(id => payload.adjust.push({ id }));
            return await device.publishMessage('GET', 'Appliance.Hub.Mts100.Adjust', payload);
        },

        /**
         * Gets MTS100 super control data for specified IDs.
         *
         * @param {Object} options - Get options
         * @param {Array<string>} options.ids - Array of MTS100 subdevice IDs
         * @returns {Promise<Object>} Promise that resolves with super control data containing `superCtl` array
         */
        async getMts100SuperCtl(options) {
            const { ids } = options;
            const payload = { 'superCtl': [] };
            ids.forEach(id => payload.superCtl.push({ id }));
            return await device.publishMessage('GET', 'Appliance.Hub.Mts100.SuperCtl', payload);
        },

        /**
         * Gets MTS100 schedule B data for specified IDs.
         *
         * @param {Object} options - Get options
         * @param {Array<string>} options.ids - Array of MTS100 subdevice IDs
         * @returns {Promise<Object>} Promise that resolves with schedule B data containing `scheduleB` array
         */
        async getMts100ScheduleB(options) {
            const { ids } = options;
            const payload = { 'scheduleB': [] };
            ids.forEach(id => payload.scheduleB.push({ id }));
            return await device.publishMessage('GET', 'Appliance.Hub.Mts100.ScheduleB', payload);
        },

        /**
         * Gets MTS100 configuration for specified IDs.
         *
         * @param {Object} options - Get options
         * @param {Array<string>} options.ids - Array of MTS100 subdevice IDs
         * @returns {Promise<Object>} Promise that resolves with configuration data containing `config` array
         */
        async getMts100Config(options) {
            const { ids } = options;
            const payload = { 'config': [] };
            ids.forEach(id => payload.config.push({ id }));
            return await device.publishMessage('GET', 'Appliance.Hub.Mts100.Config', payload);
        }
    };

    return hubFeature;
}

/**
 * Gets hub capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} _channelIds - Array of channel IDs (unused for hub capabilities)
 * @returns {Object|null} Hub capability object or null if not supported
 */
function getHubCapabilities(device, _channelIds) {
    if (!device.abilities) {return null;}

    const hasSubDeviceList = !!device.abilities['Appliance.Hub.SubDeviceList'];
    const hasBattery = !!device.abilities['Appliance.Hub.Battery'];

    if (!hasSubDeviceList && !hasBattery) {return null;}

    return {
        supported: true,
        subDeviceList: hasSubDeviceList,
        battery: hasBattery
    };
}

/**
 * Gets sensor capability information for hub subdevices.
 *
 * Detects hub sensor types and returns appropriate sensor data type capabilities.
 * This is for subdevices that connect through hubs (temperature/humidity sensors,
 * water leak sensors, smoke detectors).
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Sensor capability object or null if not a hub sensor
 */
function getSensorCapabilities(device, channelIds) {
    // Skip if not a subdevice (subdevices have a subdeviceId property)
    if (!device.subdeviceId) {
        return null;
    }

    // Get device type - subdevices store it in _type, regular devices use deviceType
    const deviceType = ((device._type || device.type || device.deviceType || '').toLowerCase());

    // Check if this is a hub temperature/humidity sensor
    // Check constructor name first (most reliable), then device type
    const isTempHumSensor = device.constructor.name === 'HubTempHumSensor' ||
        ['ms100', 'ms100f', 'ms130'].includes(deviceType);
    if (isTempHumSensor) {
        return {
            supported: true,
            channels: channelIds,
            temperature: true,
            humidity: true,
            lux: true
        };
    }

    // Check if this is a hub water leak sensor
    const isWaterLeakSensor = device.constructor.name === 'HubWaterLeakSensor' ||
        ['ms405', 'ms400'].includes(deviceType);
    if (isWaterLeakSensor) {
        return {
            supported: true,
            channels: channelIds,
            waterLeak: true
        };
    }

    // Check if this is a hub smoke detector
    const isSmokeDetector = device.constructor.name === 'HubSmokeDetector' ||
        ['ma151'].includes(deviceType);
    if (isSmokeDetector) {
        return {
            supported: true,
            channels: channelIds,
            smoke: true
        };
    }

    return null;
}

module.exports = createHubFeature;
module.exports.handlePushNotification = handlePushNotification;
module.exports.getCapabilities = getHubCapabilities;
module.exports.getSensorCapabilities = getSensorCapabilities;
