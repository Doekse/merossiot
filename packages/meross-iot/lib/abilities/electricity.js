'use strict';

const { registerNamespaceDescriptor } = require('../dispatcher');
const { normalizeChannel } = require('../utilities/options');
const { buildStateChanges } = require('../utilities/state-changes');
const { getCachedOrFetch } = require('../utilities/cache');

/** Wire `voltage` on {@link Appliance.Control.Electricity} is tenths of a volt. */
const VOLTAGE_SCALE_ELECTRICITY = 10;

/** Wire `voltage` on {@link Appliance.Control.ElectricityX} is millivolts (see meross_lan `ElectricityX_C`). */
const VOLTAGE_SCALE_ELECTRICITY_X = 1000;

const NS_ELECTRICITY = 'Appliance.Control.Electricity';
const NS_ELECTRICITY_X = 'Appliance.Control.ElectricityX';

/**
 * Creates an electricity feature object for a device.
 *
 * Provides access to real-time power consumption metrics including voltage, current, and power.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Electricity feature object with get() and other methods
 */
function createElectricityAbility(device) {
    /**
     * Initializes electricity metrics cache.
     *
     * @private
     */
    function initializeElectricityCache() {
        if (device._channelCachedSamples === undefined) {
            device._channelCachedSamples = new Map();
        }
    }

    return {
        /**
         * Gets instant power consumption metrics for a channel.
         *
         * Uses {@link NS_ELECTRICITY} when present, otherwise {@link NS_ELECTRICITY_X}.
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to read metrics from (default: 0)
         * @returns {Promise<{amperage: number, voltage: number, wattage: number, powerFactor?: number, monthlyConsumptionWh?: number, sampleTimestamp: Date}|null>} PowerInfo object or null
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            initializeElectricityCache();

            const value = await getCachedOrFetch(
                device,
                '_channelCachedSamples',
                channel,
                async () => {
                    await this._fetchMetrics(channel);
                }
            );

            return value ?? null;
        },

        /**
         * Refreshes electricity metrics for all device channels (metrics polling entry point).
         *
         * ElectricityX responses usually include every channel in one GET, so X-only devices
         * only need a single fetch per poll cycle.
         *
         * @returns {Promise<void>}
         */
        async pollAllChannels() {
            const channels = device.channels || [{ index: 0 }];
            if (this._isElectricityXOnly()) {
                await this.get({ channel: channels[0].index });
                return;
            }
            for (const channel of channels) {
                await this.get({ channel: channel.index });
            }
        },

        /**
         * @param {number} channel - Channel index
         * @returns {Promise<void>}
         * @private
         */
        async _fetchMetrics(channel) {
            if (device.abilities?.[NS_ELECTRICITY]) {
                await this._fetchClassic(channel);
                return;
            }
            if (device.abilities?.[NS_ELECTRICITY_X]) {
                await this._fetchX(channel);
                return;
            }

            try {
                await this._fetchClassic(channel);
            } catch (_error) {
                await this._fetchX(channel);
            }
        },

        /**
         * @param {number} channel - Channel index
         * @returns {Promise<void>}
         * @private
         */
        async _fetchClassic(channel) {
            const { payload: result } = await device.publishMessage('GET', NS_ELECTRICITY, { channel });
            const wire = result?.electricity;
            if (wire !== undefined && wire !== null) {
                const item = Array.isArray(wire)
                    ? (wire.find((entry) => entry.channel === channel) ?? { ...wire[0], channel })
                    : { channel, ...wire };
                updateElectricityState(device, item, 'response', {
                    voltageDivisor: VOLTAGE_SCALE_ELECTRICITY
                });
            }
            device.lastFullUpdateTimestamp = Date.now();
        },

        /**
         * @param {number} channel - Channel index
         * @returns {Promise<void>}
         * @private
         */
        async _fetchX(channel) {
            let payload;
            try {
                ({ payload } = await device.publishMessage('GET', NS_ELECTRICITY_X, {}));
            } catch (_error) {
                ({ payload } = await device.publishMessage('GET', NS_ELECTRICITY_X, {
                    channel: [{ channel }]
                }));
            }
            applyElectricityPayload(device, payload, 'response', VOLTAGE_SCALE_ELECTRICITY_X);
            device.lastFullUpdateTimestamp = Date.now();
        },

        /**
         * @returns {boolean}
         * @private
         */
        _isElectricityXOnly() {
            return Boolean(device.abilities?.[NS_ELECTRICITY_X] && !device.abilities?.[NS_ELECTRICITY]);
        }
    };
}

