'use strict';

const { MerossDevice } = require('./device');
const { OnlineStatus, SmokeAlarmStatus } = require('../enums');
const DeviceRegistry = require('./registry');
const { MerossDeviceError } = require('../exception');
const { shouldApplyUpdate } = require('../utilities/state-ordering');
const { diffSubdeviceStateSlices } = require('../utilities/subdevice-state');
const { dispatch, getNamespaceDescriptors } = require('../dispatcher');

/**
 * Base class for all Meross subdevices.
 *
 * Subdevices connect through a hub device and route all commands through the hub.
 * They cannot communicate directly with the Meross cloud, so all MQTT messages and
 * HTTP requests must go through the parent hub device.
 *
 * Subdevices include sensors (temperature/humidity, water leak, smoke), thermostat
 * valves, and other devices that connect to hub devices rather than directly to WiFi.
 *
 * State updates are delivered through the parent hub: `meross.subscription.subscribe(hub)`
 * and `deviceUpdate:${hub.uuid}` (`update.device` identifies the subdevice). Use
 * {@link MerossSubDevice#getState} or {@link MerossSubDevice#refreshState} for reads.
 *
 * @class MerossSubDevice
 * @extends MerossDevice
 * @example
 * // Subdevices are typically created automatically when hubs are discovered
 * const hub = devices.find(d => d instanceof MerossHubDevice);
 * const subdevices = hub.getSubdevices();
 *
 * // Access subdevice properties
 * const sensor = subdevices[0];
 * console.log(`Subdevice ID: ${sensor.subdeviceId}`);
 * console.log(`Hub UUID: ${sensor.hub.uuid}`);
 * console.log(`Name: ${sensor.name}`);
 */
class MerossSubDevice extends MerossDevice {
    /**
     * Creates a new MerossSubDevice instance
     * @param {string} hubDeviceUuid - UUID of the hub device this subdevice belongs to
     * @param {string} subdeviceId - Subdevice ID
     * @param {import('../meross')} manager - Root Meross instance
     * @param {Object} [kwargs] - Additional subdevice information
     * @param {string} [kwargs.subDeviceType] - Subdevice type (or type)
     * @param {string} [kwargs.subDeviceName] - Subdevice name (or name)
     * @throws {MerossDeviceError} If hub device is not found or subdevice ID is missing
     */
    constructor(hubDeviceUuid, subdeviceId, manager, kwargs = {}) {
        const hubs = manager.devices.find({ deviceUuids: [hubDeviceUuid] });
        if (!hubs || hubs.length < 1) {
            throw new MerossDeviceError(`Specified hub device ${hubDeviceUuid} is not present`, 'UNKNOWN_DEVICE_TYPE');
        }
        const hub = hubs[0];

        super(manager, hubDeviceUuid, hub.mqttHost, hub.mqttPort);

        this._hub = hub;
        this._subdeviceId = subdeviceId;
        this._type = kwargs.subDeviceType || kwargs.type;
        this._name = kwargs.subDeviceName || kwargs.name;

        if (!this._subdeviceId) {
            throw new MerossDeviceError('Subdevice ID is required', 'UNKNOWN_DEVICE_TYPE');
        }

        // Subdevices share hub's network configuration since they communicate through the hub
        this.lanIp = hub.lanIp;

        this._onlineStatus = OnlineStatus.UNKNOWN;
        this._battery = null;
        this._subscriptionStateSnapshot = null;
    }

    /**
     * Gets the subdevice ID.
     *
     * This is the unique identifier for this subdevice within the hub.
     *
     * @returns {string} Subdevice ID
     */
    get subdeviceId() {
        return this._subdeviceId;
    }

    /**
     * Gets the hub device this subdevice belongs to.
     *
     * All subdevice commands are routed through this hub device.
     *
     * @returns {MerossHubDevice} Hub device instance
     */
    get hub() {
        return this._hub;
    }

    /**
     * Gets the subdevice type
     * @returns {string|undefined} Subdevice type or undefined if not available
     */
    get type() {
        return this._type;
    }

    /**
     * Gets the subdevice name
     * @returns {string} Subdevice name or subdevice ID if name not available
     */
    get name() {
        return this._name || this._subdeviceId;
    }

    /**
     * Gets the UUID (uses hub's UUID for MQTT routing).
     *
     * Subdevices use their parent hub's UUID for MQTT message routing since
     * they cannot communicate directly with the Meross cloud.
     *
     * @returns {string} Hub device UUID
     */
    get uuid() {
        return this._hub.uuid;
    }

    /**
     * Gets the internal ID used for device registry.
     *
     * Generates and caches a composite ID combining hub UUID and subdevice ID on first
     * access (format: #BASE:{hubUuid}#SUB:{subdeviceId}) to ensure unique identification
     * in the device registry.
     *
     * @returns {string} Internal ID string
     * @throws {MerossDeviceError} If hub UUID is missing
     */
    get internalId() {
        if (this._internalId) {
            return this._internalId;
        }

        const hubUuid = this._hub.uuid || this._hub.dev?.uuid;
        if (!hubUuid) {
            throw new MerossDeviceError('Cannot generate internal ID: hub missing UUID', 'UNKNOWN_DEVICE_TYPE');
        }

        this._internalId = DeviceRegistry.generateInternalId(hubUuid, true, hubUuid, this._subdeviceId);
        return this._internalId;
    }

    /**
     * Gets the online status of the subdevice.
     *
     * If the hub is offline, the subdevice is also considered offline since subdevices
     * cannot communicate without the hub.
     *
     * @returns {number} Online status from OnlineStatus enum
     */
    get onlineStatus() {
        if (this._hub.onlineStatus !== OnlineStatus.ONLINE) {
            return this._hub.onlineStatus;
        }
        return this._onlineStatus;
    }

    /**
     * Refreshes the subdevice state through the hub.
     *
     * Delegates to the hub's refreshState() method, which updates both the hub and
     * all its subdevices in a single operation. Subclasses may override to add
     * subdevice-specific refresh logic.
     *
     * @returns {Promise<void>} Promise that resolves when state is refreshed
     * @example
     * await sensor.refreshState();
     * // Sensor state is now updated
     */
    async refreshState() {
        await this._hub.refreshState();
        this.emit('stateChange', {
            type: 'refresh',
            timestamp: this.lastFullUpdateTimestamp || Date.now(),
            value: this.getState(),
            source: 'poll'
        });
        this._subscriptionStateSnapshot = this.getState();
    }

