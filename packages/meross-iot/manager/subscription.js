'use strict';

const EventEmitter = require('events');
const { MerossDeviceError } = require('../lib/exception');

/**
 * Manages automatic polling and unified update streams for Meross devices.
 *
 * Coordinates device state updates and optional HTTP device list polling to provide a
 * unified event stream for consumers. Device-level metrics polling is delegated to
 * MerossDevice to keep push tracking and polling logic close to the data source.
 *
 * Push notifications reduce latency and network traffic compared to frequent polling.
 * Periodic polling is intended for features without push support (electricity, consumption, runtime)
 * or as an explicit fallback when a device is not producing push updates.
 *
 * Public events (after {@link ManagerSubscription#subscribe}):
 * - `deviceUpdate:${deviceUuid}` — unified state update (`update.device`, `update.state`, `update.changes`)
 * - `deviceListUpdate` — account device list diff (after {@link ManagerSubscription#subscribeToDeviceList})
 * - `error` — listener or polling failure
 *
 * Subscribe with the device UUID (hub UUID for hub + subdevices). Subdevices share the hub MQTT
 * connection; pass the hub to `subscribe()` — subdevice arguments resolve to the hub automatically.
 *
 * Device `stateChange` and manager `deviceUpdate` are internal wiring; consumers should use this manager only.
 *
 * @class
 * @extends EventEmitter
 */
class ManagerSubscription extends EventEmitter {
    /**
     * Creates a new ManagerSubscription instance.
     *
     * @param {import('../lib/meross')} meross - Root Meross instance that provides device access
     * @param {Object} [options={}] - Configuration options
     * @param {Function} [options.logger] - Logger function for debug output
     * @param {number} [options.deviceStateInterval=0] - Device state polling interval in milliseconds (0 to disable periodic polling, rely on push only after initial state)
     * @param {number} [options.electricityInterval=30000] - Electricity metrics polling interval in milliseconds (0 to disable)
     * @param {number} [options.consumptionInterval=60000] - Power consumption polling interval in milliseconds (0 to disable)
     * @param {number} [options.runtimeInterval=60000] - Runtime information polling interval in milliseconds (0 to disable)
     * @param {number} [options.httpDeviceListInterval=120000] - HTTP device list polling interval in milliseconds
     * @param {boolean} [options.smartCaching=true] - Skip polling when cached data is fresh to reduce network traffic
     * @param {number} [options.cacheMaxAge=10000] - Maximum cache age in milliseconds before considering data stale
     * @param {boolean} [options.pushOnly=false] - If true, treat push as the primary update mechanism (a baseline state is still emitted on subscribe; metrics polling still depends on intervals)
     */
    constructor(meross, options = {}) {
        super();

        if (!meross) {
            throw new MerossDeviceError('Meross instance is required', 'VALIDATION_ERROR', { field: 'meross' });
        }

        this.meross = meross;
        this.logger = options.logger || (() => {});

        this.defaultConfig = {
            deviceStateInterval: options.deviceStateInterval !== undefined ? options.deviceStateInterval : 0,
            electricityInterval: options.electricityInterval !== undefined ? options.electricityInterval : 30000,
            consumptionInterval: options.consumptionInterval !== undefined ? options.consumptionInterval : 60000,
            runtimeInterval: options.runtimeInterval !== undefined ? options.runtimeInterval : 60000,
            httpDeviceListInterval: options.httpDeviceListInterval || 120000,
            smartCaching: options.smartCaching !== false,
            cacheMaxAge: options.cacheMaxAge || 10000,
            pushOnly: options.pushOnly || false
        };

        this.subscriptions = new Map();
        this._stateListenersAttached = new WeakSet();
        this.httpPollInterval = null;
        this._lastDeviceList = null;
    }

    /**
     * Subscription target for updates: hub for subdevices, otherwise the device itself.
     *
     * @private
     * @param {import('../lib/device/device').MerossDevice} device
     * @returns {import('../lib/device/device').MerossDevice}
     */
    _resolveSubscribeTarget(device) {
        if (device.subdeviceId && device.hub) {
            return device.hub;
        }
        return device;
    }

