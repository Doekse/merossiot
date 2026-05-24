'use strict';

const { registerNamespaceDescriptor, emitStateChangeFromSnapshot, mutateChannelState } = require('../dispatcher');
const HubBatteryState = require('../states/hub-battery-state');
const { getMessageTimestamp, shouldApplyUpdate } = require('../utilities/state-ordering');

/**
 * Maps hub MQTT namespaces to the payload array key on GETACK/PUSH.
 *
 * @type {Record<string, string>}
 */
const HUB_NAMESPACE_KEYS = {
    'Appliance.Hub.Online': 'online',
    'Appliance.Hub.ToggleX': 'togglex',
    'Appliance.Hub.Battery': 'battery',
    'Appliance.Hub.Mts100.Battery': 'battery',
    'Appliance.Hub.Sensor.WaterLeak': 'waterLeak',
    'Appliance.Hub.Sensor.All': 'all',
    'Appliance.Hub.Sensor.TempHum': 'tempHum',
    'Appliance.Hub.Sensor.Alert': 'alert',
    'Appliance.Hub.Sensor.Adjust': 'adjust',
    'Appliance.Hub.Sensor.DoorWindow': 'doorWindow',
    'Appliance.Hub.Sensor.Smoke': 'smokeAlarm',
    'Appliance.Control.Sensor.LatestX': 'latest',
    'Appliance.Hub.Mts100.All': 'all',
    'Appliance.Hub.Mts100.Mode': 'mode',
    'Appliance.Hub.Mts100.Temperature': 'temperature',
    'Appliance.Hub.Mts100.Adjust': 'adjust',
    'Appliance.Hub.Mts100.SuperCtl': 'superCtl',
    'Appliance.Hub.Mts100.ScheduleB': 'scheduleB',
    'Appliance.Hub.Mts100.Config': 'config',
    'Appliance.Hub.SubdeviceList': 'subdeviceList'
};

/**
 * Extracts hub namespace item arrays from GETACK/PUSH raw payloads.
 *
 * @param {string} namespace
 * @param {Object} rawData
 * @returns {Array<Object>|null}
 */
function extractHubItems(namespace, rawData) {
    const dataKey = HUB_NAMESPACE_KEYS[namespace];
    if (!dataKey || !rawData) {
        return null;
    }

    let items = rawData[dataKey];
    if (!items && namespace === 'Appliance.Hub.Mts100.ScheduleB' && rawData.schedule) {
        items = rawData.schedule;
    }
    if (items === null || items === undefined) {
        return null;
    }
    return Array.isArray(items) ? items : [items];
}

/**
 * Hub subdevice model identifiers grouped by capability family.
 *
 * @type {Record<string, { models: string[] }>}
 */
const SUBDEVICE_FAMILIES = {
    tempHum: { models: ['ms100', 'ms100f', 'ms130'] },
    doorWindow: { models: ['ms200'] },
    waterLeak: { models: ['ms400', 'ms405'] },
    smoke: { models: ['ma151', 'gs559'] },
    mts100: { models: ['mts100v3', 'mts100', 'mts150', 'mts150p'] }
};

/**
 * Whether a subdevice matches a hub subdevice capability family.
 *
 * @param {Object} device - Hub or subdevice instance
 * @param {keyof typeof SUBDEVICE_FAMILIES} family
 * @returns {boolean}
 */
function subdeviceIs(device, family) {
    if (!device?.subdeviceId) {
        return false;
    }
    const entry = SUBDEVICE_FAMILIES[family];
    if (!entry) {
        return false;
    }
    const deviceType = ((device._type || device.type || device.deviceType || '')).toLowerCase();
    return entry.models.includes(deviceType);
}

/**
 * Resolves the {@link SUBDEVICE_FAMILIES} key for a subdevice model string.
 *
 * @param {Object} device - Subdevice instance
 * @returns {keyof typeof SUBDEVICE_FAMILIES|undefined}
 */
function getSubdeviceCapability(device) {
    if (!device?.subdeviceId) {
        return undefined;
    }
    const deviceType = ((device._type || device.type || device.deviceType || '')).toLowerCase();
    for (const [family, entry] of Object.entries(SUBDEVICE_FAMILIES)) {
        if (entry.models.includes(deviceType)) {
            return family;
        }
    }
    return undefined;
}

