'use strict';

const TriggerState = require('../../model/states/trigger-state');
const { normalizeChannel } = require('../../utilities/options');
const { createTrigger } = require('../../utilities/trigger');
const { MerossErrorValidation, MerossErrorNotFound } = require('../../model/exception');

/**
 * Trigger feature module.
 * Provides control over device triggers that can fire on/off actions based on sensor conditions.
 */
module.exports = {
    /**
     * Gets trigger information for a specific channel.
     *
     * Use {@link getCachedTriggerX} to get cached triggers without making a request.
     *
     * @param {Object} [options={}] - Get options
     * @param {number} [options.channel=0] - Channel to get triggers for (default: 0, use 65535 or 0xffff for all channels)
     * @returns {Promise<Object>} Response containing trigger data with `triggerx` array
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getTriggerX(options = {}) {
        const channel = normalizeChannel(options);
        const payload = {
            triggerx: {
                channel
            }
        };
        const response = await this.publishMessage('GET', 'Appliance.Control.TriggerX', payload);
        if (response && response.triggerx) {
            this._updateTriggerXState(response.triggerx, 'response');
        }
        return response;
    },

    /**
     * Controls a trigger (creates or updates).
     *
     * Accepts either a user-friendly format (which will be converted via createTrigger) or
     * a raw triggerx object. If a trigger ID is provided, updates the existing trigger. Otherwise,
     * creates a new trigger with a generated ID.
     *
     * @param {Object} options - Trigger options
     * @param {Object} [options.triggerx] - Raw trigger configuration object (if provided, used directly)
     * @param {string} [options.triggerx.id] - Trigger ID (required for updates, generated for new triggers)
     * @param {number} [options.triggerx.channel] - Channel the trigger belongs to
     * @param {string|number} [options.duration] - Duration as seconds (number), "30m", "1h", or "HH:MM:SS" format (user-friendly format)
     * @param {Array<string|number>|number} [options.days] - Days of week (array of names/numbers) or week bitmask (user-friendly format)
     * @param {string} [options.alias] - Trigger name/alias (user-friendly format)
     * @param {number} [options.channel] - Channel number (user-friendly format)
     * @param {boolean} [options.enabled] - Whether trigger is enabled (user-friendly format)
     * @param {string} [options.id] - Trigger ID (user-friendly format)
     * @returns {Promise<Object>} Response from the device containing the updated trigger
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setTriggerX(options = {}) {
        let triggerx;

        if (options.triggerx) {
            triggerx = options.triggerx;
        } else {
            triggerx = createTrigger(options);
        }

        const payload = { triggerx };
        const response = await this.publishMessage('SET', 'Appliance.Control.TriggerX', payload);
        if (response && response.triggerx) {
            this._updateTriggerXState(response.triggerx);
        } else if (triggerx) {
            this._updateTriggerXState([triggerx]);
        }
        return response;
    },

    /**
     * Deletes a trigger by ID.
     *
     * @param {Object} options - Delete options
     * @param {string} options.triggerId - Trigger ID to delete
     * @param {number} [options.channel=0] - Channel the trigger belongs to (default: 0)
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async deleteTriggerX(options = {}) {
        if (!options.triggerId) {
            throw new MerossErrorValidation('triggerId is required', 'triggerId');
        }
        const channel = normalizeChannel(options);
        const payload = {
            triggerx: {
                id: options.triggerId
            }
        };
        const response = await this.publishMessage('DELETE', 'Appliance.Control.TriggerX', payload);

        const channelTriggers = this._triggerxStateByChannel.get(channel);
        if (channelTriggers && Array.isArray(channelTriggers)) {
            const filtered = channelTriggers.filter(trigger => trigger.id !== options.triggerId);
            if (filtered.length === 0) {
                this._triggerxStateByChannel.delete(channel);
            } else {
                this._triggerxStateByChannel.set(channel, filtered);
            }
        }

        return response;
    },

    /**
     * Gets the cached trigger state for the specified channel.
     *
     * Returns cached triggers without making a request. Use {@link getTriggerX} to fetch
     * fresh triggers from the device. Triggers are automatically updated when commands are sent
     * or push notifications are received.
     *
     * @param {number} [channel=0] - Channel to get triggers for (default: 0)
     * @returns {Array<import('../lib/model/states/trigger-state').TriggerState>|undefined} Array of cached trigger states or undefined if not available
     * @throws {Error} If state has not been initialized (call refreshState() first)
     */
    getCachedTriggerX(channel = 0) {
        this.validateState();
        return this._triggerxStateByChannel.get(channel);
    },

    /**
     * Updates the cached trigger state from trigger data.
     *
     * Called automatically when TriggerX push notifications are received. Updates existing
     * triggers by ID or adds new ones if they don't exist.
     *
     * @param {Object|Array} triggerxData - Trigger data (single object or array)
     * @param {Object|Array} [digestData] - Optional digest data (unused)
     * @private
     */
    _updateTriggerXState(triggerxData, source = 'response') {
        if (!triggerxData) {return;}

        const triggerArray = Array.isArray(triggerxData) ? triggerxData : [triggerxData];

        for (const triggerItem of triggerArray) {
            const channelIndex = triggerItem.channel;
            if (channelIndex === undefined || channelIndex === null) {continue;}

            let channelTriggers = this._triggerxStateByChannel.get(channelIndex);
            if (!channelTriggers) {
                channelTriggers = [];
                this._triggerxStateByChannel.set(channelIndex, channelTriggers);
            }

            const oldTriggers = [...channelTriggers];
            const triggerId = triggerItem.id;
            if (triggerId) {
                const existingIndex = channelTriggers.findIndex(t => t.id === triggerId);
                if (existingIndex >= 0) {
                    channelTriggers[existingIndex].update(triggerItem);
                } else {
                    const triggerState = new TriggerState(triggerItem);
                    channelTriggers.push(triggerState);
                }
            } else {
                const triggerState = new TriggerState(triggerItem);
                channelTriggers.push(triggerState);
            }

            const newTriggers = [...channelTriggers];
            this.emit('stateChange', {
                type: 'trigger',
                channel: channelIndex,
                value: newTriggers,
                oldValue: oldTriggers,
                source,
                timestamp: Date.now()
            });
        }
    },

    /**
     * Finds a trigger by alias (name).
     *
     * @param {string} alias - Trigger alias/name to search for
     * @param {number} [channel=0] - Channel to search in
     * @returns {Promise<import('../../model/states/trigger-state').TriggerState|null>} Trigger state if found, null otherwise
     * @example
     * const trigger = await device.findTriggerByAlias('Auto-off after 30 minutes');
     * if (trigger) {
     *   console.log('Found trigger:', trigger.id);
     * }
     */
    async findTriggerByAlias(options = {}) {
        if (!options.alias) {
            throw new MerossErrorValidation('alias is required', 'alias');
        }
        const channel = normalizeChannel(options);
        const response = await this.getTriggerX({ channel });
        if (response && response.triggerx && Array.isArray(response.triggerx)) {
            const trigger = response.triggerx.find(t => t.alias === options.alias);
            if (trigger) {
                return new TriggerState(trigger);
            }
        }
        return null;
    },

    /**
     * Deletes a trigger by alias (name).
     *
     * @param {Object} options - Delete options
     * @param {string} options.alias - Trigger alias/name to delete
     * @param {number} [options.channel=0] - Channel to search in
     * @returns {Promise<Object>} Response from the device
     * @throws {Error} If trigger with alias is not found
     * @example
     * await device.deleteTriggerByAlias({alias: 'Auto-off after 30 minutes'});
     */
    async deleteTriggerByAlias(options = {}) {
        if (!options.alias) {
            throw new MerossErrorValidation('alias is required', 'alias');
        }
        const channel = normalizeChannel(options);
        const trigger = await this.findTriggerByAlias({ alias: options.alias, channel });
        if (!trigger) {
            throw new MerossErrorNotFound(`Trigger with alias "${options.alias}" not found on channel ${channel}`, 'trigger', options.alias);
        }
        return await this.deleteTriggerX({ triggerId: trigger.id, channel });
    },

    /**
     * Enables a trigger by alias (name).
     *
     * @param {Object} options - Enable options
     * @param {string} options.alias - Trigger alias/name to enable
     * @param {number} [options.channel=0] - Channel to search in
     * @returns {Promise<Object>} Response from the device
     * @throws {Error} If trigger with alias is not found
     * @example
     * await device.enableTriggerByAlias({alias: 'Auto-off after 30 minutes'});
     */
    async enableTriggerByAlias(options = {}) {
        if (!options.alias) {
            throw new MerossErrorValidation('alias is required', 'alias');
        }
        const channel = normalizeChannel(options);
        const response = await this.getTriggerX({ channel });
        if (!response || !response.triggerx || !Array.isArray(response.triggerx)) {
            throw new MerossErrorNotFound(`Trigger with alias "${options.alias}" not found on channel ${channel}`, 'trigger', options.alias);
        }

        const trigger = response.triggerx.find(t => t.alias === options.alias);
        if (!trigger) {
            throw new MerossErrorNotFound(`Trigger with alias "${options.alias}" not found on channel ${channel}`, 'trigger', options.alias);
        }

        // Update trigger with enabled state
        const updatedTrigger = {
            ...trigger,
            enable: 1
        };

        return await this.setTriggerX({ triggerx: updatedTrigger });
    },

    /**
     * Disables a trigger by alias (name).
     *
     * @param {Object} options - Disable options
     * @param {string} options.alias - Trigger alias/name to disable
     * @param {number} [options.channel=0] - Channel to search in
     * @returns {Promise<Object>} Response from the device
     * @throws {Error} If trigger with alias is not found
     * @example
     * await device.disableTriggerByAlias({alias: 'Auto-off after 30 minutes'});
     */
    async disableTriggerByAlias(options = {}) {
        if (!options.alias) {
            throw new MerossErrorValidation('alias is required', 'alias');
        }
        const channel = normalizeChannel(options);
        const response = await this.getTriggerX({ channel });
        if (!response || !response.triggerx || !Array.isArray(response.triggerx)) {
            throw new MerossErrorNotFound(`Trigger with alias "${options.alias}" not found on channel ${channel}`, 'trigger', options.alias);
        }

        const trigger = response.triggerx.find(t => t.alias === options.alias);
        if (!trigger) {
            throw new MerossErrorNotFound(`Trigger with alias "${options.alias}" not found on channel ${channel}`, 'trigger', options.alias);
        }

        // Update trigger with disabled state
        const updatedTrigger = {
            ...trigger,
            enable: 0
        };

        return await this.setTriggerX({ triggerx: updatedTrigger });
    },

    /**
     * Deletes all triggers on a channel.
     *
     * @param {Object} [options={}] - Delete options
     * @param {number} [options.channel=0] - Channel to delete triggers from
     * @returns {Promise<Array<Object>>} Array of delete responses
     * @example
     * const results = await device.deleteAllTriggers({channel: 0});
     * console.log(`Deleted ${results.length} triggers`);
     */
    async deleteAllTriggers(options = {}) {
        const channel = normalizeChannel(options);
        const response = await this.getTriggerX({ channel });
        if (!response || !response.triggerx || !Array.isArray(response.triggerx) || response.triggerx.length === 0) {
            return [];
        }

        const deletePromises = response.triggerx.map(trigger => {
            if (trigger.id) {
                return this.deleteTriggerX({ triggerId: trigger.id, channel }).catch(error => {
                    if (this.log) {
                        this.log(`Failed to delete trigger ${trigger.id}: ${error.message}`);
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

