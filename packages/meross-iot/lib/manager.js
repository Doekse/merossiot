'use strict';

const mqtt = require('mqtt');
const crypto = require('crypto');
const EventEmitter = require('events');
const { MEROSS_MQTT_DOMAIN } = require('./model/constants');
const { TransportMode } = require('./model/enums');
const {
    buildDeviceRequestTopic,
    buildClientResponseTopic,
    buildClientUserTopic,
    deviceUuidFromPushNotification,
    generateClientAndAppId,
    generateMqttPassword
} = require('./utilities/mqtt');
const ErrorBudgetManager = require('./error-budget');
const { MqttStatsCounter } = require('./utilities/stats');
const RequestQueue = require('./utilities/request-queue');
const {
    CommandError,
    CommandTimeoutError,
    MqttError,
    AuthenticationError
} = require('./model/exception');
const { HttpApiError } = require('./model/http/exception');

/**
 * Manages Meross cloud connections and device communication
 *
 * Handles authentication, device discovery, MQTT connections, and provides
 * a unified interface for controlling Meross IoT devices. Supports both cloud MQTT
 * and local HTTP communication modes.
 *
 * @class
 * @extends EventEmitter
 */
class ManagerMeross extends EventEmitter {
    /**
     * Creates a new ManagerMeross instance
     *
     * @param {Object} options - Configuration options
     * @param {MerossHttpClient} options.httpClient - HTTP client instance (required)
     * @param {Function} [options.logger] - Optional logger function for debug output
     * @param {number} [options.transportMode=TransportMode.MQTT_ONLY] - Transport mode for device communication
     * @param {number} [options.timeout=10000] - Request timeout in milliseconds
     * @param {boolean} [options.autoRetryOnBadDomain=true] - Automatically retry on domain redirect errors
     * @param {number} [options.maxErrors=1] - Maximum errors allowed per device before skipping LAN HTTP
     * @param {number} [options.errorBudgetTimeWindow=60000] - Time window in milliseconds for error budget
     * @param {boolean} [options.enableStats=false] - Enable statistics tracking for HTTP and MQTT requests
     * @param {number} [options.maxStatsSamples=1000] - Maximum number of samples to keep in statistics
     * @param {number} [options.requestBatchSize=1] - Number of concurrent requests per device
     * @param {number} [options.requestBatchDelay=200] - Delay in milliseconds between batches
     * @param {boolean} [options.enableRequestThrottling=true] - Enable/disable request throttling
     */
    constructor(options) {
        super();

        if (!options || !options.httpClient) {
            throw new Error('httpClient is required. Use MerossHttpClient.fromUserPassword() to create a client.');
        }

        this.options = options || {};
        this.token = null;
        this.key = null;
        this.userId = null;
        this.userEmail = null;
        this.authenticated = false;
        this.httpDomain = null;
        this.mqttDomain = MEROSS_MQTT_DOMAIN;
        this.issuedOn = null;

        if (options.transportMode !== undefined) {
            this._defaultTransportMode = options.transportMode;
        } else {
            this._defaultTransportMode = TransportMode.MQTT_ONLY;
        }

        this.autoRetryOnBadDomain = options.autoRetryOnBadDomain !== undefined ? !!options.autoRetryOnBadDomain : true;

        this.timeout = options.timeout || 10000;

        // Error budget prevents repeatedly attempting LAN HTTP on devices that consistently fail
        const maxErrors = options.maxErrors !== undefined ? options.maxErrors : 1;
        const timeWindowMs = options.errorBudgetTimeWindow !== undefined ? options.errorBudgetTimeWindow : 60000;
        this._errorBudgetManager = new ErrorBudgetManager(maxErrors, timeWindowMs);

        // Conservative defaults prevent overwhelming devices that cannot handle concurrent requests
        const enableRequestThrottling = options.enableRequestThrottling !== undefined ? options.enableRequestThrottling : true;
        this._requestQueue = enableRequestThrottling ? new RequestQueue({
            batchSize: options.requestBatchSize || 1,
            batchDelay: options.requestBatchDelay || 200,
            logger: options.logger
        }) : null;

        this.mqttConnections = {};
        this._mqttConnectionPromises = new Map();
        this._deviceRegistry = new ManagerMeross.DeviceRegistry();
        this._appId = null;
        this.clientResponseTopic = null;
        this._pendingMessagesFutures = new Map();

        const enableStats = options.enableStats === true;
        this._mqttStatsCounter = enableStats ? new MqttStatsCounter(options.maxStatsSamples || 1000) : null;

        this.httpClient = options.httpClient;

        // Store subscription options from constructor for lazy initialization
        this._subscriptionOptions = options.subscription || {};

        // Reuse authentication from HTTP client if already authenticated to avoid
        // redundant authentication and share credentials between HTTP and MQTT connections
        if (this.httpClient.token) {
            this.token = this.httpClient.token;
            this.key = this.httpClient.key || null;
            this.userId = this.httpClient.userId || null;
            this.userEmail = this.httpClient.userEmail || null;
            this.httpDomain = this.httpClient.httpDomain;
            this.mqttDomain = this.httpClient.mqttDomain || this.mqttDomain;
            this.authenticated = true;
            // Generate appId once per manager instance to maintain consistent client identity
            const { appId } = generateClientAndAppId();
            this._appId = appId;
            // Set clientResponseTopic immediately to avoid race conditions during connection setup
            this.clientResponseTopic = buildClientResponseTopic(this.userId, this._appId);
        }
    }

    /**
     * Gets the default transport mode for device communication
     * @returns {number} Transport mode from TransportMode enum
     */
    get defaultTransportMode() {
        return this._defaultTransportMode;
    }

    /**
     * Sets the default transport mode for device communication
     * @param {number} value - Transport mode from TransportMode enum
     * @throws {MqttError} If invalid transport mode is provided
     */
    set defaultTransportMode(value) {
        if (!Object.values(TransportMode).includes(value)) {
            throw new MqttError(`Invalid transport mode: ${value}. Must be one of: ${Object.values(TransportMode).join(', ')}`);
        }
        this._defaultTransportMode = value;
    }

    /**
     * Gets the current authentication token data for reuse
     *
     * Returns token data that can be saved and reused in future sessions using
     * MerossHttpClient.fromCredentials().
     *
     * @returns {Object|null} Token data object or null if not authenticated
     * @returns {string} returns.token - Authentication token
     * @returns {string} returns.key - Encryption key
     * @returns {string} returns.userId - User ID
     * @returns {string} returns.userEmail - User email
     * @returns {string} returns.domain - HTTP API domain
     * @returns {string} returns.mqttDomain - MQTT domain
     * @returns {string} returns.issued_on - ISO timestamp when token was issued
     */
    getTokenData() {
        if (!this.authenticated || !this.token) {
            return null;
        }
        return {
            token: this.token,
            key: this.key,
            userId: this.userId,
            userEmail: this.userEmail,
            domain: this.httpDomain,
            mqttDomain: this.mqttDomain,
            // eslint-disable-next-line camelcase
            issued_on: this.issuedOn || new Date().toISOString()
        };
    }

