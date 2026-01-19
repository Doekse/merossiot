'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const {
    SECRET,
    MEROSS_DOMAIN,
    LOGIN_URL,
    LOGOUT_URL,
    LOG_URL,
    DEV_LIST,
    SUBDEV_LIST
} = require('./model/constants');
const { getErrorMessage } = require('./model/http/error-codes');
const { HttpStatsCounter } = require('./utilities/stats');
const { MerossErrorNetworkTimeout } = require('./model/exception');
const {
    MerossErrorHttpApi,
    MerossErrorTokenExpired,
    MerossErrorTooManyTokens,
    MerossErrorWrongMFA,
    MerossErrorMFARequired,
    MerossErrorBadDomain
} = require('./model/http/exception');
const { MerossErrorAuthentication, MerossErrorApiLimitReached, MerossErrorResourceAccessDenied } = require('./model/exception');

/**
 * Generates a random alphanumeric string (nonce) for API request signing.
 *
 * Nonces are required by the Meross API to prevent replay attacks. Each request
 * must include a unique nonce that is combined with the timestamp and secret
 * to generate the request signature.
 *
 * @param {number} length - Length of the string to generate
 * @returns {string} Random alphanumeric string
 * @private
 */
function _generateNonce(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let nonce = '';
    for (let i = 0; i < length; i++) {
        nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
}

/**
 * Encodes parameters to base64 for API requests.
 *
 * The Meross API requires request parameters to be base64-encoded JSON strings
 * in the request payload, rather than sending JSON directly.
 *
 * @param {Object} parameters - Parameters object to encode
 * @returns {string} Base64-encoded JSON string
 * @private
 */
function _encodeParams(parameters) {
    const jsonstring = JSON.stringify(parameters);
    return Buffer.from(jsonstring).toString('base64');
}


/**
 * HTTP client for Meross cloud API communication
 *
 * Centralizes HTTP communication with Meross cloud servers to ensure consistent request signing,
 * error handling, and domain management. The Meross API requires MD5-based request signatures
 * and may redirect requests to region-specific domains, which this client handles automatically.
 *
 * @class
 * @example
 * const client = new MerossHttpClient({
 *     logger: console.log,
 *     timeout: 10000,
 *     enableStats: true
 * });
 *
 * const loginResult = await client.login('email@example.com', 'password');
 * const devices = await client.getDevices();
 */
class MerossHttpClient {
    /**
     * Creates a new MerossHttpClient instance
     *
     * @param {Object} [options={}] - Configuration options
     * @param {Function} [options.logger] - Optional logger function for debug output
     * @param {number} [options.timeout=10000] - Request timeout in milliseconds
     * @param {boolean} [options.autoRetryOnBadDomain=true] - Automatically retry on domain redirect errors
     * @param {string|null} [options.mqttDomain=null] - MQTT domain (set automatically after login)
     * @param {boolean} [options.enableStats=false] - Enable HTTP statistics tracking
     * @param {number} [options.maxStatsSamples=1000] - Maximum number of samples to keep in statistics
     * @param {string} [options.userAgent] - Custom User-Agent header (default: iOS app user agent)
     * @param {string} [options.appVersion] - Custom AppVersion header (default: '3.22.4')
     * @param {string} [options.appType] - Custom AppType header (default: 'iOS')
     */
    constructor(options) {
        this.options = options || {};
        this.token = null;
        this.key = null;
        this.userId = null;
        this.userEmail = null;
        this.httpDomain = MEROSS_DOMAIN;
        this.mqttDomain = options.mqttDomain || null;
        this.timeout = options.timeout || 10000;
        this.autoRetryOnBadDomain = options.autoRetryOnBadDomain !== undefined ? !!options.autoRetryOnBadDomain : true;
        this.httpRequestCounter = 0;
        this._logIdentifier = _generateNonce(30) + uuidv4();

        const enableStats = options.enableStats === true;
        this._httpStatsCounter = enableStats ? new HttpStatsCounter(options.maxStatsSamples || 1000) : null;
    }

    /**
     * Sets the authentication token
     *
     * Required for all authenticated API calls after login. The token is included in the
     * Authorization header for each request.
     *
     * @param {string} token - Authentication token from login
     */
    setToken(token) {
        this.token = token;
    }

    /**
     * Sets authentication credentials (token, key, userId, userEmail)
     *
     * @param {string} token - Authentication token
     * @param {string} key - Encryption key
     * @param {string} userId - User ID
     * @param {string} userEmail - User email
     */
    setCredentials(token, key, userId, userEmail) {
        this.token = token;
        this.key = key;
        this.userId = userId;
        this.userEmail = userEmail;
    }

    /**
     * Sets the HTTP API domain
     *
     * Used when the API redirects to a region-specific domain (e.g., EU vs US servers).
     * Typically set automatically during login, but can be overridden if needed.
     *
     * @param {string} domain - HTTP API domain (e.g., 'iotx-eu.meross.com')
     */
    setHttpDomain(domain) {
        this.httpDomain = domain;
    }

    /**
     * Sets the MQTT domain
     *
     * Used for MQTT connections to receive device updates. Typically set automatically
     * during login based on the user's region, but can be overridden if needed.
     *
     * @param {string|null} domain - MQTT domain (e.g., 'eu-iotx.meross.com') or null
     */
    setMqttDomain(domain) {
        this.mqttDomain = domain;
    }


    /**
     * Prepares an authenticated HTTP request with signing, headers, and payload
     *
     * Generates nonce, timestamp, encodes parameters, creates MD5 signature,
     * and builds request headers and payload according to Meross API requirements.
     *
     * @param {string} endpoint - API endpoint path (e.g., '/v1/Auth/signIn')
     * @param {Object} paramsData - Request parameters object to be encoded and sent
     * @returns {Object} Request configuration object
     * @returns {Object} returns.headers - HTTP headers for the request
     * @returns {Object} returns.payload - Request payload with signature
     * @returns {string} returns.url - Full URL for the request
     * @private
     */
    _prepareAuthenticatedRequest(endpoint, paramsData) {
        const nonce = _generateNonce(16);
        const timestampMillis = Date.now();
        const loginParams = _encodeParams(paramsData);

        // Meross API requires MD5 signature of secret + timestamp + nonce + encoded params
        const datatosign = SECRET + timestampMillis + nonce + loginParams;
        const md5hash = crypto.createHash('md5').update(datatosign).digest('hex');
        const headers = {
            'Authorization': `Basic ${this.token || ''}`,
            'Vendor': 'meross',
            'AppVersion': this.options.appVersion || '3.22.4',
            'AppType': this.options.appType || 'iOS',
            'AppLanguage': 'en',
            'User-Agent': this.options.userAgent || 'intellect_socket/3.22.4 (iPhone; iOS 17.2; Scale/2.00)',
            'Content-Type': 'application/json'
        };

        const payload = {
            'params': loginParams,
            'sign': md5hash,
            'timestamp': timestampMillis,
            nonce
        };

        const url = `https://${this.httpDomain}${endpoint}`;

        return { headers, payload, url };
    }

    /**
     * Executes an HTTP POST request with timeout handling and response parsing.
     *
     * Uses AbortController to enforce request timeouts, preventing indefinite
     * hangs when devices are unreachable. Parses JSON responses and throws
     * HttpApiError for non-200 status codes to provide consistent error handling.
     *
     * @param {string} url - Full URL for the request
     * @param {Object} headers - HTTP headers for the request
     * @param {Object} payload - Request payload
     * @param {number} requestCounter - Request counter for logging
     * @returns {Promise<Object>} Promise that resolves with response data
     * @returns {Response} returns.response - Fetch Response object
     * @returns {Object} returns.body - Parsed JSON response body
     * @returns {string} returns.bodyText - Raw response text
     * @throws {HttpApiError} If HTTP status is not 200
     * @throws {Error} If request timeout occurs
     * @private
     */
    async _executeHttpRequest(url, headers, payload, requestCounter) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new MerossErrorNetworkTimeout('Request timeout', null, url);
            }
            throw error;
        }

        if (response.status !== 200) {
            if (this.options.logger) {
                this.options.logger(`HTTP-Response (${requestCounter}) Error: Status=${response.status}`);
            }
            throw new MerossErrorHttpApi(`HTTP ${response.status}: ${response.statusText}`, null, response.status);
        }

        const bodyText = await response.text();
        if (this.options.logger) {
            this.options.logger(`HTTP-Response (${requestCounter}) OK: ${bodyText}`);
        }

        let body;
        try {
            body = JSON.parse(bodyText);
        } catch (err) {
            body = {};
        }

        return { response, body, bodyText };
    }

    /**
     * Extracts HTTP and API status codes from various error types
     *
     * Handles HttpApiError, statusCode property, and message parsing to extract
     * status codes for statistics tracking.
     *
     * @param {Error} error - Error object to extract codes from
     * @returns {Object} Extracted status codes
     * @returns {number} returns.httpCode - HTTP status code (0 if not found)
     * @returns {number|null} returns.apiCode - API status code (null if not found)
     * @private
     */
    _extractErrorCodes(error) {
        let httpCode = 0;
        let apiCode = null;

        if (error instanceof MerossErrorHttpApi && error.httpStatusCode) {
            httpCode = error.httpStatusCode;
            if (error.apiStatusCode !== undefined && error.apiStatusCode !== null) {
                apiCode = error.apiStatusCode;
            }
        } else if (error.statusCode) {
            httpCode = error.statusCode;
        } else if (error.message && error.message.includes('HTTP')) {
            const match = error.message.match(/HTTP (\d+)/);
            if (match) {
                httpCode = parseInt(match[1], 10);
            }
        }

        return { httpCode, apiCode };
    }


    /**
     * Handles domain redirect (status code 1030) with retry logic
     *
     * Validates retry count, checks auto-retry setting, updates domain and MQTT domain,
     * and returns recursive call to authenticatedPost or throws BadDomainError.
     *
     * @param {string} endpoint - API endpoint path
     * @param {Object} paramsData - Request parameters object
     * @param {Object} body - Response body containing redirect information
     * @param {number} retryCount - Current retry attempt count
     * @returns {Promise<Object>} Promise that resolves with API response data after retry
     * @throws {BadDomainError} If max retries exceeded or auto-retry disabled
     * @private
     */
    async _handleDomainRedirect(endpoint, paramsData, body, retryCount) {
        const MAX_RETRIES = 3;
        // Remove protocol prefix if present since httpDomain should not include it
        const newApiDomain = body.data.domain.startsWith('https://')
            ? body.data.domain.substring(8)
            : body.data.domain;
        const newMqttDomain = body.data.mqttDomain;

        if (retryCount >= MAX_RETRIES) {
            throw new MerossErrorBadDomain(
                `Max retries (${MAX_RETRIES}) exceeded for domain redirect`,
                newApiDomain,
                newMqttDomain
            );
        }

        if (!this.autoRetryOnBadDomain) {
            throw new MerossErrorBadDomain(
                `Login API redirected to different region: ${newApiDomain}. Auto-retry is disabled.`,
                newApiDomain,
                newMqttDomain
            );
        }

        if (this.options.logger) {
            this.options.logger(
                `Login API redirected to different region: ${newApiDomain}. Retrying (attempt ${retryCount + 1}/${MAX_RETRIES})...`
            );
        }

        const oldDomain = this.httpDomain;
        this.httpDomain = newApiDomain;
        this.mqttDomain = newMqttDomain;

        if (this.options.logger) {
            this.options.logger(
                `Domain changed from ${oldDomain} to ${this.httpDomain}, MQTT domain changed to ${this.mqttDomain}`
            );
        }

        return await this.authenticatedPost(endpoint, paramsData, retryCount + 1);
    }

    /**
     * Maps API status codes to appropriate error classes and throws them
     *
     * Consolidates the sequential if statements into a cleaner structure using
     * a switch statement for known error codes. Throws appropriate error instances.
     *
     * @param {number} apiStatus - API status code from response
     * @param {Object} body - Response body containing error information
     * @throws {MFARequiredError} If MFA is required but code not provided (apiStatus 1033)
     * @throws {WrongMFAError} If MFA code is incorrect (apiStatus 1032)
     * @throws {TokenExpiredError} If authentication token has expired (apiStatus 1019, 1022, 1200)
     * @throws {TooManyTokensError} If too many tokens are active (apiStatus 1301)
     * @throws {AuthenticationError} If authentication fails (apiStatus 1000-1008)
     * @throws {ApiLimitReachedError} If API rate limit is reached (apiStatus 1042)
     * @throws {ResourceAccessDeniedError} If resource access is denied (apiStatus 1043)
     * @throws {MerossError} For other API error status codes
     * @private
     */
    _throwApiStatusError(apiStatus, body) {
        const message = body.info || getErrorMessage(apiStatus);

        switch (apiStatus) {
        case 1033:
            throw new MerossErrorMFARequired(message);
        case 1032:
            throw new MerossErrorWrongMFA(message);
        case 1019:
        case 1022:
        case 1200:
            throw new MerossErrorTokenExpired(message, apiStatus);
        case 1301:
            throw new MerossErrorTooManyTokens(message);
        case 1042:
            throw new MerossErrorApiLimitReached(message);
        case 1043:
            throw new MerossErrorResourceAccessDenied(message);
        }

        // Authentication failures (status codes 1000-1008) indicate invalid credentials
        // or expired sessions, which should be handled differently from other errors
        if (apiStatus >= 1000 && apiStatus <= 1008) {
            throw new MerossErrorAuthentication(message, apiStatus);
        }

        const { MerossError } = require('./model/exception');
        throw new MerossError(
            `${apiStatus} (${getErrorMessage(apiStatus)})${body.info ? ` - ${body.info}` : ''}`,
            apiStatus
        );
    }

    /**
     * Performs an authenticated POST request to the Meross HTTP API
     *
     * Centralizes request signing, error handling, and domain management to ensure all API calls
     * follow Meross protocol requirements. The Meross API requires MD5 signatures based on a secret,
     * timestamp, nonce, and encoded parameters. Domain redirects are handled automatically because
     * the API may route requests to region-specific servers based on account location.
     *
     * @param {string} endpoint - API endpoint path (e.g., '/v1/Auth/signIn')
     * @param {Object} paramsData - Request parameters object to be encoded and sent
     * @param {number} [retryCount=0] - Internal retry counter (used for domain redirect retries)
     * @returns {Promise<Object>} Promise that resolves with the API response data
     * @throws {BadDomainError} If domain redirect occurs and max retries exceeded or auto-retry disabled
     * @throws {MFARequiredError} If MFA is required but code not provided (apiStatus 1033)
     * @throws {WrongMFAError} If MFA code is incorrect (apiStatus 1032)
     * @throws {TokenExpiredError} If authentication token has expired (apiStatus 1019, 1022, 1200)
     * @throws {TooManyTokensError} If too many tokens are active (apiStatus 1301)
     * @throws {AuthenticationError} If authentication fails (apiStatus 1000-1008)
     * @throws {ApiLimitReachedError} If API rate limit is reached (apiStatus 1042)
     * @throws {ResourceAccessDeniedError} If resource access is denied (apiStatus 1043)
     * @throws {HttpApiError} If HTTP request fails (network errors, timeouts)
     * @throws {MerossError} For other API error status codes
     * @private
     */
    async authenticatedPost(endpoint, paramsData, retryCount = 0) {
        const { headers, payload, url } = this._prepareAuthenticatedRequest(endpoint, paramsData);

        const requestCounter = this.httpRequestCounter++;
        if (this.options.logger) {
            this.options.logger(`HTTP-Call (${requestCounter}): POST ${url} headers=${JSON.stringify(headers)} body=${JSON.stringify(payload)}`);
        }

        try {
            const { body } = await this._executeHttpRequest(url, headers, payload, requestCounter);

            const apiResponseCode = body.apiStatus ?? null;

            // Track statistics after parsing response to capture both HTTP and API-level status codes
            if (this._manager) {
                this._manager.statistics.notifyHttpRequest(url, 'POST', 200, apiResponseCode);
            }

            if (body.apiStatus === 0) {
                return body.data;
            }

            // API may redirect to region-specific domain based on account location
            if (body.apiStatus === 1030 && body.data && body.data.domain) {
                return await this._handleDomainRedirect(endpoint, paramsData, body, retryCount);
            }

            // Map API status codes to specific error classes for better error handling
            // upstream, allowing callers to handle different error types appropriately
            this._throwApiStatusError(body.apiStatus, body);
        } catch (error) {
            // Track error statistics by extracting HTTP and API status codes from various error types
            const { httpCode, apiCode } = this._extractErrorCodes(error);
            if (this._manager) {
                this._manager.statistics.notifyHttpRequest(url, 'POST', httpCode, apiCode);
            }

            // Preserve custom error types for proper error handling upstream
            const { MerossError } = require('./model/exception');
            if (error instanceof MerossError) {
                throw error;
            }
            // Wrap fetch-related network errors for consistent error handling
            if (error.name === 'TypeError' && error.message && error.message.includes('fetch')) {
                throw new MerossErrorHttpApi(`HTTP request failed: ${error.message}`, null, null, { cause: error });
            }
            throw error;
        }
    }

    /**
     * Authenticates with Meross cloud API
     *
     * Establishes an authenticated session by exchanging credentials for tokens. The password
     * is hashed with MD5 before transmission as required by the Meross API. If MFA is enabled
     * on the account, the mfaCode parameter must be provided.
     *
     * @param {string} email - Meross account email address
     * @param {string} password - Meross account password (will be hashed)
     * @param {string} [mfaCode] - Multi-factor authentication code (required if MFA is enabled)
     * @returns {Promise<Object>} Login result object
     * @returns {string} returns.token - Authentication token
     * @returns {string} returns.key - Encryption key
     * @returns {string} returns.userId - User ID
     * @returns {string} returns.email - User email
     * @throws {AuthenticationError} If email or password is missing
     * @throws {MFARequiredError} If MFA is required but code not provided
     * @throws {WrongMFAError} If MFA code is incorrect
     * @throws {TokenExpiredError} If token has expired
     * @throws {BadDomainError} If domain redirect occurs and auto-retry fails
     * @example
     * const result = await client.login('email@example.com', 'password');
     * client.setToken(result.token);
     */
    async login(email, password, mfaCode) {
        if (!email) {
            throw new MerossErrorAuthentication('Email missing');
        }
        if (!password) {
            throw new MerossErrorAuthentication('Password missing');
        }
        // Meross API expects MD5 hash of password, not plain text
        const passwordHash = crypto.createHash('md5').update(password).digest('hex');

        const data = {
            email,
            password: passwordHash,
            encryption: 1,
            accountCountryCode: '--',
            mobileInfo: {
                resolution: '--',
                carrier: '--',
                deviceModel: '--',
                mobileOs: process.platform,
                mobileOSVersion: '--',
                uuid: this._logIdentifier
            },
            agree: 1,
            mfaCode: mfaCode || undefined
        };

        if (this.options.logger) {
            this.options.logger(`Login to Meross${mfaCode ? ' with MFA code' : ''}`);
        }
        const loginResponse = await this.authenticatedPost(LOGIN_URL, data);

        if (!loginResponse) {
            const { MerossError } = require('./model/exception');
            throw new MerossError('No valid Login Response data received');
        }

        // Log user activity asynchronously after successful login.
        // This call is non-blocking and failures are ignored to prevent login
        // from failing due to telemetry issues.
        this._logUserActivity().catch(err => {
            if (this.options.logger) {
                this.options.logger(`Log API call failed (non-critical): ${err.message}`);
            }
        });

        return {
            token: loginResponse.token,
            key: loginResponse.key,
            userId: loginResponse.userid,
            email: loginResponse.email,
            mqttDomain: this.mqttDomain
        };
    }

    /**
     * Gets the list of devices from Meross cloud
     *
     * @returns {Promise<Array>} Promise that resolves with array of device objects
     * @throws {HttpApiError} If API request fails
     * @throws {TokenExpiredError} If authentication token has expired
     * @throws {UnauthorizedError} If not authenticated
     * @example
     * const devices = await client.getDevices();
     * console.log(`Found ${devices.length} devices`);
     */
    async getDevices() {
        if (this.options.logger) {
            this.options.logger('Get Devices from Meross cloud server');
        }
        const deviceList = await this.authenticatedPost(DEV_LIST, {});
        return deviceList || [];
    }

    /**
     * Gets subdevices for a hub device
     *
     * @param {string} deviceUuid - Hub device UUID
     * @returns {Promise<Array>} Promise that resolves with array of subdevice objects
     * @throws {HttpApiError} If API request fails
     * @throws {TokenExpiredError} If authentication token has expired
     * @throws {UnauthorizedError} If not authenticated
     * @example
     * const subdevices = await client.getSubDevices(hubUuid);
     * console.log(`Hub has ${subdevices.length} subdevices`);
     */
    async getSubDevices(deviceUuid) {
        if (this.options.logger) {
            this.options.logger(`Get SubDevices for hub ${deviceUuid}`);
        }
        const subDeviceList = await this.authenticatedPost(SUBDEV_LIST, { uuid: deviceUuid });
        return subDeviceList || [];
    }

    /**
     * Logs user activity to Meross servers
     *
     * Called automatically after successful login. Sends client information
     * for analytics and telemetry purposes.
     *
     * @returns {Promise<void>} Promise that resolves when log is sent
     * @private
     */
    async _logUserActivity() {
        const logData = {
            system: process.platform,
            vendor: 'meross',
            uuid: this._logIdentifier,
            extra: '',
            model: process.arch,
            version: process.version
        };

        try {
            await this.authenticatedPost(LOG_URL, logData);
        } catch (err) {
            // Re-throw to allow caller to handle, but caller treats this as non-critical
            throw err;
        }
    }

    /**
     * Logs out from Meross cloud API
     *
     * Invalidates the current authentication token on the server. Should be called when
     * shutting down to prevent token leakage and ensure proper session cleanup.
     *
     * @returns {Promise<Object|null>} Promise that resolves with logout response data (or null if empty)
     * @throws {AuthenticationError} If not authenticated
     * @example
     * const response = await client.logout();
     * console.log('Logged out successfully', response);
     */
    async logout() {
        if (!this.token) {
            throw new MerossErrorAuthentication('Not authenticated');
        }
        const response = await this.authenticatedPost(LOGOUT_URL, {});
        return response || null;
    }

    /**
     * Factory method: Creates an HTTP client from username/password credentials
     *
     * Performs login and returns an authenticated client instance.
     *
     * @param {Object} options - Login options
     * @param {string} options.email - Meross account email address
     * @param {string} options.password - Meross account password
     * @param {string} [options.mfaCode] - Multi-factor authentication code
     * @param {Function} [options.logger] - Optional logger function
     * @param {number} [options.timeout=10000] - Request timeout in milliseconds
     * @param {boolean} [options.autoRetryOnBadDomain=true] - Automatically retry on domain redirect
     * @param {boolean} [options.enableStats=false] - Enable statistics tracking
     * @param {number} [options.maxStatsSamples=1000] - Maximum number of samples
     * @param {string} [options.userAgent] - Custom User-Agent header
     * @param {string} [options.appVersion] - Custom AppVersion header
     * @param {string} [options.appType] - Custom AppType header
     * @returns {Promise<MerossHttpClient>} Authenticated HTTP client instance
     * @static
     * @example
     * const client = await MerossHttpClient.fromUserPassword({
     *     email: 'user@example.com',
     *     password: 'password'
     * });
     */
    static async fromUserPassword(options) {
        const client = new MerossHttpClient({
            logger: options.logger,
            timeout: options.timeout,
            autoRetryOnBadDomain: options.autoRetryOnBadDomain,
            enableStats: options.enableStats,
            maxStatsSamples: options.maxStatsSamples,
            userAgent: options.userAgent,
            appVersion: options.appVersion,
            appType: options.appType
        });

        const loginResult = await client.login(options.email, options.password, options.mfaCode);
        client.setCredentials(loginResult.token, loginResult.key, loginResult.userId, loginResult.email);
        client.setHttpDomain(client.httpDomain);
        if (loginResult.mqttDomain) {
            client.setMqttDomain(loginResult.mqttDomain);
        }

        return client;
    }

    /**
     * Factory method: Creates an HTTP client from saved credentials
     *
     * Creates a client with pre-authenticated token data. Useful for reusing
     * tokens across sessions without re-authenticating.
     *
     * @param {Object} credentials - Saved credentials object
     * @param {string} credentials.token - Authentication token
     * @param {string} credentials.key - Encryption key
     * @param {string} credentials.userId - User ID
     * @param {string} credentials.domain - HTTP API domain
     * @param {string} [credentials.mqttDomain] - MQTT domain
     * @param {Function} [options.logger] - Optional logger function
     * @param {number} [options.timeout=10000] - Request timeout in milliseconds
     * @param {boolean} [options.autoRetryOnBadDomain=true] - Automatically retry on domain redirect
     * @param {boolean} [options.enableStats=false] - Enable statistics tracking
     * @param {number} [options.maxStatsSamples=1000] - Maximum number of samples
     * @param {string} [options.userAgent] - Custom User-Agent header
     * @param {string} [options.appVersion] - Custom AppVersion header
     * @param {string} [options.appType] - Custom AppType header
     * @returns {MerossHttpClient} HTTP client instance with credentials set
     * @static
     * @example
     * const client = MerossHttpClient.fromCredentials({
     *     token: 'savedToken',
     *     key: 'savedKey',
     *     userId: 'userId123',
     *     domain: 'iotx-eu.meross.com',
     *     mqttDomain: 'eu-iotx.meross.com'
     * });
     */
    static fromCredentials(credentials, options = {}) {
        const client = new MerossHttpClient({
            logger: options.logger,
            timeout: options.timeout,
            autoRetryOnBadDomain: options.autoRetryOnBadDomain,
            mqttDomain: credentials.mqttDomain,
            enableStats: options.enableStats,
            maxStatsSamples: options.maxStatsSamples,
            userAgent: options.userAgent,
            appVersion: options.appVersion,
            appType: options.appType
        });

        client.setCredentials(
            credentials.token,
            credentials.key,
            credentials.userId,
            credentials.userEmail || null
        );
        client.setHttpDomain(credentials.domain);
        if (credentials.mqttDomain) {
            client.setMqttDomain(credentials.mqttDomain);
        }

        return client;
    }
}

module.exports = MerossHttpClient;

