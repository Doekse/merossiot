'use strict';

const EventEmitter = require('events');
const { MEROSS_MQTT_DOMAIN } = require('./model/constants');
const { TransportMode } = require('./model/enums');
const {
    buildClientResponseTopic,
    generateClientAndAppId
} = require('./utilities/mqtt');
const ErrorBudgetManager = require('./error-budget');
const RequestQueue = require('./utilities/request-queue');
const DeviceRegistry = require('./device-registry');
const { MerossAuthError, MerossDeviceError } = require('./model/exception');

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
     * Authenticates and returns a manager without connecting to the cloud or initializing devices.
     *
     * Centralizing auth creation here keeps the HTTP client as an internal detail
     * so consumers only need to provide credentials and can adjust runtime settings
     * on the returned manager. Use {@link ManagerMeross.connect} when you want auth
     * plus cloud connection in one step.
     *
     * @static
     * @async
     * @param {Object} options - Authentication options
     * @param {string} [options.email] - Account email for password authentication
     * @param {string} [options.password] - Account password for password authentication
     * @param {string} [options.mfaCode] - MFA code for password authentication
     * @param {string} [options.token] - Existing token for credential authentication
     * @param {string} [options.key] - Encryption key for credential authentication
     * @param {string} [options.userId] - User ID for credential authentication
     * @param {string} [options.domain] - HTTP API domain for credential authentication
     * @param {string} [options.mqttDomain] - MQTT domain for credential authentication
     * @param {Function} [options.logger] - Optional logger for auth and manager runtime
     * @returns {Promise<ManagerMeross>} Authenticated manager (not yet connected)
     * @throws {MerossDeviceError} If options do not contain a valid auth shape
     */
    static async authenticate(options) {
        const normalizedOptions = options || {};
        const isPasswordAuth = !!(normalizedOptions.email && normalizedOptions.password);
        const isCredentialAuth = !!(normalizedOptions.token &&
            normalizedOptions.key &&
            normalizedOptions.userId &&
            normalizedOptions.domain);

        if (!isPasswordAuth && !isCredentialAuth) {
            throw new MerossDeviceError(
                'Provide either {email, password} or {token, key, userId, domain}',
                'VALIDATION_ERROR',
                { field: 'options' }
            );
        }

        const MerossHttpClient = require('./http-api');
        const httpClientOpts = {
            logger: normalizedOptions.logger
        };

        let httpClient;
        if (isPasswordAuth) {
            httpClient = await MerossHttpClient.fromUserPassword({
                email: normalizedOptions.email,
                password: normalizedOptions.password,
                mfaCode: normalizedOptions.mfaCode,
                ...httpClientOpts
            });
        } else {
            httpClient = MerossHttpClient.fromCredentials({
                token: normalizedOptions.token,
                key: normalizedOptions.key,
                userId: normalizedOptions.userId,
                domain: normalizedOptions.domain,
                mqttDomain: normalizedOptions.mqttDomain
            }, httpClientOpts);
        }

        const manager = new ManagerMeross({ httpClient });
        if (normalizedOptions.logger) {
            manager.logger = normalizedOptions.logger;
        }

        return manager;
    }

    /**
     * Authenticates via {@link ManagerMeross.authenticate} then connects to the cloud.
     *
     * @static
     * @async
     * @param {Object} options - Same shape as {@link ManagerMeross.authenticate}
     * @returns {Promise<ManagerMeross>} Connected manager instance
     * @throws {MerossDeviceError} If options do not contain a valid auth shape
     */
    static async connect(options) {
        const manager = await ManagerMeross.authenticate(options);
        await manager.connect();
        return manager;
    }

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
        this._defaultTransportMode = options.transportMode !== undefined
            ? options.transportMode
            : TransportMode.MQTT_ONLY;
        this._initializeErrorBudget(options);
        this._initializeRequestQueue(options);
        this._initializeMqttStructures();
        this._initializeHttpClient(options);
        if (options.enableStats) {
            this.statistics.enable(options.maxStatsSamples || 1000);
        }
        this._initializeManagers();
    }

    /**
     * Validates constructor options.
     *
     * Ensures httpClient is provided since it's required for all manager operations.
     *
     * @private
     * @param {Object} options - Configuration options
     * @throws {MerossDeviceError} If httpClient is missing
     */
    _validateOptions(options) {
        if (!options || !options.httpClient) {
            throw new MerossDeviceError(
                'httpClient is required. Use ManagerMeross.authenticate() or ManagerMeross.connect().',
                'VALIDATION_ERROR',
                { field: 'httpClient' }
            );
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
        this.authenticated = false;
        this.mqttDomain = MEROSS_MQTT_DOMAIN;
        this.issuedOn = null;
        this.autoRetryOnBadDomain = options.autoRetryOnBadDomain !== undefined ? !!options.autoRetryOnBadDomain : true;
        this._timeout = options.timeout || 10000;
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
     * Initializes HTTP client and wires HTTP statistics notification.
     *
     * Registers a request hook on the client so authenticated POSTs can feed
     * manager statistics without the client holding a back-reference to the manager.
     * Stores subscription options for lazy initialization of the subscription manager.
     *
     * @private
     * @param {Object} options - Configuration options
     */
    _initializeHttpClient(options) {
        this._httpClient = options.httpClient;
        if (this._httpClient) {
            this._httpClient._onHttpRequest = (url, method, httpCode, apiCode) => {
                if (this._mqttStatsCounter || this._httpClient._httpStatsCounter) {
                    this.statistics.notifyHttpRequest(url, method, httpCode, apiCode);
                }
            };
        }
        if (this._httpClient && this._httpClient.token) {
            this.mqttDomain = this._httpClient.mqttDomain || this.mqttDomain;
            this.authenticated = true;

            const { appId } = generateClientAndAppId();
            this._appId = appId;
            this.clientResponseTopic = buildClientResponseTopic(this.userId, this._appId);
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
     * Gets the authentication token from the internal HTTP client.
     *
     * Delegating token reads keeps manager auth state synchronized with the
     * single source of truth owned by MerossHttpClient.
     *
     * @returns {string|null} Active token value
     */
    get token() {
        return this._httpClient?.token || null;
    }

    /**
     * Gets the encryption key from the internal HTTP client.
     *
     * Delegating key reads avoids stale credentials when HTTP client auth
     * state changes after login, refresh, or logout.
     *
     * @returns {string|null} Active encryption key
     */
    get key() {
        return this._httpClient?.key || null;
    }

    /**
     * Gets the Meross user ID from the internal HTTP client.
     *
     * Using the HTTP client as the single source of truth prevents divergence
     * between manager and transport authentication metadata.
     *
     * @returns {string|null} Authenticated user ID
     */
    get userId() {
        return this._httpClient?.userId || null;
    }

    /**
     * Gets the Meross user email from the internal HTTP client.
     *
     * Returning the email directly from the auth owner avoids duplicate
     * assignment paths and keeps token exports consistent.
     *
     * @returns {string|null} Authenticated user email
     */
    get userEmail() {
        return this._httpClient?.userEmail || null;
    }

    /**
     * Gets the active HTTP API domain from the internal HTTP client.
     *
     * Domain can change due to redirects, so delegating reads ensures callers
     * always receive the latest endpoint in use.
     *
     * @returns {string|null} Active Meross HTTP domain
     */
    get httpDomain() {
        return this._httpClient?.httpDomain || null;
    }

    /**
     * Gets the internal HTTP client instance.
     *
     * Keeping this alias preserves compatibility for code paths that have not
     * yet migrated to the internal `_httpClient` property.
     *
     * @returns {MerossHttpClient|null} Active HTTP client instance
     */
    get httpClient() {
        return this._httpClient || null;
    }

    /**
     * Exposes per-device LAN HTTP error budgets for inspection and manual reset.
     *
     * Callers that previously used {@link ManagerMeross#getDebugInfo} for budget
     * helpers should use this object instead.
     *
     * @returns {ErrorBudgetManager} Error budget manager
     */
    get errorBudget() {
        return this._errorBudgetManager;
    }

    /**
     * Gets the request timeout used for device commands.
     *
     * Timeout is surfaced as a runtime setting so callers can tune responsiveness
     * while the manager is active.
     *
     * @returns {number} Timeout in milliseconds
     */
    get timeout() {
        return this._timeout;
    }

    /**
     * Sets the request timeout used for device commands.
     *
     * Guarding invalid values avoids broken request behavior when settings are
     * changed dynamically from CLI or application code.
     *
     * @param {number} value - Timeout in milliseconds
     */
    set timeout(value) {
        const normalizedTimeout = Number(value);
        if (Number.isFinite(normalizedTimeout) && normalizedTimeout > 0) {
            this._timeout = normalizedTimeout;
            return;
        }
        this._timeout = 10000;
    }

    /**
     * Gets the active logger function.
     *
     * Logger is exposed at runtime so debugging can be enabled or disabled
     * without recreating the manager.
     *
     * @returns {Function|null} Logger function or null when disabled
     */
    get logger() {
        return this.options?.logger || null;
    }

    /**
     * Sets the logger for manager and dependent runtime components.
     *
     * Propagating logger updates keeps log behavior consistent across HTTP calls,
     * throttling, and subscription polling after initial construction.
     *
     * @param {Function|null} fn - Logger function to use
     */
    set logger(fn) {
        if (!this.options) {
            this.options = {};
        }
        this.options.logger = typeof fn === 'function' ? fn : null;

        if (this._httpClient) {
            this._httpClient.options.logger = this.options.logger;
        }
        if (this._requestQueue) {
            this._requestQueue.logger = this.options.logger;
        }
        if (this._subscriptionManager) {
            this._subscriptionManager.logger = this.options.logger || (() => {});
        }
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
     * @throws {MerossApiError} If API request fails
     * @throws {MerossAuthError} If authentication token has expired
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
     * @throws {MerossApiError} If API request fails
     * @throws {MerossAuthError} If authentication token has expired
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
     * Ends the session via the Meross API (invalidating the token server-side), clears
     * credential state on the internal HTTP client, marks this manager as unauthenticated,
     * and disconnects all devices and MQTT connections.
     *
     * @returns {Promise<Object|null>} Promise that resolves with logout response data from Meross API (or null if empty)
     * @throws {MerossAuthError} If not authenticated
     */
    async logout() {
        if (!this.authenticated || !this.token) {
            throw new MerossAuthError('Not authenticated', 'AUTHENTICATION');
        }
        const response = await this._httpClient.logout();
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
 * @property {Function} deviceReady - Emitted when a device finishes initialization and is ready
 *   @param {MerossDevice|MerossHubDevice} device - Device instance
 * @property {Function} connected - Emitted when a device connects
 *   @param {MerossDevice|MerossHubDevice} device - Device instance
 * @property {Function} reconnected - Emitted when a device reconnects after a disconnect
 *   @param {MerossDevice|MerossHubDevice} device - Device instance
 * @property {Function} disconnected - Emitted when a device connection closes
 *   @param {MerossDevice|MerossHubDevice} device - Device instance
 *   @param {Error|string|null} error - Present when the disconnect was caused by an error
 * @property {Function} deviceUpdate - Emitted when a device reports a state change
 *   @param {MerossDevice|MerossHubDevice} device - Device instance
 *   @param {Object} change - State change payload from the device
 * @property {Function} error - Emitted when an error occurs on a device or in MQTT transport
 *   @param {Error|string} error - Error object or message
 *   @param {string|null} deviceId - Device UUID when scoped to a device, or null for manager-level errors
 */

module.exports = ManagerMeross;

