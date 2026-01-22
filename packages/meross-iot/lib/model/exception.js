'use strict';

/**
 * Base error class for all Meross errors.
 *
 * Provides a common interface for error handling with errorCode property to
 * identify specific API error conditions. All library-specific errors extend
 * this class to enable instanceof checks and consistent error handling
 * throughout the library.
 *
 * @class
 * @extends Error
 * @property {string} code - String identifier for the error type
 * @property {number|null} errorCode - API error code (if available)
 * @property {boolean} isOperational - Whether this is an operational (recoverable) error
 * @property {Error|null} cause - The underlying error that caused this error (error chaining)
 */
class MerossError extends Error {
    constructor(message, errorCode = null, options = {}) {
        super(message);
        this.name = this.constructor.name;
        this.code = options.code || this.constructor.name;
        this.errorCode = errorCode;
        this.isOperational = options.isOperational ?? true;
        this.cause = options.cause || null;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Returns a JSON-serializable representation of the error.
     * Excludes stack trace and cause for clean serialization in logs/APIs.
     *
     * @returns {Object} Serializable error object
     */
    toJSON() {
        const result = {
            name: this.name,
            code: this.code,
            message: this.message
        };
        if (this.errorCode !== null) {
            result.errorCode = this.errorCode;
        }
        if (this.isOperational !== undefined) {
            result.isOperational = this.isOperational;
        }
        return result;
    }
}

/**
 * Authentication related errors (error codes 1000-1008).
 *
 * Thrown when authentication fails due to invalid credentials, account issues,
 * or authentication service problems. Indicates the login request cannot be
 * completed with the provided credentials.
 *
 * Base class for authentication errors. HTTP-specific auth errors are in
 * lib/model/http/exception.js.
 *
 * @class
 * @extends MerossError
 * @property {number} errorCode - API error code (1000-1008)
 */
class MerossErrorAuthentication extends MerossError {
    constructor(message, errorCode, options = {}) {
        super(message || 'Authentication failed', errorCode, {
            code: 'AUTHENTICATION',
            isOperational: true,
            ...options
        });
    }
}

/**
 * API limit reached error (error code 1042).
 *
 * Thrown when the API rate limit has been exceeded. Meross enforces rate limits
 * to prevent abuse and ensure service stability. Requests should be throttled
 * to stay within the allowed rate. Retry after a delay or reduce request frequency.
 *
 * @class
 * @extends MerossError
 * @property {number} errorCode - Always 1042
 */
class MerossErrorApiLimitReached extends MerossError {
    constructor(message, options = {}) {
        super(message || 'API top limit reached', 1042, {
            code: 'API_LIMIT_REACHED',
            isOperational: true,
            ...options
        });
    }
}

/**
 * Resource access denied error (error code 1043).
 *
 * Thrown when access to a resource is denied due to insufficient permissions.
 * The account may not have access to the requested device or resource, or the
 * resource may not exist. Verify the resource exists and the account has
 * appropriate permissions.
 *
 * @class
 * @extends MerossError
 * @property {number} errorCode - Always 1043
 */
class MerossErrorResourceAccessDenied extends MerossError {
    constructor(message, options = {}) {
        super(message || 'Resource access deny', 1043, {
            code: 'RESOURCE_ACCESS_DENIED',
            isOperational: false,
            ...options
        });
    }
}

/**
 * Device command timeout error.
 *
 * Thrown when a device command doesn't receive a response within the timeout period.
 * Indicates the device may be offline, unreachable, or experiencing network issues
 * that prevent timely communication. Check device connectivity and network status.
 *
 * @class
 * @extends MerossError
 * @property {string|null} deviceUuid - UUID of the device that timed out
 * @property {number|null} timeout - Timeout duration in milliseconds
 * @property {Object|null} command - Command information (method, namespace, etc.)
 */
class MerossErrorCommandTimeout extends MerossError {
    constructor(message, deviceUuid = null, timeout = null, command = null, options = {}) {
        super(message || 'Command timeout occurred', null, {
            code: 'COMMAND_TIMEOUT',
            isOperational: true,
            ...options
        });
        this.deviceUuid = deviceUuid;
        this.timeout = timeout;
        this.command = command;
    }

