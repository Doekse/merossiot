'use strict';

const EventEmitter = require('events');
const { MEROSS_MQTT_DOMAIN } = require('./model/constants');
const { TransportMode } = require('./model/enums');
const {
    buildClientResponseTopic,
    generateClientAndAppId
} = require('./utilities/mqtt');
const ErrorBudgetManager = require('./error-budget');
const { MqttStatsCounter } = require('./utilities/stats');
const RequestQueue = require('./utilities/request-queue');
const DeviceRegistry = require('./device-registry');
const { AuthenticationError } = require('./model/exception');

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

        this._validateOptions(options);
        this._initializeBasicProperties(options);
        this._initializeTransportMode(options);
        this._initializeErrorBudget(options);
        this._initializeRequestQueue(options);
        this._initializeMqttStructures();
        this._initializeStatistics(options);
        this._initializeHttpClient(options);
        this._initializeManagers();
        this._reuseAuthenticationFromClient();
    }

    /**
     * Validates constructor options.
     *
     * Ensures httpClient is provided since it's required for all manager operations.
     *
     * @private
     * @param {Object} options - Configuration options
     * @throws {Error} If httpClient is missing
     */
    _validateOptions(options) {
        if (!options || !options.httpClient) {
            throw new Error('httpClient is required. Use MerossHttpClient.fromUserPassword() to create a client.');
        }
    }

    /**
     * Initializes basic instance properties.
     *
     * Sets default values for authentication state, domains, and configuration flags.
     * Uses MEROSS_MQTT_DOMAIN as default to ensure connectivity even if domain is not
     * provided by the HTTP client.
     *
     * @private
     * @param {Object} options - Configuration options
     */
    _initializeBasicProperties(options) {
        this.options = options || {};
        this.token = null;
        this.key = null;
        this.userId = null;
        this.userEmail = null;
        this.authenticated = false;
        this.httpDomain = null;
        this.mqttDomain = MEROSS_MQTT_DOMAIN;
        this.issuedOn = null;
        this.autoRetryOnBadDomain = options.autoRetryOnBadDomain !== undefined ? !!options.autoRetryOnBadDomain : true;
        this.timeout = options.timeout || 10000;
    }

    /**
     * Initializes transport mode configuration.
     *
     * Defaults to MQTT_ONLY if not specified to maintain backward compatibility
     * with existing code that relies on cloud MQTT communication.
     *
     * @private
     * @param {Object} options - Configuration options
     */
    _initializeTransportMode(options) {
        if (options.transportMode !== undefined) {
            this._defaultTransportMode = options.transportMode;
        } else {
            this._defaultTransportMode = TransportMode.MQTT_ONLY;
        }
    }

    /**
     * Initializes error budget manager.
     *
     * Tracks LAN HTTP failures per device to automatically fall back to MQTT
     * when local communication becomes unreliable, preventing repeated failed
     * requests.
     *
     * @private
     * @param {Object} options - Configuration options
     */
    _initializeErrorBudget(options) {
        const maxErrors = options.maxErrors !== undefined ? options.maxErrors : 1;
        const timeWindowMs = options.errorBudgetTimeWindow !== undefined ? options.errorBudgetTimeWindow : 60000;
        this._errorBudgetManager = new ErrorBudgetManager(maxErrors, timeWindowMs);
    }

    /**
     * Initializes request queue for throttling.
     *
     * Batches and delays requests to prevent overwhelming devices with rapid
     * command sequences, which can cause timeouts or device instability.
     *
     * @private
     * @param {Object} options - Configuration options
     */
    _initializeRequestQueue(options) {
        const enableRequestThrottling = options.enableRequestThrottling !== undefined ? options.enableRequestThrottling : true;
        this._requestQueue = enableRequestThrottling ? new RequestQueue({
            batchSize: options.requestBatchSize || 1,
            batchDelay: options.requestBatchDelay || 200,
            logger: options.logger
        }) : null;
    }

    /**
     * Initializes MQTT-related data structures.
     *
     * Creates maps and objects to track connections, pending messages, and device
     * registrations before any MQTT operations begin.
     *
     * @private
     */
    _initializeMqttStructures() {
        this.mqttConnections = {};
        this._mqttConnectionPromises = new Map();
        this._deviceRegistry = new DeviceRegistry();
        this._appId = null;
        this.clientResponseTopic = null;
        this._pendingMessagesFutures = new Map();
    }

    /**
     * Initializes statistics tracking.
     *
     * Creates statistics counter only when enabled to avoid overhead when
     * statistics are not needed.
     *
     * @private
     * @param {Object} options - Configuration options
     */
    _initializeStatistics(options) {
        const enableStats = options.enableStats === true;
        this._mqttStatsCounter = enableStats ? new MqttStatsCounter(options.maxStatsSamples || 1000) : null;
    }

    /**
     * Initializes HTTP client and sets up manager reference.
     *
     * Establishes bidirectional reference between manager and HTTP client to enable
     * statistics tracking. Stores subscription options for lazy initialization of
     * subscription manager to avoid creating it when not needed.
     *
     * @private
     * @param {Object} options - Configuration options
     */
    _initializeHttpClient(options) {
        this.httpClient = options.httpClient;
        if (this.httpClient) {
            this.httpClient._manager = this;
        }
        this._subscriptionOptions = options.subscription || {};
    }

    /**
     * Initializes managers object for lazy initialization.
     *
     * Pre-allocates manager slots to enable lazy loading, reducing startup time
     * and memory usage when only specific managers are needed.
     *
     * @private
     */
    _initializeManagers() {
        this._managers = {
            devices: null,
            mqtt: null,
            http: null,
            transport: null,
            statistics: null
        };
    }

    /**
     * Reuses authentication from HTTP client if already authenticated.
     *
     * Copies credentials and domains from HTTP client to avoid redundant authentication
     * and ensure both HTTP and MQTT connections use the same session. Generates appId
     * immediately to establish consistent client identity before any MQTT operations.
     *
     * @private
     */
    _reuseAuthenticationFromClient() {
        if (!this.httpClient.token) {
            return;
        }

        this.token = this.httpClient.token;
        this.key = this.httpClient.key || null;
        this.userId = this.httpClient.userId || null;
        this.userEmail = this.httpClient.userEmail || null;
        this.httpDomain = this.httpClient.httpDomain;
        this.mqttDomain = this.httpClient.mqttDomain || this.mqttDomain;
        this.authenticated = true;

        const { appId } = generateClientAndAppId();
        this._appId = appId;
        this.clientResponseTopic = buildClientResponseTopic(this.userId, this._appId);
    }

    /**
     * Gets the ManagerDevices instance.
     *
     * Lazy-loads the devices manager on first access to reduce startup overhead.
     * Provides device discovery, initialization, and lifecycle management.
     *
     * @returns {ManagerDevices} Devices manager
     */
    get devices() {
        if (!this._managers.devices) {
            const ManagerDevices = require('./managers/devices');
            this._managers.devices = new ManagerDevices(this);
        }
        return this._managers.devices;
    }

    /**
     * Gets the ManagerMqtt instance.
     *
     * Lazy-loads the MQTT manager on first access. Provides MQTT connection
     * management and message publishing.
     *
     * @returns {ManagerMqtt} MQTT manager
     */
    get mqtt() {
        if (!this._managers.mqtt) {
            const ManagerMqtt = require('./managers/mqtt');
            this._managers.mqtt = new ManagerMqtt(this);
        }
        return this._managers.mqtt;
    }

    /**
     * Gets the ManagerHttp instance.
     *
     * Lazy-loads the HTTP manager on first access. Provides LAN HTTP communication
     * with devices for faster local operations.
     *
     * @returns {ManagerHttp} HTTP manager
     */
    get http() {
        if (!this._managers.http) {
            const ManagerHttp = require('./managers/http');
            this._managers.http = new ManagerHttp(this);
        }
        return this._managers.http;
    }

    /**
     * Gets the ManagerTransport instance.
     *
     * Lazy-loads the transport manager on first access. Provides transport mode
     * selection and message routing between MQTT and LAN HTTP.
     *
     * @returns {ManagerTransport} Transport manager
     */
    get transport() {
        if (!this._managers.transport) {
            const ManagerTransport = require('./managers/transport');
            this._managers.transport = new ManagerTransport(this);
        }
        return this._managers.transport;
    }

    /**
     * Gets the ManagerStatistics instance.
     *
     * Lazy-loads the statistics manager on first access. Provides unified statistics
     * tracking for HTTP and MQTT communication.
     *
     * @returns {ManagerStatistics} Statistics manager
     */
    get statistics() {
        if (!this._managers.statistics) {
            const ManagerStatistics = require('./managers/statistics');
            this._managers.statistics = new ManagerStatistics(this);
        }
        return this._managers.statistics;
    }

    /**
     * Gets the current authentication token data for reuse.
     *
     * Returns token data that can be saved and reused in future sessions using
     * MerossHttpClient.fromCredentials(), avoiding repeated login operations.
     *
     * @returns {Object|null} Token data object or null if not authenticated
     * @returns {string} returns.token - Authentication token
     * @returns {string} returns.key - Encryption key
     * @returns {string} returns.userId - User ID
     * @returns {string} returns.userEmail - User email
     * @returns {string} returns.domain - HTTP API domain
     * @returns {string} returns.mqttDomain - MQTT domain
     * @returns {string} returns.issuedOn - ISO timestamp when token was issued
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
            issuedOn: this.issuedOn || new Date().toISOString()
        };
    }

    /**
     * Authenticates with Meross cloud and discovers devices.
     *
     * Alias for devices.initialize() for backward compatibility. The httpClient
     * should already be authenticated when passed to the constructor to avoid
     * authentication errors during device discovery.
     *
     * @returns {Promise<number>} Promise that resolves with the number of devices discovered
     * @throws {HttpApiError} If API request fails
     * @throws {TokenExpiredError} If authentication token has expired
     */
    async login() {
        return await this.devices.initialize();
    }

    /**
     * Connects to Meross cloud and initializes all devices.
     *
     * Performs device discovery and marks manager as authenticated. The httpClient
     * should already be authenticated when passed to the constructor to avoid
     * errors during initialization.
     *
     * @returns {Promise<number>} Promise that resolves with the number of devices connected
     * @throws {HttpApiError} If API request fails
     * @throws {TokenExpiredError} If authentication token has expired
     */
    async connect() {
        try {
            const deviceListLength = await this.devices.initialize();
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
     * Logs out from Meross cloud and disconnects all devices.
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
     * Disconnects all devices and closes all MQTT connections.
     *
     * Clears the device registry (which disconnects all devices), clears all request queues,
     * and closes all MQTT connections. Retrieves devices before clearing registry to ensure
     * queue cleanup can access device UUIDs. Should be called when shutting down the application.
     *
     * @param {boolean} [force] - Force disconnect flag (passed to MQTT client end() method)
     * @returns {void}
     */
    disconnectAll(force) {
        const devices = this._deviceRegistry.list();
        this._deviceRegistry.clear();

        if (this._requestQueue) {
            devices.forEach(device => {
                const uuid = device.uuid;
                if (uuid) {
                    this._requestQueue.clearQueue(uuid);
                }
            });
        }

        if (this._managers.mqtt) {
            this._managers.mqtt.disconnectAll(force);
        } else {
            for (const domain of Object.keys(this.mqttConnections)) {
                if (this.mqttConnections[domain] && this.mqttConnections[domain].client) {
                    this.mqttConnections[domain].client.removeAllListeners();
                    this.mqttConnections[domain].client.end(force);
                }
            }
            this.mqttConnections = {};
            this._mqttConnectionPromises.clear();
        }
    }

    /**
     * Gets or creates the ManagerSubscription instance.
     *
     * Lazy-loads the subscription manager on first access to avoid creating it when
     * automatic polling is not needed. Merges constructor subscription options with
     * logger from manager options to provide consistent configuration.
     *
     * @returns {ManagerSubscription} ManagerSubscription instance
     */
    get subscription() {
        if (!this._subscriptionManager) {
            const ManagerSubscription = require('./managers/subscription');
            this._subscriptionManager = new ManagerSubscription(this, {
                logger: this.options?.logger,
                ...this._subscriptionOptions
            });
        }
        return this._subscriptionManager;
    }


}

/**
 * Events emitted by ManagerMeross instance
 *
 * @typedef {Object} MerossCloudEvents
 * @property {Function} deviceInitialized - Emitted when a device is initialized
 *   @param {string} deviceId - Device UUID
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

