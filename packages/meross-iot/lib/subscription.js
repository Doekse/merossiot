'use strict';

/**
 * Provides automatic polling and data provisioning for Meross devices.
 *
 * Combines push notifications with polling to provide a unified update stream.
 * This abstraction allows platforms to subscribe to devices and receive automatic
 * updates without managing polling intervals, caching logic, or handling the
 * complexity of coordinating push notifications with periodic polling.
 *
 * @class
 */
class SubscriptionManager {
    /**
     * Creates a new SubscriptionManager instance
     *
     * @param {Object} manager - MerossManager instance
     * @param {Object} [options={}] - Configuration options
     * @param {Function} [options.logger] - Logger function for debug output
     * @param {number} [options.deviceStateInterval=30000] - Device state polling interval in ms (30s)
     * @param {number} [options.electricityInterval=30000] - Electricity polling interval in ms (30s)
     * @param {number} [options.consumptionInterval=60000] - Consumption polling interval in ms (60s)
     * @param {number} [options.httpDeviceListInterval=120000] - HTTP device list polling interval in ms (120s)
     * @param {boolean} [options.smartCaching=true] - Enable smart caching to avoid unnecessary polls
     * @param {number} [options.cacheMaxAge=10000] - Max cache age in ms before refreshing (10s)
     */
    constructor(manager, options = {}) {
        if (!manager) {
            throw new Error('Manager instance is required');
        }

        this.manager = manager;
        this.logger = options.logger || (() => {});

        this.defaultConfig = {
            deviceStateInterval: options.deviceStateInterval || 30000,
            electricityInterval: options.electricityInterval || 30000,
            consumptionInterval: options.consumptionInterval || 60000,
            httpDeviceListInterval: options.httpDeviceListInterval || 120000,
            smartCaching: options.smartCaching !== false,
            cacheMaxAge: options.cacheMaxAge || 10000
        };

        // Tracks subscription state for each device (deviceUuid -> SubscriptionState)
        this.subscriptions = new Map();

        // HTTP device list polling tracks device additions/removals from the cloud API
        this.httpPollInterval = null;
        this.httpSubscribers = new Map();
        this._lastDeviceList = null;
    }

    /**
     * Subscribe to device updates
     *
     * @param {MerossDevice} device - Device to subscribe to
     * @param {Object} [config={}] - Subscription configuration (optional, uses defaults)
     * @param {number} [config.deviceStateInterval] - Device state polling interval in ms
     * @param {number} [config.electricityInterval] - Electricity polling interval in ms
     * @param {number} [config.consumptionInterval] - Consumption polling interval in ms
     * @param {boolean} [config.smartCaching] - Enable smart caching
     * @param {number} [config.cacheMaxAge] - Max cache age in ms
     * @param {Function} [onUpdate] - Callback for updates: (update) => {}
     * @returns {string} Subscription ID
     */
    subscribe(device, config = {}, onUpdate = null) {
        const deviceUuid = device.uuid;

        if (!this.subscriptions.has(deviceUuid)) {
            this._createSubscription(device);
        }

        const subscription = this.subscriptions.get(deviceUuid);
        const subId = `${deviceUuid}-${Date.now()}-${Math.random()}`;

        subscription.subscribers.set(subId, {
            config: { ...this.defaultConfig, ...config },
            onUpdate: onUpdate || (() => {}),
            subscribedAt: Date.now()
        });

        // Start polling if this is the first subscriber
        if (subscription.subscribers.size === 1) {
            this._startPolling(device, subscription);
        }

        this.logger(`Subscribed to device ${device.name} (${deviceUuid}). Total subscribers: ${subscription.subscribers.size}`);

        return subId;
    }

    /**
     * Unsubscribe from device updates
     *
     * @param {string} deviceUuid - Device UUID
     * @param {string} subscriptionId - Subscription ID returned from subscribe()
     */
    unsubscribe(deviceUuid, subscriptionId) {
        const subscription = this.subscriptions.get(deviceUuid);
        if (!subscription) {
            return;
        }

        subscription.subscribers.delete(subscriptionId);

        // Stop polling if no more subscribers
        if (subscription.subscribers.size === 0) {
            this._stopPolling(deviceUuid);
            this.subscriptions.delete(deviceUuid);
            this.logger(`Unsubscribed from device ${deviceUuid}. No more subscribers.`);
        } else {
            this.logger(`Unsubscribed from device ${deviceUuid}. Remaining subscribers: ${subscription.subscribers.size}`);
        }
    }