    /**
     * Authenticates with Meross cloud and discovers devices
     *
     * Retrieves device list and initializes device connections.
     * The httpClient should already be authenticated when passed to the constructor.
     * If the client is not authenticated, this method will attempt to get devices
     * which may trigger authentication errors.
     *
     * @returns {Promise<number>} Promise that resolves with the number of devices discovered
     * @throws {HttpApiError} If API request fails
     * @throws {TokenExpiredError} If authentication token has expired
     */
    async login() {
        return await this.getDevices();
    }

    /**
     * Retrieves and initializes all devices from the Meross cloud
     *
     * Fetches device list from cloud API, creates device instances, and sets up
     * MQTT connections. Emits 'deviceInitialized' event for each device.
     *
     * @returns {Promise<number>} Promise that resolves with the number of devices initialized
     * @throws {HttpApiError} If API request fails
     * @throws {TokenExpiredError} If authentication token has expired
     */
    async getDevices() {
        const deviceList = await this.httpClient.getDevices();

        if (!deviceList || !Array.isArray(deviceList)) {
            return 0;
        }

        const { OnlineStatus } = require('../lib/model/enums');
        const { buildDevice } = require('./device-factory');

        const onlineDevices = deviceList.filter(dev => dev.onlineStatus === OnlineStatus.ONLINE);

        const devicesByDomain = new Map();
        onlineDevices.forEach(dev => {
            const domain = dev.domain || this.mqttDomain;
            if (!devicesByDomain.has(domain)) {
                devicesByDomain.set(domain, []);
            }
            devicesByDomain.get(domain).push(dev);
        });

        for (const [domain, devices] of devicesByDomain) {
            if (devices.length > 0) {
                const firstDevice = devices[0];
                this.initMqtt({
                    uuid: firstDevice.uuid,
                    domain
                });
            }
        }

        const devicePromises = onlineDevices.map(async (dev) => {
            try {
                // Query abilities before device creation to determine device class and features
                // Extended timeout accounts for devices that respond slowly during discovery
                let abilities = null;
                try {
                    abilities = await this._queryDeviceAbilities(
                        dev.uuid,
                        dev.domain || this.mqttDomain,
                        10000
                    );
                } catch (err) {
                    return null;
                }

                if (!abilities) {
                    return null;
                }

                // Detect hubs by checking for hub-specific ability rather than device type
                // Device type strings are unreliable, but abilities are consistent
                const { HUB_DISCRIMINATING_ABILITY } = require('./device-factory');
                const isHub = abilities && typeof abilities === 'object' &&
                             HUB_DISCRIMINATING_ABILITY in abilities;

                // Fetch subdevice metadata for hubs, but defer creation until after hub enrollment
                // This ensures hub is fully initialized before subdevices are created
                let subDeviceList = null;
                if (isHub) {
                    try {
                        subDeviceList = await this.httpClient.getSubDevices(dev.uuid);
                    } catch (err) {
                        subDeviceList = [];
                    }
                }

                // Build device with complete feature set determined from abilities
                // This avoids needing to query abilities again after device creation
                const device = buildDevice(dev, abilities, this, subDeviceList);

                // Store abilities in device instance for runtime capability checks
                device.updateAbilities(abilities);

                this._deviceRegistry.registerDevice(device);
                await this.connectDevice(device, dev);

                return device;
            } catch (err) {
                if (this.options.logger) {
                    this.options.logger(`Error enrolling device ${dev.uuid}: ${err.message}`);
                }
                return null;
            }
        });

        const devices = (await Promise.all(devicePromises)).filter(d => d !== null);

        // Create subdevices after all hubs are enrolled to ensure parent hub is fully initialized
        // Subdevices inherit capabilities from their parent hub's abilities
        const { buildSubdevice, getSubdeviceAbilities } = require('./device-factory');
        const { MerossHubDevice } = require('./controller/hub-device');
        for (const device of devices) {
            // Use instanceof to check device type since device classes are dynamically
            // created at runtime and cannot be checked using static class references
            if (device instanceof MerossHubDevice && typeof device.getSubdevices === 'function') {
                const subDeviceList = device.subDeviceList || [];
                const hubAbilities = device.abilities;

                if (hubAbilities && subDeviceList && Array.isArray(subDeviceList) && subDeviceList.length > 0) {
                    const HttpSubdeviceInfo = require('./model/http/subdevice');
                    for (const subdeviceInfoRaw of subDeviceList) {
                        try {
                            const subdeviceInfo = HttpSubdeviceInfo.fromDict(subdeviceInfoRaw);
                            // Build subdevice using hub's abilities since subdevices don't have their own
                            const subdevice = buildSubdevice(
                                subdeviceInfo,
                                device.uuid,
                                hubAbilities,
                                this
                            );

                            device.registerSubdevice(subdevice);
                            this._deviceRegistry.registerDevice(subdevice);

                            // Extract subdevice-specific abilities from hub's full ability set
                            if (subdevice && subdevice.type) {
                                const subdeviceAbilities = getSubdeviceAbilities(subdevice.type, hubAbilities);
                                if (Object.keys(subdeviceAbilities).length > 0) {
                                    subdevice.updateAbilities(subdeviceAbilities);
                                }
                            }
                        } catch (err) {
                            // Skip subdevices that fail to initialize to avoid blocking hub enrollment
                        }
                    }
                }
            }
        }

        return devices.length;
    }