    toJSON() {
        const result = super.toJSON();
        if (this.deviceUuid !== null) {
            result.deviceUuid = this.deviceUuid;
        }
        if (this.timeout !== null) {
            result.timeout = this.timeout;
        }
        if (this.command !== null) {
            result.command = this.command;
        }
        return result;
    }
}

/**
 * Device command error (device returned an error response).
 *
 * Thrown when a device command fails and the device returns an error response.
 * The command was received and processed by the device, but the device rejected
 * it or encountered an error during execution. Check the errorPayload for
 * device-specific error details.
 *
 * @class
 * @extends MerossError
 * @property {Object|null} errorPayload - Error payload from device response
 * @property {string|null} deviceUuid - UUID of the device that returned the error
 */
class MerossErrorCommand extends MerossError {
    constructor(message, errorPayload = null, deviceUuid = null, options = {}) {
        super(message || 'Device command failed', null, {
            code: 'COMMAND_FAILED',
            isOperational: true,
            ...options
        });
        this.errorPayload = errorPayload;
        this.deviceUuid = deviceUuid;
    }

    toJSON() {
        const result = super.toJSON();
        if (this.errorPayload !== null) {
            result.errorPayload = this.errorPayload;
        }
        if (this.deviceUuid !== null) {
            result.deviceUuid = this.deviceUuid;
        }
        return result;
    }
}

/**
 * MQTT connection/communication error.
 *
 * Thrown when MQTT connection or communication fails. Can occur due to network
 * issues, MQTT broker unavailability, connection timeouts, or protocol errors
 * during message transmission. Check network connectivity and MQTT broker status.
 *
 * @class
 * @extends MerossError
 * @property {string|null} topic - MQTT topic related to the error
 * @property {Object|null} mqttMessage - MQTT message related to the error
 */
class MerossErrorMqtt extends MerossError {
    constructor(message, topic = null, mqttMessage = null, options = {}) {
        super(message || 'MQTT error occurred', null, {
            code: 'MQTT_ERROR',
            isOperational: true,
            ...options
        });
        this.topic = topic;
        this.mqttMessage = mqttMessage;
    }

    toJSON() {
        const result = super.toJSON();
        if (this.topic !== null) {
            result.topic = this.topic;
        }
        if (this.mqttMessage !== null) {
            result.mqttMessage = this.mqttMessage;
        }
        return result;
    }
}

/**
 * Device not connected error.
 *
 * Thrown when attempting to send a command to a device that is not connected.
 * Commands can only be sent after the device has established a connection and
 * emitted the 'connected' event. Wait for the device to connect before sending commands.
 *
 * @class
 * @extends MerossError
 * @property {string|null} deviceUuid - UUID of the device that is not connected
 */
class MerossErrorUnconnected extends MerossError {
    constructor(message, deviceUuid = null, options = {}) {
        super(message || 'Device is not connected', null, {
            code: 'DEVICE_UNCONNECTED',
            isOperational: true,
            ...options
        });
        this.deviceUuid = deviceUuid;
    }

    toJSON() {
        const result = super.toJSON();
        if (this.deviceUuid !== null) {
            result.deviceUuid = this.deviceUuid;
        }
        return result;
    }
}

/**
 * Unknown or unsupported device type error.
 *
 * Thrown when a device operation is attempted on a device type that doesn't
 * support the requested feature or when the device type is not recognized.
 * Indicates a mismatch between the requested operation and device capabilities.
 * Verify the device type supports the requested operation.
 *
 * @class
 * @extends MerossError
 * @property {string|null} deviceType - Device type that is unsupported
 */
class MerossErrorUnknownDeviceType extends MerossError {
    constructor(message, deviceType = null, options = {}) {
        super(message || 'Unknown or unsupported device type', null, {
            code: 'UNKNOWN_DEVICE_TYPE',
            isOperational: false,
            ...options
        });
        this.deviceType = deviceType;
    }

    toJSON() {
        const result = super.toJSON();
        if (this.deviceType !== null) {
            result.deviceType = this.deviceType;
        }
        return result;
    }
}

/**
 * Validation error for invalid parameters or missing required fields.
 *
 * Thrown when function arguments are invalid, missing required parameters,
 * or have incorrect types/values. Indicates a programming error where the
 * caller provided invalid input.
 *
 * @class
 * @extends MerossError
 * @property {string|null} field - The field/parameter that failed validation
 */
class MerossErrorValidation extends MerossError {
    constructor(message, field = null, options = {}) {
        super(message || 'Validation error', null, {
            code: 'VALIDATION_ERROR',
            isOperational: false,
            ...options
        });
        this.field = field;
    }

