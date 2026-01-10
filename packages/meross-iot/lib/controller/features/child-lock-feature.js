'use strict';

const { normalizeChannel } = require('../../utilities/options');

/**
 * Child lock feature module.
 * Provides control over physical control lock functionality.
 */
module.exports = {
    /**
     * Gets the child lock status from the device.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get lock status for (default: 0)
     * @param {string} [options.subId=null] - Optional subdevice ID
     * @returns {Promise<Object>} Response containing lock status with `lock` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getChildLock(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            lock: [{
                channel
            }]
        };
        if (options.subId) {
            payload.lock[0].subId = options.subId;
        }
        return await this.publishMessage('GET', 'Appliance.Control.PhysicalLock', payload);
    },

    /**
     * Controls the child lock status.
     *
     * @param {Object} options - Child lock options
     * @param {Object|Array<Object>} [options.lockData] - Lock data object or array of lock items (if provided, used directly)
     * @param {number} [options.channel] - Channel to control
     * @param {string} [options.subId] - Optional subdevice ID
     * @param {number} [options.onoff] - Lock on (1) or off (0)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setChildLock(options = {}) {
        let lockData;
        if (options.lockData) {
            lockData = Array.isArray(options.lockData) ? options.lockData : [options.lockData];
        } else {
            const channel = normalizeChannel(options);
            lockData = [{
                channel,
                subId: options.subId,
                onoff: options.onoff
            }];
        }
        const payload = { lock: lockData };
        return await this.publishMessage('SET', 'Appliance.Control.PhysicalLock', payload);
    }
};