    /**
     * Query device abilities via MQTT (internal method)
     *
     * Queries a device's supported capabilities (namespaces) via MQTT. This is called
     * automatically during device discovery.
     *
     * @param {string} deviceUuid - Device UUID
     * @param {string} domain - MQTT domain for the device
     * @param {number} [timeout=5000] - Timeout in milliseconds
     * @returns {Promise<Object|null>} Abilities object or null if query fails or times out
     * @throws {CommandTimeoutError} If query times out
     * @throws {MqttError} If MQTT connection fails
     * @private
     */
    async _queryDeviceAbilities(deviceUuid, domain, timeout = 5000) {
        if (!this.authenticated || !this.token || !this.key || !this.userId) {
            if (this.options.logger) {
                this.options.logger('Cannot query abilities: not authenticated');
            }
            return null;
        }

        const mqttDomain = domain || this.mqttDomain;

        if (!this.mqttConnections[mqttDomain] || !this.mqttConnections[mqttDomain].client) {
            const minimalDev = { uuid: deviceUuid, domain: mqttDomain };
            await this.initMqtt(minimalDev);
        }

        const mqttConnection = this.mqttConnections[mqttDomain];

        if (!mqttConnection.client.connected) {
            const connectionPromise = this._mqttConnectionPromises.get(mqttDomain);
            if (!connectionPromise) {
                return null;
            }
            try {
                await connectionPromise;
            } catch {
                return null;
            }
        }

        if (!this.clientResponseTopic) {
            if (this.options.logger) {
                this.options.logger('Client response topic not set');
            }
            return null;
        }

        const message = this.encodeMessage('GET', 'Appliance.System.Ability', {}, deviceUuid);
        const { messageId } = message.header;

        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                if (this._pendingMessagesFutures.has(messageId)) {
                    this._pendingMessagesFutures.delete(messageId);
                    reject(new CommandTimeoutError(
                        `Ability query timeout after ${timeout}ms`,
                        deviceUuid,
                        timeout,
                        { method: 'GET', namespace: 'Appliance.System.Ability' }
                    ));
                }
            }, timeout);

            this._pendingMessagesFutures.set(messageId, {
                resolve: (response) => {
                    clearTimeout(timeoutHandle);
                    if (response && response.ability) {
                        resolve(response.ability);
                    } else {
                        resolve(null);
                    }
                },
                reject: (error) => {
                    clearTimeout(timeoutHandle);
                    reject(error);
                },
                timeout: timeoutHandle
            });

            try {
                const topic = buildDeviceRequestTopic(deviceUuid);
                mqttConnection.client.publish(topic, JSON.stringify(message), (err) => {
                    if (err) {
                        if (this._pendingMessagesFutures.has(messageId)) {
                            clearTimeout(timeoutHandle);
                            this._pendingMessagesFutures.delete(messageId);
                        }
                        reject(err);
                    }
                });
            } catch (err) {
                if (this._pendingMessagesFutures.has(messageId)) {
                    clearTimeout(timeoutHandle);
                    this._pendingMessagesFutures.delete(messageId);
                }
                reject(err);
            }
        }).catch((error) => {
            if (this.options.logger) {
                this.options.logger(`Error querying abilities for ${deviceUuid}: ${error.message}`);
            }
            return null;
        });
    }

    /**
     * Connects to Meross cloud and initializes all devices
     *
     * Performs device discovery. The httpClient should already be authenticated
     * when passed to the constructor.
     *
     * @returns {Promise<number>} Promise that resolves with the number of devices connected
     * @throws {HttpApiError} If API request fails
     * @throws {TokenExpiredError} If authentication token has expired
     */
    async connect() {
        try {
            const deviceListLength = await this.getDevices();
            this.authenticated = true;
            return deviceListLength;
        } catch (err) {
            if (err.message && err.message.includes('Token')) {
                if (this.options.logger) {
                    this.options.logger('Token seems invalid. Ensure httpClient is authenticated.');
                }
            }
            throw err;
        }
    }

    /**
     * Logs out from Meross cloud and disconnects all devices
     *
     * Closes all MQTT connections, disconnects all devices, and clears authentication.
     * Should be called when shutting down the application to properly clean up resources.
     *
     * @returns {Promise<Object|null>} Promise that resolves with logout response data from Meross API (or null if empty)
     * @throws {AuthenticationError} If not authenticated
     */
    async logout() {
        if (!this.authenticated || !this.token) {
            throw new AuthenticationError('Not authenticated');
        }
        const response = await this.httpClient.logout();
        this.token = null;
        this.key = null;
        this.userId = null;
        this.userEmail = null;
        this.authenticated = false;

        this.disconnectAll();

        return response;
    }


    /**
     * Disconnects all devices and closes all MQTT connections
     *
     * Clears the device registry (which disconnects all devices), clears all request queues,
     * and closes all MQTT connections. This should be called when shutting down the application.
     *
     * @param {boolean} [force] - Force disconnect flag (passed to MQTT client end() method)
     * @returns {void}
     */
    disconnectAll(force) {
        // Retrieve devices before clearing registry to allow queue cleanup
        const devices = this._deviceRegistry.list();
        this._deviceRegistry.clear();

        if (this._requestQueue) {
            devices.forEach(device => {
                const uuid = device.uuid || device.dev?.uuid;
                if (uuid) {
                    this._requestQueue.clearQueue(uuid);
                }
            });
        }

        for (const domain of Object.keys(this.mqttConnections)) {
            if (this.mqttConnections[domain] && this.mqttConnections[domain].client) {
                this.mqttConnections[domain].client.removeAllListeners();
                this.mqttConnections[domain].client.end(force);
            }
        }

        this.mqttConnections = {};
        this._mqttConnectionPromises.clear();
    }

    /**
     * Initializes MQTT connection for a device
     *
     * Creates or retrieves the MQTT client for the device's domain and ensures
     * the device is added to the connection's device list. This is a simplified
     * wrapper around `_getMqttClient()` that handles device-specific setup.
     *
     * @param {Object} dev - Device definition object with uuid and optional domain
     * @returns {Promise<void>} Promise that resolves when MQTT connection is ready
     */
    async initMqtt(dev) {
        const domain = dev.domain || this.mqttDomain;

        if (!this.mqttConnections[domain]) {
            this.mqttConnections[domain] = {};
        }

        await this._getMqttClient(domain, dev.uuid);
    }

    /**
     * Creates a new MQTT client and sets up all event listeners
     *
     * This method creates a new MQTT client instance and sets up all event listeners
     * (connect, error, close, reconnect, message) exactly once.
     *
     * @param {string} domain - MQTT domain for the connection
     * @returns {mqtt.MqttClient} The created MQTT client
     * @private
     */
    _createMqttClient(domain) {
        // Generate appId if not already set (should be set in constructor when authenticated)
        if (!this._appId) {
            const { appId } = generateClientAndAppId();
            this._appId = appId;
            if (this.userId) {
                this.clientResponseTopic = buildClientResponseTopic(this.userId, this._appId);
            }
        }
        // Reuse same clientId for all clients since each domain connects to a different broker
        const clientId = `app:${this._appId}`;

        // Meross MQTT authentication requires password as MD5 hash of userId + key
        const hashedPassword = generateMqttPassword(this.userId, this.key);

        const client = mqtt.connect({
            'protocol': 'mqtts',
            'host': domain,
            'port': 2001,
            clientId,
            'username': this.userId,
            'password': hashedPassword,
            'rejectUnauthorized': true,
            'keepalive': 30,
            'reconnectPeriod': 5000
        });

        // Set up all event listeners once when client is created to prevent duplicate
        // listeners that would cause MaxListenersExceededWarning if the client is reused
        client.on('connect', () => {
            const userTopic = buildClientUserTopic(this.userId);
            client.subscribe(userTopic, (err) => {
                if (err) {
                    this.emit('error', err, null);
                }
            });

            client.subscribe(this.clientResponseTopic, (err) => {
                if (err) {
                    this.emit('error', err, null);
                }
            });

            // Resolve connection promise after subscriptions complete to ensure client is fully ready
            if (this.mqttConnections[domain]._connectionResolve) {
                this.mqttConnections[domain]._connectionResolve();
                this.mqttConnections[domain]._connectionResolve = null;
            }

            this.mqttConnections[domain].deviceList.forEach(devId => {
                const device = this._deviceRegistry._devicesByUuid.get(devId) || null;
                if (device) {
                    device.emit('connected');
                }
            });
        });

        client.on('error', (error) => {
            // MQTT client handles reconnection automatically via reconnectPeriod option
            this.mqttConnections[domain].deviceList.forEach(devId => {
                const device = this._deviceRegistry._devicesByUuid.get(devId) || null;
                if (device) {
                    device.emit('error', error ? error.toString() : null);
                }
            });
        });

        client.on('close', (error) => {
            this.mqttConnections[domain].deviceList.forEach(devId => {
                const device = this._deviceRegistry._devicesByUuid.get(devId) || null;
                if (device) {
                    device.emit('close', error ? error.toString() : null);
                }
            });
        });

        client.on('reconnect', () => {
            this.mqttConnections[domain].deviceList.forEach(devId => {
                const device = this._deviceRegistry._devicesByUuid.get(devId) || null;
                if (device) {
                    device.emit('reconnect');
                }
            });
        });

        client.on('message', (topic, message) => {
            if (!message) {return;}
            try {
                message = JSON.parse(message.toString());
            } catch (err) {
                this.emit('error', new Error(`JSON parse error: ${err}`), null);
                return;
            }

            if (!message.header) {return;}

            const { messageId } = message.header;
            const messageMethod = message.header.method;

            // Handle manager-level queries (e.g., ability queries) before routing to devices.
            // These queries use messageId-based futures rather than device-specific handlers
            // because they are initiated by the manager, not by individual devices
            if (messageId && this._pendingMessagesFutures.has(messageId)) {
                const pendingFuture = this._pendingMessagesFutures.get(messageId);

                if (pendingFuture.timeout) {
                    clearTimeout(pendingFuture.timeout);
                }

                if (messageMethod === 'ERROR') {
                    const errorPayload = message.payload || {};
                    const deviceUuid = message.header?.from ? deviceUuidFromPushNotification(message.header.from) : null;
                    pendingFuture.reject(new CommandError(
                        `Device returned error: ${JSON.stringify(errorPayload)}`,
                        errorPayload,
                        deviceUuid
                    ));
                } else if (messageMethod === 'GETACK' || messageMethod === 'SETACK' || messageMethod === 'DELETEACK') {
                    pendingFuture.resolve(message.payload || message);
                } else {
                    const topic = message.header?.from || null;
                    pendingFuture.reject(new MqttError(
                        `Unexpected message method: ${messageMethod}`,
                        topic,
                        message
                    ));
                }

                this._pendingMessagesFutures.delete(messageId);
                return;
            }

            if (!message.header.from) {return;}
            const deviceUuid = deviceUuidFromPushNotification(message.header.from);
            const device = this._deviceRegistry._devicesByUuid.get(deviceUuid) || null;
            if (device) {
                device.handleMessage(message);
            }
        });

        return client;
    }

    /**
     * Gets existing MQTT client or creates a new one for the given domain
     *
     * This method manages the MQTT client lifecycle and uses promise-based serialization
     * to prevent concurrent connection attempts. If a client already exists and is connected, it returns immediately. If a client
     * exists but is not connected, it waits for the existing connection promise. If no
     * client exists, it creates a new one and waits for connection.
     *
     * @param {string} domain - MQTT domain for the connection
     * @param {string} deviceUuid - Device UUID (for device list tracking)
     * @returns {Promise<mqtt.MqttClient>} Promise that resolves with the MQTT client
     * @private
     */
    async _getMqttClient(domain, deviceUuid) {
        if (!this.mqttConnections[domain]) {
            this.mqttConnections[domain] = {};
        }

        let client = this.mqttConnections[domain].client;
        if (!client) {
            client = this._createMqttClient(domain);
            this.mqttConnections[domain].client = client;
            this.mqttConnections[domain].deviceList = this.mqttConnections[domain].deviceList || [];
            if (!this.mqttConnections[domain].deviceList.includes(deviceUuid)) {
                this.mqttConnections[domain].deviceList.push(deviceUuid);
            }
        } else {
            if (client.connected) {
                if (!this.mqttConnections[domain].deviceList.includes(deviceUuid)) {
                    this.mqttConnections[domain].deviceList.push(deviceUuid);
                }
                return client;
            }
        }

        // Serialize connection attempts using promises to prevent concurrent connections
        // to the same domain. Multiple calls will wait for the same connection promise,
        // ensuring only one connection attempt is made per domain at a time
        let connectionPromise = this._mqttConnectionPromises.get(domain);
        if (!connectionPromise) {
            connectionPromise = new Promise((resolve, reject) => {
                this.mqttConnections[domain]._connectionResolve = resolve;

                setTimeout(() => {
                    if (this.mqttConnections[domain]) {
                        this.mqttConnections[domain]._connectionResolve = null;
                    }
                    this._mqttConnectionPromises.delete(domain);
                    reject(new MqttError(`MQTT connection timeout for domain ${domain}`, null, null));
                }, 30000);
            });

            this._mqttConnectionPromises.set(domain, connectionPromise);
        }

        await connectionPromise;
        return this.mqttConnections[domain].client;
    }

    /**
     * Sends a message to a device via MQTT
     *
     * Publishes a message to the device's MQTT topic. Tracks MQTT statistics if enabled.
     * Emits error events on the device if publish fails.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance
     * @param {Object} data - Message data object with header and payload
     * @returns {boolean} True if message was sent successfully, false if MQTT connection not available
     */
    sendMessageMqtt(device, data) {
        const domain = device.domain || this.mqttDomain;
        if (!this.mqttConnections[domain] || !this.mqttConnections[domain].client) {
            return false;
        }

        if (this.options.logger) {
            this.options.logger(`MQTT-Cloud-Call ${device.uuid}: ${JSON.stringify(data)}`);
        }

        if (this._mqttStatsCounter && data && data.header) {
            const namespace = data.header.namespace || 'Unknown';
            const method = data.header.method || 'Unknown';
            this._mqttStatsCounter.notifyApiCall(device.uuid, namespace, method);
        }

        const topic = buildDeviceRequestTopic(device.uuid);
        this.mqttConnections[domain].client.publish(topic, JSON.stringify(data), undefined, err => {
            if (err) {
                const deviceObj = this._deviceRegistry._devicesByUuid.get(device.uuid) || null;
                if (deviceObj) {
                    deviceObj.emit('error', err);
                }
            }
        });
        return true;
    }

    /**
     * Sends a message to a device via LAN HTTP
     *
     * Sends an HTTP POST request directly to the device's local IP address. Handles encryption
     * if the device supports it. Decrypts and parses the response, then routes it to the device's
     * handleMessage method. Tracks HTTP statistics if enabled.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance
     * @param {string} ip - Device LAN IP address
     * @param {Object} payload - Message payload object with header and payload
     * @param {number} [timeoutOverride=this.timeout] - Request timeout in milliseconds
     * @returns {Promise<void>} Promise that resolves when message is sent and response is handled
     * @throws {CommandError} If encryption is required but MAC address not available
     * @throws {HttpApiError} If HTTP request fails or response is invalid
     */
    async sendMessageHttp(device, ip, payload, timeoutOverride = this.timeout) {
        const url = `http://${ip}/config`;
        let messageData = JSON.stringify(payload);
        let decryptResponse = false;

        if (device && typeof device.supportEncryption === 'function' && device.supportEncryption()) {
            if (!device.isEncryptionKeySet()) {
                // Encryption key is derived from MAC address, so it must be available
                if (device._macAddress && this.key) {
                    device.setEncryptionKey(device.uuid, this.key, device._macAddress);
                } else {
                    if (this.options.logger) {
                        this.options.logger(`Warning: Device ${device.uuid} supports encryption but MAC address not available yet. Falling back to MQTT.`);
                    }
                    throw new CommandError('Encryption required but MAC address not available', null, device.uuid);
                }
            }

            try {
                messageData = device.encryptMessage(messageData);
                decryptResponse = true;
            } catch (err) {
                if (this.options.logger) {
                    this.options.logger(`Error encrypting message for ${device.uuid}: ${err.message}`);
                }
                throw err;
            }
        }

        const options = {
            url,
            method: 'POST',
            json: payload,
            timeout: timeoutOverride
        };
        if (this.options.logger) {
            this.options.logger(`HTTP-Local-Call ${device.uuid}${decryptResponse ? ' [ENCRYPTED]' : ''}: ${JSON.stringify(options)}`);
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutOverride);

            let response;
            try {
                response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: messageData,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
            } catch (error) {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    throw new Error('Request timeout');
                }
                throw error;
            }

            if (response.status !== 200) {
                if (this.options.logger) {
                    this.options.logger(`HTTP-Local-Response ${device.uuid}${decryptResponse ? ' [ENCRYPTED]' : ''} Error: Status=${response.status}`);
                }
                throw new HttpApiError(`HTTP ${response.status}: ${response.statusText}`, null, response.status);
            }

            const body = await response.text();
            if (this.options.logger) {
                this.options.logger(`HTTP-Local-Response ${device.uuid}${decryptResponse ? ' [ENCRYPTED]' : ''} OK: ${body}`);
            }

            // Track HTTP success before parsing to avoid counting parsing errors as HTTP failures
            if (this.httpClient && this.httpClient.stats) {
                this.httpClient.stats.notifyHttpRequest(url, 'POST', 200, null);
            }

            let responseBody = body;

            if (decryptResponse && device) {
                try {
                    const decrypted = device.decryptMessage(body);
                    // Remove null padding that encryption adds to match block size
                    responseBody = decrypted.toString('utf8').replace(/\0+$/, '');
                    try {
                        responseBody = JSON.parse(responseBody);
                    } catch (parseErr) {
                        if (this.options.logger) {
                            this.options.logger(`Error parsing decrypted response for ${device.uuid}: ${parseErr.message}`);
                        }
                        throw new HttpApiError(`Failed to parse decrypted response: ${parseErr.message}`, null, null);
                    }
                } catch (decryptErr) {
                    if (this.options.logger) {
                        this.options.logger(`Error decrypting response for ${device.uuid}: ${decryptErr.message}`);
                    }
                    throw decryptErr;
                }
            } else {
                try {
                    responseBody = JSON.parse(responseBody);
                } catch (parseErr) {
                    if (this.options.logger) {
                        this.options.logger(`Error parsing response for ${device.uuid}: ${parseErr.message}`);
                    }
                }
            }

            if (responseBody && typeof responseBody === 'object') {
                setImmediate(() => {
                    if (device) {
                        device.handleMessage(responseBody);
                    }
                });
                return;
            }
            throw new HttpApiError(`Invalid response: ${typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)}`, null, null);
        } catch (error) {
            // Track HTTP-level errors only, not parsing errors that occur after successful HTTP 200
            if (this.httpClient && this.httpClient.stats) {
                let errorHttpCode = null;
                const errorApiCode = null;

                if (error instanceof HttpApiError && error.httpStatusCode !== null && error.httpStatusCode !== undefined) {
                    errorHttpCode = error.httpStatusCode;
                } else if (!(error instanceof HttpApiError)) {
                    // Extract HTTP status code from network errors, timeouts, and connection failures
                    if (error.statusCode) {
                        errorHttpCode = error.statusCode;
                    } else if (error.message && error.message.includes('HTTP')) {
                        const match = error.message.match(/HTTP (\d+)/);
                        if (match) {
                            errorHttpCode = parseInt(match[1], 10);
                        }
                    }
                    if (errorHttpCode === null) {
                        errorHttpCode = 0;
                    }
                }

                if (errorHttpCode !== null) {
                    this.httpClient.stats.notifyHttpRequest(url, 'POST', errorHttpCode, errorApiCode);
                }
            }

            throw error;
        }
    }

    /**
     * Encodes a message for Meross device communication
     *
     * Creates a properly formatted message object with header containing messageId, signature,
     * timestamp, and other required fields. The signature is computed as MD5(messageId + key + timestamp).
     *
     * @param {string} method - Message method ('GET', 'SET', 'PUSH')
     * @param {string} namespace - Message namespace (e.g., 'Appliance.Control.ToggleX')
     * @param {Object} payload - Message payload object
     * @param {string} deviceUuid - Target device UUID
     * @returns {Object} Encoded message object with header and payload
     * @returns {Object} returns.header - Message header
     * @returns {string} returns.header.from - Response topic
     * @returns {string} returns.header.messageId - Unique message ID (MD5 hash)
     * @returns {string} returns.header.method - Message method
     * @returns {string} returns.header.namespace - Message namespace
     * @returns {number} returns.header.payloadVersion - Payload version (always 1)
     * @returns {string} returns.header.sign - Message signature (MD5 hash)
     * @returns {number} returns.header.timestamp - Unix timestamp in seconds
     * @returns {string} returns.header.triggerSrc - Trigger source (always 'Android')
     * @returns {string} returns.header.uuid - Device UUID
     * @returns {Object} returns.payload - Message payload
     */
    encodeMessage(method, namespace, payload, deviceUuid) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let randomstring = '';
        for (let i = 0; i < 16; i++) {
            randomstring += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const messageId = crypto.createHash('md5').update(randomstring).digest('hex').toLowerCase();
        const timestamp = Math.round(new Date().getTime() / 1000);

        const signature = crypto.createHash('md5').update(messageId + this.key + timestamp).digest('hex');

        return {
            'header': {
                'from': this.clientResponseTopic,
                messageId,
                method,
                namespace,
                'payloadVersion': 1,
                'sign': signature,
                timestamp,
                'triggerSrc': 'Android',
                'uuid': deviceUuid
            },
            payload
        };
    }

    /**
     * Requests a message to be sent to a device (with throttling support)
     *
     * This method queues requests per device and processes them in batches to prevent
     * rate limiting. Requests are throttled regardless of transport mode (HTTP or MQTT).
     * If throttling is disabled, requests are executed immediately.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance
     * @param {string|null} ip - Device LAN IP address (null if not available)
     * @param {Object} data - Message data object with header and payload
     * @param {number|null} [overrideTransportMode=null] - Override transport mode (from TransportMode enum)
     * @returns {Promise<boolean>} Promise that resolves to true if message was sent successfully
     * @throws {CommandError} If message cannot be sent
     * @throws {HttpApiError} If HTTP request fails
     * @throws {MqttError} If MQTT publish fails
     */
    async requestMessage(device, ip, data, overrideTransportMode = null) {
        if (!this._requestQueue) {
            return this._sendMessage(device, ip, data, overrideTransportMode);
        }

        return this._requestQueue.enqueue(device.uuid, () =>
            this._sendMessage(device, ip, data, overrideTransportMode)
        );
    }

    /**
     * Sends a message to a device via HTTP or MQTT (internal implementation)
     *
     * This method handles the actual message sending logic, including transport mode
     * selection, error budget checking, HTTP fallback to MQTT, and error handling.
     * It is called by requestMessage() which handles throttling/queuing.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance
     * @param {string|null} ip - Device LAN IP address (null if not available)
     * @param {Object} data - Message data object with header and payload
     * @param {number|null} [overrideTransportMode=null] - Override transport mode (from TransportMode enum)
     * @returns {Promise<boolean>} Promise that resolves to true if message was sent successfully
     * @throws {CommandError} If message cannot be sent
     * @throws {HttpApiError} If HTTP request fails
     * @throws {MqttError} If MQTT publish fails
     * @private
     */
    async _sendMessage(device, ip, data, overrideTransportMode = null) {
        const transportMode = overrideTransportMode !== null
            ? overrideTransportMode
            : this._defaultTransportMode;

        const method = data?.header?.method?.toUpperCase();
        const isGetMessage = method === 'GET';

        let attemptLan = false;
        if (transportMode === TransportMode.LAN_HTTP_FIRST) {
            attemptLan = true;
        } else if (transportMode === TransportMode.LAN_HTTP_FIRST_ONLY_GET) {
            attemptLan = isGetMessage;
        }

        if (attemptLan && ip) {
            // Skip LAN HTTP if error budget exhausted to prevent repeated failures on unreliable devices
            if (this._errorBudgetManager.isOutOfBudget(device.uuid)) {
                if (this.options.logger) {
                    this.options.logger(
                        `Cannot issue command via LAN (http) against device ${device.uuid} - device has no more error budget left. Using MQTT.`
                    );
                }
                const shouldFallback = transportMode === TransportMode.LAN_HTTP_FIRST
                    || transportMode === TransportMode.LAN_HTTP_FIRST_ONLY_GET;

                if (shouldFallback) {
                    return this.sendMessageMqtt(device, data);
                }
                attemptLan = false;
            }

            if (attemptLan) {
                try {
                    // Use shorter timeout for LAN requests to fail fast and fallback to MQTT
                    const lanTimeout = Math.min(this.timeout, 1000);
                    await this.sendMessageHttp(device, ip, data, lanTimeout);
                    return true;
                } catch (err) {
                    // Distinguish HTTP-level failures from parsing errors that occur after successful HTTP 200
                    const isHttpFailure = !(err instanceof HttpApiError) ||
                                         (err instanceof HttpApiError && err.httpStatusCode !== null && err.httpStatusCode !== undefined);

                    if (isHttpFailure) {
                        this._errorBudgetManager.notifyError(device.uuid);
                    }

                    if (this.options.logger) {
                        this.options.logger(
                            `An error occurred while attempting to send a message over internal LAN to device ${device.uuid}. Retrying with MQTT transport.`
                        );
                    }

                    const shouldFallback = transportMode === TransportMode.LAN_HTTP_FIRST
                        || transportMode === TransportMode.LAN_HTTP_FIRST_ONLY_GET;

                    if (shouldFallback) {
                        return this.sendMessageMqtt(device, data);
                    }
                    throw err;
                }
            }
        }

        return this.sendMessageMqtt(device, data);
    }

    /**
     * Connects a device to the manager and sets up event handling
     *
     * Forwards device events to manager and initializes MQTT connection.
     * Device abilities are already known at this point (queried before device creation).
     * The device should already be registered in the device registry before calling this method.
     *
     * @param {MerossDevice|MerossHubDevice} deviceObj - Device instance to connect
     * @param {Object} dev - Device definition object from API
     * @returns {Promise<void>} Promise that resolves when device connection is set up
     */
    async connectDevice(deviceObj, dev) {
        const deviceId = deviceObj.uuid;

        deviceObj.on('close', (error) => {
            this.emit('close', deviceId, error);
        });
        deviceObj.on('error', (error) => {
            this.emit('error', error, deviceId);
        });
        deviceObj.on('rawSendData', (message) => {
            this.emit('rawData', deviceId, message);
        });
        deviceObj.on('pushNotification', (notification) => {
            this.emit('pushNotification', deviceId, notification, deviceObj);
        });

        if (this._subscriptionManager) {
            deviceObj.on('stateChange', () => {
                // Subscription manager has its own listeners for stateChange events
            });
        }

        deviceObj.on('connected', () => {
            this.emit('connected', deviceId);

            // Refresh hub state after connection to populate subdevice statuses.
            // Delay ensures MQTT connection is fully established and stable before
            // querying devices, preventing race conditions during connection setup
            if (typeof deviceObj.getSubdevices === 'function') {
                const subdevices = deviceObj.getSubdevices();
                if (subdevices.length > 0) {
                    setTimeout(async () => {
                        try {
                            await deviceObj.refreshState();
                        } catch (err) {
                            const logger = this.options?.logger;
                            if (logger && typeof logger === 'function') {
                                logger(`Failed to refresh hub ${deviceId} subdevice statuses: ${err.message}`);
                            }
                        }
                    }, 2000);
                }
            }
        });

        this.emit('deviceInitialized', deviceId, dev, deviceObj);

        await this.initMqtt(dev);

        deviceObj.connect();
    }

    /**
     * Gets or creates the ManagerSubscription instance
     *
     * Provides automatic polling and data provisioning for devices.
     * Uses lazy initialization to create the manager only when needed.
     * Merges constructor subscription options with any additional options.
     *
     * @returns {ManagerSubscription} ManagerSubscription instance
     */
    get subscription() {
        if (!this._subscriptionManager) {
            const ManagerSubscription = require('./subscription');
            this._subscriptionManager = new ManagerSubscription(this, {
                logger: this.options?.logger,
                ...this._subscriptionOptions
            });
        }
        return this._subscriptionManager;
    }

    /**
     * Gets the DeviceRegistry instance for device management
     *
     * Provides direct access to DeviceRegistry methods for device lookups and queries.
     * Use this property to access device registry functionality:
     * - `meross.devices.get(identifier)` - Get a device by UUID or subdevice identifier
     * - `meross.devices.find(filters)` - Find devices matching filters
     * - `meross.devices.list()` - Get all registered devices
     *
     * @returns {DeviceRegistry} DeviceRegistry instance
     */
    get devices() {
        return this._deviceRegistry;
    }

}

