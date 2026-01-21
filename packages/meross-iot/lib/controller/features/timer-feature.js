'use strict';

const TimerState = require('../../model/states/timer-state');
const { normalizeChannel } = require('../../utilities/options');
const { createTimer } = require('../../utilities/timer');
const { MerossErrorValidation, MerossErrorNotFound } = require('../../model/exception');

/**
 * Creates a timer feature object for a device.
 *
 * Provides control over device timers that can trigger on/off actions at specified times.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Timer feature object with set(), get(), and other methods
 */
function createTimerFeature(device) {
    return {
        /**
         * Gets timer information for a specific timer ID or all timers for a channel.
         *
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from device.
         *
         * @param {Object} [options={}] - Get options
         * @param {string} [options.timerId] - Timer ID (string). If provided, gets specific timer
         * @param {number} [options.channel=0] - Channel number. If timerId not provided, gets all timers for this channel
         * @returns {Promise<Object>} Response containing timer data with `timerx` array
         */
        async get(options = {}) {
            if (options.timerId && typeof options.timerId === 'string') {
                return await this._getTimerXById(options.timerId);
            }
            return await this._getTimerXByChannel(normalizeChannel(options));
        },

        /**
         * Gets a timer by its ID.
         * Tries GET request first, then falls back to cached state.
         *
         * @param {string} timerId - Timer ID to retrieve
         * @returns {Promise<Object>} Response containing timer data
         * @private
         */
        async _getTimerXById(timerId) {
            try {
                const payload = {
                    timerx: {
                        id: timerId
                    }
                };
                const response = await device.publishMessage('GET', 'Appliance.Control.TimerX', payload);
                if (response && response.timerx) {
                    updateTimerXState(device, response.timerx, 'response');
                    return response;
                }
            } catch (error) {
                // Fall back to cache if GET request fails
            }

            const cachedTimers = device._timerxStateByChannel.get(0);
            if (cachedTimers && Array.isArray(cachedTimers)) {
                const timer = cachedTimers.find(t => t.id === timerId);
                if (timer) {
                    return {
                        timerx: timer.toObject ? timer.toObject() : timer,
                        digest: []
                    };
                }
            }

            return this._buildEmptyTimerResponse();
        },

        /**
         * Gets all timers for a specific channel.
         * Tries cached state first, then falls back to GET requests via digest.
         *
         * @param {number} channel - Channel number
         * @returns {Promise<Object>} Response containing timer data
         * @private
         */
        async _getTimerXByChannel(channel) {
            const cachedResponse = this._getTimerXFromCache(channel);
            if (cachedResponse) {
                return cachedResponse;
            }

            return await this._queryTimerXByChannel(channel);
        },

        /**
         * Gets timers from cache for a specific channel.
         *
         * @param {number} channel - Channel number
         * @returns {Object|null} Response containing cached timer data, or null if not available
         * @private
         */
        _getTimerXFromCache(channel) {
            const cachedTimers = device._timerxStateByChannel.get(channel);
            if (cachedTimers && Array.isArray(cachedTimers) && cachedTimers.length > 0) {
                return {
                    timerx: cachedTimers.map(t => t.toObject ? t.toObject() : t),
                    digest: cachedTimers.map(t => ({
                        id: t.id,
                        channel: t.channel,
                        count: t.count
                    }))
                };
            }
            return null;
        },

        /**
         * Queries timers for a channel from the device by fetching digest and querying each timer individually.
         *
         * @param {number} channel - Channel number
         * @returns {Promise<Object>} Response containing timer data
         * @private
         */
        async _queryTimerXByChannel(channel) {
            try {
                const digestResponse = await device.digestTimer.get();
                if (!digestResponse || !digestResponse.digest || !Array.isArray(digestResponse.digest)) {
                    return this._buildEmptyTimerResponse();
                }

                const channelTimerIds = this._extractTimerIdsForChannel(digestResponse.digest, channel);
                if (channelTimerIds.length === 0) {
                    return this._buildEmptyTimerResponse();
                }

                const allTimers = await this._queryTimersByIds(channelTimerIds);
                if (allTimers.length > 0) {
                    const combinedResponse = {
                        timerx: allTimers,
                        digest: digestResponse.digest.filter(d => d.channel === channel)
                    };
                    updateTimerXState(device, allTimers, 'response');
                    return combinedResponse;
                }
            } catch (error) {
                // Return empty response if query fails
            }

            return this._buildEmptyTimerResponse();
        },

        /**
         * Extracts timer IDs for a specific channel from digest data.
         *
         * @param {Array} digest - Digest array from getTimerXDigest response
         * @param {number} channel - Channel number
         * @returns {Array<string>} Array of timer IDs for the channel
         * @private
         */
        _extractTimerIdsForChannel(digest, channel) {
            return digest
                .filter(d => d.channel === channel)
                .map(d => d.id);
        },

        /**
         * Queries multiple timers by their IDs in parallel.
         *
         * @param {Array<string>} timerIds - Array of timer IDs to query
         * @returns {Promise<Array>} Array of timer objects
         * @private
         */
        async _queryTimersByIds(timerIds) {
            const timerPromises = timerIds.map(id => {
                const payload = { timerx: { id } };
                return device.publishMessage('GET', 'Appliance.Control.TimerX', payload).catch(() => null);
            });

            const timerResponses = await Promise.all(timerPromises);
            return this._parseTimerResponses(timerResponses);
        },

        /**
         * Parses timer responses and extracts timer data, handling both array and single object formats.
         *
         * @param {Array} timerResponses - Array of timer response objects
         * @returns {Array} Flattened array of timer objects
         * @private
         */
        _parseTimerResponses(timerResponses) {
            return timerResponses
                .filter(r => r && r.timerx)
                .map(r => {
                    const timerx = r.timerx;
                    return Array.isArray(timerx) ? timerx : [timerx];
                })
                .flat();
        },

        /**
         * Builds an empty timer response object.
         *
         * @returns {Object} Empty response with timerx and digest arrays
         * @private
         */
        _buildEmptyTimerResponse() {
            return {
                timerx: [],
                digest: []
            };
        },

        /**
         * Sets a timer (creates or updates).
         *
         * @param {Object} options - Timer options
         * @param {Object} [options.timerx] - Raw timer configuration object (if provided, used directly)
         * @param {string|Date|number} [options.time] - Time in HH:MM format, Date object, or minutes (user-friendly format)
         * @param {Array<string|number>|number} [options.days] - Days of week (array of names/numbers) or week bitmask (user-friendly format)
         * @param {boolean} [options.on] - Whether to turn device on (true) or off (false) when timer triggers (user-friendly format)
         * @param {string} [options.alias] - Timer name/alias (user-friendly format)
         * @param {number} [options.channel] - Channel number (user-friendly format)
         * @param {boolean} [options.enabled] - Whether timer is enabled (user-friendly format)
         * @param {string} [options.id] - Timer ID (user-friendly format)
         * @returns {Promise<Object>} Response from the device
         */
        async set(options = {}) {
            let timerx;

            if (options.timerx) {
                timerx = options.timerx;
            } else {
                timerx = createTimer(options);
            }

            const payload = { timerx };
            const response = await device.publishMessage('SET', 'Appliance.Control.TimerX', payload);
            if (response && response.timerx) {
                updateTimerXState(device, response.timerx);
            } else if (timerx) {
                updateTimerXState(device, [timerx]);
            }
            return response;
        },

        /**
         * Deletes a timer by ID.
         *
         * @param {Object} options - Delete options
         * @param {string} options.timerId - Timer ID to delete
         * @param {number} [options.channel=0] - Channel the timer belongs to (default: 0)
         * @returns {Promise<Object>} Response from the device
         */
        async delete(options = {}) {
            if (!options.timerId) {
                throw new MerossErrorValidation('timerId is required', 'timerId');
            }
            const channel = normalizeChannel(options);
            const payload = {
                timerx: {
                    id: options.timerId
                }
            };
            const response = await device.publishMessage('DELETE', 'Appliance.Control.TimerX', payload);

            const channelTimers = device._timerxStateByChannel.get(channel);
            if (channelTimers && Array.isArray(channelTimers)) {
                const filtered = channelTimers.filter(timer => timer.id !== options.timerId);
                if (filtered.length === 0) {
                    device._timerxStateByChannel.delete(channel);
                } else {
                    device._timerxStateByChannel.set(channel, filtered);
                }
            }

            return response;
        },

        /**
         * Finds a timer by alias (name).
         *
         * @param {Object} options - Find options
         * @param {string} options.alias - Timer alias/name to search for
         * @param {number} [options.channel=0] - Channel to search in
         * @returns {Promise<import('../../model/states/timer-state').TimerState|null>} Timer state if found, null otherwise
         */
        async findTimerByAlias(options = {}) {
            if (!options.alias) {
                throw new MerossErrorValidation('alias is required', 'alias');
            }
            const channel = normalizeChannel(options);
            const response = await this.get({ channel });
            if (response && response.timerx && Array.isArray(response.timerx)) {
                const timer = response.timerx.find(t => t.alias === options.alias);
                if (timer) {
                    return new TimerState(timer);
                }
            }
            return null;
        },

        /**
         * Deletes a timer by its alias (name).
         *
         * @param {Object} options - Delete options
         * @param {string} options.alias - Timer alias/name to delete
         * @param {number} [options.channel=0] - Channel the timer belongs to
         * @returns {Promise<Object>} Response from the device
         */
        async deleteTimerByAlias(options = {}) {
            if (!options.alias) {
                throw new MerossErrorValidation('alias is required', 'alias');
            }
            const channel = normalizeChannel(options);
            const timer = await this.findTimerByAlias({ alias: options.alias, channel });
            if (!timer) {
                throw new MerossErrorNotFound(`Timer with alias "${options.alias}" not found on channel ${channel}`, 'timer', options.alias);
            }
            return await this.delete({ timerId: timer.id, channel });
        },

        /**
         * Enables a timer by its alias (name).
         *
         * @param {Object} options - Enable options
         * @param {string} options.alias - Timer alias/name to enable
         * @param {number} [options.channel=0] - Channel the timer belongs to
         * @returns {Promise<Object>} Response from the device
         */
        async enableTimerByAlias(options = {}) {
            if (!options.alias) {
                throw new MerossErrorValidation('alias is required', 'alias');
            }
            const channel = normalizeChannel(options);
            const response = await this.get({ channel });
            if (!response || !response.timerx || !Array.isArray(response.timerx)) {
                throw new MerossErrorNotFound(`Timer with alias "${options.alias}" not found on channel ${channel}`, 'timer', options.alias);
            }

            const timer = response.timerx.find(t => t.alias === options.alias);
            if (!timer) {
                throw new MerossErrorNotFound(`Timer with alias "${options.alias}" not found on channel ${channel}`, 'timer', options.alias);
            }

            const updatedTimer = {
                ...timer,
                enable: 1
            };

            return await this.set({ timerx: updatedTimer });
        },

        /**
         * Disables a timer by its alias (name).
         *
         * @param {Object} options - Disable options
         * @param {string} options.alias - Timer alias/name to disable
         * @param {number} [options.channel=0] - Channel the timer belongs to
         * @returns {Promise<Object>} Response from the device
         */
        async disableTimerByAlias(options = {}) {
            if (!options.alias) {
                throw new MerossErrorValidation('alias is required', 'alias');
            }
            const channel = normalizeChannel(options);
            const response = await this.get({ channel });
            if (!response || !response.timerx || !Array.isArray(response.timerx)) {
                throw new MerossErrorNotFound(`Timer with alias "${options.alias}" not found on channel ${channel}`, 'timer', options.alias);
            }

            const timer = response.timerx.find(t => t.alias === options.alias);
            if (!timer) {
                throw new MerossErrorNotFound(`Timer with alias "${options.alias}" not found on channel ${channel}`, 'timer', options.alias);
            }

            const updatedTimer = {
                ...timer,
                enable: 0
            };

            return await this.set({ timerx: updatedTimer });
        },

        /**
         * Deletes all timers for a channel.
         *
         * @param {Object} options - Delete options
         * @param {number} [options.channel=0] - Channel to delete timers from
         * @returns {Promise<Array<Object>>} Array of successful delete responses
         */
        async deleteAllTimers(options = {}) {
            const channel = normalizeChannel(options);
            const response = await this.get({ channel });
            if (!response || !response.timerx || !Array.isArray(response.timerx) || response.timerx.length === 0) {
                return [];
            }

            const deletePromises = response.timerx.map(timer => {
                if (timer.id) {
                    return this.delete({ timerId: timer.id, channel }).catch(error => {
                        if (device.log) {
                            device.log(`Failed to delete timer ${timer.id}: ${error.message}`);
                        }
                        return null;
                    });
                }
                return Promise.resolve(null);
            });

            const results = await Promise.all(deletePromises);
            return results.filter(r => r !== null);
        }
    };
}