/**
 * Forwards hub GETACK/PUSH array items to matching subdevices by `id`.
 *
 * @param {Object} device - Hub device
 * @param {Object|undefined} header
 * @param {string} namespace
 * @param {Array<Object>|null|undefined} items
 * @returns {Promise<void>}
 */
async function routeItemsToSubdevices(device, header, namespace, items) {
    if (!Array.isArray(items)) {
        return;
    }
    for (const item of items) {
        if (!item || item.id === null || item.id === undefined) {
            continue;
        }
        const subdevice = device.getSubdevice(item.id);
        if (subdevice && typeof subdevice.handleMessage === 'function') {
            await subdevice.handleMessage({ header, namespace, payload: item });
        }
    }
}

/**
 * Builds a hub GET payload listing subdevice IDs under `payloadKey`.
 *
 * @param {string} payloadKey
 * @param {string|string[]|undefined} ids
 * @returns {Object}
 */
function buildHubGetPayload(payloadKey, ids) {
    const payload = { [payloadKey]: [] };
    if (Array.isArray(ids)) {
        ids.forEach(id => payload[payloadKey].push({ id }));
    } else if (ids !== null && ids !== undefined) {
        payload[payloadKey].push({ id: ids });
    }
    return payload;
}

/**
 * Reads item array(s) from a GETACK payload, trying alternate response keys when needed.
 *
 * @param {Object|undefined} response
 * @param {string} routeKey
 * @param {string[]} [responseKeys]
 * @returns {Array<Object>|null}
 */
function extractGetResponseItems(response, routeKey, responseKeys) {
    const keys = responseKeys || [routeKey];
    for (const key of keys) {
        if (response && response[key] !== null && response[key] !== undefined) {
            const items = response[key];
            return Array.isArray(items) ? items : [items];
        }
    }
    return null;
}

/**
 * Applies GETACK items to one subdevice's dispatcher state.
 *
 * @param {Object} device
 * @param {Object} header
 * @param {string} namespace
 * @param {Array<Object>|Object} items
 * @param {{ wholeArray?: boolean }} [options]
 * @returns {Promise<void>}
 */
async function applyGetItemsToSubdevice(device, header, namespace, items, { wholeArray = false } = {}) {
    if (!items) {
        return;
    }
    if (wholeArray) {
        await device.handleMessage({ header, namespace, payload: items });
        return;
    }
    const list = Array.isArray(items) ? items : [items];
    for (const item of list) {
        if (item.id === device.subdeviceId || list.length === 1) {
            await device.handleMessage({ header, namespace, payload: item });
        }
    }
}

/**
 * Issues a hub GET and routes ACK items to subdevice state (single subdevice or hub fan-out).
 *
 * @param {Object} device - Hub or subdevice instance
 * @param {Object} options
 * @param {string} options.namespace - MQTT namespace
 * @param {string} options.payloadKey - Request body array key
 * @param {string|string[]|undefined} [options.ids] - Hub: subdevice ID(s); omitted with subdevice uses `device.subdeviceId`
 * @param {string} [options.routeKey] - Response array key when it differs from `payloadKey`
 * @param {string} [options.requestKey] - Request key when it differs from `payloadKey` (e.g. ScheduleB GET uses `schedule`)
 * @param {string[]} [options.responseKeys] - Alternate response keys to try (e.g. `waterleak` / `waterLeak`)
 * @param {boolean} [options.subdeviceWholeArray] - Pass the full response array as one payload on subdevices (smoke)
 * @param {null|undefined} [options.transport] - Fourth argument to `publishMessage` when set to `null`
 * @returns {Promise<Object|undefined>} GETACK payload
 */
