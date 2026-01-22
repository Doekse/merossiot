'use strict';

const EventEmitter = require('events');
const { MerossErrorValidation } = require('../model/exception');
const { OnlineStatus } = require('../model/enums');

/**
 * Manages automatic polling and unified update streams for Meross devices.
 *
 * Coordinates push notifications and targeted polling to provide a single event stream for
 * device state changes. Device state is polled once on initial subscription to establish a
 * baseline for listeners, then typically relies on push notifications for ongoing updates.
 * Some features (electricity, consumption) require periodic polling because they do not
 * emit push notifications.
 *
 * Push notifications reduce latency and network traffic compared to frequent polling.
 * Periodic polling is intended for features without push support (electricity, consumption)
 * or as an explicit fallback when a device is not producing push updates.
 *
 * @class
 * @extends EventEmitter
 */
class ManagerSubscription extends EventEmitter {
    /**
     * Creates a new ManagerSubscription instance.
     *
     * @param {Object} manager - MerossManager instance that provides device access
     * @param {Object} [options={}] - Configuration options
     * @param {Function} [options.logger] - Logger function for debug output
     * @param {number} [options.deviceStateInterval=0] - Device state polling interval in milliseconds (0 to disable periodic polling, rely on push only after initial state)
     * @param {number} [options.electricityInterval=30000] - Electricity metrics polling interval in milliseconds (0 to disable)
     * @param {number} [options.consumptionInterval=60000] - Power consumption polling interval in milliseconds (0 to disable)
     * @param {number} [options.httpDeviceListInterval=120000] - HTTP device list polling interval in milliseconds
     * @param {boolean} [options.smartCaching=true] - Skip polling when cached data is fresh to reduce network traffic
     * @param {number} [options.cacheMaxAge=10000] - Maximum cache age in milliseconds before considering data stale
     * @param {boolean} [options.pushOnly=false] - If true, treat push as the primary update mechanism (a baseline state is still emitted on subscribe; metrics polling still depends on intervals)
     */
    constructor(manager, options = {}) {
        super();

        if (!manager) {
            throw new MerossErrorValidation('Manager instance is required', 'manager');
        }

        this.manager = manager;
        this.logger = options.logger || (() => {});

        this.defaultConfig = {
            deviceStateInterval: options.deviceStateInterval !== undefined ? options.deviceStateInterval : 0,
            electricityInterval: options.electricityInterval !== undefined ? options.electricityInterval : 30000,
            consumptionInterval: options.consumptionInterval !== undefined ? options.consumptionInterval : 60000,
            httpDeviceListInterval: options.httpDeviceListInterval || 120000,
            smartCaching: options.smartCaching !== false,
            cacheMaxAge: options.cacheMaxAge || 10000,
            pushOnly: options.pushOnly || false
        };

        this.subscriptions = new Map();
        this.httpPollInterval = null;
        this._lastDeviceList = null;
    }

