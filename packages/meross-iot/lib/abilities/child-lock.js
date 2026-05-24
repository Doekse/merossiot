'use strict';

const { PhysicalLockCodec } = require('../enums');
const { MerossDeviceError } = require('../exception');
const { normalizeChannel } = require('../utilities/options');

/**
 * Creates a child lock feature object for a device.
 *
 * Provides control over physical control lock functionality.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Child lock feature object with set() and get() methods
 */
function createChildLockAbility(device) {
    return {
        /**
         * Gets the child lock status from the device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get lock status for (default: 0)
         * @param {string} [options.subId=null] - Optional subdevice ID
         * @returns {Promise<Object>} Response containing lock status with `lock` array
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            const payload = {
                lock: [{
                    channel
                }]
            };
            if (options.subId) {
                payload.lock[0].subId = options.subId;
            }
            const { payload: out } = await device.publishMessage('GET', 'Appliance.Control.PhysicalLock', payload);
            return out;
        },

        /**
         * Sets the child lock status.
         *
         * @param {Object} options - Child lock options
         * @param {Object|Array<Object>} [options.lockData] - Lock data object or array (if provided, used directly)
         * @param {number} [options.channel] - Channel to control
         * @param {string} [options.subId] - Optional subdevice ID
         * @param {number} [options.onoff] - Lock wire value (0 = unlocked, 1 = locked)
         * @param {'unlocked'|'locked'} [options.lockState] - Semantic lock state (alternative to `onoff`)
         * @param {boolean} [options.locked] - Shorthand for `lockState` locked/unlocked
         * @returns {Promise<Object>} Response from the device
         */
        async set(options = {}) {
            let lockData;
            if (options.lockData) {
                lockData = Array.isArray(options.lockData) ? options.lockData : [options.lockData];
            } else {
                const channel = normalizeChannel(options);
                let onoff = options.onoff;
                if (options.lockState !== undefined && options.lockState !== null) {
                    onoff = PhysicalLockCodec.toWire(options.lockState);
                    if (onoff === undefined) {
                        throw new MerossDeviceError(
                            'Invalid lock state. Expected "unlocked" or "locked".',
                            'VALIDATION_ERROR',
                            { field: 'lockState', lockState: options.lockState }
                        );
                    }
                } else if (options.locked !== undefined) {
                    onoff = PhysicalLockCodec.toWire(options.locked ? 'locked' : 'unlocked');
                }
                lockData = [{
                    channel,
                    subId: options.subId,
                    onoff
                }];
            }
            const payload = { lock: lockData };
            const { payload: out } = await device.publishMessage('SET', 'Appliance.Control.PhysicalLock', payload);
            return out;
        }
    };
}

/**
 * Gets child lock capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Child lock capability object or null if not supported
 */
function getChildLockCapabilities(device, channelIds) {
    return {
        supported: true,
        channels: channelIds
    };
}

module.exports = createChildLockAbility;
module.exports.getCapabilities = getChildLockCapabilities;
module.exports.ability = {
    key: 'childLock',
    namespaces: [
        'Appliance.Control.PhysicalLock',
        'Appliance.Control.ChildLock'
    ],
    caches: [],
    create: createChildLockAbility,
    getCapabilities: getChildLockCapabilities
};
