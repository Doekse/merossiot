'use strict';

const { MerossDeviceError } = require('../exception');
const { OverTempTypeCodec } = require('../enums');
const { normalizeOverTemp } = require('../utilities/normalize-payload');

/**
 * Creates a configuration feature object for a device.
 *
 * Provides access to device configuration settings such as over-temperature protection.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Config feature object with get() and set() methods
 */
function createConfigAbility(device) {
    return {
        /**
         * Gets the over-temperature protection configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<Object>} Response with decoded `overTemp.type`
         */
        async get(_options = {}) {
            const { payload } = await device.publishMessage('GET', 'Appliance.Config.OverTemp', {});
            if (payload?.overTemp) {
                return {
                    ...payload,
                    overTemp: normalizeOverTemp(payload.overTemp, { decodeValue: false })
                };
            }
            return payload;
        },

        /**
         * Sets the over-temperature protection configuration.
         *
         * @param {Object} options - Over-temperature config options
         * @param {boolean} options.enable - Enable state (true = on, false = off)
         * @param {'early-warning'|'shutoff-relay'|number} [options.type] - Protection type
         * @returns {Promise<Object>} Response from the device
         */
        async set(options = {}) {
            if (options.enable === undefined) {
                throw new MerossDeviceError('enable is required', 'VALIDATION_ERROR', { field: 'enable' });
            }

            const enableValue = options.enable ? 1 : 2;
            let typeWire;

            if (options.type !== undefined) {
                typeWire = typeof options.type === 'string'
                    ? OverTempTypeCodec.toWire(options.type)
                    : options.type;
                if (typeWire === undefined) {
                    throw new MerossDeviceError('Invalid over-temperature type', 'VALIDATION_ERROR', { field: 'type', value: options.type });
                }
            } else {
                try {
                    const currentConfig = await this.get();
                    const currentType = currentConfig?.overTemp?.type;
                    if (typeof currentType === 'string') {
                        typeWire = OverTempTypeCodec.toWire(currentType) ?? 1;
                    } else {
                        typeWire = currentType !== undefined ? currentType : 1;
                    }
                } catch (e) {
                    typeWire = 1;
                }
            }

            const payload = {
                overTemp: { enable: enableValue, type: typeWire }
            };
            const { payload: out } = await device.publishMessage('SET', 'Appliance.Config.OverTemp', payload);
            if (out?.overTemp) {
                return {
                    ...out,
                    overTemp: normalizeOverTemp(out.overTemp, { decodeValue: false })
                };
            }
            return out;
        }
    };
}

/**
 * Gets config capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Config capability object or null if not supported
 */
function getConfigCapabilities(device, channelIds) {
    return {
        supported: true,
        channels: channelIds
    };
}

module.exports = createConfigAbility;
module.exports.getCapabilities = getConfigCapabilities;
module.exports.ability = {
    key: 'config',
    namespaces: ['Appliance.Config.OverTemp'],
    caches: [],
    create: createConfigAbility,
    getCapabilities: getConfigCapabilities
};