async function publishHubGet(device, options) {
    const {
        namespace,
        payloadKey,
        ids,
        routeKey = payloadKey,
        requestKey = payloadKey,
        responseKeys,
        subdeviceWholeArray = false,
        transport
    } = options;

    const payload = device.subdeviceId
        ? { [requestKey]: [{ id: device.subdeviceId }] }
        : buildHubGetPayload(requestKey, ids);

    const publishArgs = transport === null
        ? ['GET', namespace, payload, null]
        : ['GET', namespace, payload];

    const { header, payload: response } = await device.publishMessage(...publishArgs);
    const items = extractGetResponseItems(response, routeKey, responseKeys);
    if (!items) {
        return response;
    }

    if (device.subdeviceId) {
        await applyGetItemsToSubdevice(device, header, namespace, items, {
            wholeArray: subdeviceWholeArray
        });
    } else {
        await routeItemsToSubdevices(device, header, namespace, items);
    }

    return response;
}

/**
 * Issues a hub SET with a keyed entry array.
 *
 * @param {Object} device
 * @param {Object} options
 * @param {string} options.namespace
 * @param {string} options.payloadKey
 * @param {Array<Object>} options.entries
 * @param {null|undefined} [options.transport]
 * @returns {Promise<Object|undefined>} SETACK payload
 */
async function publishHubSet(device, options) {
    const { namespace, payloadKey, entries, transport } = options;
    const publishArgs = transport === null
        ? ['SET', namespace, { [payloadKey]: entries }, null]
        : ['SET', namespace, { [payloadKey]: entries }];
    const { payload: response } = await device.publishMessage(...publishArgs);
    return response;
}

/** @param {Array<{type?: string, subdeviceId: string}>} subdevices */
function collectIdsByTypes(subdevices, types) {
    const normalized = types.map(t => t.toLowerCase());
    return subdevices
        .filter(sub => normalized.includes((sub.type || '').toLowerCase()))
        .map(sub => sub.subdeviceId);
}

/**
 * Handles push notifications for hub functionality.
 *
 * Routes notifications to appropriate subdevices based on the namespace.
 *
 * @param {Object} device - The device instance
 * @param {Object} notification - The parsed push notification instance
 * @returns {boolean} True if the notification was handled locally, false otherwise
 */