    /**
     * Subscribe to HTTP device list updates
     *
     * @param {Function} [onUpdate] - Callback: (devices) => {}
     * @returns {string} Subscription ID
     */
    subscribeToDeviceList(onUpdate = null) {
        const subId = `deviceList-${Date.now()}-${Math.random()}`;
        this.httpSubscribers.set(subId, {
            onUpdate: onUpdate || (() => {}),
            subscribedAt: Date.now()
        });

        // Start HTTP polling if this is the first subscriber
        if (this.httpSubscribers.size === 1) {
            this._startHttpPolling();
        }

        // Immediately fetch current device list
        this._pollHttpDeviceList();

        return subId;
    }

    /**
     * Unsubscribe from HTTP device list updates
     *
     * @param {string} subscriptionId - Subscription ID
     */
    unsubscribeFromDeviceList(subscriptionId) {
        this.httpSubscribers.delete(subscriptionId);

        if (this.httpSubscribers.size === 0) {
            this._stopHttpPolling();
        }
    }

    /**
     * Cleanup all subscriptions and stop all polling
     */
    destroy() {
        // Stop all device polling
        this.subscriptions.forEach((subscription, deviceUuid) => {
            this._stopPolling(deviceUuid);
        });

        this.subscriptions.clear();

        // Stop HTTP polling
        this._stopHttpPolling();
        this.httpSubscribers.clear();
    }

    /**
     * Create subscription state for a device
     * @private
     */
    _createSubscription(device) {
        const subscription = {
            device,
            subscribers: new Map(),
            pollingIntervals: new Map(), // feature -> interval handle
            lastPollTimes: new Map(),   // feature -> timestamp
            lastUpdate: null,            // Last unified update
            pushActive: false,          // Whether push notifications are active
            pushLastSeen: null          // Last push notification timestamp
        };

        this.subscriptions.set(device.uuid, subscription);

        // Listen to push notifications (only to mark push as active for smart polling)
        device.on('pushNotification', () => {
            this._markPushActive(device.uuid);
        });

        // Listen to stateChange events (unified handler for all state changes)
        device.on('stateChange', (event) => {
            this._handleStateChange(device.uuid, event);
        });

        // Listen to stateRefreshed events
        device.on('stateRefreshed', (data) => {
            this._handleStateRefreshed(device.uuid, data);
        });
    }

    /**
     * Start polling for a device.
     *
     * @private
     */
    _startPolling(device, subscription) {
        // Use the most aggressive polling config from all subscribers to ensure
        // all subscribers receive updates at least as frequently as they require
        const config = this._getAggressiveConfig(subscription);

        // Poll device state (System.All)
        if (config.deviceStateInterval > 0) {
            const interval = setInterval(async () => {
                await this._pollDeviceState(device, subscription);
            }, config.deviceStateInterval);

            subscription.pollingIntervals.set('deviceState', interval);

            // Poll immediately
            this._pollDeviceState(device, subscription);
        }

        // Poll electricity if device supports it
        if (config.electricityInterval > 0 && typeof device.getElectricity === 'function') {
            const interval = setInterval(async () => {
                await this._pollElectricity(device, subscription, config);
            }, config.electricityInterval);

            subscription.pollingIntervals.set('electricity', interval);
        }

        // Poll consumption if device supports it
        if (config.consumptionInterval > 0 && typeof device.getPowerConsumption === 'function') {
            const interval = setInterval(async () => {
                await this._pollConsumption(device, subscription, config);
            }, config.consumptionInterval);

            subscription.pollingIntervals.set('consumption', interval);
        }
    }

    /**
     * Stop polling for a device
     * @private
     */
    _stopPolling(deviceUuid) {
        const subscription = this.subscriptions.get(deviceUuid);
        if (!subscription) {
            return;
        }

        subscription.pollingIntervals.forEach((interval) => {
            clearInterval(interval);
        });

        subscription.pollingIntervals.clear();
    }

