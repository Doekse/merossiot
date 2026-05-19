'use strict';

/**
 * Returns sorted channel indices via the device public API.
 *
 * @param {import('meross-iot').MerossDevice|null|undefined} device - Device instance
 * @returns {number[]}
 */
function getChannelIds(device) {
    if (!device) {
        return [0];
    }
    if (typeof device.getChannelIds === 'function') {
        return device.getChannelIds();
    }
    const ids = device.capabilities?.channels?.ids;
    if (Array.isArray(ids) && ids.length > 0) {
        return [...ids];
    }
    if (Array.isArray(device.channels) && device.channels.length > 0) {
        return [...new Set(device.channels.map(ch => ch.index))].sort((a, b) => a - b);
    }
    return [0];
}

/**
 * Returns the primary channel index for channel-scoped feature calls.
 *
 * @param {import('meross-iot').MerossDevice|null|undefined} device - Device instance
 * @returns {number}
 */
function getPrimaryChannel(device) {
    const ids = getChannelIds(device);
    return ids[0];
}

/**
 * Resolves a control-registry channel default, falling back to the device primary channel.
 *
 * @param {Object} methodMetadata - Control method metadata
 * @param {import('meross-iot').MerossDevice} device - Device instance
 * @param {Object} [options={}] - Resolution options
 * @param {string} [options.paramName='channel'] - Channel parameter name
 * @param {string} [options.nestedIn] - Parent param name when channel is nested (e.g. `timerx`)
 * @returns {number}
 */
function resolveControlChannel(methodMetadata, device, options = {}) {
    const { paramName = 'channel', nestedIn } = options;
    let defaultValue;

    if (nestedIn) {
        defaultValue = methodMetadata.params
            ?.find(p => p.name === nestedIn)
            ?.properties
            ?.find(prop => prop.name === paramName)
            ?.default;
    } else {
        defaultValue = methodMetadata.params?.find(p => p.name === paramName)?.default;
    }

    if (defaultValue !== undefined && defaultValue !== null) {
        return defaultValue;
    }
    return getPrimaryChannel(device);
}

module.exports = {
    getChannelIds,
    getPrimaryChannel,
    resolveControlChannel
};