    /**
     * Snapshot of subdevice state for subscriptions (channel `0` per feature type).
     *
     * @returns {Object} State object aligned with {@link MerossDevice#getState} shape
     */
    getState() {
        const state = {
            online: this.onlineStatus,
            timestamp: this.lastFullUpdateTimestamp || Date.now(),
            subdeviceId: this.subdeviceId,
            hubUuid: this.uuid
        };

        if (this._battery !== undefined && this._battery !== null) {
            state.battery = { 0: this._battery };
        }

        this._appendSubdeviceState(state);
        return state;
    }

    /**
     * @protected
     * @param {Object} state - Mutable state object from {@link MerossSubDevice#getState}
     * @returns {void}
     */
    _appendSubdeviceState(_state) {
    }

    /**
     * @private
     * @param {Object|undefined} header - Hub-forwarded MQTT header
     * @returns {string} `stateChange` source label
     */
    _resolveHubMessageSource(header) {
        const method = header?.method;
        if (method === 'PUSH') {
            return 'push';
        }
        if (method === 'GETACK' || method === 'SETACK') {
            return 'response';
        }
        return 'hub';
    }

    /**
     * @private
     * @param {string} source - Provenance for `stateChange`
     * @returns {void}
     */
    _publishSubdeviceStateChanges(source) {
        const newState = this.getState();
        const oldState = this._subscriptionStateSnapshot;
        const slices = diffSubdeviceStateSlices(oldState, newState);

        for (const slice of slices) {
            const event = {
                type: slice.type,
                source,
                timestamp: Date.now(),
                value: slice.value
            };
            if (slice.channel !== undefined) {
                event.channel = slice.channel;
            }
            this.emit('stateChange', event);
        }

        this._subscriptionStateSnapshot = newState;
    }

    /**
     * Last known battery level (0–100) from the most recent refresh or PUSH.
     *
     * @returns {number|null} Battery percentage, or null if unknown / unsupported
     */
    getBattery() {
        return this._battery !== undefined && this._battery !== null ? this._battery : null;
    }

    /**
     * Publishes a message by routing it through the hub device.
     *
     * All subdevice commands must be routed through the hub since subdevices cannot
     * communicate directly with the Meross cloud. Delegates to the hub's publishMessage() method.
     *
     * @param {string} method - Message method ('GET', 'SET', etc.)
     * @param {string} namespace - Message namespace (e.g., 'Appliance.Hub.Sensor.TempHum')
     * @param {Object} payload - Message payload (must include subdevice ID)
     * @param {number|null} [transportMode=null] - Transport mode from {@link TransportMode} enum
     * @returns {Promise<{header: Object, payload: Object}>} Resolves with the full message
     *   envelope so the header carries namespace and ordering timestamps alongside the payload.
     * @example
     * const { payload } = await sensor.publishMessage(
     *     'GET',
     *     'Appliance.Hub.Sensor.TempHum',
     *     { id: sensor.subdeviceId }
     * );
     */
    async publishMessage(method, namespace, payload, transportMode = null) {
        return await this._hub.publishMessage(method, namespace, payload, transportMode);
    }

    /**
     * Maps numeric online status codes to OnlineStatus enum values.
     *
     * @private
     * @param {number} statusValue - Numeric status code (0-3)
     * @returns {number} OnlineStatus enum value
     */
    _mapOnlineStatus(statusValue) {
        const statusMap = {
            0: OnlineStatus.NOT_ONLINE,
            1: OnlineStatus.ONLINE,
            2: OnlineStatus.OFFLINE,
            3: OnlineStatus.UPGRADING
        };
        return statusMap[statusValue] ?? OnlineStatus.UNKNOWN;
    }

    /**
     * Updates online status from notification data when the message timestamp is not stale.
     *
     * Handles both `data.online.status` (Sensor.All, Mts100.All) and `data.status` (Hub.Online).
     * All writes share the `'online'` ordering key so a stale aggregate payload cannot overwrite
     * a fresher per-namespace online update.
     *
     * @private
     * @param {Object} data - Notification data payload
     * @param {number|null|undefined} messageTs - Milliseconds from {@link getMessageTimestamp}, or
     *   null/undefined to apply without ordering
     * @param {Object} [options]
     * @param {boolean} [options.touchLastActiveTime=false] - When true, assigns `_lastActiveTime`
     *   from the payload (possibly `undefined`), matching Hub.Online / Mts100.All call sites; when
     *   false, only `_onlineStatus` is updated (Sensor.All paths that omitted last-active).
     * @returns {void}
     */
    _updateOnlineStatus(data, messageTs, { touchLastActiveTime = false } = {}) {
        let statusValue;
        let lastActiveTime;

        if (data.online && data.online.status !== undefined) {
            statusValue = data.online.status;
            lastActiveTime = data.online.lastActiveTime;
        } else if (data.status !== undefined) {
            statusValue = data.status;
            lastActiveTime = data.lastActiveTime;
        }

        if (statusValue === undefined) {
            return;
        }

        if (!shouldApplyUpdate(this, 'online', messageTs)) {
            return;
        }

        this._onlineStatus = this._mapOnlineStatus(statusValue);
        if (touchLastActiveTime) {
            this._lastActiveTime = lastActiveTime;
        }
    }

    /**
     * Handles Appliance.Hub.Battery and Appliance.Hub.Mts100.Battery namespaces.
     *
     * @private
     * @param {Object} data - Notification data payload
     */
    _handleBattery(data) {
        // Filter out sentinel values (0xFFFFFFFF, -1) indicating battery reporting is unsupported
        if (data.value !== undefined && data.value !== null &&
            data.value !== 0xFFFFFFFF && data.value !== -1) {
            this._battery = data.value;
        }
    }

    /**
     * Handles Appliance.Hub.Online namespace.
     *
     * @private
     * @param {Object} data - Notification data payload
     * @param {number|null|undefined} messageTs - Message ordering time from the hub envelope header
     */
    _handleOnline(data, messageTs) {
        this._updateOnlineStatus(data, messageTs, { touchLastActiveTime: true });
    }