    /**
     * Subscribe to device updates.
     *
     * Registers event listeners for push notifications and starts periodic polling
     * based on configuration. For metrics (electricity/consumption), multiple calls merge by
     * selecting the shortest interval so all listeners receive updates at the required frequency.
     * Device state polling is configured explicitly via `deviceStateInterval` (with a baseline
     * state poll on initial subscription).
     *
     * @param {MerossDevice} device - Device to subscribe to
     * @param {Object} [config={}] - Subscription configuration
     * @param {number} [config.deviceStateInterval] - Device state polling interval in milliseconds (0 to disable periodic polling, rely on push only after initial state)
     * @param {number} [config.electricityInterval] - Electricity metrics polling interval in milliseconds (0 to disable)
     * @param {number} [config.consumptionInterval] - Power consumption polling interval in milliseconds (0 to disable)
     * @param {boolean} [config.smartCaching] - Skip polling when cached data is fresh
     * @param {number} [config.cacheMaxAge] - Maximum cache age in milliseconds before refresh
     * @param {boolean} [config.pushOnly=false] - Prefer push-driven updates and emit cached state immediately when available
     * @example
     * subscription.subscribe(device, { pushOnly: true });
     * subscription.on(`deviceUpdate:${device.uuid}`, (update) => {
     *     console.log('Device state:', update.state);
     *     console.log('Changes:', update.changes);
     * });
     */
    subscribe(device, config = {}) {
        const deviceUuid = device.uuid;
        const eventName = `deviceUpdate:${deviceUuid}`;

        if (!this.subscriptions.has(deviceUuid)) {
            this._createSubscription(device);
        }

        const subscription = this.subscriptions.get(deviceUuid);
        const isNewSubscription = !subscription.pollingIntervals || subscription.pollingIntervals.size === 0;

        const existingConfig = subscription.config || { ...this.defaultConfig };
        const pushOnly = config.pushOnly !== undefined ? config.pushOnly : (existingConfig.pushOnly || this.defaultConfig.pushOnly);

        subscription.config = {
            deviceStateInterval: config.deviceStateInterval !== undefined ? config.deviceStateInterval : (existingConfig.deviceStateInterval !== undefined ? existingConfig.deviceStateInterval : this.defaultConfig.deviceStateInterval),
            electricityInterval: Math.min(
                existingConfig.electricityInterval || this.defaultConfig.electricityInterval,
                config.electricityInterval !== undefined ? config.electricityInterval : (existingConfig.electricityInterval || this.defaultConfig.electricityInterval)
            ),
            consumptionInterval: Math.min(
                existingConfig.consumptionInterval || this.defaultConfig.consumptionInterval,
                config.consumptionInterval !== undefined ? config.consumptionInterval : (existingConfig.consumptionInterval || this.defaultConfig.consumptionInterval)
            ),
            smartCaching: config.smartCaching !== undefined ? config.smartCaching : existingConfig.smartCaching,
            cacheMaxAge: Math.min(
                existingConfig.cacheMaxAge || this.defaultConfig.cacheMaxAge,
                config.cacheMaxAge !== undefined ? config.cacheMaxAge : (existingConfig.cacheMaxAge || this.defaultConfig.cacheMaxAge)
            ),
            pushOnly
        };

        if (isNewSubscription) {
            this._startPolling(device, subscription);
        }

        if (subscription.config.pushOnly && isNewSubscription) {
            this._emitCachedState(device, subscription);
        }

        const listenerCount = this.listenerCount(eventName);
        this.logger(`Subscribed to device ${device.name} (${deviceUuid}). Total listeners: ${listenerCount}`);
    }

    /**
     * Unsubscribe from device updates and stop polling when no listeners remain.
     *
     * Stops polling and cleans up resources when the last event listener is removed.
     * Call this after removing all listeners with `removeAllListeners()` or `off()`.
     *
     * @param {string} deviceUuid - Device UUID to unsubscribe from
     */
    unsubscribe(deviceUuid) {
        const subscription = this.subscriptions.get(deviceUuid);
        if (!subscription) {
            return;
        }

        const eventName = `deviceUpdate:${deviceUuid}`;
        const listenerCount = this.listenerCount(eventName);

        if (listenerCount === 0) {
            this._stopPolling(deviceUuid);
            this.subscriptions.delete(deviceUuid);
            this.logger(`Unsubscribed from device ${deviceUuid}. No more listeners.`);
        } else {
            this.logger(`Unsubscribed from device ${deviceUuid}. Remaining listeners: ${listenerCount}`);
        }
    }

    /**
     * Subscribe to HTTP device list updates.
     *
     * Starts periodic polling of the HTTP API device list to detect additions,
     * removals, and metadata changes. Listen for updates using:
     * `on('deviceListUpdate', handler)`
     */
    subscribeToDeviceList() {
        if (!this.httpPollInterval) {
            this._startHttpPolling();
        }

        const listenerCount = this.listenerCount('deviceListUpdate');
        this.logger(`Subscribed to device list. Total listeners: ${listenerCount}`);
    }