/**
 * Registry for managing Meross devices and subdevices.
 *
 * Maintains indexes for efficient device lookups across base devices and subdevices.
 * Base devices can be looked up by UUID, while internal IDs enable unified lookup
 * for both base devices and subdevices.
 *
 * Internal IDs unify device identification:
 * - Base devices: `#BASE:{uuid}`
 * - Subdevices: `#SUB:{hubUuid}:{subdeviceId}`
 *
 * @class DeviceRegistry
 */
class DeviceRegistry {
    /**
     * Creates a new device registry.
     *
     * Initializes two indexes: one by internal ID (supports all devices) and one by UUID
     * (base devices only). The UUID index enables O(1) lookups for base devices without
     * requiring internal ID generation.
     */
    constructor() {
        this._devicesByInternalId = new Map();
        this._devicesByUuid = new Map();
    }

    /**
     * Generates an internal ID for a device or subdevice.
     *
     * Internal IDs provide a unified identifier format that works for both base devices
     * and subdevices, enabling consistent lookup operations regardless of device type.
     * The prefix distinguishes device types to prevent ID collisions.
     *
     * @param {string} uuid - Device UUID (for base devices) or hub UUID (for subdevices)
     * @param {boolean} [isSubdevice=false] - Whether this is a subdevice
     * @param {string} [hubUuid] - Hub UUID (required if isSubdevice is true)
     * @param {string} [subdeviceId] - Subdevice ID (required if isSubdevice is true)
     * @returns {string} Internal ID string
     */
    static generateInternalId(uuid, isSubdevice = false, hubUuid = null, subdeviceId = null) {
        if (isSubdevice) {
            return `#SUB:${hubUuid}:${subdeviceId}`;
        }
        return `#BASE:${uuid}`;
    }