/**
 * Applies a namespace payload `electricity` field (dict or list) to the per-channel cache.
 *
 * @param {Object} device - The device instance
 * @param {Object} payload - Raw namespace payload
 * @param {string} source - Update source
 * @param {number} voltageDivisor - {@link VOLTAGE_SCALE_ELECTRICITY} or {@link VOLTAGE_SCALE_ELECTRICITY_X}
 */
function applyElectricityPayload(device, payload, source, voltageDivisor) {
    const raw = payload?.electricity;
    if (raw === undefined || raw === null) {
        return;
    }
    const items = Array.isArray(raw) ? raw : [raw];
    for (const item of items) {
        updateElectricityState(device, item, source, { voltageDivisor });
    }
}

/**
 * Updates the cached electricity state from electricity data.
 *
 * Called automatically when electricity data is received. Parses raw device data,
 * converts units, and emits stateChange events when values change.
 *
 * @param {Object} device - The device instance
 * @param {Object} electricityData - Raw electricity data from device
 * @param {string} [source='response'] - Source of the update ('push' | 'poll' | 'response')
 * @param {Object} [options] - Parsing options
 * @param {number} [options.voltageDivisor=10] - Divisor for wire `voltage` (10 classic, 1000 for ElectricityX)
 */
function updateElectricityState(device, electricityData, source = 'response', options = {}) {
    if (!electricityData) {return;}

    if (device._channelCachedSamples === undefined) {
        device._channelCachedSamples = new Map();
    }

    const channelIndex = electricityData.channel;
    if (channelIndex === undefined || channelIndex === null) {return;}

    const voltageDivisor = options.voltageDivisor ?? VOLTAGE_SCALE_ELECTRICITY;

    const current = parseFloat(electricityData.current || 0) / 1000;
    const voltage = parseFloat(electricityData.voltage || 0) / voltageDivisor;
    const power = parseFloat(electricityData.power || 0) / 1000;

    const powerInfo = {
        amperage: current,
        voltage,
        wattage: power,
        sampleTimestamp: new Date()
    };

    if (electricityData.factor !== undefined && electricityData.factor !== null) {
        powerInfo.powerFactor = parseFloat(electricityData.factor) / 100;
    }
    if (electricityData.mConsume !== undefined && electricityData.mConsume !== null) {
        powerInfo.monthlyConsumptionWh = parseFloat(electricityData.mConsume);
    }

    const oldPowerInfo = device._channelCachedSamples.get(channelIndex);
    const oldValue = oldPowerInfo ? {
        amperage: oldPowerInfo.amperage,
        voltage: oldPowerInfo.voltage,
        wattage: oldPowerInfo.wattage,
        powerFactor: oldPowerInfo.powerFactor,
        monthlyConsumptionWh: oldPowerInfo.monthlyConsumptionWh
    } : undefined;

    device._channelCachedSamples.set(channelIndex, powerInfo);

    const diffFields = {
        amperage: powerInfo.amperage,
        voltage: powerInfo.voltage,
        wattage: powerInfo.wattage
    };
    if (powerInfo.powerFactor !== undefined) {
        diffFields.powerFactor = powerInfo.powerFactor;
    }
    if (powerInfo.monthlyConsumptionWh !== undefined) {
        diffFields.monthlyConsumptionWh = powerInfo.monthlyConsumptionWh;
    }

    const newValue = buildStateChanges(oldValue, diffFields);

    if (Object.keys(newValue).length > 0) {
        const valueToEmit = oldValue === undefined ? powerInfo : { ...newValue, sampleTimestamp: powerInfo.sampleTimestamp };

        device.emit('stateChange', {
            type: 'electricity',
            channel: channelIndex,
            value: valueToEmit,
            oldValue,
            source,
            timestamp: Date.now()
        });
    }
}

/**
 * Gets electricity capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Electricity capability object or null if not supported
 */
function getElectricityCapabilities(device, channelIds) {
    return {
        supported: true,
        channels: channelIds
    };
}

registerNamespaceDescriptor(NS_ELECTRICITY, {
    namespace: NS_ELECTRICITY,
    customApply: (device, payload, source) => {
        applyElectricityPayload(device, payload, source, VOLTAGE_SCALE_ELECTRICITY);
    }
});

registerNamespaceDescriptor(NS_ELECTRICITY_X, {
    namespace: NS_ELECTRICITY_X,
    customApply: (device, payload, source) => {
        applyElectricityPayload(device, payload, source, VOLTAGE_SCALE_ELECTRICITY_X);
    }
});

module.exports = createElectricityAbility;
module.exports.getCapabilities = getElectricityCapabilities;
module.exports.updateElectricityState = updateElectricityState;
module.exports.ability = {
    key: 'electricity',
    namespaces: [NS_ELECTRICITY, NS_ELECTRICITY_X],
    caches: [],
    create: createElectricityAbility,
    getCapabilities: getElectricityCapabilities
};
