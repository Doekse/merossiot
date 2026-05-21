'use strict';

const { registerNamespaceDescriptor, mutateChannelState } = require('../dispatcher');
const { getMessageTimestamp } = require('../utilities/state-ordering');
const { applySubdeviceBattery, applySubdeviceOnline, publishHubGet, subdeviceIs } = require('./hub');
const TemperatureState = require('../states/temperature-state');
const HumidityState = require('../states/humidity-state');
const LuxState = require('../states/lux-state');

/**
 * Dispatcher descriptors for hub temperature/humidity subdevices (MS100, MS130, etc.).
 *
 * @module abilities/hub-temp-hum
 */

const temperatureDescriptor = {
    namespace: 'Appliance.Hub.Sensor.TempHum',
    stateMap: '_temperatureStateByChannel',
    StateClass: TemperatureState,
    eventType: 'temperature',
    gateKey: '_handleSensorAll',
    snapshot: (s) => s.toSnapshot()
};

const humidityDescriptor = {
    namespace: 'Appliance.Hub.Sensor.TempHum',
    stateMap: '_humidityStateByChannel',
    StateClass: HumidityState,
    eventType: 'humidity',
    gateKey: '_handleSensorAll',
    snapshot: (s) => s.toSnapshot()
};

const luxDescriptor = {
    namespace: 'Appliance.Control.Sensor.LatestX',
    stateMap: '_luxStateByChannel',
    StateClass: LuxState,
    eventType: 'lux',
    gateKey: '_handleLatestX',
    snapshot: (s) => s.toSnapshot()
};

/**
 * Parses Sensor.All sample tuples into structured history entries.
 *
 * @param {Array} samples
 * @returns {Array<{ fromTs: number, toTs: number, temperature: number|null, humidity: number|null }>}
 */
function parseSampleArray(samples) {
    return samples.map(sample => {
        const [temp, hum, fromTs, toTs] = sample;
        return {
            fromTs,
            toTs,
            temperature: temp ? parseFloat(temp) / 10 : null,
            humidity: hum ? parseFloat(hum) / 10 : null
        };
    });
}

/**
 * Extracts the latest reading from a LatestX `data` object.
 *
 * @param {Object} data
 * @param {string} type - `temp`, `humi`, or `light`
 * @returns {{ value: number, timestamp: number }|null}
 */
function extractLatestReading(data, type) {
    const readingArray = data[type];
    if (!Array.isArray(readingArray) || readingArray.length === 0) {
        return null;
    }

    const readingData = readingArray[0];
    if (readingData.value === undefined || readingData.value === null) {
        return null;
    }

    return {
        value: readingData.value,
        timestamp: readingData.timestamp
    };
}

/**
 * @param {object} device
 * @returns {TemperatureState|undefined}
 */
function getTemperatureState(device) {
    return device._temperatureStateByChannel?.get(0);
}

/**
 * @param {object} device
 * @returns {HumidityState|undefined}
 */
function getHumidityState(device) {
    return device._humidityStateByChannel?.get(0);
}

/**
 * @param {object} device
 * @returns {LuxState|undefined}
 */
function getLuxState(device) {
    return device._luxStateByChannel?.get(0);
}

/**
 * Latest sample timestamp (seconds) from temperature or humidity cached state.
 *
 * @param {object} device
 * @returns {number|null}
 */
function getLastSampledTimestamp(device) {
    const tempTs = getTemperatureState(device)?.latestSampleTime;
    const humTs = getHumidityState(device)?.latestSampleTime;
    if (tempTs == null && humTs == null) {
        return null;
    }
    if (tempTs == null) {
        return humTs;
    }
    if (humTs == null) {
        return tempTs;
    }
    return Math.max(tempTs, humTs);
}

/**
 * Applies Sensor.All / TempHum aggregate payloads to temp/hum maps and optional battery.
 *
 * @param {object} device
 * @param {Object} data
 * @param {number|null|undefined} messageTs
 * @param {string} source
 * @returns {void}
 */
function applyTempHumPayload(device, data, messageTs, source) {
    applySubdeviceOnline(device, data, messageTs, source);

    if (data.temperature) {
        mutateChannelState(device, temperatureDescriptor, (state) => {
            state.update(data.temperature);
        }, source);
    }

    if (data.humidity) {
        mutateChannelState(device, humidityDescriptor, (state) => {
            state.update(data.humidity);
        }, source);
    }

    if (data.battery !== undefined && data.battery !== null) {
        applySubdeviceBattery(device, data.battery, source);
    }

    if (data.sample && Array.isArray(data.sample)) {
        device._tempHumSamples = parseSampleArray(data.sample);
    }

    if (data.syncedTime) {
        mutateChannelState(device, temperatureDescriptor, (state) => {
            state.update({ latestSampleTime: data.syncedTime });
        }, source);
    }
}

