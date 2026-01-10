'use strict';

const TimerState = require('../../model/states/timer-state');
const { normalizeChannel } = require('../../utilities/options');
const { createTimer } = require('../../utilities/timer');

/**
 * Timer feature module.
 * Provides control over device timers that can trigger on/off actions at specified times.
 */
module.exports = {
    /**
     * Gets timer information for a specific timer ID or all timers for a channel.
     *
     * Use {@link getCachedTimerX} to get cached timers without making a request.
     *
     * According to the Meross API specification, GET requests require a timer ID.
     * When a channel number is provided, this method uses Appliance.Digest.TimerX
     * to retrieve all timer IDs for that channel, then queries each timer individually.
     *
     * @param {Object} [options={}] - Get options
     * @param {string} [options.timerId] - Timer ID (string). If provided, gets specific timer
     * @param {number} [options.channel=0] - Channel number. If timerId not provided, gets all timers for this channel
     * @returns {Promise<Object>} Response containing timer data with `timerx` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getTimerX(options = {}) {
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
            const response = await this.publishMessage('GET', 'Appliance.Control.TimerX', payload);
            if (response && response.timerx) {
                this._updateTimerXState(response.timerx, 'response');
                return response;
            }
        } catch (error) {
        }

        const cachedTimers = this.getCachedTimerX ? this.getCachedTimerX() : null;
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
        const cachedTimers = this.getCachedTimerX ? this.getCachedTimerX(channel) : null;
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
            const digestResponse = await this.getTimerXDigest();
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
                this._updateTimerXState(allTimers, 'response');
                return combinedResponse;
            }
        } catch (error) {
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
            return this.publishMessage('GET', 'Appliance.Control.TimerX', payload).catch(() => null);
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
     * Controls a timer (creates or updates).
     *
     * Accepts either a user-friendly format (which will be converted via createTimer) or
     * a raw timerx object. If a timer ID is provided, updates the existing timer. Otherwise,
     * creates a new timer with a generated ID.
     *
     * @param {Object} options - Timer options
     * @param {Object} [options.timerx] - Raw timer configuration object (if provided, used directly)
     * @param {string} [options.timerx.id] - Timer ID (required for updates, generated for new timers)
     * @param {number} [options.timerx.channel] - Channel the timer belongs to
     * @param {number} [options.timerx.onoff] - Turn device on (1) or off (0) when timer triggers
     * @param {number} [options.timerx.type] - Timer type (use TimerType enum)
     * @param {number} [options.timerx.time] - Time value (depends on timer type)
     * @param {string|Date|number} [options.time] - Time in HH:MM format, Date object, or minutes (user-friendly format)
     * @param {Array<string|number>|number} [options.days] - Days of week (array of names/numbers) or week bitmask (user-friendly format)
     * @param {boolean} [options.on] - Whether to turn device on (true) or off (false) when timer triggers (user-friendly format)
     * @param {string} [options.alias] - Timer name/alias (user-friendly format)
     * @param {number} [options.channel] - Channel number (user-friendly format)
     * @param {boolean} [options.enabled] - Whether timer is enabled (user-friendly format)
     * @param {string} [options.id] - Timer ID (user-friendly format)
     * @returns {Promise<Object>} Response from the device containing the updated timer
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setTimerX(options = {}) {
        let timerx;

        if (options.timerx) {
            timerx = options.timerx;
        } else {
            timerx = createTimer(options);
        }

        const payload = { timerx };
        const response = await this.publishMessage('SET', 'Appliance.Control.TimerX', payload);
        if (response && response.timerx) {
            this._updateTimerXState(response.timerx);
        } else if (timerx) {
            this._updateTimerXState([timerx]);
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
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async deleteTimerX(options = {}) {
        if (!options.timerId) {
            throw new Error('timerId is required');
        }
        const channel = normalizeChannel(options);
        const payload = {
            timerx: {
                id: options.timerId
            }
        };
        const response = await this.publishMessage('DELETE', 'Appliance.Control.TimerX', payload);

        const channelTimers = this._timerxStateByChannel.get(channel);
        if (channelTimers && Array.isArray(channelTimers)) {
            const filtered = channelTimers.filter(timer => timer.id !== options.timerId);
            if (filtered.length === 0) {
                this._timerxStateByChannel.delete(channel);
            } else {
                this._timerxStateByChannel.set(channel, filtered);
            }
        }

        return response;
    },

    /**
     * Gets the cached timer state for the specified channel.
     *
     * Returns cached timers without making a request. Use {@link getTimerX} to fetch
     * fresh timers from the device. Timers are automatically updated when commands are sent
     * or push notifications are received.
     *
     * @param {number} [channel=0] - Channel to get timers for (default: 0)
     * @returns {Array<import('../lib/model/states/timer-state').TimerState>|undefined} Array of cached timer states or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getCachedTimerX(channel = 0) {
        this.validateState();
        return this._timerxStateByChannel.get(channel);
    },

    /**
     * Updates the cached timer state from timer data.
     *
     * Called automatically when TimerX push notifications are received. Updates existing
     * timers by ID or adds new ones if they don't exist.
     *
     * @param {Object|Array} timerxData - Timer data (single object or array)
     * @param {Object|Array} [digestData] - Optional digest data (unused)
     * @private
     */
    _updateTimerXState(timerxData, source = 'response') {
        if (!timerxData) {return;}

        const timerArray = Array.isArray(timerxData) ? timerxData : [timerxData];

        for (const timerItem of timerArray) {
            const channelIndex = timerItem.channel;
            if (channelIndex === undefined || channelIndex === null) {continue;}

            let channelTimers = this._timerxStateByChannel.get(channelIndex);
            if (!channelTimers) {
                channelTimers = [];
                this._timerxStateByChannel.set(channelIndex, channelTimers);
            }

            const oldTimers = [...channelTimers];
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
            this.emit('stateChange', {
                type: 'timer',
                channel: channelIndex,
                value: newTimers,
                oldValue: oldTimers,
                source,
                timestamp: Date.now()
            });
        }
    },


    /**
     * Finds a timer by alias (name).
     *
     * @param {string} alias - Timer alias/name to search for
     * @param {number} [channel=0] - Channel to search in
     * @returns {Promise<import('../../model/states/timer-state').TimerState|null>} Timer state if found, null otherwise
     * @example
     * const timer = await device.findTimerByAlias('Morning Lights');
     * if (timer) {
     *   console.log('Found timer:', timer.id);
     * }
     */
    async findTimerByAlias(options = {}) {
        if (!options.alias) {
            throw new Error('alias is required');
        }
        const channel = normalizeChannel(options);
        const response = await this.getTimerX({ channel });
        if (response && response.timerx && Array.isArray(response.timerx)) {
            const timer = response.timerx.find(t => t.alias === options.alias);
            if (timer) {
                return new TimerState(timer);
            }
        }
        return null;
    },

    /**
     * Deletes a timer by alias (name).
     *
     * @param {Object} options - Delete options
     * @param {string} options.alias - Timer alias/name to delete
     * @param {number} [options.channel=0] - Channel to search in
     * @returns {Promise<Object>} Response from the device
     * @throws {Error} If timer with alias is not found
     * @example
     * await device.deleteTimerByAlias({alias: 'Morning Lights'});
     */
    async deleteTimerByAlias(options = {}) {
        if (!options.alias) {
            throw new Error('alias is required');
        }
        const channel = normalizeChannel(options);
        const timer = await this.findTimerByAlias({ alias: options.alias, channel });
        if (!timer) {
            throw new Error(`Timer with alias "${options.alias}" not found on channel ${channel}`);
        }
        return await this.deleteTimerX({ timerId: timer.id, channel });
    },

    /**
     * Enables a timer by alias (name).
     *
     * @param {Object} options - Enable options
     * @param {string} options.alias - Timer alias/name to enable
     * @param {number} [options.channel=0] - Channel to search in
     * @returns {Promise<Object>} Response from the device
     * @throws {Error} If timer with alias is not found
     * @example
     * await device.enableTimerByAlias({alias: 'Morning Lights'});
     */
    async enableTimerByAlias(options = {}) {
        if (!options.alias) {
            throw new Error('alias is required');
        }
        const channel = normalizeChannel(options);
        const response = await this.getTimerX({ channel });
        if (!response || !response.timerx || !Array.isArray(response.timerx)) {
            throw new Error(`Timer with alias "${options.alias}" not found on channel ${channel}`);
        }

        const timer = response.timerx.find(t => t.alias === options.alias);
        if (!timer) {
            throw new Error(`Timer with alias "${options.alias}" not found on channel ${channel}`);
        }

        // Update timer with enabled state
        const updatedTimer = {
            ...timer,
            enable: 1
        };

        return await this.setTimerX({ timerx: updatedTimer });
    },

    /**
     * Disables a timer by alias (name).
     *
     * @param {Object} options - Disable options
     * @param {string} options.alias - Timer alias/name to disable
     * @param {number} [options.channel=0] - Channel to search in
     * @returns {Promise<Object>} Response from the device
     * @throws {Error} If timer with alias is not found
     * @example
     * await device.disableTimerByAlias({alias: 'Morning Lights'});
     */
    async disableTimerByAlias(options = {}) {
        if (!options.alias) {
            throw new Error('alias is required');
        }
        const channel = normalizeChannel(options);
        const response = await this.getTimerX({ channel });
        if (!response || !response.timerx || !Array.isArray(response.timerx)) {
            throw new Error(`Timer with alias "${options.alias}" not found on channel ${channel}`);
        }

        const timer = response.timerx.find(t => t.alias === options.alias);
        if (!timer) {
            throw new Error(`Timer with alias "${options.alias}" not found on channel ${channel}`);
        }

        // Update timer with disabled state
        const updatedTimer = {
            ...timer,
            enable: 0
        };

        return await this.setTimerX({ timerx: updatedTimer });
    },

    /**
     * Deletes all timers on a channel.
     *
     * @param {Object} [options={}] - Delete options
     * @param {number} [options.channel=0] - Channel to delete timers from
     * @returns {Promise<Array<Object>>} Array of delete responses
     * @example
     * const results = await device.deleteAllTimers({channel: 0});
     * console.log(`Deleted ${results.length} timers`);
     */
    async deleteAllTimers(options = {}) {
        const channel = normalizeChannel(options);
        const response = await this.getTimerX({ channel });
        if (!response || !response.timerx || !Array.isArray(response.timerx) || response.timerx.length === 0) {
            return [];
        }

        const deletePromises = response.timerx.map(timer => {
            if (timer.id) {
                return this.deleteTimerX({ timerId: timer.id, channel }).catch(error => {
                    if (this.log) {
                        this.log(`Failed to delete timer ${timer.id}: ${error.message}`);
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