    /**
     * Poll device state (System.All)
     * @private
     */
    async _pollDeviceState(device, subscription) {
        // Skip polling if push notifications are active and recent to avoid
        // redundant requests when the device is already sending updates via push
        if (subscription.pushActive && subscription.pushLastSeen) {
            const timeSincePush = Date.now() - subscription.pushLastSeen;
            if (timeSincePush < 5000) {
                return;
            }
        }

        // Check cache age if smart caching is enabled to avoid unnecessary polls
        // when cached data is still fresh, reducing network traffic and device load
        const config = this._getAggressiveConfig(subscription);
        if (config.smartCaching && device._lastFullUpdateTimestamp) {
            const cacheAge = Date.now() - device._lastFullUpdateTimestamp;
            if (cacheAge < config.cacheMaxAge) {
                this._emitCachedState(device, subscription);
                return;
            }
        }

        try {
            await device.refreshState();
            subscription.lastPollTimes.set('deviceState', Date.now());
        } catch (error) {
            this.logger(`Error polling device state for ${device.uuid}: ${error.message}`);
        }
    }

    /**
     * Poll electricity metrics
     * @private
     */
    async _pollElectricity(device, subscription, config) {
        // Skip polling if push notifications are active to avoid redundant requests
        if (subscription.pushActive) {
            return;
        }

        try {
            // Check cache first if smart caching enabled to avoid unnecessary polls
            // when cached data is still fresh
            if (config.smartCaching && typeof device.getCachedElectricity === 'function') {
                const channels = device.channels || [{ index: 0 }];
                let allCached = true;

                for (const channel of channels) {
                    const cached = device.getCachedElectricity(channel.index);
                    if (!cached || !cached.sampleTimestamp) {
                        allCached = false;
                        break;
                    }
                    const age = Date.now() - cached.sampleTimestamp.getTime();
                    if (age >= config.cacheMaxAge) {
                        allCached = false;
                        break;
                    }
                }

                if (allCached) {
                    return;
                }
            }

            // Poll all channels
            const channels = device.channels || [{ index: 0 }];
            for (const channel of channels) {
                await device.getElectricity({ channel: channel.index });
            }

            subscription.lastPollTimes.set('electricity', Date.now());
        } catch (error) {
            this.logger(`Error polling electricity for ${device.uuid}: ${error.message}`);
        }
    }

    /**
     * Poll consumption data
     * @private
     */
    async _pollConsumption(device, subscription, config) {
        // Skip polling if push notifications are active to avoid redundant requests
        if (subscription.pushActive) {
            return;
        }

        try {
            // Check cache first if smart caching enabled to avoid unnecessary polls
            // when cached data is still fresh
            if (config.smartCaching && typeof device.getCachedConsumption === 'function') {
                const channels = device.channels || [{ index: 0 }];
                let allCached = true;

                for (const channel of channels) {
                    const cached = device.getCachedConsumption(channel.index);
                    if (!cached) {
                        allCached = false;
                        break;
                    }
                }

                if (allCached) {
                    return;
                }
            }

            const channels = device.channels || [{ index: 0 }];
            for (const channel of channels) {
                await device.getPowerConsumption({ channel: channel.index });
            }

            subscription.lastPollTimes.set('consumption', Date.now());
        } catch (error) {
            this.logger(`Error polling consumption for ${device.uuid}: ${error.message}`);
        }
    }

    /**
     * Mark push notifications as active (for smart polling)
     * @private
     */
    _markPushActive(deviceUuid) {
        const subscription = this.subscriptions.get(deviceUuid);
        if (!subscription) {
            return;
        }

        subscription.pushActive = true;
        subscription.pushLastSeen = Date.now();

        // Reset push activity timer (if no push for 60s, consider it inactive)
        clearTimeout(subscription.pushInactivityTimer);
        subscription.pushInactivityTimer = setTimeout(() => {
            subscription.pushActive = false;
        }, 60000);
    }

    /**
     * Handle stateChange event (unified handler for all state changes from push/poll).
     *
     * @private
     */
    _handleStateChange(deviceUuid, event) {
        const subscription = this.subscriptions.get(deviceUuid);
        if (!subscription) {
            return;
        }

        // Transform stateChange event to changes format expected by subscribers
        const changes = {};
        if (event.type && event.value !== undefined) {
            changes[event.type] = { [event.channel]: event.value };
        }

        const unifiedUpdate = {
            source: event.source || 'poll',
            timestamp: event.timestamp || Date.now(),
            event,
            device: subscription.device,
            state: subscription.device.getUnifiedState(),
            changes
        };

        subscription.lastUpdate = unifiedUpdate;
        this._distributeUpdate(deviceUuid, unifiedUpdate);
    }


