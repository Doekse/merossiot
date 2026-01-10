'use strict';

/**
 * Channel metadata for a device.
 *
 * Encapsulates channel information parsed from device initialization data. Devices
 * can have multiple channels (e.g., master channel at index 0, sub-channels at 1-n),
 * each representing a separate control point or feature. The master channel typically
 * controls the primary device functions.
 *
 * @class
 * @example
 * const channels = device.channels;
 * channels.forEach(channel => {
 *     console.log(`Channel ${channel.index}: ${channel.name} (USB: ${channel.isUsb})`);
 * });
 */
class ChannelInfo {
    /**
     * Creates a new ChannelInfo instance.
     *
     * @param {number} index - Channel index (0 for master channel, 1-n for sub-channels)
     * @param {string} [name] - Channel name (defaults to 'Main channel' for index 0)
     * @param {string} [channelType] - Channel type (e.g., 'USB')
     * @param {boolean} [isMasterChannel=false] - Whether this is the master channel
     */
    constructor(index, name = null, channelType = null, isMasterChannel = false) {
        this._index = index;
        this._name = name;
        this._type = channelType;
        this._master = isMasterChannel;
    }

    /**
     * Gets the channel index.
     *
     * The index identifies which channel this represents. Index 0 is reserved for
     * the master channel, while indices 1-n represent sub-channels or additional
     * control points.
     *
     * @returns {number} Channel index (0 for master, 1-n for sub-channels)
     */
    get index() {
        return this._index;
    }

    /**
     * Gets the channel name.
     *
     * @returns {string|null} Channel name or null if not set
     */
    get name() {
        return this._name;
    }

    /**
     * Gets whether this channel is a USB channel.
     *
     * @returns {boolean} True if channel type is 'USB', false otherwise
     */
    get isUsb() {
        return this._type === 'USB';
    }

    /**
     * Gets whether this is the master channel.
     *
     * The master channel (typically at index 0) represents the primary device control
     * point. Commands sent without a channel specification default to the master channel.
     *
     * @returns {boolean} True if this is the master channel, false otherwise
     */
    get isMasterChannel() {
        return this._master;
    }
}

module.exports = ChannelInfo;