    /**
     * Registers a device in the registry.
     *
     * Prevents duplicate registrations by checking for existing internal ID.
     * Base devices are indexed by both internal ID and UUID to support both lookup methods.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance to register
     * @returns {void}
     */
    registerDevice(device) {
        const internalId = this._getInternalId(device);

        if (this._devicesByInternalId.has(internalId)) {
            return;
        }

        this._devicesByInternalId.set(internalId, device);

        const uuid = device.uuid;
        if (uuid && !this._isSubdevice(device)) {
            this._devicesByUuid.set(uuid, device);
        }
    }

    /**
     * Removes a device from the registry.
     *
     * Removes the device from all indexes to maintain consistency. Base devices are removed
     * from both the internal ID and UUID indexes, while subdevices are only in the internal ID index.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance to remove
     * @returns {void}
     */
    removeDevice(device) {
        const internalId = this._getInternalId(device);
        const uuid = device.uuid;

        this._devicesByInternalId.delete(internalId);

        if (uuid && !this._isSubdevice(device)) {
            this._devicesByUuid.delete(uuid);
        }
    }

    /**
     * Unified method to get a device by identifier.
     *
     * Supports both base devices (by UUID string) and subdevices (by object with hubUuid and id).
     * Internally converts the identifier to an internal ID format and performs the lookup.
     *
     * @param {string|Object} identifier - Device identifier
     * @param {string} identifier - For base devices: device UUID string (e.g., 'device-uuid')
     * @param {Object} identifier - For subdevices: object with hubUuid and id properties
     * @param {string} identifier.hubUuid - Hub UUID that the subdevice belongs to
     * @param {string} identifier.id - Subdevice ID
     * @returns {MerossDevice|MerossHubDevice|MerossSubDevice|null} Device instance, or null if not found
     * @example
     * // Get base device by UUID
     * const device = registry.get('device-uuid');
     *
     * @example
     * // Get subdevice by hub UUID and subdevice ID
     * const subdevice = registry.get({ hubUuid: 'hub-uuid', id: 'subdevice-id' });
     */
    get(identifier) {
        if (typeof identifier === 'string') {
            // Base device lookup by UUID
            return this._devicesByUuid.get(identifier) || null;
        } else if (identifier && typeof identifier === 'object') {
            // Subdevice lookup by hubUuid and id
            const { hubUuid, id } = identifier;
            if (hubUuid && id) {
                const internalId = ManagerMeross.DeviceRegistry.generateInternalId(hubUuid, true, hubUuid, id);
                return this._devicesByInternalId.get(internalId) || null;
            }
        }
        return null;
    }