    /**
     * Handle stateRefreshed event
     * @private
     */
    _handleStateRefreshed(deviceUuid, data) {
        const subscription = this.subscriptions.get(deviceUuid);
        if (!subscription) {
            return;
        }

        const update = {
            source: 'poll',
            timestamp: data.timestamp || Date.now(),
            device: subscription.device,
            state: data.state || subscription.device.getUnifiedState(),
            changes: {} // Full refresh means all state is new, so no specific changes to report
        };

        subscription.lastUpdate = update;
        this._distributeUpdate(deviceUuid, update);
    }

    /**
     * Distribute update to all subscribers
     * @private
     */
    _distributeUpdate(deviceUuid, update) {
        const subscription = this.subscriptions.get(deviceUuid);
        if (!subscription) {
            return;
        }

        subscription.subscribers.forEach((subscriber) => {
            try {
                subscriber.onUpdate(update);
            } catch (error) {
                this.logger(`Error in subscriber callback for ${deviceUuid}: ${error.message}`);
            }
        });
    }

    /**
     * Get most aggressive (shortest interval) config from all subscribers.
     *
     * Uses the shortest polling intervals requested by any subscriber to ensure
     * all subscribers receive updates at least as frequently as they require.
     *
     * @private
     */
    _getAggressiveConfig(subscription) {
        const config = { ...this.defaultConfig };

        subscription.subscribers.forEach((subscriber) => {
            const subConfig = subscriber.config;
            if (subConfig.deviceStateInterval < config.deviceStateInterval) {
                config.deviceStateInterval = subConfig.deviceStateInterval;
            }
            if (subConfig.electricityInterval < config.electricityInterval) {
                config.electricityInterval = subConfig.electricityInterval;
            }
            if (subConfig.consumptionInterval < config.consumptionInterval) {
                config.consumptionInterval = subConfig.consumptionInterval;
            }
            if (subConfig.cacheMaxAge < config.cacheMaxAge) {
                config.cacheMaxAge = subConfig.cacheMaxAge;
            }
        });

        return config;
    }

    /**
     * Start HTTP device list polling
     * @private
     */
    _startHttpPolling() {
        this.httpPollInterval = setInterval(() => {
            this._pollHttpDeviceList();
        }, this.defaultConfig.httpDeviceListInterval);

        // Poll immediately
        this._pollHttpDeviceList();
    }

    /**
     * Stop HTTP device list polling
     * @private
     */
    _stopHttpPolling() {
        if (this.httpPollInterval) {
            clearInterval(this.httpPollInterval);
            this.httpPollInterval = null;
        }
    }

    /**
     * Poll HTTP device list
     * @private
     */
    async _pollHttpDeviceList() {
        try {
            const devices = await this.manager.httpClient.listDevices();

            // Compare with previous list to detect changes
            const previousUuids = new Set(this._lastDeviceList?.map(d => d.uuid) || []);
            const currentUuids = new Set(devices.map(d => d.uuid));

            const added = devices.filter(d => !previousUuids.has(d.uuid));
            const removed = this._lastDeviceList?.filter(d => !currentUuids.has(d.uuid)) || [];
            const changed = devices.filter(d => {
                const prev = this._lastDeviceList?.find(p => p.uuid === d.uuid);
                return prev && JSON.stringify(prev) !== JSON.stringify(d);
            });

            this._lastDeviceList = devices;

            // Distribute to all subscribers
            this.httpSubscribers.forEach((subscriber) => {
                try {
                    subscriber.onUpdate({
                        devices,
                        added,
                        removed,
                        changed,
                        timestamp: Date.now()
                    });
                } catch (error) {
                    this.logger(`Error in device list subscriber callback: ${error.message}`);
                }
            });
        } catch (error) {
            this.logger(`Error polling HTTP device list: ${error.message}`);
        }
    }


    /**
     * Emit cached state to subscribers
     * @private
     */
    _emitCachedState(device, subscription) {
        const update = {
            source: 'cache',
            timestamp: Date.now(),
            device,
            state: device.getUnifiedState()
        };

        subscription.lastUpdate = update;
        this._distributeUpdate(device.uuid, update);
    }

}

module.exports = SubscriptionManager;

