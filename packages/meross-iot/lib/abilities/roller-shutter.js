'use strict';

const RollerShutterState = require('../states/roller-shutter-state');
const { getCachedOrFetch } = require('../utilities/cache');
const { normalizeChannel } = require('../utilities/options');
const { MerossDeviceError } = require('../exception');
const { registerNamespaceDescriptor } = require('../dispatcher');

/**
 * Creates a roller shutter feature object for a device.
 *
 * Provides control over roller shutter/blind position and movement state.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Roller shutter feature object with set(), get(), and convenience methods
 */
function createRollerShutterAbility(device) {
    return {
        /**
         * Sets the roller shutter position.
         *
         * @param {Object} options - Roller shutter position options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @param {number} options.position - Position value (0-100 for open/close, -1 for stop)
         * @returns {Promise<Object>} Response from the device
         * @throws {MerossDeviceError} If device is not connected (code DEVICE_UNCONNECTED) or command times out (COMMAND_TIMEOUT)
         */
        async set(options = {}) {
            if (options.position === undefined) {
                throw new MerossDeviceError('position is required', 'VALIDATION_ERROR', { field: 'position' });
            }
            const channel = normalizeChannel(options);
            const payload = { 'position': { position: options.position, channel } };
            const { payload: responsePayload } = await device.publishMessage('SET', 'Appliance.RollerShutter.Position', payload);
            return responsePayload;
        },

        /**
         * Gets the current roller shutter state for a channel.
         *
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get state for (default: 0)
         * @returns {Promise<RollerShutterState|undefined>} Promise that resolves with roller shutter state or undefined
         * @throws {MerossDeviceError} If device is not connected (code DEVICE_UNCONNECTED) or command times out (COMMAND_TIMEOUT)
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            return getCachedOrFetch(
                device,
                '_rollerShutterStateByChannel',
                channel,
                () => device.publishMessage('GET', 'Appliance.RollerShutter.State', {})
            );
        },

        /**
         * Opens the roller shutter (moves to position 100).
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @returns {Promise<Object>} Response from the device
         */
        async open(options = {}) {
            return await this.set({ ...options, position: 100 });
        },

        /**
         * Closes the roller shutter (moves to position 0).
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @returns {Promise<Object>} Response from the device
         */
        async close(options = {}) {
            return await this.set({ ...options, position: 0 });
        },

        /**
         * Stops the roller shutter movement.
         *
         * @param {Object} [options={}] - Options
         * @param {number} [options.channel=0] - Channel to control (default: 0)
         * @returns {Promise<Object>} Response from the device
         */
        async stop(options = {}) {
            return await this.set({ ...options, position: -1 });
        },

        /**
         * Gets the roller shutter position from the device.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<Object>} Response containing roller shutter position with `position` array
         */
        async getPosition(_options = {}) {
            const { payload } = await device.publishMessage('GET', 'Appliance.RollerShutter.Position', {});
            return payload;
        },

        /**
         * Gets the roller shutter configuration from the device.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<Object>} Response containing roller shutter config with `config` array
         */
        async getConfig(_options = {}) {
            const { payload } = await device.publishMessage('GET', 'Appliance.RollerShutter.Config', {});
            return payload;
        },

        /**
         * Sets the roller shutter configuration.
         *
         * @param {Object} options - Roller shutter config options
         * @param {Object|Array} options.config - Configuration object or array of configuration objects
         * @returns {Promise<Object>} Response from the device
         */
        async setConfig(options = {}) {
            if (!options.config) {
                throw new MerossDeviceError('config is required', 'VALIDATION_ERROR', { field: 'config' });
            }
            const payload = { config: options.config };
            const { payload: responsePayload } = await device.publishMessage('SET', 'Appliance.RollerShutter.Config', payload);
            return responsePayload;
        },

        /**
         * Gets the roller shutter adjustment settings from the device.
         *
         * @param {Object} [options={}] - Get options
         * @returns {Promise<Object>} Response containing roller shutter adjustment data
         */
        async getAdjust(_options = {}) {
            const { payload } = await device.publishMessage('GET', 'Appliance.RollerShutter.Adjust', {});
            return payload;
        }
    };
}

