'use strict';

const EventEmitter = require('events');
const { MerossDeviceError } = require('./exception');
const { ENABLED_MANAGERS, OPTIONAL_MANAGERS } = require('../manager/registry');

/**
 * Manages Meross cloud connections and device communication.
 *
 * Sub-manager accessors lazy-load transport, devices, and MQTT so credentials and
 * runtime options can be applied before cloud initialization.
 *
 * @class
 * @extends EventEmitter
 */
class Meross extends EventEmitter {
    /**
     * Authenticates and returns a manager without connecting to the cloud or initializing devices.
     *
     * Centralizing auth creation here keeps the HTTP client as an internal detail
     * so consumers only need to provide credentials and can adjust runtime settings
     * on the returned manager. Use {@link Meross.connect} when you want auth
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
     * @returns {Promise<Meross>} Authenticated manager (not yet connected)
     * @throws {MerossDeviceError} If options do not contain a valid auth shape
     */
    static async authenticate(options) {
        const ManagerAuth = require('../manager/auth');
        const httpClient = await ManagerAuth.createClient(options);
        const meross = new Meross({ httpClient });
        if (options?.logger) {
            meross.logger = options.logger;
        }
        return meross;
    }

    /**
     * Authenticates via {@link Meross.authenticate} then connects to the cloud.
     *
     * @static
     * @async
     * @param {Object} options - Same shape as {@link Meross.authenticate}
     * @returns {Promise<Meross>} Connected manager instance
     * @throws {MerossDeviceError} If options do not contain a valid auth shape
     */
    static async connect(options) {
        const meross = await Meross.authenticate(options);
        await meross.connect();
        return meross;
    }

    /**
     * @param {Object} options - Configuration options
     * @param {MerossApiClient} options.httpClient - HTTP client instance (required)
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
        this._initializeFromOptions(options);
    }

    /**
     * Constructor callers must supply an authenticated HTTP client; use
     * {@link Meross.authenticate} or {@link Meross.connect} as entry points.
     *
     * @private
     * @param {Object} options - Configuration options
     * @throws {MerossDeviceError} If httpClient is missing
     */
    _validateOptions(options) {
        if (!options || !options.httpClient) {
            throw new MerossDeviceError(
                'httpClient is required. Use Meross.authenticate() or Meross.connect().',
                'VALIDATION_ERROR',
                { field: 'httpClient' }
            );
        }
    }

    /**
     * Applies all constructor-time field wiring in one place so ordering stays obvious
     * when new options are added (e.g. HTTP hook and `_managers` before optional stats).
     *
     * @private
     * @param {Object} options - Same object passed to the constructor (after validation)
     */
    _initializeFromOptions(options) {
        this.options = options;
        this.issuedOn = null;
        this.autoRetryOnBadDomain = options.autoRetryOnBadDomain !== undefined ? !!options.autoRetryOnBadDomain : true;
        this._timeout = options.timeout || 10000;

        this._managers = Object.fromEntries(
            [...Object.keys(ENABLED_MANAGERS), ...Object.keys(OPTIONAL_MANAGERS)]
                .map(name => [name, null])
        );

        const ManagerAuth = require('../manager/auth');
        this._managers.auth = new ManagerAuth(this, options.httpClient);
        this._managers.auth.initializeFromClient();

        if (options.enableStats) {
            this.statistics.enable(options.maxStatsSamples || 1000);
        }

        this._subscriptionOptions = options.subscription || {};
    }

    /** @returns {import('../manager/auth')} */
    get auth() {
        return this._managers.auth;
    }

    get authenticated() {
        return this.auth.authenticated;
    }

    set authenticated(value) {
        this.auth.authenticated = value;
    }

    get mqttDomain() {
        return this.auth.mqttDomain;
    }

    set mqttDomain(value) {
        this.auth.mqttDomain = value;
    }

    /**
     * Delegates token reads to the HTTP client so manager auth state cannot drift
     * from the credential owner.
     *
     * @returns {string|null} Active token value
     */
    get token() {
        return this.auth.token;
    }

    /**
     * Delegates key reads to the HTTP client so post-login refresh stays visible
     * to transport and encryption code paths.
     *
     * @returns {string|null} Active encryption key
     */
    get key() {
        return this.auth.key;
    }