    toJSON() {
        const result = super.toJSON();
        if (this.field !== null) {
            result.field = this.field;
        }
        return result;
    }
}

/**
 * Resource not found error.
 *
 * Thrown when a requested resource (device, channel, trigger, timer, etc.)
 * cannot be found. Indicates the resource doesn't exist or is not accessible.
 *
 * @class
 * @extends MerossError
 * @property {string|null} resourceType - Type of resource that was not found (e.g., 'device', 'channel')
 * @property {string|null} resourceId - Identifier of the resource that was not found
 */
class MerossErrorNotFound extends MerossError {
    constructor(message, resourceType = null, resourceId = null, options = {}) {
        super(message || 'Resource not found', null, {
            code: 'NOT_FOUND',
            isOperational: false,
            ...options
        });
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }

    toJSON() {
        const result = super.toJSON();
        if (this.resourceType !== null) {
            result.resourceType = this.resourceType;
        }
        if (this.resourceId !== null) {
            result.resourceId = this.resourceId;
        }
        return result;
    }
}

/**
 * Network/HTTP request timeout error.
 *
 * Thrown when an HTTP or network request times out before receiving a response.
 * Different from CommandTimeoutError which is for device command timeouts.
 * This indicates a network-level timeout that may be retryable.
 *
 * @class
 * @extends MerossError
 * @property {number|null} timeout - Timeout duration in milliseconds
 * @property {string|null} url - URL or endpoint that timed out
 */
class MerossErrorNetworkTimeout extends MerossError {
    constructor(message, timeout = null, url = null, options = {}) {
        super(message || 'Network request timeout', null, {
            code: 'NETWORK_TIMEOUT',
            isOperational: true,
            ...options
        });
        this.timeout = timeout;
        this.url = url;
    }

    toJSON() {
        const result = super.toJSON();
        if (this.timeout !== null) {
            result.timeout = this.timeout;
        }
        if (this.url !== null) {
            result.url = this.url;
        }
        return result;
    }
}

/**
 * Parse/serialization error.
 *
 * Thrown when data parsing fails (e.g., JSON parsing, protocol parsing).
 * Indicates data corruption, protocol mismatch, or malformed data that cannot
 * be processed.
 *
 * @class
 * @extends MerossError
 * @property {any|null} data - The data that failed to parse
 * @property {string|null} format - The expected format (e.g., 'json', 'xml')
 */
class MerossErrorParse extends MerossError {
    constructor(message, data = null, format = null, options = {}) {
        super(message || 'Parse error', null, {
            code: 'PARSE_ERROR',
            isOperational: false,
            ...options
        });
        this.data = data;
        this.format = format;
    }

    toJSON() {
        const result = super.toJSON();
        if (this.format !== null) {
            result.format = this.format;
        }
        return result;
    }
}

/**
 * Rate limit error (error code 1028).
 *
 * Thrown when requests are made too frequently. Different from ApiLimitReachedError
 * (1042) which indicates the API top limit has been reached. This error indicates
 * rate limiting at a per-request level.
 *
 * @class
 * @extends MerossError
 * @property {number} errorCode - Always 1028
 */
class MerossErrorRateLimit extends MerossError {
    constructor(message, options = {}) {
        super(message || 'Requested too frequently', 1028, {
            code: 'RATE_LIMIT',
            isOperational: true,
            ...options
        });
    }
}

/**
 * Operation locked error (error code 1035).
 *
 * Thrown when an operation is locked and cannot be performed at this time.
 * The operation may become available after a delay or when the lock is released.
 *
 * @class
 * @extends MerossError
 * @property {number} errorCode - Always 1035
 */
class MerossErrorOperationLocked extends MerossError {
    constructor(message, options = {}) {
        super(message || 'Operation is locked', 1035, {
            code: 'OPERATION_LOCKED',
            isOperational: true,
            ...options
        });
    }
}

/**
 * Unsupported operation error (error code 20112).
 *
 * Thrown when an operation is not supported by the device, API, or current
 * configuration. Indicates the requested functionality is not available.
 *
 * @class
 * @extends MerossError
 * @property {number} errorCode - Always 20112
 * @property {string|null} operation - The operation that is unsupported
 * @property {string|null} reason - Reason why the operation is unsupported
 */
class MerossErrorUnsupported extends MerossError {
    constructor(message, operation = null, reason = null, options = {}) {
        super(message || 'Unsupported operation', 20112, {
            code: 'UNSUPPORTED',
            isOperational: false,
            ...options
        });
        this.operation = operation;
        this.reason = reason;
    }