    /**
     * Applies a hub-forwarded message to this subdevice.
     *
     * Subdevices do not receive raw MQTT; the hub strips the envelope and
     * forwards `{ header, namespace, payload }` (possibly a single item from
     * a larger hub payload). This override intentionally shadows
     * {@link MerossDevice#handleMessage} — see JSDoc there for the MQTT-raw shape.
     *
     * Routes through the shared namespace registry ({@link module:dispatcher}) like
     * standalone devices via {@link MerossDevice#_routeMessageToAbility}. Descriptors
     * are registered in hub ability modules (see requires at end of this file).
     * Ordering gate keys
     * match the former handler method names (e.g. `_handleSensorAll`) so namespaces
     * that share a handler share one timestamp gate.
     *
     * @param {{ header?: object, namespace: string, payload: object }} message - Hub-forwarded envelope
     * @returns {Promise<void>}
     */
    async handleMessage({ header, namespace, payload }) {
        this.emit('message', { header, namespace, payload });

        const source = this._resolveHubMessageSource(header);

        if (header === null || header === undefined) {
            const descriptors = getNamespaceDescriptors(namespace);
            for (const descriptor of descriptors) {
                dispatch(this, descriptor, payload, source, null, undefined);
            }
            this._publishSubdeviceStateChanges(source);
            return;
        }

        this._routeMessageToAbility({ ...header, namespace }, payload, source);
        this._publishSubdeviceStateChanges(source);
    }
}

/**
 * Hub Temperature/Humidity Sensor subdevice (MS100, MS100F, MS130, etc.).
 *
 * This class represents temperature and humidity sensors that connect through
 * a Meross hub device. It provides methods to read temperature and humidity values,
 * access historical samples, and check sensor capabilities.
 *
 * @class HubTempHumSensor
 * @extends MerossSubDevice
 * @example
 * const sensor = hub.getSubdevice('sensor123');
 * if (sensor instanceof HubTempHumSensor) {
 *     // Get current temperature
 *     const temp = sensor.getLastSampledTemperature();
 *     console.log(`Temperature: ${temp}°C`);
 *
 *     // Get current humidity
 *     const humidity = sensor.getLastSampledHumidity();
 *     console.log(`Humidity: ${humidity}%`);
 *
 *     // Get temperature range
 *     const minTemp = sensor.getMinSupportedTemperature();
 *     const maxTemp = sensor.getMaxSupportedTemperature();
 *     console.log(`Range: ${minTemp}°C to ${maxTemp}°C`);
 * }
 */
class HubTempHumSensor extends MerossSubDevice {
    /**
     * Creates a new HubTempHumSensor instance
     * @param {string} hubDeviceUuid - UUID of the hub device
     * @param {string} subdeviceId - Subdevice ID
     * @param {import('../meross')} manager - Root Meross instance
     * @param {Object} [kwargs] - Additional subdevice information
     */
    constructor(hubDeviceUuid, subdeviceId, manager, kwargs = {}) {
        super(hubDeviceUuid, subdeviceId, manager, kwargs);

        this._temperature = {};
        this._humidity = {};
        this._lux = null;
        this._samples = [];
        this._lastSampledTime = null;
        this._alert = {};
        this._adjust = {};
    }

    /**
     * Handles Appliance.Hub.Sensor.All and Appliance.Hub.Sensor.TempHum namespaces.
     *
     * @private
     * @param {Object} data - Notification data payload
     * @param {number|null|undefined} messageTs - Message ordering time from the hub envelope header
     */
    _handleSensorAll(data, messageTs) {
        this._updateOnlineStatus(data, messageTs);

        // Merge to preserve existing properties like min/max temperature ranges
        if (data.temperature) {
            this._temperature = { ...this._temperature, ...data.temperature };
        }

        if (data.humidity) {
            this._humidity = { ...this._humidity, ...data.humidity };
        }

        if (data.battery !== undefined && data.battery !== null) {
            this._battery = data.battery;
        }

        if (data.sample && Array.isArray(data.sample)) {
            this._samples = this._parseSampleArray(data.sample);
        }

        if (data.syncedTime) {
            this._lastSampledTime = new Date(data.syncedTime * 1000);
        }
    }

    /**
     * Handles Appliance.Hub.Sensor.Alert namespace.
     *
     * @private
     * @param {Object} data - Notification data payload
     * @param {number|null|undefined} _messageTs - Message ordering time (unused; alert config is not time-series)
     */
    _handleAlert(data, _messageTs) {
        if (data.temperature !== undefined) {
            this._alert.temperature = data.temperature;
        }
        if (data.humidity !== undefined) {
            this._alert.humidity = data.humidity;
        }
    }

    /**
     * Handles Appliance.Hub.Sensor.Adjust namespace.
     *
     * @private
     * @param {Object} data - Notification data payload
     * @param {number|null|undefined} _messageTs - Message ordering time (unused; calibration is not time-series)
     */
    _handleAdjust(data, _messageTs) {
        if (data.temperature !== undefined) {
            this._adjust.temperature = data.temperature;
        }
        if (data.humidity !== undefined) {
            this._adjust.humidity = data.humidity;
        }
    }

    /**
     * Alert threshold config from the last refresh or PUSH.
     *
     * @returns {Object} `temperature` / `humidity` segment arrays
     */
    getAlert() {
        return { ...this._alert };
    }

    /**
     * Temperature/humidity calibration offsets (firmware ×10 units).
     *
     * @returns {Object}
     */
    getAdjust() {
        return { ...this._adjust };
    }

    /**
     * Handles Appliance.Control.Sensor.LatestX namespace.
     *
     * @private
     * @param {Object} data - Notification data payload
     */
    _handleLatestX(data) {
        if (!data.data) {
            return;
        }

        const tempReading = this._extractLatestReading(data.data, 'temp');
        if (tempReading) {
            this._temperature.latest = tempReading.value;
            if (tempReading.timestamp) {
                this._temperature.latestSampleTime = tempReading.timestamp;
                this._lastSampledTime = new Date(tempReading.timestamp * 1000);
            }
        }

        const humiReading = this._extractLatestReading(data.data, 'humi');
        if (humiReading) {
            this._humidity.latest = humiReading.value;
            if (humiReading.timestamp) {
                this._humidity.latestSampleTime = humiReading.timestamp;
            }
        }

        const lightReading = this._extractLatestReading(data.data, 'light');
        if (lightReading) {
            this._lux = lightReading.value;
        }
    }

    /**
     * Parses sample array into structured objects.
     *
     * @private
     * @param {Array} samples - Array of sample data
     * @returns {Array} Array of parsed sample objects
     */
    _parseSampleArray(samples) {
        return samples.map(sample => {
            const [temp, hum, fromTs, toTs] = sample;
            return {
                fromTs,
                toTs,
                temperature: temp ? parseFloat(temp) / 10 : null,
                humidity: hum ? parseFloat(hum) / 10 : null
            };
        });
    }

    /**
     * Extracts latest reading from LatestX data format.
     *
     * @private
     * @param {Object} data - LatestX data object
     * @param {string} type - Reading type ('temp', 'humi', 'light')
     * @returns {Object|null} Reading object with value and timestamp, or null if not available
     */
    _extractLatestReading(data, type) {
        const readingArray = data[type];
        if (!Array.isArray(readingArray) || readingArray.length === 0) {
            return null;
        }

        const readingData = readingArray[0];
        if (readingData.value === undefined || readingData.value === null) {
            return null;
        }

        return {
            value: readingData.value,
            timestamp: readingData.timestamp
        };
    }

