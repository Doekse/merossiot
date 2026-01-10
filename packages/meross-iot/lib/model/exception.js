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
 * @property {number|null} errorCode - API error code (if available)
 */
class MerossError extends Error {
    constructor(message, errorCode = null) {
        super(message);
        this.name = this.constructor.name;
        this.errorCode = errorCode;
        Error.captureStackTrace(this, this.constructor);
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
class AuthenticationError extends MerossError {
    constructor(message, errorCode) {
        super(message || 'Authentication failed', errorCode);
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
class ApiLimitReachedError extends MerossError {
    constructor(message) {
        super(message || 'API top limit reached', 1042);
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
class ResourceAccessDeniedError extends MerossError {
    constructor(message) {
        super(message || 'Resource access deny', 1043);
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
class CommandTimeoutError extends MerossError {
    constructor(message, deviceUuid = null, timeout = null, command = null) {
        super(message || 'Command timeout occurred');
        this.deviceUuid = deviceUuid;
        this.timeout = timeout;
        this.command = command;
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
class CommandError extends MerossError {
    constructor(message, errorPayload = null, deviceUuid = null) {
        super(message || 'Device command failed');
        this.errorPayload = errorPayload;
        this.deviceUuid = deviceUuid;
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
class MqttError extends MerossError {
    constructor(message, topic = null, mqttMessage = null) {
        super(message || 'MQTT error occurred');
        this.topic = topic;
        this.mqttMessage = mqttMessage;
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
class UnconnectedError extends MerossError {
    constructor(message, deviceUuid = null) {
        super(message || 'Device is not connected');
        this.deviceUuid = deviceUuid;
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
class UnknownDeviceTypeError extends MerossError {
    constructor(message, deviceType = null) {
        super(message || 'Unknown or unsupported device type');
        this.deviceType = deviceType;
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
function _handleTokenErrors(errorCode, message) {
    const { TokenExpiredError, TooManyTokensError } = require('./http/exception');

    if (errorCode === 1019 || errorCode === 1022 || errorCode === 1200) {
        return new TokenExpiredError(message, errorCode);
    }
    if (errorCode === 1301) {
        return new TooManyTokensError(message);
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
function _handleAuthenticationErrors(errorCode, message) {
    if (errorCode >= 1000 && errorCode <= 1008) {
        return new AuthenticationError(message, errorCode);
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
function _handleMFAErrors(errorCode, message) {
    const { MFARequiredError, WrongMFAError } = require('./http/exception');

    if (errorCode === 1032) {
        return new WrongMFAError(message);
    }
    if (errorCode === 1033) {
        return new MFARequiredError(message);
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
function _handleDomainAndLimitErrors(errorCode, message, context) {
    const { BadDomainError } = require('./http/exception');

    if (errorCode === 1030) {
        return new BadDomainError(message, context.apiDomain, context.mqttDomain);
    }
    if (errorCode === 1042) {
        return new ApiLimitReachedError(message);
    }
    if (errorCode === 1043) {
        return new ResourceAccessDeniedError(message);
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
function _handleHttpStatusErrors(httpStatusCode, errorCode, message) {
    const { HttpApiError, UnauthorizedError } = require('./http/exception');

    if (httpStatusCode === 401) {
        return new UnauthorizedError(message, errorCode, httpStatusCode);
    }
    if (httpStatusCode && httpStatusCode >= 400) {
        return new HttpApiError(message, errorCode, httpStatusCode);
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
    const { info, httpStatusCode } = context;
    const { getErrorMessage } = require('./http/error-codes');
    const message = info || getErrorMessage(errorCode);

    // Check token-related errors
    const tokenError = _handleTokenErrors(errorCode, message);
    if (tokenError) {
        return tokenError;
    }

    // Check authentication errors
    const authError = _handleAuthenticationErrors(errorCode, message);
    if (authError) {
        return authError;
    }

    // Check MFA errors
    const mfaError = _handleMFAErrors(errorCode, message);
    if (mfaError) {
        return mfaError;
    }

    // Check domain and API limit errors
    const domainError = _handleDomainAndLimitErrors(errorCode, message, context);
    if (domainError) {
        return domainError;
    }

    // Check HTTP status code errors
    const httpError = _handleHttpStatusErrors(httpStatusCode, errorCode, message);
    if (httpError) {
        return httpError;
    }

    // Default: return generic MerossError
    return new MerossError(`${errorCode} (${getErrorMessage(errorCode)})${info ? ` - ${info}` : ''}`, errorCode);
}

module.exports = {
    MerossError,
    AuthenticationError,
    ApiLimitReachedError,
    ResourceAccessDeniedError,
    CommandTimeoutError,
    CommandError,
    MqttError,
    UnconnectedError,
    UnknownDeviceTypeError,
    mapErrorCodeToError
};
