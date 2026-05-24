'use strict';

const { TempUnitCodec } = require('../enums');
const { MerossDeviceError } = require('../exception');
const { normalizeChannel } = require('../utilities/options');

/**
 * Creates a temperature unit feature object for a device.
 *
 * Provides control over the temperature unit display preference (Celsius or Fahrenheit).
 *
 * @param {Object} device - The device instance
 * @returns {Object} Temperature unit feature object with set() and get() methods
 */
function createTempUnitAbility(device) {
    return {
        /**
         * Gets the temperature unit configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get temperature unit for (default: 0)
         * @returns {Promise<Object>} Response containing temperature unit configuration with `tempUnit` array
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            const payload = {
                tempUnit: [{
                    channel
                }]
            };
            const { payload: out } = await device.publishMessage('GET', 'Appliance.Control.TempUnit', payload);
            return out;
        },

        /**
         * Sets the temperature unit configuration.
         *
         * @param {Object} options - Temperature unit options
         * @param {Object|Array<Object>} [options.tempUnitData] - Temperature unit data object or array (if provided, used directly)
         * @param {number} [options.channel] - Channel to configure
         * @param {number|'celsius'|'fahrenheit'} [options.tempUnit] - Wire code or semantic unit
         * @returns {Promise<Object>} Response from the device
         */
        async set(options = {}) {
            let tempUnitData;
            if (options.tempUnitData) {
                tempUnitData = Array.isArray(options.tempUnitData) ? options.tempUnitData : [options.tempUnitData];
            } else {
                const channel = normalizeChannel(options);
                let tempUnitWire = options.tempUnit;
                if (typeof tempUnitWire === 'string') {
                    tempUnitWire = TempUnitCodec.toWire(tempUnitWire);
                    if (tempUnitWire === undefined) {
                        throw new MerossDeviceError(
                            'Invalid temperature unit. Expected "celsius" or "fahrenheit".',
                            'VALIDATION_ERROR',
                            { field: 'tempUnit', tempUnit: options.tempUnit }
                        );
                    }
                }
                tempUnitData = [{
                    channel,
                    tempUnit: tempUnitWire
                }];
            }
            const payload = { tempUnit: tempUnitData };
            const { payload: out } = await device.publishMessage('SET', 'Appliance.Control.TempUnit', payload);
            return out;
        }
    };
}

/**
 * Gets temp unit capability information for a device.
 *
 * @param {Object} _device - The device instance (unused; consistent with `getCapabilities` signature)
 * @param {Array<number>} _channelIds - Array of channel IDs (unused; consistent with `getCapabilities` signature)
 * @returns {Object|null} Temp unit capability object or null if not supported
 */
function getTempUnitCapabilities(_device, _channelIds) {
    return {
        supported: true
    };
}

module.exports = createTempUnitAbility;
module.exports.getCapabilities = getTempUnitCapabilities;
module.exports.ability = {
    key: 'tempUnit',
    namespaces: ['Appliance.Control.TempUnit'],
    caches: [],
    create: createTempUnitAbility,
    getCapabilities: getTempUnitCapabilities
};