    /**
     * Gets the last sampled temperature in Celsius.
     *
     * Temperature values are stored as tenths of degrees (×10). Handles edge case where
     * some firmware versions double-scale values (×100), detected by values > 1000.
     *
     * @returns {number|null} Temperature in Celsius, or null if not available
     * @example
     * const temp = sensor.getLastSampledTemperature();
     * if (temp !== null) {
     *     console.log(`Current temperature: ${temp}°C`);
     * }
     */
    getLastSampledTemperature() {
        const temp = this._temperature.latest;
        if (temp === undefined || temp === null) {
            return null;
        }
        const tempValue = parseFloat(temp);
        if (tempValue > 1000) {
            return tempValue / 100.0;
        }
        return tempValue / 10.0;
    }

    /**
     * Gets the last sampled humidity percentage.
     *
     * @returns {number|null} Humidity percentage (0-100), or null if not available
     * @example
     * const humidity = sensor.getLastSampledHumidity();
     * if (humidity !== null) {
     *     console.log(`Current humidity: ${humidity}%`);
     * }
     */
    getLastSampledHumidity() {
        const hum = this._humidity.latest;
        if (hum === undefined || hum === null) {
            return null;
        }
        return parseFloat(hum) / 10.0;
    }

    /**
     * Gets the timestamp of the last sample
     * @returns {Date|null} Date object or null if not available
     */
    getLastSampledTime() {
        return this._lastSampledTime;
    }

    /**
     * Gets the minimum supported temperature in Celsius
     * @returns {number|null} Minimum temperature in Celsius or null if not available
     */
    getMinSupportedTemperature() {
        return this._temperature.min ? parseFloat(this._temperature.min) / 10 : null;
    }

    /**
     * Gets the maximum supported temperature in Celsius
     * @returns {number|null} Maximum temperature in Celsius or null if not available
     */
    getMaxSupportedTemperature() {
        return this._temperature.max ? parseFloat(this._temperature.max) / 10 : null;
    }


    /**
     * Gets the lux (illuminance) reading.
     *
     * @returns {number|null} Lux value, or null if not available
     * @example
     * const lux = sensor.getLux();
     * if (lux !== null) {
     *     console.log(`Light: ${lux} lx`);
     * }
     */
    getLux() {
        return this._lux !== undefined && this._lux !== null ? this._lux : null;
    }

    /**
     * @protected
     * @param {Object} state
     * @returns {void}
     */
    _appendSubdeviceState(state) {
        const temp = this.getLastSampledTemperature();
        const hum = this.getLastSampledHumidity();
        if (temp !== null || this._temperature.latestSampleTime != null || this._temperature.min != null) {
            state.temperature = {
                0: {
                    latest: temp,
                    latestSampleTime: this._temperature.latestSampleTime ?? null,
                    min: this.getMinSupportedTemperature(),
                    max: this.getMaxSupportedTemperature()
                }
            };
        }
        if (hum !== null || this._humidity.latestSampleTime != null) {
            state.humidity = {
                0: {
                    latest: hum,
                    latestSampleTime: this._humidity.latestSampleTime ?? null
                }
            };
        }
        const lux = this.getLux();
        if (lux !== null) {
            state.lux = { 0: lux };
        }
        if (Object.keys(this._alert).length > 0) {
            state.alert = { 0: this.getAlert() };
        }
        if (Object.keys(this._adjust).length > 0) {
            state.adjust = { 0: this.getAdjust() };
        }
    }
}

/**
 * Hub door/window contact sensor subdevice (MS200, etc.).
 *
 * @class HubDoorWindowSensor
 * @extends MerossSubDevice
 */
class HubDoorWindowSensor extends MerossSubDevice {
    /**
     * @param {string} hubDeviceUuid - UUID of the hub device
     * @param {string} subdeviceId - Subdevice ID
     * @param {import('../meross')} manager - Root Meross instance
     * @param {Object} [kwargs] - Additional subdevice information
     */
    constructor(hubDeviceUuid, subdeviceId, manager, kwargs = {}) {
        super(hubDeviceUuid, subdeviceId, manager, kwargs);

        this._doorWindowStatus = null;
        this._lmTime = null;
        this._syncedTime = null;
        this._samples = [];
    }

    /**
     * @private
     * @param {Object} data - Door/window payload slice
     * @param {number|null|undefined} messageTs - Hub envelope timestamp for ordering
     */
    _applyDoorWindowData(data, messageTs) {
        if (data.status !== undefined && data.status !== null) {
            if (shouldApplyUpdate(this, 'doorWindowStatus', messageTs)) {
                this._doorWindowStatus = data.status;
            }
        }
        if (data.lmTime !== undefined && data.lmTime !== null) {
            if (shouldApplyUpdate(this, 'doorWindowLmTime', messageTs)) {
                this._lmTime = data.lmTime;
            }
        }
        if (data.syncedTime !== undefined && data.syncedTime !== null) {
            this._syncedTime = data.syncedTime;
        }
        if (data.sample && Array.isArray(data.sample)) {
            this._samples = data.sample.map(([status, ts]) => ({ status, timestamp: ts }));
        }
    }

    /**
     * @private
     * @param {Object} data - Notification data payload
     * @param {number|null|undefined} messageTs - Message ordering time
     */
    _handleDoorWindow(data, messageTs) {
        this._applyDoorWindowData(data, messageTs);
    }

    /**
     * @private
     * @param {Object} data - Sensor.All item
     * @param {number|null|undefined} messageTs - Message ordering time
     */
    _handleSensorAll(data, messageTs) {
        this._updateOnlineStatus(data, messageTs);
        if (data.doorWindow) {
            this._applyDoorWindowData(data.doorWindow, messageTs);
        }
        if (data.battery !== undefined && data.battery !== null) {
            this._battery = data.battery;
        }
    }

    /**
     * @returns {boolean|null} True when open, false when closed, null if unknown
     */
    isOpen() {
        if (this._doorWindowStatus === null || this._doorWindowStatus === undefined) {
            return null;
        }
        return this._doorWindowStatus === 1;
    }

    /**
     * @returns {number|null} Unix timestamp of the latest door/window change
     */
    getLatestLmTime() {
        return this._lmTime;
    }

    /**
     * @returns {Array<{status: number, timestamp: number}>} Historical open/close samples
     */
    getDoorWindowSamples() {
        return [...this._samples];
    }