/**
 * Updates the cached roller shutter configuration from config data.
 *
 * Called automatically when roller shutter configuration responses are received.
 * Handles both single objects and arrays of config data.
 *
 * @param {Object} device - The device instance
 * @param {Object|Array} configData - Config data (single object or array)
 */
function updateRollerShutterConfig(device, configData) {
    if (!configData) {return;}

    const configArray = Array.isArray(configData) ? configData : [configData];

    for (const configItem of configArray) {
        const channelIndex = configItem.channel;
        if (channelIndex === undefined || channelIndex === null) {continue;}

        device._rollerShutterConfigByChannel.set(channelIndex, configItem);
    }
}

/**
 * Gets roller shutter capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Roller shutter capability object or null if not supported
 */
function getRollerShutterCapabilities(device, channelIds) {
    const hasRollerShutterState = !!device.abilities['Appliance.RollerShutter.State'];
    const hasRollerShutterPosition = !!device.abilities['Appliance.RollerShutter.Position'];
    const hasRollerShutterConfig = !!device.abilities['Appliance.RollerShutter.Config'];
    const hasRollerShutterAdjust = !!device.abilities['Appliance.RollerShutter.Adjust'];

    if (!hasRollerShutterState && !hasRollerShutterPosition && !hasRollerShutterConfig && !hasRollerShutterAdjust) {return null;}

    return {
        supported: true,
        channels: channelIds
    };
}

const rollerShutterSnapshot = (s) => {
    const snap = { state: s.state, position: s.position };
    if (s.stoppedBy !== undefined) {
        snap.stoppedBy = s.stoppedBy;
    }
    if (s.calibrationStatus !== undefined) {
        snap.calibrationStatus = s.calibrationStatus;
    }
    return snap;
};

/**
 * Caches the latest reported position in parallel to {@link _rollerShutterStateByChannel}
 * so getPosition-style reads stay consistent with movement commands.
 */
function afterRollerShutterPositionCache(device, item) {
    if (device._rollerShutterPositionByChannel && item.channel !== null && item.channel !== undefined) {
        device._rollerShutterPositionByChannel.set(item.channel, item.position);
    }
}

registerNamespaceDescriptor('Appliance.RollerShutter.State', {
    namespace: 'Appliance.RollerShutter.State',
    payloadKey: 'state',
    stateMap: '_rollerShutterStateByChannel',
    StateClass: RollerShutterState,
    eventType: 'rollerShutter',
    snapshot: rollerShutterSnapshot
});

registerNamespaceDescriptor('Appliance.RollerShutter.Position', {
    namespace: 'Appliance.RollerShutter.Position',
    payloadKey: 'position',
    stateMap: '_rollerShutterStateByChannel',
    StateClass: RollerShutterState,
    eventType: 'rollerShutter',
    snapshot: rollerShutterSnapshot,
    afterApply: (device, item) => { afterRollerShutterPositionCache(device, item); }
});

/**
 * Config writes a per-channel config cache without emitting stateChange. Per-channel
 * ordering prevents stale messages for one channel from overwriting newer config on
 * another.
 */
registerNamespaceDescriptor('Appliance.RollerShutter.Config', {
    namespace: 'Appliance.RollerShutter.Config',
    payloadKey: 'config',
    customApplyItem: (device, item) => {
        updateRollerShutterConfig(device, item);
    }
});

registerNamespaceDescriptor('Appliance.RollerShutter.Adjust', {
    namespace: 'Appliance.RollerShutter.Adjust',
    payloadKey: 'adjust',
    stateMap: '_rollerShutterStateByChannel',
    StateClass: RollerShutterState,
    eventType: 'rollerShutter',
    snapshot: rollerShutterSnapshot
});

module.exports = createRollerShutterAbility;
/**
 * Private exports for unit tests. Do not rename or change shape without updating
 * `test/roller-shutter.test.js`.
 */
module.exports.getCapabilities = getRollerShutterCapabilities;
module.exports.ability = {
    key: 'rollerShutter',
    namespaces: [
        'Appliance.RollerShutter.State',
        'Appliance.RollerShutter.Position',
        'Appliance.RollerShutter.Adjust'
    ],
    caches: [
        '_rollerShutterStateByChannel',
        '_rollerShutterPositionByChannel',
        '_rollerShutterConfigByChannel'
    ],
    create: createRollerShutterAbility,
    getCapabilities: getRollerShutterCapabilities
};