/**
 * Updates the cached timer state from timer data.
 *
 * @param {Object} device - The device instance
 * @param {Object|Array} timerxData - Timer data (single object or array)
 * @param {string} [source='response'] - Source of the update
 */
function updateTimerXState(device, timerxData, source = 'response') {
    if (!timerxData) {return;}

    const timerArray = Array.isArray(timerxData) ? timerxData : [timerxData];

    for (const timerItem of timerArray) {
        const channelIndex = timerItem.channel;
        if (channelIndex === undefined || channelIndex === null) {continue;}

        let channelTimers = device._timerxStateByChannel.get(channelIndex);
        if (!channelTimers) {
            channelTimers = [];
            device._timerxStateByChannel.set(channelIndex, channelTimers);
        }

        const timerId = timerItem.id;
        if (timerId) {
            const existingIndex = channelTimers.findIndex(t => t.id === timerId);
            if (existingIndex >= 0) {
                channelTimers[existingIndex].update(timerItem);
            } else {
                const timerState = new TimerState(timerItem);
                channelTimers.push(timerState);
            }
        } else {
            const timerState = new TimerState(timerItem);
            channelTimers.push(timerState);
        }

        const newTimers = [...channelTimers];
        device.emit('state', {
            type: 'timer',
            channel: channelIndex,
            value: newTimers,
            source,
            timestamp: Date.now()
        });
    }
}

/**
 * Gets timer capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Timer capability object or null if not supported
 */
function getTimerCapabilities(device, channelIds) {
    if (!device.abilities) {return null;}

    const hasTimerX = !!device.abilities['Appliance.Control.TimerX'];
    const hasTimer = !!device.abilities['Appliance.Control.Timer'];

    if (!hasTimerX && !hasTimer) {return null;}

    return {
        supported: true,
        channels: channelIds
    };
}

module.exports = createTimerFeature;
module.exports._updateTimerXState = updateTimerXState;
module.exports.getCapabilities = getTimerCapabilities;

