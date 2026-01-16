'use strict';

const { DNDMode } = require('../../model/enums');

/**
 * Do-not-disturb feature module.
 * Controls the device's do-not-disturb mode, which disables the ambient LED when enabled.
 */
module.exports = {
    /**
     * Gets the do-not-disturb mode from the device.
     * @param {Object} [options={}] - Get options
     * @returns {Promise<import('../lib/enums').DNDMode>} DNDMode enum object (DNDMode.DND_DISABLED or DNDMode.DND_ENABLED)
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getDNDMode(_options = {}) {
        const result = await this.publishMessage('GET', 'Appliance.System.DNDMode', {});
        if (result && result.DNDMode && result.DNDMode.mode !== undefined) {
            const modeValue = result.DNDMode.mode;
            const enumKey = Object.keys(DNDMode).find(key => DNDMode[key] === modeValue);
            this.lastFullUpdateTimestamp = Date.now();
            return enumKey ? DNDMode[enumKey] : DNDMode.DND_DISABLED;
        }
        this.lastFullUpdateTimestamp = Date.now();
        return DNDMode.DND_DISABLED;
    },

    /**
     * Gets the raw numeric DND mode value from the device.
     *
     * Returns the numeric value directly without converting to an enum. For enum object,
     * use {@link getDNDMode} instead.
     * @param {Object} [options={}] - Get options
     * @returns {Promise<number>} Raw numeric DND mode value (0 = disabled, 1 = enabled)
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     * @see getDNDMode
     */
    async getRawDNDMode(_options = {}) {
        const result = await this.publishMessage('GET', 'Appliance.System.DNDMode', {});
        if (result && result.DNDMode && result.DNDMode.mode !== undefined) {
            return result.DNDMode.mode;
        }
        return DNDMode.DND_DISABLED;
    },

    /**
     * Controls the do-not-disturb mode setting.
     *
     * When enabled, the device turns off its ambient LED to reduce visual disturbance.
     *
     * @param {Object} options - DND mode options
     * @param {boolean|import('../lib/enums').DNDMode} options.mode - DNDMode enum value or boolean (true = enabled, false = disabled)
     * @returns {Promise<void>}
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     * @throws {import('../lib/errors/errors').CommandError} If mode value is invalid
     */
    async setDNDMode(options = {}) {
        if (options.mode === undefined) {
            const { CommandError } = require('../../model/exception');
            throw new CommandError('mode is required', { options }, this.uuid);
        }
        let modeValue;
        if (typeof options.mode === 'boolean') {
            modeValue = options.mode ? DNDMode.DND_ENABLED : DNDMode.DND_DISABLED;
        } else if (options.mode === DNDMode.DND_ENABLED || options.mode === DNDMode.DND_DISABLED) {
            modeValue = options.mode;
        } else {
            const { CommandError } = require('../../model/exception');
            throw new CommandError('Invalid DND mode. Expected boolean or DNDMode enum value.', { mode: options.mode }, this.uuid);
        }

        const payload = { 'DNDMode': { 'mode': modeValue } };
        await this.publishMessage('SET', 'Appliance.System.DNDMode', payload);
    }
};