    /**
     * Gets all registered devices.
     *
     * Returns both base devices and subdevices from the internal ID index, which contains
     * all registered devices regardless of type.
     *
     * @returns {Array<MerossDevice|MerossHubDevice|MerossSubDevice>} Array of all registered devices
     */
    list() {
        return Array.from(this._devicesByInternalId.values());
    }

    /**
     * Finds devices matching the specified filters.
     *
     * This method supports multiple filter criteria that can be combined.
     * All filters are applied as AND conditions (device must match all specified filters).
     *
     * @param {Object} [filters={}] - Filter criteria
     * @param {Array<string>} [filters.device_uuids] - Array of device UUIDs to match (snake_case to match API)
     * @param {Array<string>} [filters.internal_ids] - Array of internal IDs to match
     * @param {string} [filters.device_type] - Device type to match (e.g., "mss310")
     * @param {string} [filters.device_name] - Device name to match
     * @param {number} [filters.online_status] - Online status to match (0 = offline, 1 = online)
     * @param {string|Array<string>|Function} [filters.device_class] - Device capability/class filter.
     *                                                                  Can be:
     *                                                                  - String: 'light', 'thermostat', 'toggle', 'rollerShutter', 'garageDoor', 'diffuser', 'spray', 'hub'
     *                                                                  - Array of strings: matches if device has any of the capabilities
     *                                                                  - Function: custom filter function that receives device and returns boolean
     * @returns {Array<MerossDevice|MerossHubDevice|MerossSubDevice>} Array of matching devices
     */
    find(filters = {}) {
        let devices = this.list();

        if (filters.device_uuids && Array.isArray(filters.device_uuids) && filters.device_uuids.length > 0) {
            const uuidSet = new Set(filters.device_uuids);
            devices = devices.filter(device => {
                const uuid = device.uuid;
                return uuidSet.has(uuid);
            });
        }

        if (filters.internal_ids && Array.isArray(filters.internal_ids) && filters.internal_ids.length > 0) {
            const idSet = new Set(filters.internal_ids);
            devices = devices.filter(device => {
                return idSet.has(this._getInternalId(device));
            });
        }

        if (filters.device_type) {
            devices = devices.filter(device => {
                const deviceType = device.deviceType;
                return deviceType === filters.device_type;
            });
        }

        if (filters.device_name) {
            devices = devices.filter(device => {
                const name = device.name;
                return name === filters.device_name;
            });
        }

        if (filters.online_status !== undefined) {
            devices = devices.filter(device => {
                const status = device.onlineStatus || device._onlineStatus;
                return status === filters.online_status;
            });
        }

        if (filters.device_class) {
            const capabilityChecks = Array.isArray(filters.device_class)
                ? filters.device_class
                : [filters.device_class];

            devices = devices.filter(device => {
                return capabilityChecks.some(check => {
                    if (typeof check === 'function') {
                        return check(device);
                    } else if (typeof check === 'string') {
                        return this._hasCapability(device, check);
                    }
                    return false;
                });
            });
        }

        return devices;
    }