/**
 * @param {object} device
 * @param {Object} data
 * @param {string} source
 * @returns {void}
 */
function applyLatestXPayload(device, data, source) {
    if (!data.data) {
        return;
    }

    const tempReading = extractLatestReading(data.data, 'temp');
    if (tempReading) {
        mutateChannelState(device, temperatureDescriptor, (state) => {
            state.update({
                latest: tempReading.value,
                latestSampleTime: tempReading.timestamp
            });
        }, source);
    }

    const humiReading = extractLatestReading(data.data, 'humi');
    if (humiReading) {
        mutateChannelState(device, humidityDescriptor, (state) => {
            state.update({
                latest: humiReading.value,
                latestSampleTime: humiReading.timestamp
            });
        }, source);
    }

    const lightReading = extractLatestReading(data.data, 'light');
    if (lightReading) {
        mutateChannelState(device, luxDescriptor, (state) => {
            state.update(lightReading.value);
        }, source);
    }
}

registerNamespaceDescriptor('Appliance.Hub.Sensor.TempHum', {
    ...temperatureDescriptor,
    customApply: (device, payload, source) => {
        if (!subdeviceIs(device, 'tempHum')) {
            return;
        }
        applyTempHumPayload(device, payload, null, source);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Sensor.All', {
    namespace: 'Appliance.Hub.Sensor.All',
    gateKey: '_handleSensorAll',
    customApply: (device, payload, source, header) => {
        if (!subdeviceIs(device, 'tempHum')) {
            return;
        }
        applyTempHumPayload(device, payload, getMessageTimestamp(header), source);
    }
});

registerNamespaceDescriptor('Appliance.Control.Sensor.LatestX', {
    ...luxDescriptor,
    customApply: (device, payload, source) => {
        if (!subdeviceIs(device, 'tempHum')) {
            return;
        }
        applyLatestXPayload(device, payload, source);
    }
});

/**
 * Creates a temperature/humidity feature object for a hub or temp/hum subdevice.
 *
 * @param {Object} device - Hub or temp/hum subdevice instance
 * @returns {Object} Temp/hum feature with get and cached read methods
 */
function createTempHumAbility(device) {
    return {
        /**
         * Fetches temperature/humidity data and updates local state.
         *
         * @param {Object} [options={}] - Get options
         * @param {string|Array<string>} [options.sensorIds] - Hub only: temp/hum subdevice ID(s)
         * @returns {Promise<Object>} Response containing `tempHum` array
         */
        async get(options = {}) {
            return publishHubGet(device, {
                namespace: 'Appliance.Hub.Sensor.TempHum',
                payloadKey: 'tempHum',
                ids: options.sensorIds,
                transport: null
            });
        },

        /**
         * Last sampled temperature in Celsius from cached state.
         *
         * @returns {number|null}
         */
        getLastSampledTemperature() {
            return getTemperatureState(device)?.latest ?? null;
        },

        /**
         * Last sampled humidity percentage from cached state.
         *
         * @returns {number|null}
         */
        getLastSampledHumidity() {
            return getHumidityState(device)?.latest ?? null;
        },

        /**
         * Timestamp of the last sample from cached state.
         *
         * @returns {Date|null}
         */
        getLastSampledTime() {
            const ts = getLastSampledTimestamp(device);
            return ts != null ? new Date(ts * 1000) : null;
        },

        /**
         * Minimum supported temperature in Celsius from cached state.
         *
         * @returns {number|null}
         */
        getMinSupportedTemperature() {
            return getTemperatureState(device)?.min ?? null;
        },

        /**
         * Maximum supported temperature in Celsius from cached state.
         *
         * @returns {number|null}
         */
        getMaxSupportedTemperature() {
            return getTemperatureState(device)?.max ?? null;
        },

        /**
         * Lux (illuminance) reading from cached state.
         *
         * @returns {number|null}
         */
        getLux() {
            return getLuxState(device)?.value ?? null;
        }
    };
}

/**
 * Gets temp/hum capability information for a hub temperature/humidity subdevice.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Temp/hum capability object or null if not supported
 */
function getCapabilities(device, channelIds) {
    if (!subdeviceIs(device, 'tempHum')) {
        return null;
    }

    return {
        supported: true,
        channels: channelIds,
        temperature: true,
        humidity: true,
        lux: true
    };
}

module.exports = createTempHumAbility;
module.exports.getCapabilities = getCapabilities;
module.exports.ability = {
    key: 'tempHum',
    namespaces: ['Appliance.Hub.Sensor.TempHum'],
    family: 'tempHum',
    caches: [
        '_temperatureStateByChannel',
        '_humidityStateByChannel',
        '_luxStateByChannel'
    ],
    create: createTempHumAbility,
    getCapabilities
};