    /**
     * @protected
     * @param {Object} state
     * @returns {void}
     */
    _appendSubdeviceState(state) {
        state.doorWindow = {
            0: {
                isOpen: this.isOpen(),
                lmTime: this._lmTime,
                syncedTime: this._syncedTime
            }
        };
    }
}

/**
 * Hub Thermostat Valve subdevice (MTS100v3, etc.).
 *
 * This class represents smart thermostat valves that connect through a Meross hub.
 * It provides comprehensive control over heating/cooling modes, target temperatures,
 * presets, and valve on/off state.
 *
 * @class HubThermostatValve
 * @extends MerossSubDevice
 * @example
 * const valve = hub.getSubdevice('valve123');
 * if (valve instanceof HubThermostatValve) {
 *     // Turn valve on (using hub-specific method)
 *     await valve.setToggle({ on: true });
 *     // Or use feature-based API if available: await valve.toggle.set({ channel: 0, on: true });
 *
 *     // Set target temperature
 *     await valve.setTargetTemperature(22); // 22°C
 *
 *     // Set thermostat mode
 *     await valve.setMode(ThermostatMode.AUTO);
 *
 *     // Check if heating
 *     if (valve.isHeating()) {
 *         console.log('Valve is currently heating');
 *     }
 *
 *     // Use preset temperatures
 *     await valve.setPresetTemperature('comfort', 23);
 *     const comfortTemp = valve.getPresetTemperature('comfort');
 * }
 */
class HubThermostatValve extends MerossSubDevice {
    /**
     * Creates a new HubThermostatValve instance
     * @param {string} hubDeviceUuid - UUID of the hub device
     * @param {string} subdeviceId - Subdevice ID
     * @param {import('../meross')} manager - Root Meross instance
     * @param {Object} [kwargs] - Additional subdevice information
     */
    constructor(hubDeviceUuid, subdeviceId, manager, kwargs = {}) {
        super(hubDeviceUuid, subdeviceId, manager, kwargs);

        this._togglex = {};
        this._mode = {};
        this._temperature = {};
        this._adjust = {};
        this._scheduleBMode = null;
        this._scheduleB = null;
        this._superCtl = null;
        this._mts100Config = null;
        this._lastActiveTime = null;
    }

    /**
     * Handles Appliance.Hub.Mts100.All namespace.
     *
     * @private
     * @param {Object} data - Notification data payload
     * @param {number|null|undefined} messageTs - Message ordering time from the hub envelope header
     */
    _handleMts100All(data, messageTs) {
        this._scheduleBMode = data.scheduleBMode;

        this._updateOnlineStatus(data, messageTs, { touchLastActiveTime: true });

        if (data.togglex) {
            this._togglex = { ...this._togglex, ...data.togglex };
        }
        if (data.mode) {
            this._mode = { ...this._mode, ...data.mode };
        }
        if (data.temperature) {
            this._temperature = { ...this._temperature, ...data.temperature };
            this._temperature.latestSampleTime = Date.now();
        }
        if (data.adjust) {
            this._adjust = { ...this._adjust, ...data.adjust };
            this._adjust.latestSampleTime = Date.now();
        }
    }

    /**
     * Handles Appliance.Hub.ToggleX namespace
     * @private
     * @param {Object} data - Notification data payload
     */
    _handleToggleX(data) {
        if (data.onoff !== undefined) {
            this._togglex.onoff = data.onoff;
        }
    }

    /**
     * Handles Appliance.Hub.Mts100.Mode namespace
     * @private
     * @param {Object} data - Notification data payload
     */
    _handleMts100Mode(data) {
        if (data.state !== undefined) {
            this._mode.state = data.state;
        }
    }

    /**
     * Handles Appliance.Hub.Mts100.Temperature namespace
     * @private
     * @param {Object} data - Notification data payload
     */
    _handleMts100Temperature(data) {
        if (data) {
            this._temperature = { ...this._temperature, ...data };
            this._temperature.latestSampleTime = Date.now();
        }
    }

    /**
     * @private
     * @param {Object} data - Mts100.Adjust payload item
     * @param {number|null|undefined} _messageTs - Message ordering time (unused)
     */
    _handleMts100Adjust(data, _messageTs) {
        if (data.temperature !== undefined) {
            this._adjust = { ...this._adjust, temperature: data.temperature };
            this._adjust.latestSampleTime = Date.now();
        }
    }

    /**
     * @private
     * @param {Object} data - SuperCtl payload item
     */
    _handleMts100SuperCtl(data) {
        this._superCtl = { ...(this._superCtl || {}), ...data };
    }

    /**
     * @private
     * @param {Object} data - ScheduleB payload item (`schedule` or per-day fields)
     */
    _handleMts100ScheduleB(data) {
        this._scheduleB = { ...(this._scheduleB || {}), ...data };
    }

    /**
     * @private
     * @param {Object} data - Config payload item
     */
    _handleMts100Config(data) {
        this._mts100Config = { ...(this._mts100Config || {}), ...data };
    }

    /**
     * @returns {Object|null} Super Control settings from the last refresh or PUSH
     */
    getSuperCtl() {
        return this._superCtl ? { ...this._superCtl } : null;
    }

    /**
     * @returns {Object|null} Schedule B timetable from the last refresh or PUSH
     */
    getScheduleB() {
        return this._scheduleB ? { ...this._scheduleB } : null;
    }

    /**
     * @returns {Object|null} MTS100 PID/config from the last refresh or PUSH
     */
    getMts100Config() {
        return this._mts100Config ? { ...this._mts100Config } : null;
    }

    /**
     * Checks if the valve is currently on.
     *
     * @returns {boolean} True if valve is on, false otherwise
     * @example
     * if (valve.isOn()) {
     *     console.log('Valve is open');
     * } else {
     *     console.log('Valve is closed');
     * }
     */
    isOn() {
        return this._togglex.onoff === 1;
    }

    /**
     * Sets the valve state (on/off).
     *
     * @param {Object} options - Toggle options
     * @param {boolean} options.on - True to turn on, false to turn off
     * @returns {Promise<void>} Promise that resolves when command is sent
     */
    async setToggle(options) {
        const { on } = options;
        await this.publishMessage('SET', 'Appliance.Hub.ToggleX', {
            togglex: [{ id: this._subdeviceId, onoff: on ? 1 : 0, channel: 0 }]
        }, null);
        this._togglex.onoff = on ? 1 : 0;
    }

    /**
     * Toggles the valve state (on/off).
     *
     * @returns {Promise<void>} Promise that resolves when command is sent
     */
    async toggle() {
        const isOn = this.isOn();
        await this.setToggle({ on: !isOn });
    }