    /**
     * Delegates user ID reads to the HTTP client as the single auth metadata source.
     *
     * @returns {string|null} Authenticated user ID
     */
    get userId() {
        return this.auth.userId;
    }

    /**
     * Delegates email reads to the HTTP client so token export stays consistent.
     *
     * @returns {string|null} Authenticated user email
     */
    get userEmail() {
        return this.auth.userEmail;
    }

    /**
     * Delegates domain reads to the HTTP client because regional redirects update it in place.
     *
     * @returns {string|null} Active Meross HTTP domain
     */
    get httpDomain() {
        return this.auth.httpDomain;
    }

    /**
     * Preserves the legacy `httpClient` accessor while auth owns the underlying client.
     *
     * @returns {MerossApiClient|null} Active HTTP client instance
     */
    get httpClient() {
        return this.auth.client;
    }

    /**
     * Request timeout surfaced at runtime for CLI and application tuning.
     *
     * @returns {number} Timeout in milliseconds
     */
    get timeout() {
        return this._timeout;
    }

    /**
     * Rejects invalid timeout values to avoid silent fallback to broken request behavior.
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
     * Logger exposed at runtime so debugging can be toggled without recreating the manager.
     *
     * @returns {Function|null} Logger function or null when disabled
     */
    get logger() {
        return this.options.logger || null;
    }

    /**
     * Propagates logger changes to HTTP, throttling, and subscription polling.
     *
     * @param {Function|null} fn - Logger function to use
     */
    set logger(fn) {
        this.options.logger = typeof fn === 'function' ? fn : null;

        this.auth.client.options.logger = this.options.logger;

        const queue = this.transport._requestQueue;
        if (queue) {
            queue.logger = this.options.logger;
        }
        const subscription = this._managers.subscription;
        if (subscription) {
            subscription.logger = this.options.logger || (() => {});
        }
    }

    /**
     * Lazy-loads a sub-manager by registry name.
     *
     * @private
     * @param {string} name - Key in ENABLED_MANAGERS
     * @returns {import('../manager/base')|import('./managers/subscription')}
     */
    _getManager(name) {
        if (name === 'auth') {
            return this._managers.auth;
        }
        if (!this._managers[name]) {
            const loadManager = ENABLED_MANAGERS[name] || OPTIONAL_MANAGERS[name];
            if (!loadManager) {
                throw new MerossDeviceError(`Unknown manager: ${name}`, 'VALIDATION_ERROR', { field: 'name' });
            }
            const ManagerClass = loadManager();
            if (name === 'subscription') {
                this._managers[name] = new ManagerClass(this, {
                    logger: this.options?.logger,
                    ...this._subscriptionOptions
                });
            } else {
                this._managers[name] = new ManagerClass(this);
            }
        }
        return this._managers[name];
    }

    /** @returns {import("../manager/devices")} */
    get devices() {
        return this._getManager('devices');
    }

    /** @returns {import("../manager/mqtt")} */
    get mqtt() {
        return this._getManager('mqtt');
    }

    /** @returns {import("../manager/http")} */
    get http() {
        return this._getManager('http');
    }

    /** @returns {import("../manager/transport")} */
    get transport() {
        return this._getManager('transport');
    }

    /** @returns {import("../manager/statistics")} */
    get statistics() {
        return this._getManager('statistics');
    }

    /** @returns {import("../manager/subscription")} */
    get subscription() {
        return this._getManager('subscription');
    }

    /**
     * Returns persisted credential fields for {@link MerossApiClient.fromCredentials}.
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
        return this.auth.getTokenData();
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
        const deviceListLength = await this.devices.initialize();
        this.auth.markConnected();
        return deviceListLength;
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
        const response = await this.auth.logout();
        this.disconnectAll();
        return response;
    }


    /**
     * Tears down device and transport state during logout or application shutdown.
     *
     * Clears the registry first so queue cleanup can still resolve device UUIDs
     * before MQTT connections close.
     *
     * @param {boolean} [force] - Passed to MQTT client end()
     * @returns {void}
     */
    disconnectAll(force) {
        const devices = this.devices.clear();
        this.transport.clearAllQueues(devices);
        this.mqtt.disconnectAll(force);
    }

}

/**
 * Events emitted by Meross instance
 *
 * @typedef {Object} MerossEvents
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

module.exports = Meross;

