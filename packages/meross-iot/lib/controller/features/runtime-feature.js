'use strict';

/**
 * Runtime feature module.
 * Provides access to device runtime information such as uptime and system statistics.
 */
module.exports = {
    /**
     * Initializes runtime info storage.
     *
     * Called lazily to ensure the runtime info object exists before use.
     *
     * @private
     */
    _initializeRuntimeInfo() {
        if (this._runtimeInfo === undefined) {
            this._runtimeInfo = {};
        }
    },

    /**
     * Gets the latest runtime information from the device.
     *
     * Runtime information may vary over time as Meross adds, removes, or changes runtime
     * data fields in firmware updates. Use {@link cachedSystemRuntimeInfo} to access cached
     * runtime info without making a request.
     *
     * @returns {Promise<Object>} Runtime information object
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async updateRuntimeInfo() {
        this._initializeRuntimeInfo();
        const result = await this.publishMessage('GET', 'Appliance.System.Runtime', {});
        const data = result && result.runtime ? result.runtime : {};
        this._runtimeInfo = data;
        return data;
    },

    /**
     * Gets the cached runtime information.
     *
     * Returns the most recently fetched runtime info without making a request. For fresh
     * data, use {@link updateRuntimeInfo} instead.
     *
     * @returns {Object|null} Cached runtime info or null if not yet fetched
     */
    get cachedSystemRuntimeInfo() {
        this._initializeRuntimeInfo();
        return this._runtimeInfo;
    },

    /**
     * Refreshes device state including runtime information.
     *
     * Calls the base refreshState implementation (getSystemAllData) and then updates
     * runtime info to ensure all state is current.
     *
     * @returns {Promise<void>}
     * @throws {import('../lib/errors/errors').UnknownDeviceTypeError} If device does not support refreshState
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async refreshState() {
        if (typeof this.getSystemAllData === 'function') {
            await this.getSystemAllData();
        } else {
            const { UnknownDeviceTypeError } = require('../../model/exception');
            throw new UnknownDeviceTypeError('Device does not support refreshState()', this.deviceType);
        }
        await this.updateRuntimeInfo();
    }
};