    /**
     * Gets the current thermostat mode
     * @returns {number|undefined} Mode value from ThermostatMode enum or undefined if not available
     */
    getMode() {
        return this._mode.state;
    }

    /**
     * Sets the thermostat mode.
     *
     * @param {number} mode - Mode value from {@link ThermostatMode} enum
     * @returns {Promise<void>} Promise that resolves when command is sent
     * @example
     * // Set to auto mode
     * await valve.setMode(ThermostatMode.AUTO);
     *
     * // Set to heating mode
     * await valve.setMode(ThermostatMode.HEAT);
     */
    async setMode(mode) {
        await this.publishMessage('SET', 'Appliance.Hub.Mts100.Mode', {
            mode: [{ id: this._subdeviceId, state: mode }]
        }, null);
        this._mode.state = mode;
    }

    /**
     * Gets the target temperature in Celsius
     * @returns {number|null} Target temperature in Celsius or null if not available
     */
    getTargetTemperature() {
        const temp = this._temperature.currentSet;
        if (temp === undefined || temp === null) {
            return null;
        }
        return parseFloat(temp) / 10.0;
    }

    /**
     * Sets the target temperature
     * @param {number} temperature - Target temperature in Celsius
     * @returns {Promise<void>} Promise that resolves when command is sent
     */
    async setTargetTemperature(temperature) {
        const targetTemp = temperature * 10;
        await this.publishMessage('SET', 'Appliance.Hub.Mts100.Temperature', {
            temperature: [{ id: this._subdeviceId, custom: targetTemp }]
        }, null);
        this._temperature.currentSet = targetTemp;
    }

    /**
     * Gets the last sampled room temperature in Celsius
     * @returns {number|null} Room temperature in Celsius or null if not available
     */
    getLastSampledTemperature() {
        const temp = this._temperature.room;
        if (temp === undefined || temp === null) {
            return null;
        }
        return parseFloat(temp) / 10.0;
    }

    /**
     * Gets the minimum supported temperature in Celsius
     * @returns {number|null} Minimum temperature in Celsius or null if not available
     */
    getMinSupportedTemperature() {
        const temp = this._temperature.min;
        if (temp === undefined || temp === null) {
            return null;
        }
        return parseFloat(temp) / 10.0;
    }

    /**
     * Gets the maximum supported temperature in Celsius
     * @returns {number|null} Maximum temperature in Celsius or null if not available
     */
    getMaxSupportedTemperature() {
        const temp = this._temperature.max;
        if (temp === undefined || temp === null) {
            return null;
        }
        return parseFloat(temp) / 10.0;
    }

    /**
     * Checks if the valve is currently heating
     * @returns {boolean} True if heating, false otherwise
     */
    isHeating() {
        return this._temperature.heating === 1;
    }

    /**
     * Checks if window open detection is active
     * @returns {boolean} True if window is detected as open, false otherwise
     */
    isWindowOpen() {
        return this._temperature.openWindow === 1;
    }

    /**
     * Gets the list of supported temperature presets
     * @returns {Array<string>} Array of preset names: ['custom', 'comfort', 'economy', 'away']
     */
    getSupportedPresets() {
        return ['custom', 'comfort', 'economy', 'away'];
    }

    /**
     * Gets the temperature for a specific preset
     * @param {string} preset - Preset name (must be one of: 'custom', 'comfort', 'economy', 'away')
     * @returns {number|null} Temperature in Celsius or null if preset not supported or not available
     */
    getPresetTemperature(preset) {
        if (!this.getSupportedPresets().includes(preset)) {
            return null;
        }
        const val = this._temperature[preset];
        if (val === undefined || val === null) {
            return null;
        }
        return parseFloat(val) / 10.0;
    }

    /**
     * Sets the temperature for a specific preset
     * @param {string} preset - Preset name (must be one of: 'custom', 'comfort', 'economy', 'away')
     * @param {number} temperature - Temperature in Celsius
     * @returns {Promise<void>} Promise that resolves when command is sent
     * @throws {MerossDeviceError} If preset is not supported
     */
    async setPresetTemperature(preset, temperature) {
        if (!this.getSupportedPresets().includes(preset)) {
            throw new MerossDeviceError(`Preset ${preset} is not supported`, 'COMMAND_FAILED', { preset, deviceUuid: this.uuid });
        }
        const targetTemp = temperature * 10;
        await this.publishMessage('SET', 'Appliance.Hub.Mts100.Temperature', {
            temperature: [{ id: this._subdeviceId, [preset]: targetTemp }]
        }, null);
        this._temperature[preset] = targetTemp;
    }

    /**
     * Gets the temperature adjustment offset in Celsius
     * @returns {number|null} Adjustment offset in Celsius or null if not available
     */
    getAdjust() {
        const adjust = this._adjust.temperature;
        if (adjust === undefined || adjust === null) {
            return null;
        }
        return parseFloat(adjust) / 100.0;
    }

    /**
     * Sets the temperature adjustment offset
     * @param {number} temperature - Adjustment offset in Celsius
     * @returns {Promise<void>} Promise that resolves when command is sent
     */
    async setAdjust(temperature) {
        const adjustTemp = temperature * 100;
        await this.publishMessage('SET', 'Appliance.Hub.Mts100.Adjust', {
            adjust: [{ id: this._subdeviceId, temperature: adjustTemp }]
        }, null);
        this._adjust.temperature = adjustTemp;
        this._adjust.latestSampleTime = Date.now();
    }

    /**
     * @protected
     * @param {Object} state
     * @returns {void}
     */
    _appendSubdeviceState(state) {
        state.thermostat = {
            0: {
                isOn: this.isOn(),
                mode: this.getMode(),
                targetTemp: this.getTargetTemperature(),
                roomTemp: this.getLastSampledTemperature(),
                heating: this.isHeating(),
                windowOpen: this.isWindowOpen(),
                adjust: this.getAdjust(),
                scheduleBMode: this._scheduleBMode,
                superCtl: this.getSuperCtl(),
                scheduleB: this.getScheduleB(),
                config: this.getMts100Config()
            }
        };
    }
}

/**
 * Hub Water Leak Sensor subdevice (MS405, MS400, etc.).
 *
 * This class represents water leak detection sensors that connect through a Meross hub.
 * It provides methods to check for water leaks, access leak event history, and monitor
 * sensor status.
 *
 * @class HubWaterLeakSensor
 * @extends MerossSubDevice
 * @example
 * const sensor = hub.getSubdevice('leak123');
 * if (sensor instanceof HubWaterLeakSensor) {
 *     // Check for leaks
 *     const isLeaking = sensor.isLeaking();
 *     if (isLeaking) {
 *         console.warn('Water leak detected!');
 *         const leakTime = sensor.getLatestDetectedWaterLeakTs();
 *         console.log(`Leak detected at: ${new Date(leakTime * 1000)}`);
 *     }
 *
 *     // Get leak event history
 *     const events = sensor.getLastEvents();
 *     console.log(`Total events: ${events.length}`);
 * }
 */