    /**
     * Checks if a device has a specific capability.
     *
     * Determines capability by checking for the presence of device-specific methods or
     * constructor names, rather than relying on device type strings which may vary.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device to check
     * @param {string} capability - Capability name (e.g., 'light', 'thermostat', 'toggle')
     * @returns {boolean} True if device has the capability, false otherwise
     * @private
     */
    _hasCapability(device, capability) {
        const capabilityMap = {
            'light': () => typeof device.getLightState === 'function' ||
                         typeof device.getCachedLightState === 'function',
            'thermostat': () => typeof device.getThermostatMode === 'function' ||
                             typeof device.getCachedThermostatState === 'function',
            'toggle': () => typeof device.setToggle === 'function' ||
                          typeof device.setToggleX === 'function',
            'rollerShutter': () => typeof device.getRollerShutterState === 'function',
            'garageDoor': () => typeof device.getGarageDoorState === 'function',
            'diffuser': () => typeof device.getDiffuserLightState === 'function',
            'spray': () => typeof device.getSprayState === 'function',
            'hub': () => typeof device.getSubdevices === 'function'
        };

        const check = capabilityMap[capability.toLowerCase()];
        return check ? check() : false;
    }

    /**
     * Gets or generates the internal ID for a device.
     *
     * Caches the generated ID on the device to avoid repeated computation. Handles
     * multiple property access patterns for subdevices to support different device implementations.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance
     * @returns {string} Internal ID string
     * @throws {UnknownDeviceTypeError} If required identifiers are missing
     * @private
     */
    _getInternalId(device) {
        const { UnknownDeviceTypeError } = require('./model/exception');

        if (device._internalId) {
            return device._internalId;
        }

        if (this._isSubdevice(device)) {
            const hubUuid = device.hub?.uuid || device._hub?.uuid || device.hub?.dev?.uuid || device._hub?.dev?.uuid;
            const subdeviceId = device.subdeviceId || device._subdeviceId;

            if (!hubUuid || !subdeviceId) {
                throw new UnknownDeviceTypeError('Cannot generate internal ID for subdevice: missing hub UUID or subdevice ID');
            }

            const internalId = ManagerMeross.DeviceRegistry.generateInternalId(hubUuid, true, hubUuid, subdeviceId);
            device._internalId = internalId;
            return internalId;
        }

        const uuid = device.uuid;
        if (!uuid) {
            throw new UnknownDeviceTypeError('Cannot generate internal ID: device missing UUID');
        }

        const internalId = ManagerMeross.DeviceRegistry.generateInternalId(uuid);
        device._internalId = internalId;
        return internalId;
    }