function handlePushNotification(device, notification) {
    const namespace = notification?.namespace || '';
    if (!HUB_NAMESPACE_KEYS[namespace]) {
        return false;
    }

    const items = extractHubItems(namespace, notification?.rawData || {});
    if (!items || items.length === 0) {
        const dataKey = HUB_NAMESPACE_KEYS[namespace];
        const logger = device.meross.options.logger || console.warn;
        logger(`${device.constructor.name} could not find ${dataKey} in push notification: ${JSON.stringify(notification?.rawData)}`);
        return false;
    }

    if (typeof notification.routeToSubdevices === 'function') {
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
function createHubAbility(device) {
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
        } else if (device._initialSubdeviceInfos?.length > 0) {
            for (const sub of device._initialSubdeviceInfos) {
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
            const logger = device.meross?.options?.logger || console.debug;
            logger(`Failed to fetch latest sensor readings: ${latestError.message}`);
        }

        try {
            if (typeof hubFeature.getBattery === 'function') {
                await hubFeature.getBattery();
            }
        } catch (batteryError) {
            const logger = device.meross?.options?.logger || console.debug;
            logger(`Failed to update battery data: ${batteryError.message}`);
        }

        const subdevices = device.getSubdevices();
        const tempHumIds = collectIdsByTypes(subdevices, ['ms100', 'ms100f', 'ms130']);
        if (tempHumIds.length > 0) {
            try {
                if (device.sensorAlert && typeof device.sensorAlert.get === 'function') {
                    await device.sensorAlert.get({ sensorIds: tempHumIds });
                }
            } catch (alertError) {
                const logger = device.meross?.options?.logger || console.debug;
                logger(`Failed to fetch sensor alert config: ${alertError.message}`);
            }
            try {
                if (device.sensorAdjust && typeof device.sensorAdjust.get === 'function') {
                    await device.sensorAdjust.get({ sensorIds: tempHumIds });
                }
            } catch (adjustError) {
                const logger = device.meross?.options?.logger || console.debug;
                logger(`Failed to fetch sensor adjust config: ${adjustError.message}`);
            }
        }

        const doorWindowIds = collectIdsByTypes(subdevices, ['ms200']);
        if (doorWindowIds.length > 0) {
            try {
                if (device.doorWindow && typeof device.doorWindow.get === 'function') {
                    await device.doorWindow.get({ sensorIds: doorWindowIds });
                }
            } catch (doorError) {
                const logger = device.meross?.options?.logger || console.debug;
                logger(`Failed to fetch door/window sensor data: ${doorError.message}`);
            }
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

        if (device.mts100 && typeof device.mts100.get === 'function') {
            await device.mts100.get({ ids: mts100Ids, complete: true });
        }
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
                const logger = device.meross.options.logger || console.error;
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
            const { header, payload: response } = await device.publishMessage('GET', 'Appliance.Hub.Battery', payload, null);

            if (response && response.battery && Array.isArray(response.battery)) {
                for (const batteryData of response.battery) {
                    const subdeviceId = batteryData.id;
                    const subdevice = device.getSubdevice(subdeviceId);
                    if (subdevice && typeof subdevice.handleMessage === 'function') {
                        await subdevice.handleMessage({ header, namespace: 'Appliance.Hub.Battery', payload: batteryData });
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
            const { payload } = await device.publishMessage('GET', 'Appliance.Hub.Online', {});
            return payload;
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
            const { payload: out } = await device.publishMessage('SET', 'Appliance.Hub.ToggleX', payload);
            return out;
        },

        /**
         * Gets the hub's exception information.
         *
         * @returns {Promise<Object>} Promise that resolves with exception data
         */
        async getException() {
            const { payload } = await device.publishMessage('GET', 'Appliance.Hub.Exception', {});
            return payload;
        },

        /**
         * Gets the hub's report information.
         *
         * @returns {Promise<Object>} Promise that resolves with report data
         */
        async getReport() {
            const { payload } = await device.publishMessage('GET', 'Appliance.Hub.Report', {});
            return payload;
        },

        /**
         * Initiates pairing of a subdevice to the hub.
         *
         * @returns {Promise<Object>} Promise that resolves with response data
         */
        async pairSubDev() {
            const { payload } = await device.publishMessage('SET', 'Appliance.Hub.PairSubDev', {});
            return payload;
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
            const { payload: out } = await device.publishMessage('SET', 'Appliance.Hub.SubDevice.Beep', payload);
            return out;
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
            const { payload: out } = await device.publishMessage('GET', 'Appliance.Hub.SubDevice.Beep', payload);
            return out;
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
            const { payload: out } = await device.publishMessage('GET', 'Appliance.Hub.SubDevice.MotorAdjust', payload);
            return out;
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
            const { payload: out } = await device.publishMessage('SET', 'Appliance.Hub.SubDevice.MotorAdjust', payload);
            return out;
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
            const { payload: out } = await device.publishMessage('GET', 'Appliance.Hub.SubDevice.Version', payload);
            return out;
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

            const { header, payload: response } = await device.publishMessage('GET', 'Appliance.Hub.Sensor.All', payload);

            if (response && response.all && Array.isArray(response.all)) {
                for (const sensorData of response.all) {
                    const subdeviceId = sensorData.id;
                    const subdevice = device.getSubdevice(subdeviceId);
                    if (subdevice && typeof subdevice.handleMessage === 'function') {
                        await subdevice.handleMessage({ header, namespace: 'Appliance.Hub.Sensor.All', payload: sensorData });
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

            const { header, payload: response } = await device.publishMessage('GET', 'Appliance.Control.Sensor.LatestX', payload, null);

            if (response && response.latest && Array.isArray(response.latest)) {
                for (const latestData of response.latest) {
                    const subdeviceId = latestData.subId;
                    const subdevice = device.getSubdevice(subdeviceId);
                    if (subdevice && typeof subdevice.handleMessage === 'function') {
                        await subdevice.handleMessage({ header, namespace: 'Appliance.Control.Sensor.LatestX', payload: latestData });
                    }
                }
            }

            return response;
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
    const hasSubDeviceList = !!device.abilities['Appliance.Hub.SubDeviceList'];
    const hasBattery = !!device.abilities['Appliance.Hub.Battery'];

    if (!hasSubDeviceList && !hasBattery) {return null;}

    return {
        supported: true,
        subDeviceList: hasSubDeviceList,
        battery: hasBattery
    };
}

const hubBatteryDescriptor = {
    namespace: 'Appliance.Hub.Battery',
    stateMap: '_batteryStateByChannel',
    StateClass: HubBatteryState,
    eventType: 'battery',
    gateKey: '_handleBattery',
    snapshot: (s) => s.toSnapshot(),
    emitValue: (_old, newSnap) => newSnap
};

const hubOnlineDescriptor = {
    namespace: 'Appliance.Hub.Online',
    eventType: 'online',
    gateKey: '_handleOnline',
    emitValue: (oldVal, newVal) => (oldVal !== newVal ? newVal : undefined)
};


/**
 * Applies hub online payloads with the shared `'online'` ordering gate.
 *
 * @param {object} device
 * @param {Object} data
 * @param {number|null|undefined} messageTs
 * @param {string} source
 * @param {Object} [options]
 * @param {boolean} [options.touchLastActiveTime=false]
 * @returns {void}
 */
function applySubdeviceOnline(device, data, messageTs, source, { touchLastActiveTime = false } = {}) {
    let statusValue;
    let lastActiveTime;

    if (data.online && data.online.status !== undefined) {
        statusValue = data.online.status;
        lastActiveTime = data.online.lastActiveTime;
    } else if (data.status !== undefined) {
        statusValue = data.status;
        lastActiveTime = data.lastActiveTime;
    }

    if (statusValue === undefined) {
        return;
    }

    if (!shouldApplyUpdate(device, 'online', messageTs)) {
        return;
    }

    const oldOnline = device.connectivity;
    device._connectivityWire = statusValue;
    if (touchLastActiveTime) {
        device._lastActiveTime = lastActiveTime;
    }

    emitStateChangeFromSnapshot(
        device,
        hubOnlineDescriptor,
        source,
        0,
        oldOnline,
        device.connectivity
    );
}

/**
 * Updates channel-0 battery state and emits a scalar `stateChange` value.
 *
 * @param {object} device
 * @param {Object|number|null} data
 * @param {string} source
 * @returns {void}
 */
function applySubdeviceBattery(device, data, source) {
    mutateChannelState(device, hubBatteryDescriptor, (state) => {
        state.update(data);
    }, source);
}

registerNamespaceDescriptor('Appliance.Hub.Battery', {
    ...hubBatteryDescriptor,
    customApply: (device, payload, source) => {
        if (device.subdeviceId === null || device.subdeviceId === undefined) {
            return;
        }
        applySubdeviceBattery(device, payload, source);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Mts100.Battery', {
    ...hubBatteryDescriptor,
    namespace: 'Appliance.Hub.Mts100.Battery',
    customApply: (device, payload, source) => {
        if (device.subdeviceId === null || device.subdeviceId === undefined) {
            return;
        }
        applySubdeviceBattery(device, payload, source);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Online', {
    ...hubOnlineDescriptor,
    customApply: (device, payload, source, header) => {
        if (device.subdeviceId === null || device.subdeviceId === undefined) {
            return;
        }
        applySubdeviceOnline(device, payload, getMessageTimestamp(header), source, {
            touchLastActiveTime: true
        });
    }
});

module.exports = createHubAbility;
module.exports.extractHubItems = extractHubItems;
module.exports.SUBDEVICE_FAMILIES = SUBDEVICE_FAMILIES;
module.exports.subdeviceIs = subdeviceIs;
module.exports.getSubdeviceCapability = getSubdeviceCapability;
module.exports.applySubdeviceBattery = applySubdeviceBattery;
module.exports.applySubdeviceOnline = applySubdeviceOnline;
module.exports.handlePushNotification = handlePushNotification;
module.exports.routeItemsToSubdevices = routeItemsToSubdevices;
module.exports.publishHubGet = publishHubGet;
module.exports.publishHubSet = publishHubSet;
module.exports.getCapabilities = getHubCapabilities;
module.exports.ability = {
    key: 'hub',
    getCapabilities: getHubCapabilities
};