class HubWaterLeakSensor extends MerossSubDevice {
    /**
     * Creates a new HubWaterLeakSensor instance
     * @param {string} hubDeviceUuid - UUID of the hub device
     * @param {string} subdeviceId - Subdevice ID
     * @param {import('../meross')} manager - Root Meross instance
     * @param {Object} [kwargs] - Additional subdevice information
     */
    constructor(hubDeviceUuid, subdeviceId, manager, kwargs = {}) {
        super(hubDeviceUuid, subdeviceId, manager, kwargs);

        this._waterLeakState = null;
        this._lastEventTs = null;
        this._cachedEvents = [];
        this._maxEventsQueueLen = 30;
        this._lastWaterLeakEventTs = null;
    }

    /**
     * Handles Appliance.Hub.Sensor.WaterLeak namespace
     * @private
     * @param {Object} data - Notification data payload
     */
    _handleWaterLeak(data) {
        const { latestWaterLeak } = data;
        const { latestSampleTime } = data;

        if (latestSampleTime !== undefined && latestSampleTime !== null) {
            this._handleWaterLeakFreshData(latestWaterLeak === 1, latestSampleTime);
        }
    }

    /**
     * Handles Appliance.Hub.Sensor.All namespace
     * @private
     * @param {Object} data - Notification data payload
     * @param {number|null|undefined} messageTs - Message ordering time from the hub envelope header
     */
    _handleSensorAll(data, messageTs) {
        this._updateOnlineStatus(data, messageTs);

        // Extract water leak data if present
        if (data.waterLeak) {
            const { latestWaterLeak } = data.waterLeak;
            const { latestSampleTime } = data.waterLeak;

            if (latestSampleTime !== undefined && latestSampleTime !== null) {
                this._handleWaterLeakFreshData(latestWaterLeak === 1, latestSampleTime);
            }
        }
    }

    /**
     * Checks if water leak is currently detected.
     *
     * @returns {boolean|null} True if leaking, false if not leaking, null if state is unknown
     * @example
     * const isLeaking = sensor.isLeaking();
     * if (isLeaking === true) {
     *     console.warn('Water leak detected!');
     * } else if (isLeaking === false) {
     *     console.log('No water leak detected');
     * } else {
     *     console.log('Sensor state unknown');
     * }
     */
    isLeaking() {
        return this._waterLeakState;
    }

    /**
     * Gets the timestamp of the latest sample
     * @returns {number|null} Timestamp or null if no samples received
     */
    getLatestSampleTime() {
        return this._lastEventTs;
    }

    /**
     * Gets the timestamp of the latest detected water leak event
     * @returns {number|null} Timestamp or null if no leak events detected
     */
    getLatestDetectedWaterLeakTs() {
        return this._lastWaterLeakEventTs;
    }

    /**
     * Gets the last water leak events (cached queue, max 30 events)
     * @returns {Array<Object>} Array of event objects with leaking (boolean) and timestamp (number) properties
     */
    getLastEvents() {
        return [...this._cachedEvents];
    }

    /**
     * Handles fresh water leak data with timestamp validation.
     *
     * Ignores stale updates to maintain chronological order and prevent race conditions
     * from out-of-order notifications. Maintains bounded event history using FIFO queue.
     *
     * @private
     * @param {boolean} leaking - Whether water leak is detected
     * @param {number} timestamp - Event timestamp
     */
    _handleWaterLeakFreshData(leaking, timestamp) {
        if (this._lastEventTs !== null && timestamp <= this._lastEventTs) {
            return;
        }

        if (this._lastEventTs === null || timestamp >= this._lastEventTs) {
            this._lastEventTs = timestamp;
            this._waterLeakState = leaking;
        }

        if (leaking && (this._lastWaterLeakEventTs === null || timestamp >= this._lastWaterLeakEventTs)) {
            this._lastWaterLeakEventTs = timestamp;
        }

        if (this._cachedEvents.length >= this._maxEventsQueueLen) {
            this._cachedEvents.shift();
        }
        this._cachedEvents.push({
            leaking,
            timestamp
        });
    }

    /**
     * @protected
     * @param {Object} state
     * @returns {void}
     */
    _appendSubdeviceState(state) {
        state.waterLeak = {
            0: {
                isLeaking: this.isLeaking(),
                latestSampleTime: this.getLatestSampleTime(),
                latestDetectedTs: this.getLatestDetectedWaterLeakTs()
            }
        };
    }
}

/**
 * Hub Smoke Detector subdevice (MA151, etc.).
 *
 * This class represents smoke detector devices that connect through a Meross hub.
 * It provides methods to check alarm status, mute alarms, access test event history,
 * and monitor sensor status.
 *
 * @class HubSmokeDetector
 * @extends MerossSubDevice
 * @example
 * const detector = hub.getSubdevice('smoke123');
 * if (detector instanceof HubSmokeDetector) {
 *     // Check alarm status
 *     const status = detector.getSmokeAlarmStatus();
 *     if (status === SmokeAlarmStatus.NORMAL) {
 *         console.log('No alarms detected');
 *     } else if (status === SmokeAlarmStatus.MUTE_SMOKE_ALARM) {
 *         console.log('Smoke alarm is muted');
 *     }
 *
 *     // Mute smoke alarm
 *     await detector.muteAlarm(true);
 *
 *     // Get test events
 *     const testEvents = detector.getTestEvents();
 *     console.log(`Test events: ${testEvents.length}`);
 *
 *     // Refresh alarm status
 *     await detector.refreshAlarmStatus();
 * }
 */
class HubSmokeDetector extends MerossSubDevice {
    /**
     * Creates a new HubSmokeDetector instance
     * @param {string} hubDeviceUuid - UUID of the hub device
     * @param {string} subdeviceId - Subdevice ID
     * @param {import('../meross')} manager - Root Meross instance
     * @param {Object} [kwargs] - Additional subdevice information
     */
    constructor(hubDeviceUuid, subdeviceId, manager, kwargs = {}) {
        super(hubDeviceUuid, subdeviceId, manager, kwargs);

        this._alarmStatus = null;
        this._interConn = null;
        this._lastStatusUpdate = null;
        this._testEvents = [];
        this._maxTestEvents = 10;
    }

