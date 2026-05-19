'use strict';

const TriggerState = require('../states/trigger-state');
const { readCache } = require('../utilities/cache');
const { normalizeChannel } = require('../utilities/options');
const triggerUtils = require('../utilities/trigger');
const { MerossDeviceError } = require('../exception');
const { registerNamespaceDescriptor } = require('../dispatcher');

/**
 * Creates a trigger feature object for a device.
 *
 * Provides control over device triggers that can fire on/off actions based on sensor conditions.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Trigger feature object with set(), get(), and other methods
 */
function createTriggerAbility(device) {
    return {
        /**
         * Gets trigger information for a specific channel.
         *
         * Automatically uses cache if fresh (within 5 seconds), otherwise fetches from device.
         *
         * @param {Object} [options={}] - Get options
         * @param {number} [options.channel=0] - Channel to get triggers for (default: 0)
         * @returns {Promise<Object>} Response containing trigger data with `triggerx` array
         */
        async get(options = {}) {
            const channel = normalizeChannel(options);
            const cached = readCache(device, '_triggerxStateByChannel', channel);
            if (Array.isArray(cached) && cached.length > 0) {
                return {
                    triggerx: cached.map(t => t.toObject ? t.toObject() : t)
                };
            }

            // Fetch fresh state
            const payload = {
                triggerx: {
                    channel
                }
            };
            const { payload: response } = await device.publishMessage('GET', 'Appliance.Control.TriggerX', payload);
            if (response && response.triggerx) {
                updateTriggerXState(device, response.triggerx, 'response');
            }
            return response;
        },


        /**
         * Sets a trigger (creates or updates).
         *
         * @param {Object} options - Trigger options
         * @param {Object} [options.triggerx] - Raw trigger configuration object (if provided, used directly)
         * @param {string|number} [options.duration] - Duration as seconds (number), "30m", "1h", or "HH:MM:SS" format (user-friendly format)
         * @param {Array<string|number>|number} [options.days] - Days of week (array of names/numbers) or week bitmask (user-friendly format)
         * @param {string} [options.alias] - Trigger name/alias (user-friendly format)
         * @param {number} [options.channel] - Channel number (user-friendly format)
         * @param {boolean} [options.enabled] - Whether trigger is enabled (user-friendly format)
         * @param {string} [options.id] - Trigger ID (user-friendly format)
         * @returns {Promise<Object>} Response from the device
         */
        async set(options = {}) {
            let triggerx;

            if (options.triggerx) {
                triggerx = options.triggerx;
            } else {
                triggerx = triggerUtils.createTrigger(options);
            }

            const payload = { triggerx };
            const { payload: response } = await device.publishMessage('SET', 'Appliance.Control.TriggerX', payload);
            if (response && response.triggerx) {
                updateTriggerXState(device, response.triggerx);
            } else if (triggerx) {
                updateTriggerXState(device, [triggerx]);
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
         */
        async delete(options = {}) {
            if (!options.triggerId) {
                throw new MerossDeviceError('triggerId is required', 'VALIDATION_ERROR', { field: 'triggerId' });
            }
            const channel = normalizeChannel(options);
            const payload = {
                triggerx: {
                    id: options.triggerId
                }
            };
            const { payload: response } = await device.publishMessage('DELETE', 'Appliance.Control.TriggerX', payload);

            const channelTriggers = device._triggerxStateByChannel.get(channel);
            if (channelTriggers && Array.isArray(channelTriggers)) {
                const filtered = channelTriggers.filter(trigger => trigger.id !== options.triggerId);
                if (filtered.length === 0) {
                    device._triggerxStateByChannel.delete(channel);
                } else {
                    device._triggerxStateByChannel.set(channel, filtered);
                }
            }

            return response;
        },

        /**
         * Finds a trigger by alias (name).
         *
         * @param {Object} options - Find options
         * @param {string} options.alias - Trigger alias/name to search for
         * @param {number} [options.channel=0] - Channel to search in
         * @returns {Promise<import('../states/trigger-state').TriggerState|null>} Trigger state if found, null otherwise
         */
        async findTriggerByAlias(options = {}) {
            if (!options.alias) {
                throw new MerossDeviceError('alias is required', 'VALIDATION_ERROR', { field: 'alias' });
            }
            const channel = normalizeChannel(options);
            const response = await this.get({ channel });
            if (response && response.triggerx && Array.isArray(response.triggerx)) {
                const trigger = response.triggerx.find(t => t.alias === options.alias);
                if (trigger) {
                    return new TriggerState(trigger);
                }
            }
            return null;
        },

        async deleteTriggerByAlias(options = {}) {
            if (!options.alias) {
                throw new MerossDeviceError('alias is required', 'VALIDATION_ERROR', { field: 'alias' });
            }
            const channel = normalizeChannel(options);
            const trigger = await this.findTriggerByAlias({ alias: options.alias, channel });
            if (!trigger) {
                throw new MerossDeviceError(`Trigger with alias "${options.alias}" not found on channel ${channel}`, 'NOT_FOUND', { resourceType: 'trigger', resourceId: options.alias });
            }
            return await this.delete({ triggerId: trigger.id, channel });
        },

        async enableTriggerByAlias(options = {}) {
            if (!options.alias) {
                throw new MerossDeviceError('alias is required', 'VALIDATION_ERROR', { field: 'alias' });
            }
            const channel = normalizeChannel(options);
            const response = await this.get({ channel });
            if (!response || !response.triggerx || !Array.isArray(response.triggerx)) {
                throw new MerossDeviceError(`Trigger with alias "${options.alias}" not found on channel ${channel}`, 'NOT_FOUND', { resourceType: 'trigger', resourceId: options.alias });
            }

            const trigger = response.triggerx.find(t => t.alias === options.alias);
            if (!trigger) {
                throw new MerossDeviceError(`Trigger with alias "${options.alias}" not found on channel ${channel}`, 'NOT_FOUND', { resourceType: 'trigger', resourceId: options.alias });
            }

            const updatedTrigger = {
                ...trigger,
                enable: 1
            };

            return await this.set({ triggerx: updatedTrigger });
        },

        async disableTriggerByAlias(options = {}) {
            if (!options.alias) {
                throw new MerossDeviceError('alias is required', 'VALIDATION_ERROR', { field: 'alias' });
            }
            const channel = normalizeChannel(options);
            const response = await this.get({ channel });
            if (!response || !response.triggerx || !Array.isArray(response.triggerx)) {
                throw new MerossDeviceError(`Trigger with alias "${options.alias}" not found on channel ${channel}`, 'NOT_FOUND', { resourceType: 'trigger', resourceId: options.alias });
            }

            const trigger = response.triggerx.find(t => t.alias === options.alias);
            if (!trigger) {
                throw new MerossDeviceError(`Trigger with alias "${options.alias}" not found on channel ${channel}`, 'NOT_FOUND', { resourceType: 'trigger', resourceId: options.alias });
            }

            const updatedTrigger = {
                ...trigger,
                enable: 0
            };

            return await this.set({ triggerx: updatedTrigger });
        },

        async deleteAllTriggers(options = {}) {
            const channel = normalizeChannel(options);
            const response = await this.get({ channel });
            if (!response || !response.triggerx || !Array.isArray(response.triggerx) || response.triggerx.length === 0) {
                return [];
            }

            const deletePromises = response.triggerx.map(trigger => {
                if (trigger.id) {
                    return this.delete({ triggerId: trigger.id, channel }).catch(error => {
                        if (device.log) {
                            device.log(`Failed to delete trigger ${trigger.id}: ${error.message}`);
                        }
                        return null;
                    });
                }
                return Promise.resolve(null);
            });

            const results = await Promise.all(deletePromises);
            return results.filter(r => r !== null);
        },

        /**
         * Converts duration input to seconds.
         *
         * @param {string|number} duration - Duration expression
         * @returns {number} Duration in seconds
         */
        durationToSeconds(duration) {
            return triggerUtils.durationToSeconds(duration);
        },

        /**
         * Converts seconds to a human-readable duration string.
         *
         * @param {number} seconds - Duration in seconds
         * @returns {string} Human-readable duration string
         */
        secondsToDuration(seconds) {
            return triggerUtils.secondsToDuration(seconds);
        },

        /**
         * Creates a trigger payload with sane defaults.
         *
         * @param {Object} options - Trigger options
         * @returns {Object} Trigger payload for Appliance.Control.TriggerX
         */
        createTrigger(options = {}) {
            return triggerUtils.createTrigger(options);
        }
    };
}

/**
 * Updates the cached trigger state from trigger data.
 *
 * @param {Object} device - The device instance
 * @param {Object|Array} triggerxData - Trigger data (single object or array)
 * @param {string} [source='response'] - Source of the update
 */
function updateTriggerXState(device, triggerxData, source = 'response') {
    if (!device._triggerxStateByChannel) {return;}
    if (!triggerxData) {return;}

    const triggerArray = Array.isArray(triggerxData) ? triggerxData : [triggerxData];

    for (const triggerItem of triggerArray) {
        const channelIndex = triggerItem.channel;
        if (channelIndex === undefined || channelIndex === null) {continue;}

        let channelTriggers = device._triggerxStateByChannel.get(channelIndex);
        if (!channelTriggers) {
            channelTriggers = [];
            device._triggerxStateByChannel.set(channelIndex, channelTriggers);
        }

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
        device.emit('stateChange', {
            type: 'trigger',
            channel: channelIndex,
            value: newTriggers,
            source,
            timestamp: Date.now()
        });
    }
}

/**
 * Gets trigger capability information for a device.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Trigger capability object or null if not supported
 */
function getTriggerCapabilities(device, channelIds) {
    if (!device.abilities) {return null;}

    const hasTriggerX = !!device.abilities['Appliance.Control.TriggerX'];
    const hasTrigger = !!device.abilities['Appliance.Control.Trigger'];

    if (!hasTriggerX && !hasTrigger) {return null;}

    return {
        supported: true,
        channels: channelIds
    };
}

/**
 * TriggerX mirrors TimerX: list-shaped state per channel that must be ordered per
 * channel so independent channels are not cross-masked by a stale message.
 */
registerNamespaceDescriptor('Appliance.Control.TriggerX', {
    namespace: 'Appliance.Control.TriggerX',
    payloadKey: 'triggerx',
    customApplyItem: (device, item, source) => {
        updateTriggerXState(device, item, source);
    }
});

module.exports = createTriggerAbility;
/**
 * Private export for unit tests. Do not rename or change shape without updating
 * `test/trigger.test.js`.
 */
module.exports.getCapabilities = getTriggerCapabilities;

