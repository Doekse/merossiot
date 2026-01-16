'use strict';

const EventEmitter = require('events');

/**
 * Manages automatic polling and unified update streams for Meross devices.
 *
 * Coordinates push notifications and periodic polling to provide a single event stream
 * for device state changes. Handles polling lifecycle, cache management, and prevents
 * redundant network requests when push notifications are active or cached data is fresh.
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
     * @param {number} [options.deviceStateInterval=30000] - Device state polling interval in milliseconds
     * @param {number} [options.electricityInterval=30000] - Electricity metrics polling interval in milliseconds
     * @param {number} [options.consumptionInterval=60000] - Power consumption polling interval in milliseconds
     * @param {number} [options.httpDeviceListInterval=120000] - HTTP device list polling interval in milliseconds
     * @param {boolean} [options.smartCaching=true] - Skip polling when cached data is fresh to reduce network traffic
     * @param {number} [options.cacheMaxAge=10000] - Maximum cache age in milliseconds before considering data stale
     */
    constructor(manager, options = {}) {
        super();

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

        this.subscriptions = new Map();
        this.httpPollInterval = null;
        this._lastDeviceList = null;
    }

    /**
     * Subscribe to device updates and start polling if needed.
     *
     * Configures polling intervals for the device and merges with existing configuration
     * using the most aggressive (shortest) intervals to ensure all listeners receive
     * updates at least as frequently as required. Polling starts automatically when
     * the first subscription is created.
     *
     * Listen for updates using: `on('deviceUpdate:${deviceUuid}', handler)`
     *
     * @param {MerossDevice} device - Device to subscribe to
     * @param {Object} [config={}] - Subscription configuration overrides
     * @param {number} [config.deviceStateInterval] - Device state polling interval in milliseconds
     * @param {number} [config.electricityInterval] - Electricity metrics polling interval in milliseconds
     * @param {number} [config.consumptionInterval] - Power consumption polling interval in milliseconds
     * @param {boolean} [config.smartCaching] - Enable cache-based polling optimization
     * @param {number} [config.cacheMaxAge] - Maximum cache age in milliseconds before refresh
     */
    subscribe(device, config = {}) {
        const deviceUuid = device.uuid;
        const eventName = `deviceUpdate:${deviceUuid}`;

        if (!this.subscriptions.has(deviceUuid)) {
            this._createSubscription(device);
        }

        const subscription = this.subscriptions.get(deviceUuid);
        const isNewSubscription = !subscription.pollingIntervals || subscription.pollingIntervals.size === 0;

        // Merge configuration using shortest intervals to satisfy all listeners
        const existingConfig = subscription.config || { ...this.defaultConfig };
        subscription.config = {
            deviceStateInterval: Math.min(
                existingConfig.deviceStateInterval || this.defaultConfig.deviceStateInterval,
                config.deviceStateInterval || this.defaultConfig.deviceStateInterval
            ),
            electricityInterval: Math.min(
                existingConfig.electricityInterval || this.defaultConfig.electricityInterval,
                config.electricityInterval || this.defaultConfig.electricityInterval
            ),
            consumptionInterval: Math.min(
                existingConfig.consumptionInterval || this.defaultConfig.consumptionInterval,
                config.consumptionInterval || this.defaultConfig.consumptionInterval
            ),
            smartCaching: config.smartCaching !== undefined ? config.smartCaching : existingConfig.smartCaching,
            cacheMaxAge: Math.min(
                existingConfig.cacheMaxAge || this.defaultConfig.cacheMaxAge,
                config.cacheMaxAge || this.defaultConfig.cacheMaxAge
            )
        };

        if (isNewSubscription) {
            this._startPolling(device, subscription);
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
     * changes, which are then distributed to ManagerSubscription listeners via events.
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
            pushActive: false,
            pushLastSeen: null
        };

        this.subscriptions.set(device.uuid, subscription);

        device.on('pushNotification', () => {
            this._markPushActive(device.uuid);
        });

        device.on('stateChange', (event) => {
            this._handleStateChange(device.uuid, event);
        });

        device.on('stateRefreshed', (data) => {
            this._handleStateRefreshed(device.uuid, data);
        });
    }

    /**
     * Start periodic polling for device state, electricity, and consumption data.
     *
     * Creates intervals for each supported feature based on configuration. Performs
     * an immediate poll on startup to provide initial state to listeners.
     *
     * @private
     * @param {MerossDevice} device - Device to poll
     * @param {Object} subscription - Subscription state object
     */
    _startPolling(device, subscription) {
        const config = subscription.config || this.defaultConfig;

        if (config.deviceStateInterval > 0) {
            const interval = setInterval(async () => {
                await this._pollDeviceState(device, subscription);
            }, config.deviceStateInterval);

            subscription.pollingIntervals.set('deviceState', interval);
            this._pollDeviceState(device, subscription);
        }

        if (config.electricityInterval > 0 && typeof device.getElectricity === 'function') {
            const interval = setInterval(async () => {
                await this._pollElectricity(device, subscription, config);
            }, config.electricityInterval);

            subscription.pollingIntervals.set('electricity', interval);
        }

        if (config.consumptionInterval > 0 && typeof device.getPowerConsumption === 'function') {
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
     * Skips polling if push notifications were received recently (within 5 seconds)
     * or if cached data is fresh (when smart caching is enabled). This prevents
     * redundant network requests when the device is already providing updates.
     *
     * @private
     * @param {MerossDevice} device - Device to poll
     * @param {Object} subscription - Subscription state object
     */
    async _pollDeviceState(device, subscription) {
        if (subscription.pushActive && subscription.pushLastSeen) {
            const timeSincePush = Date.now() - subscription.pushLastSeen;
            if (timeSincePush < 5000) {
                return;
            }
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
     * Poll electricity metrics (power, voltage, current) for all device channels.
     *
     * Skips polling when push notifications are active or when cached data for all
     * channels is fresh, reducing unnecessary network requests.
     *
     * @private
     * @param {MerossDevice} device - Device to poll
     * @param {Object} subscription - Subscription state object
     * @param {Object} config - Configuration object with caching settings
     */
    async _pollElectricity(device, subscription, config) {
        if (subscription.pushActive) {
            return;
        }

        try {
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
     * Poll power consumption data for all device channels.
     *
     * Skips polling when push notifications are active or when cached consumption
     * data exists for all channels, reducing network traffic.
     *
     * @private
     * @param {MerossDevice} device - Device to poll
     * @param {Object} subscription - Subscription state object
     * @param {Object} config - Configuration object with caching settings
     */
    async _pollConsumption(device, subscription, config) {
        if (subscription.pushActive) {
            return;
        }

        try {
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
     * Mark push notifications as active and reset inactivity timer.
     *
     * When push notifications are active, polling is reduced to avoid redundant
     * requests. Push activity expires after 60 seconds of inactivity.
     *
     * @private
     * @param {string} deviceUuid - Device UUID that received push notification
     */
    _markPushActive(deviceUuid) {
        const subscription = this.subscriptions.get(deviceUuid);
        if (!subscription) {
            return;
        }

        subscription.pushActive = true;
        subscription.pushLastSeen = Date.now();

        clearTimeout(subscription.pushInactivityTimer);
        subscription.pushInactivityTimer = setTimeout(() => {
            subscription.pushActive = false;
        }, 60000);
    }

    /**
     * Handle incremental state change events from push notifications or polling.
     *
     * Transforms device stateChange events into unified update objects containing
     * both the full state and only the changed values for efficient processing.
     *
     * @private
     * @param {string} deviceUuid - Device UUID that changed state
     * @param {Object} event - State change event from device
     */
    _handleStateChange(deviceUuid, event) {
        const subscription = this.subscriptions.get(deviceUuid);
        if (!subscription) {
            return;
        }

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
     * Handle full state refresh events from polling.
     *
     * Creates an update object with empty changes since all state is refreshed,
     * allowing listeners to process the complete state snapshot.
     *
     * @private
     * @param {string} deviceUuid - Device UUID that was refreshed
     * @param {Object} data - Refresh data containing state and timestamp
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
            changes: {}
        };

        subscription.lastUpdate = update;
        this._distributeUpdate(deviceUuid, update);
    }

    /**
     * Emit device update event to all listeners.
     *
     * Emits errors as separate events to prevent one failing listener from
     * blocking others.
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
     * Compares the current device list with the previous one to identify additions,
     * removals, and metadata changes. Emits a single event with all changes to
     * minimize listener processing overhead.
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
     * Used when cached data is fresh and polling would be redundant. Provides
     * listeners with current state while avoiding unnecessary network traffic.
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