    /**
     * Handles Appliance.Hub.Sensor.Smoke namespace
     * @private
     * @param {Object} data - Notification data payload
     */
    _handleSmoke(data) {
        this._handleSmokeAlarmData(data);
    }

    /**
     * Handles Appliance.Hub.Sensor.All namespace
     * @private
     * @param {Object} data - Notification data payload
     * @param {number|null|undefined} messageTs - Message ordering time from the hub envelope header
     */
    _handleSensorAll(data, messageTs) {
        this._updateOnlineStatus(data, messageTs);

        // Extract smoke alarm data if present
        if (data.smokeAlarm) {
            this._handleSmokeAlarmData(data.smokeAlarm);
        }
    }

    /**
     * Handles smoke alarm data with timestamp validation.
     *
     * Normalizes array format responses to single object and validates timestamp freshness
     * to prevent state regression from out-of-order notifications.
     *
     * @private
     * @param {Object|Array} data - Smoke alarm data (can be object or array)
     */
    _handleSmokeAlarmData(data) {
        const alarmData = this._normalizeAlarmData(data);

        const status = alarmData?.status;
        const interConn = alarmData?.interConn;
        const timestamp = alarmData?.timestamp;
        const event = alarmData?.event;

        if (!this._validateAlarmTimestamp(timestamp)) {
            return;
        }

        if (timestamp !== undefined && timestamp !== null) {
            this._lastStatusUpdate = timestamp;
        }

        if (status !== undefined && status !== null) {
            this._alarmStatus = status;
        }

        if (interConn !== undefined && interConn !== null) {
            this._interConn = interConn;
        }

        if (event && event.test) {
            this._processTestEvent(event.test);
        }
    }

    /**
     * Normalizes alarm data from array format to single object.
     *
     * @private
     * @param {Object|Array} data - Smoke alarm data (can be object or array)
     * @returns {Object} Normalized alarm data object
     */
    _normalizeAlarmData(data) {
        if (Array.isArray(data) && data.length > 0) {
            return data[0];
        }
        return data;
    }

    /**
     * Validates alarm timestamp freshness.
     *
     * @private
     * @param {number|undefined|null} timestamp - Timestamp to validate
     * @returns {boolean} True if update should proceed, false if stale
     */
    _validateAlarmTimestamp(timestamp) {
        if (timestamp === undefined || timestamp === null) {
            return true;
        }
        if (this._lastStatusUpdate !== null && timestamp <= this._lastStatusUpdate) {
            return false;
        }
        return true;
    }

    /**
     * Processes test event data.
     *
     * Maintains FIFO queue with size limit to prevent unbounded memory growth.
     *
     * @private
     * @param {Object} testEvent - Test event object with type and timestamp
     */
    _processTestEvent(testEvent) {
        const testType = testEvent.type;
        const testTimestamp = testEvent.timestamp;

        if (this._testEvents.length >= this._maxTestEvents) {
            this._testEvents.shift();
        }
        this._testEvents.push({
            type: testType,
            timestamp: testTimestamp
        });
    }

    /**
     * Gets the current smoke alarm status.
     *
     * @returns {number|null} Alarm status code from {@link SmokeAlarmStatus} enum (23, 26, 27), or null if unknown
     * @example
     * const status = detector.getSmokeAlarmStatus();
     * if (status === SmokeAlarmStatus.NORMAL) {
     *     console.log('No alarms');
     * } else if (status === SmokeAlarmStatus.MUTE_SMOKE_ALARM) {
     *     console.log('Smoke alarm muted');
     * }
     */
    getSmokeAlarmStatus() {
        return this._alarmStatus;
    }

    /**
     * Gets the interconnection status
     * @returns {number|null} Interconnection status (0 = not interconnected, 1 = interconnected) or null if unknown
     */
    getInterConnStatus() {
        return this._interConn;
    }

    /**
     * Gets the timestamp of the last status update
     * @returns {number|null} Timestamp or null if no updates received
     */
    getLastStatusUpdate() {
        return this._lastStatusUpdate;
    }

    /**
     * Mutes the smoke alarm or temperature alarm.
     *
     * @param {boolean} [muteSmoke=true] - If true, mute smoke alarm (status 27), else mute temperature alarm (status 26)
     * @returns {Promise<Object>} Promise that resolves with the response from the device
     * @example
     * // Mute smoke alarm
     * await detector.muteAlarm(true);
     *
     * // Mute temperature alarm
     * await detector.muteAlarm(false);
     */
    async muteAlarm(muteSmoke = true) {
        const status = muteSmoke ? SmokeAlarmStatus.MUTE_SMOKE_ALARM : SmokeAlarmStatus.MUTE_TEMPERATURE_ALARM;

        const { payload: response } = await this.publishMessage('SET', 'Appliance.Hub.Sensor.Smoke', {
            smokeAlarm: [{
                id: this._subdeviceId,
                status
            }]
        }, null);

        if (response) {
            this._alarmStatus = status;
        }

        return response;
    }

    /**
     * Gets the cached test events
     * @returns {Array<Object>} Array of test event objects with type and timestamp properties
     */
    getTestEvents() {
        return [...this._testEvents];
    }

    /**
     * @protected
     * @param {Object} state
     * @returns {void}
     */
    _appendSubdeviceState(state) {
        state.smoke = {
            0: {
                alarmStatus: this.getSmokeAlarmStatus(),
                interConn: this.getInterConnStatus(),
                lastStatusUpdate: this.getLastStatusUpdate()
            }
        };
    }

    /**
     * Refreshes the smoke alarm status from the device.
     *
     * @returns {Promise<Object>} Promise that resolves with the alarm status response
     */
    async refreshAlarmStatus() {
        const { header, payload: response } = await this.publishMessage('GET', 'Appliance.Hub.Sensor.Smoke', {
            smokeAlarm: [{
                id: this._subdeviceId
            }]
        }, null);

        if (response && response.smokeAlarm) {
            await this.handleMessage({
                header,
                namespace: 'Appliance.Hub.Sensor.Smoke',
                payload: response.smokeAlarm
            });
        }

        return response;
    }
}

require('../abilities/hub');
require('../abilities/hub-temp-hum');
require('../abilities/hub-alert');
require('../abilities/hub-adjust');
require('../abilities/hub-water-leak');
require('../abilities/hub-smoke');
require('../abilities/hub-door-window');
require('../abilities/hub-mts100');

module.exports = {
    MerossSubDevice,
    HubTempHumSensor,
    HubDoorWindowSensor,
    HubThermostatValve,
    HubWaterLeakSensor,
    HubSmokeDetector
};