    /**
     * Unsubscribe from HTTP device list updates.
     *
     * Stops HTTP polling when no listeners remain. Call this after removing
     * all listeners with `removeAllListeners('deviceListUpdate')` or `off()`.
     */
    unsubscribeFromDeviceList() {
        const listenerCount = this.listenerCount('deviceListUpdate');

        if (listenerCount === 0) {
            this._stopHttpPolling();
        }
    }

    /**
     * Cleanup all subscriptions, stop all polling, and remove all event listeners.
     *
     * Call this method when shutting down to prevent memory leaks and ensure
     * all intervals are cleared.
     */
    destroy() {
        this.removeAllListeners();

        this.subscriptions.forEach((subscription, deviceUuid) => {
            this._stopPolling(deviceUuid);
        });

        this.subscriptions.clear();
        this._stopHttpPolling();
    }

    /**
     * Initialize subscription state and register device event handlers.
     *
     * Sets up event listeners on the device to capture push notifications and state
     * changes via the unified 'state' event, which are then distributed to ManagerSubscription
     * listeners via events.
     *
     * @private
     * @param {MerossDevice} device - Device to create subscription for
     */
    _createSubscription(device) {
        const subscription = {
            device,
            config: null,
            pollingIntervals: new Map(),
            lastPollTimes: new Map(),
            lastUpdate: null,
            pushActiveNamespaces: new Map()
        };

        this.subscriptions.set(device.uuid, subscription);

        device.on('pushNotificationReceived', (namespace) => {
            this._setPushActive(device.uuid, namespace);
        });

        device.on('state', (event) => {
            this._onStateEvent(device.uuid, event);
        });
    }

    /**
     * Start polling for device state, electricity, and consumption data.
     *
     * Performs a one-time device state poll on initial subscription so consumers
     * can receive a current baseline state without waiting for the next push event.
     * Periodic polling is reserved for features that do not support push notifications
     * (electricity, consumption) and for the optional device-state fallback interval.
     *
     * @private
     * @param {MerossDevice} device - Device to poll
     * @param {Object} subscription - Subscription state object
     */
    _startPolling(device, subscription) {
        const config = subscription.config || this.defaultConfig;

        this._pollDeviceState(device, subscription);

        if (config.deviceStateInterval > 0) {
            const interval = setInterval(async () => {
                await this._pollDeviceState(device, subscription);
            }, config.deviceStateInterval);

            subscription.pollingIntervals.set('deviceState', interval);
        }

        if (config.electricityInterval > 0 && device.electricity && typeof device.electricity.get === 'function') {
            const interval = setInterval(async () => {
                await this._pollElectricity(device, subscription, config);
            }, config.electricityInterval);

            subscription.pollingIntervals.set('electricity', interval);
        }

        if (config.consumptionInterval > 0 && device.consumption) {
            const interval = setInterval(async () => {
                await this._pollConsumption(device, subscription, config);
            }, config.consumptionInterval);

            subscription.pollingIntervals.set('consumption', interval);
        }
    }