    toJSON() {
        const result = super.toJSON();
        if (this.operation !== null) {
            result.operation = this.operation;
        }
        if (this.reason !== null) {
            result.reason = this.reason;
        }
        return result;
    }
}

/**
 * Initialization error.
 *
 * Thrown when device or component initialization fails. This may occur due to
 * network issues, missing dependencies, or configuration problems. May be
 * retryable in some cases.
 *
 * @class
 * @extends MerossError
 * @property {string|null} component - The component that failed to initialize
 * @property {string|null} reason - Reason for initialization failure
 */
class MerossErrorInitialization extends MerossError {
    constructor(message, component = null, reason = null, options = {}) {
        super(message || 'Initialization failed', null, {
            code: 'INITIALIZATION_FAILED',
            isOperational: true,
            ...options
        });
        this.component = component;
        this.reason = reason;
    }

    toJSON() {
        const result = super.toJSON();
        if (this.component !== null) {
            result.component = this.component;
        }
        if (this.reason !== null) {
            result.reason = this.reason;
        }
        return result;
    }
}

/**
 * Handles token-related error codes.
 *
 * Maps token expiration and token limit error codes to appropriate error
 * classes. Token errors indicate authentication token issues that require
 * re-authentication or token management.
 *
 * @private
 * @param {number} errorCode - The error code
 * @param {string} message - Error message
 * @returns {MerossError|null} Error instance or null if not a token error
 */
function _handleTokenErrors(errorCode, message, options = {}) {
    const { MerossErrorTokenExpired, MerossErrorTooManyTokens } = require('./http/exception');

    if (errorCode === 1019 || errorCode === 1022 || errorCode === 1200) {
        return new MerossErrorTokenExpired(message, errorCode, options);
    }
    if (errorCode === 1301) {
        return new MerossErrorTooManyTokens(message, options);
    }
    return null;
}

/**
 * Handles authentication error codes (1000-1008).
 *
 * Maps authentication error codes to AuthenticationError instances. These
 * errors indicate login failures due to invalid credentials or account issues.
 *
 * @private
 * @param {number} errorCode - The error code
 * @param {string} message - Error message
 * @returns {MerossError|null} Error instance or null if not an auth error
 */
function _handleAuthenticationErrors(errorCode, message, options = {}) {
    if (errorCode >= 1000 && errorCode <= 1008) {
        return new MerossErrorAuthentication(message, errorCode, options);
    }
    return null;
}

/**
 * Handles MFA-related error codes.
 *
 * Maps multi-factor authentication error codes to appropriate error classes.
 * MFA errors indicate issues with two-factor authentication during login.
 *
 * @private
 * @param {number} errorCode - The error code
 * @param {string} message - Error message
 * @returns {MerossError|null} Error instance or null if not an MFA error
 */
function _handleMFAErrors(errorCode, message, options = {}) {
    const { MerossErrorMFARequired, MerossErrorWrongMFA } = require('./http/exception');

    if (errorCode === 1032) {
        return new MerossErrorWrongMFA(message, options);
    }
    if (errorCode === 1033) {
        return new MerossErrorMFARequired(message, options);
    }
    return null;
}

/**
 * Handles domain and API limit/access error codes.
 *
 * Maps domain configuration errors and API limit/access errors to appropriate
 * error classes. Domain errors indicate incorrect API/MQTT domain configuration,
 * while limit errors indicate rate limiting or permission issues.
 *
 * @private
 * @param {number} errorCode - The error code
 * @param {string} message - Error message
 * @param {Object} context - Additional context
 * @returns {MerossError|null} Error instance or null if not a domain/limit error
 */
function _handleDomainAndLimitErrors(errorCode, message, context, options = {}) {
    const { MerossErrorBadDomain } = require('./http/exception');

    if (errorCode === 1030) {
        return new MerossErrorBadDomain(message, context.apiDomain, context.mqttDomain, options);
    }
    if (errorCode === 1042) {
        return new MerossErrorApiLimitReached(message, options);
    }
    if (errorCode === 1043) {
        return new MerossErrorResourceAccessDenied(message, options);
    }
    return null;
}

/**
 * Handles rate limit and operation locked error codes.
 *
 * Maps rate limiting (1028) and operation locked (1035) error codes to
 * appropriate error classes. These errors indicate temporary restrictions
 * that may be retryable after a delay.
 *
 * @private
 * @param {number} errorCode - The error code
 * @param {string} message - Error message
 * @returns {MerossError|null} Error instance or null if not a rate limit/locked error
 */
function _handleRateLimitAndLockedErrors(errorCode, message, options = {}) {
    if (errorCode === 1028) {
        return new MerossErrorRateLimit(message, options);
    }
    if (errorCode === 1035) {
        return new MerossErrorOperationLocked(message, options);
    }
    return null;
}

/**
 * Handles validation and resource error codes.
 *
 * Maps validation (20101), not found (20106), and unsupported (20112) error
 * codes to appropriate error classes. These errors indicate client-side issues
 * with requests or resource availability.
 *
 * @private
 * @param {number} errorCode - The error code
 * @param {string} message - Error message
 * @param {Object} context - Additional context
 * @returns {MerossError|null} Error instance or null if not a validation/resource error
 */
function _handleValidationAndResourceErrors(errorCode, message, context, options = {}) {
    if (errorCode === 20101) {
        return new MerossErrorValidation(message, context.field || null, options);
    }
    if (errorCode === 20106) {
        return new MerossErrorNotFound(message, context.resourceType || null, context.resourceId || null, options);
    }
    if (errorCode === 20112) {
        return new MerossErrorUnsupported(message, context.operation || null, context.reason || null, options);
    }
    return null;
}

/**
 * Handles HTTP status code-based errors.
 *
 * Maps HTTP status codes to appropriate error classes. HTTP errors indicate
 * server-side issues or authentication problems at the HTTP protocol level.
 *
 * @private
 * @param {number} httpStatusCode - HTTP status code
 * @param {number} errorCode - The API error code
 * @param {string} message - Error message
 * @returns {MerossError|null} Error instance or null if not an HTTP error
 */
function _handleHttpStatusErrors(httpStatusCode, errorCode, message, options = {}) {
    const { MerossErrorHttpApi, MerossErrorUnauthorized } = require('./http/exception');

    if (httpStatusCode === 401) {
        return new MerossErrorUnauthorized(message, errorCode, httpStatusCode, options);
    }
    if (httpStatusCode && httpStatusCode >= 400) {
        return new MerossErrorHttpApi(message, errorCode, httpStatusCode, options);
    }
    return null;
}

/**
 * Maps error codes to appropriate error classes.
 *
 * Converts API error codes into specific error class instances based on the
 * error code value and context. Provides consistent error handling by mapping
 * numeric codes to typed error objects with appropriate properties. This
 * centralizes error handling logic and ensures all errors are properly typed.
 *
 * @param {number} errorCode - The error code from API response
 * @param {Object} [context={}] - Additional context
 * @param {string} [context.info] - Error message from API
 * @param {string} [context.deviceUuid] - Device UUID (for device-related errors)
 * @param {number} [context.httpStatusCode] - HTTP status code
 * @param {string} [context.apiDomain] - API domain (for BadDomainError)
 * @param {string} [context.mqttDomain] - MQTT domain (for BadDomainError)
 * @returns {MerossError} Appropriate error instance
 */
function mapErrorCodeToError(errorCode, context = {}) {
    const { info, httpStatusCode, ...options } = context;
    const { getErrorMessage } = require('./http/error-codes');
    const message = info || getErrorMessage(errorCode);

    // Check token-related errors
    const tokenError = _handleTokenErrors(errorCode, message, options);
    if (tokenError) {
        return tokenError;
    }

    // Check authentication errors
    const authError = _handleAuthenticationErrors(errorCode, message, options);
    if (authError) {
        return authError;
    }

    // Check MFA errors
    const mfaError = _handleMFAErrors(errorCode, message, options);
    if (mfaError) {
        return mfaError;
    }

    // Check domain and API limit errors
    const domainError = _handleDomainAndLimitErrors(errorCode, message, context, options);
    if (domainError) {
        return domainError;
    }

    // Check rate limit and operation locked errors
    const rateLimitError = _handleRateLimitAndLockedErrors(errorCode, message, options);
    if (rateLimitError) {
        return rateLimitError;
    }

    // Check validation and resource errors
    const validationError = _handleValidationAndResourceErrors(errorCode, message, context, options);
    if (validationError) {
        return validationError;
    }

    // Check HTTP status code errors
    const httpError = _handleHttpStatusErrors(httpStatusCode, errorCode, message, options);
    if (httpError) {
        return httpError;
    }

    // Default: return generic MerossError
    return new MerossError(`${errorCode} (${getErrorMessage(errorCode)})${info ? ` - ${info}` : ''}`, errorCode, options);
}

module.exports = {
    MerossError,
    MerossErrorAuthentication,
    MerossErrorApiLimitReached,
    MerossErrorResourceAccessDenied,
    MerossErrorCommandTimeout,
    MerossErrorCommand,
    MerossErrorMqtt,
    MerossErrorUnconnected,
    MerossErrorUnknownDeviceType,
    MerossErrorValidation,
    MerossErrorNotFound,
    MerossErrorNetworkTimeout,
    MerossErrorParse,
    MerossErrorRateLimit,
    MerossErrorOperationLocked,
    MerossErrorUnsupported,
    MerossErrorInitialization,
    mapErrorCodeToError
};