    /**
     * Subscribe to device updates.
     *
     * Registers event listeners for push notifications and starts periodic polling
     * based on configuration. Configuration is only applied on the first subscription
     * call for a device; subsequent calls reuse the existing configuration.
     * Device state polling is configured explicitly via `deviceStateInterval` (with a baseline
     * state poll on initial subscription).
     *
     * @param {MerossDevice} device - Device to subscribe to
     * @param {Object} [config={}] - Subscription configuration (only applied on first subscription)
     * @param {number} [config.deviceStateInterval] - Device state polling interval in milliseconds (0 to disable periodic polling, rely on push only after initial state)
     * @param {number} [config.electricityInterval] - Electricity metrics polling interval in milliseconds (0 to disable)
     * @param {number} [config.consumptionInterval] - Power consumption polling interval in milliseconds (0 to disable)
     * @param {number} [config.runtimeInterval] - Runtime information polling interval in milliseconds (0 to disable)
     * @param {boolean} [config.smartCaching] - Skip polling when cached data is fresh
     * @param {number} [config.cacheMaxAge] - Maximum cache age in milliseconds before refresh
     * @param {boolean} [config.pushOnly=false] - Prefer push-driven updates and emit cached state immediately when available
     * @example
     * subscription.subscribe(hub, { pushOnly: true });
     * subscription.on(`deviceUpdate:${hub.uuid}`, (update) => {
     *     console.log('Updated device:', update.device.name, update.changes);
     * });
     */
    subscribe(device, config = {}) {
        const target = this._resolveSubscribeTarget(device);
        const deviceUuid = target.uuid;
        const eventName = `deviceUpdate:${deviceUuid}`;

        if (device !== target) {
            this.logger(
                `Subdevice ${device.name} maps to hub ${target.name}; subscribe/listen on deviceUpdate:${deviceUuid}`
            );
        }

        if (!this.subscriptions.has(deviceUuid)) {
            this._createSubscription(target);
        }

        const subscription = this.subscriptions.get(deviceUuid);
        const isNewSubscription = !subscription.pollingStarted;

        if (isNewSubscription) {
            const getConfigValue = (key) => config[key] !== undefined ? config[key] : this.defaultConfig[key];

            subscription.config = {
                deviceStateInterval: getConfigValue('deviceStateInterval'),
                electricityInterval: getConfigValue('electricityInterval'),
                consumptionInterval: getConfigValue('consumptionInterval'),
                runtimeInterval: getConfigValue('runtimeInterval'),
                smartCaching: getConfigValue('smartCaching'),
                cacheMaxAge: getConfigValue('cacheMaxAge'),
                pushOnly: getConfigValue('pushOnly')
            };

            this._startPolling(target, subscription);
            subscription.pollingStarted = true;

            if (subscription.config.pushOnly) {
                this._emitCachedState(target, subscription);
            }
        }

        const listenerCount = this.listenerCount(eventName);
        this.logger(`Subscribed to device ${target.name} (${deviceUuid}). Total listeners: ${listenerCount}`);
    }

    /**
     * Unsubscribe from device updates and stop polling when no listeners remain.
     *
     * Stops polling and cleans up resources when the last event listener is removed.
     * Call this after removing all listeners with `removeAllListeners()` or `off()`.
     *
     * @param {string} deviceUuid - Hub or base device UUID (same value used in `deviceUpdate:${deviceUuid}`)
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
     * Attach `stateChange` forwarding when a subdevice is registered on an already-subscribed hub.
     *
     * @param {import('../lib/device/hubdevice').MerossHubDevice} hub
     * @param {import('../lib/device/subdevice').MerossSubDevice} subdevice
     */
    onSubdeviceRegistered(hub, subdevice) {
        if (!hub?.uuid || !this.subscriptions.has(hub.uuid)) {
            return;
        }
        this._attachSubdeviceStateListener(hub, subdevice);
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
            pollingStarted: false,
            pollingIntervals: new Map(),
            lastPollTimes: new Map(),
            lastUpdate: null
        };

        this.subscriptions.set(device.uuid, subscription);
        this._attachStateListeners(device);
    }

    /**
     * Wire hub/base `stateChange` events into `deviceUpdate:${uuid}`.
     *
     * @private
     * @param {import('../lib/device/device').MerossDevice} device
     */
    _attachStateListeners(device) {
        if (!this._stateListenersAttached.has(device)) {
            this._stateListenersAttached.add(device);
            device.on('stateChange', (event) => {
                this._onStateEvent(device.uuid, event, device);
            });
        }

        if (typeof device.getSubdevices === 'function') {
            for (const subdevice of device.getSubdevices()) {
                this._attachSubdeviceStateListener(device, subdevice);
            }
        }
    }

    /**
     * @private
     * @param {import('../lib/device/hubdevice').MerossHubDevice} hub
     * @param {import('../lib/device/subdevice').MerossSubDevice} subdevice
     */
    _attachSubdeviceStateListener(hub, subdevice) {
        if (this._stateListenersAttached.has(subdevice)) {
            return;
        }
        this._stateListenersAttached.add(subdevice);
        subdevice.on('stateChange', (event) => {
            this._onStateEvent(hub.uuid, event, subdevice);
        });
    }

    /**
     * Start polling for device state, electricity, consumption, and runtime data.
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
        device.startMetricsPolling({
            electricityInterval: config.electricityInterval,
            consumptionInterval: config.consumptionInterval,
            runtimeInterval: config.runtimeInterval,
            smartCaching: config.smartCaching,
            cacheMaxAge: config.cacheMaxAge
        });
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

        subscription.device.stopMetricsPolling();
        subscription.pollingIntervals.forEach((interval) => {
            clearInterval(interval);
        });

        subscription.pollingIntervals.clear();
        subscription.pollingStarted = false;
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
        if (!device.isOnline) {
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
     * Handle unified state events from push notifications or polling.
     *
     * Transforms device state events into unified update objects containing
     * both the full state and only the changed values for efficient processing.
     * Handles all state event types including incremental changes and full refreshes.
     *
     * @private
     * @param {string} deviceUuid - Hub or base device UUID
     * @param {Object} event - Unified state event from device
     * @param {import('../lib/device/device').MerossDevice} sourceDevice - Device that emitted the change
     */
    _onStateEvent(deviceUuid, event, sourceDevice) {
        const subscription = this.subscriptions.get(deviceUuid);
        if (!subscription) {
            return;
        }

        if (event.type === 'refresh') {
            const update = {
                source: event.source || 'poll',
                timestamp: event.timestamp || Date.now(),
                device: sourceDevice,
                state: event.value || sourceDevice.getState(),
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
            device: sourceDevice,
            state: sourceDevice.getState(),
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
     * @param {string} deviceUuid - Hub or base device UUID
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
            const devices = await this.meross.auth.client.getDevices();

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
            state: device.getState()
        };

        subscription.lastUpdate = update;
        this._distributeUpdate(device.uuid, update);
    }

}

module.exports = ManagerSubscription;