    /**
     * Stop all polling intervals for a device.
     *
     * @private
     * @param {string} deviceUuid - Device UUID to stop polling for
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
     * Poll device state via System.All namespace.
     *
     * Called once on initial subscription to provide current state to listeners.
     * Skips polling when push notifications were received recently or cached data
     * is fresh to avoid redundant network requests. After initial poll, ongoing
     * updates rely on push notifications.
     *
     * @private
     * @param {MerossDevice} device - Device to poll
     * @param {Object} subscription - Subscription state object
     */
    async _pollDeviceState(device, subscription) {
        if (device.onlineStatus !== OnlineStatus.ONLINE) {
            return;
        }

        const namespace = 'Appliance.System.All';
        if (this._hasRecentPush(subscription, namespace, 5000)) {
            return;
        }

        const config = subscription.config || this.defaultConfig;
        if (config.smartCaching && device.lastFullUpdateTimestamp) {
            const cacheAge = Date.now() - device.lastFullUpdateTimestamp;
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
     * Poll electricity metrics for all device channels.
     *
     * Electricity metrics require polling as they don't support push notifications.
     * Skips polling when all channels have fresh cached data (if smartCaching enabled)
     * to reduce network traffic.
     *
     * @private
     * @param {MerossDevice} device - Device to poll
     * @param {Object} subscription - Subscription state object
     * @param {Object} config - Configuration object with caching settings
     */
    async _pollElectricity(device, subscription, config) {
        if (device.onlineStatus !== OnlineStatus.ONLINE) {
            return;
        }

        try {
            if (config.smartCaching && device._channelCachedSamples) {
                const channels = device.channels || [{ index: 0 }];
                let allCached = true;

                for (const channel of channels) {
                    const cached = device._channelCachedSamples.get(channel.index);
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

            const channels = device.channels || [{ index: 0 }];
            for (const channel of channels) {
                await device.electricity.get({ channel: channel.index });
            }

            subscription.lastPollTimes.set('electricity', Date.now());
        } catch (error) {
            this.logger(`Error polling electricity for ${device.uuid}: ${error.message}`);
        }
    }

    /**
     * Poll power consumption data for all device channels.
     *
     * Consumption data requires polling as it doesn't support push notifications.
     * Skips polling when all channels have cached consumption data (if smartCaching enabled)
     * to reduce network traffic.
     *
     * @private
     * @param {MerossDevice} device - Device to poll
     * @param {Object} subscription - Subscription state object
     * @param {Object} config - Configuration object with caching settings
     */
    async _pollConsumption(device, subscription, config) {
        if (device.onlineStatus !== OnlineStatus.ONLINE) {
            return;
        }

        try {
            if (config.smartCaching && device._channelCachedConsumption) {
                const channels = device.channels || [{ index: 0 }];
                let allCached = true;

                for (const channel of channels) {
                    const cached = device._channelCachedConsumption.get(channel.index);
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
                await device.consumption.get({ channel: channel.index });
            }

            subscription.lastPollTimes.set('consumption', Date.now());
        } catch (error) {
            this.logger(`Error polling consumption for ${device.uuid}: ${error.message}`);
        }
    }

    /**
     * Mark push notifications as active for a specific namespace.
     *
     * Tracks push notification activity per namespace to allow selective polling
     * skipping. Only namespaces that receive push notifications will skip polling.
     *
     * @private
     * @param {string} deviceUuid - Device UUID that received push notification
     * @param {string} namespace - Namespace that received the push notification
     */
    _setPushActive(deviceUuid, namespace) {
        const subscription = this.subscriptions.get(deviceUuid);
        if (!subscription) {
            return;
        }

        if (!namespace) {
            return;
        }

        const timestamp = Date.now();
        subscription.pushActiveNamespaces.set(namespace, timestamp);

        const timerKey = `pushInactivityTimer_${namespace}`;
        clearTimeout(subscription[timerKey]);
        subscription[timerKey] = setTimeout(() => {
            subscription.pushActiveNamespaces.delete(namespace);
        }, 60000);
    }

    /**
     * Check if a namespace received a recent push notification.
     *
     * @private
     * @param {Object} subscription - Subscription state object
     * @param {string} namespace - Namespace to check
     * @param {number} maxAge - Maximum age in milliseconds to consider recent
     * @returns {boolean} True if namespace received push within maxAge
     */
    _hasRecentPush(subscription, namespace, maxAge) {
        const pushTimestamp = subscription.pushActiveNamespaces.get(namespace);
        if (!pushTimestamp) {
            return false;
        }

        const timeSincePush = Date.now() - pushTimestamp;
        return timeSincePush < maxAge;
    }

    /**
     * Handle unified state events from push notifications or polling.
     *
     * Transforms device state events into unified update objects containing
     * both the full state and only the changed values for efficient processing.
     * Handles all state event types including incremental changes and full refreshes.
     *
     * @private
     * @param {string} deviceUuid - Device UUID that changed state
     * @param {Object} event - Unified state event from device
     */
    _onStateEvent(deviceUuid, event) {
        const subscription = this.subscriptions.get(deviceUuid);
        if (!subscription) {
            return;
        }

        if (event.type === 'refresh') {
            const update = {
                source: event.source || 'poll',
                timestamp: event.timestamp || Date.now(),
                device: subscription.device,
                state: event.value || subscription.device.getUnifiedState(),
                changes: {}
            };
            subscription.lastUpdate = update;
            this._distributeUpdate(deviceUuid, update);
            return;
        }

        const changes = {};
        if (event.type && event.value !== undefined) {
            if (event.channel !== undefined) {
                if (!changes[event.type]) {
                    changes[event.type] = {};
                }
                changes[event.type][event.channel] = event.value;
            } else {
                changes[event.type] = event.value;
            }
        }

        const unifiedUpdate = {
            source: event.source || 'push',
            timestamp: event.timestamp || Date.now(),
            device: subscription.device,
            state: subscription.device.getUnifiedState(),
            changes
        };

        subscription.lastUpdate = unifiedUpdate;
        this._distributeUpdate(deviceUuid, unifiedUpdate);
    }

    /**
     * Emit device update event to all listeners.
     *
     * Catches and emits listener errors separately to prevent one failing
     * listener from blocking others.
     *
     * @private
     * @param {string} deviceUuid - Device UUID to emit update for
     * @param {Object} update - Update object containing state and changes
     */
    _distributeUpdate(deviceUuid, update) {
        const subscription = this.subscriptions.get(deviceUuid);
        if (!subscription) {
            return;
        }

        try {
            this.emit(`deviceUpdate:${deviceUuid}`, update);
        } catch (error) {
            this.logger(`Error emitting deviceUpdate event for ${deviceUuid}: ${error.message}`);
            this.emit('error', error, deviceUuid);
        }
    }


    /**
     * Start periodic polling of HTTP API device list.
     *
     * Performs an immediate poll on startup to provide current device list
     * to listeners without waiting for the first interval.
     *
     * @private
     */
    _startHttpPolling() {
        this.httpPollInterval = setInterval(() => {
            this._pollHttpDeviceList();
        }, this.defaultConfig.httpDeviceListInterval);

        this._pollHttpDeviceList();
    }

    /**
     * Stop HTTP device list polling.
     *
     * @private
     */
    _stopHttpPolling() {
        if (this.httpPollInterval) {
            clearInterval(this.httpPollInterval);
            this.httpPollInterval = null;
        }
    }

    /**
     * Poll HTTP API for device list and detect changes.
     *
     * Compares current and previous device lists to identify additions, removals,
     * and metadata changes. Emits a single event with all changes to minimize
     * listener processing overhead.
     *
     * @private
     */
    async _pollHttpDeviceList() {
        try {
            const devices = await this.manager.httpClient.listDevices();

            const previousUuids = new Set(this._lastDeviceList?.map(d => d.uuid) || []);
            const currentUuids = new Set(devices.map(d => d.uuid));

            const added = devices.filter(d => !previousUuids.has(d.uuid));
            const removed = this._lastDeviceList?.filter(d => !currentUuids.has(d.uuid)) || [];
            const changed = devices.filter(d => {
                const prev = this._lastDeviceList?.find(p => p.uuid === d.uuid);
                return prev && JSON.stringify(prev) !== JSON.stringify(d);
            });

            this._lastDeviceList = devices;

            try {
                this.emit('deviceListUpdate', {
                    devices,
                    added,
                    removed,
                    changed,
                    timestamp: Date.now()
                });
            } catch (error) {
                this.logger(`Error emitting deviceListUpdate event: ${error.message}`);
                this.emit('error', error);
            }
        } catch (error) {
            this.logger(`Error polling HTTP device list: ${error.message}`);
            this.emit('error', error);
        }
    }


    /**
     * Emit cached device state without performing a network request.
     *
     * Used when cached data is fresh to avoid redundant polling while still
     * providing listeners with current state.
     *
     * @private
     * @param {MerossDevice} device - Device to emit cached state for
     * @param {Object} subscription - Subscription state object
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

module.exports = ManagerSubscription;