    /**
     * Determines if a device is a subdevice.
     *
     * Checks for the presence of subdevice-specific properties rather than relying on
     * device type, as property names may vary between implementations.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device to check
     * @returns {boolean} True if device is a subdevice, false otherwise
     * @private
     */
    _isSubdevice(device) {
        return !!(device.subdeviceId || device._subdeviceId) && !!(device.hub || device._hub);
    }

    /**
     * Clears all devices from the registry.
     *
     * Disconnects all devices before removal to ensure proper cleanup of connections
     * and event listeners. Both indexes are cleared to maintain consistency.
     *
     * @returns {void}
     */
    clear() {
        const devices = this.list();
        devices.forEach(device => {
            if (device.disconnect) {
                device.disconnect();
            }
        });
        this._devicesByInternalId.clear();
        this._devicesByUuid.clear();
    }

    /**
     * Gets the total number of devices registered (including subdevices).
     *
     * @returns {number} Total number of registered devices
     */
    get size() {
        return this._devicesByInternalId.size;
    }
}

// Attach DeviceRegistry as nested class to ManagerMeross
ManagerMeross.DeviceRegistry = DeviceRegistry;

/**
 * Events emitted by ManagerMeross instance
 *
 * @typedef {Object} MerossCloudEvents
 * @property {Function} deviceInitialized - Emitted when a device is initialized
 *   @param {string} deviceId - Device UUID
 *   @param {Object} deviceDef - Device definition object from API
 *   @param {MerossDevice|MerossHubDevice} device - Device instance
 * @property {Function} connected - Emitted when a device connects
 *   @param {string} deviceId - Device UUID
 * @property {Function} close - Emitted when a device connection closes
 *   @param {string} deviceId - Device UUID
 *   @param {string|null} error - Error message if connection closed due to error
 * @property {Function} error - Emitted when an error occurs
 *   @param {string} deviceId - Device UUID (or null for manager-level errors)
 *   @param {Error|string} error - Error object or error message
 * @property {Function} reconnect - Emitted when a device reconnects
 *   @param {string} deviceId - Device UUID
 * @property {Function} data - Emitted when data is received from a device
 *   @param {string} deviceId - Device UUID
 *   @param {Object} payload - Data payload
 * @property {Function} pushNotification - Emitted when a push notification is received
 *   @param {string} deviceId - Device UUID
 *   @param {GenericPushNotification} notification - Push notification object
 *   @param {MerossDevice|MerossHubDevice} device - Device instance
 * @property {Function} rawData - Emitted with raw message data (for debugging)
 *   @param {string} deviceId - Device UUID
 *   @param {Object} message - Raw message object
 */

module.exports = ManagerMeross;
module.exports.DeviceRegistry = DeviceRegistry;

