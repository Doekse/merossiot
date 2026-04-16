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
 * Base class for authentication category failures.
 *
 * This groups credential, token, MFA, and unauthorized errors under one
 * `instanceof` boundary while preserving specific handling through `code`.
 *
 * @class
 * @extends MerossError
 * @property {string} code - Fine-grained auth error discriminator
 */
class MerossAuthError extends MerossError {
    constructor(message, code, properties = {}) {
        const { errorCode = null, ...errorProperties } = properties;
        super(message || 'Authentication failed', errorCode, { code });
        Object.assign(this, errorProperties);
    }
}

/**
 * Base class for device and feature interaction failures.
 *
 * This groups command, validation, and initialization failures raised by device
 * operations while retaining exact handling through `code`.
 *
 * @class
 * @extends MerossError
 * @property {string} code - Fine-grained device error discriminator
 */
class MerossDeviceError extends MerossError {
    constructor(message, code, properties = {}) {
        const { errorCode = null, ...errorProperties } = properties;
        super(message || 'Device operation failed', errorCode, { code });
        Object.assign(this, errorProperties);
    }
}

/**
 * Base class for cloud API and HTTP-level failures.
 *
 * This groups API response and HTTP transport failures so callers can catch a
 * broad API category while still switching on `code`.
 *
 * @class
 * @extends MerossError
 * @property {string} code - Fine-grained API error discriminator
 */
class MerossApiError extends MerossError {
    constructor(message, code, properties = {}) {
        const { errorCode = null, ...errorProperties } = properties;
        super(message || 'API operation failed', errorCode, { code });
        Object.assign(this, errorProperties);
    }
}

/**
 * Base class for network and protocol failures.
 *
 * This groups MQTT, timeout, and parse failures where retry or fallback logic
 * commonly shares the same control flow.
 *
 * @class
 * @extends MerossError
 * @property {string} code - Fine-grained network error discriminator
 */
class MerossNetworkError extends MerossError {
    constructor(message, code, properties = {}) {
        const { errorCode = null, ...errorProperties } = properties;
        super(message || 'Network operation failed', errorCode, { code });
        Object.assign(this, errorProperties);
    }
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
    const properties = { ...context, errorCode };
    delete properties.info;
    delete properties.httpStatusCode;

    if (httpStatusCode === 401) {
        return new MerossAuthError(message, 'UNAUTHORIZED', {
            ...properties,
            httpStatusCode
        });
    }
    if (httpStatusCode && httpStatusCode >= 400) {
        return new MerossApiError(message, 'HTTP_API_ERROR', {
            ...properties,
            httpStatusCode
        });
    }

    if (errorCode === 1019 || errorCode === 1022 || errorCode === 1200) {
        return new MerossAuthError(message, 'TOKEN_EXPIRED', properties);
    }
    if (errorCode === 1301) {
        return new MerossAuthError(message, 'TOO_MANY_TOKENS', properties);
    }
    if (errorCode >= 1000 && errorCode <= 1008) {
        return new MerossAuthError(message, 'AUTHENTICATION', properties);
    }
    if (errorCode === 1032) {
        return new MerossAuthError(message, 'MFA_WRONG', properties);
    }
    if (errorCode === 1033) {
        return new MerossAuthError(message, 'MFA_REQUIRED', properties);
    }

    if (errorCode === 1030) {
        return new MerossApiError(message, 'BAD_DOMAIN', {
            ...properties,
            apiDomain: context.apiDomain || null,
            mqttDomain: context.mqttDomain || null
        });
    }
    if (errorCode === 1042) {
        return new MerossApiError(message, 'API_LIMIT_REACHED', properties);
    }
    if (errorCode === 1043) {
        return new MerossApiError(message, 'RESOURCE_ACCESS_DENIED', properties);
    }
    if (errorCode === 1028) {
        return new MerossApiError(message, 'RATE_LIMIT', properties);
    }
    if (errorCode === 1035) {
        return new MerossApiError(message, 'OPERATION_LOCKED', properties);
    }

    if (errorCode === 20101) {
        return new MerossDeviceError(message, 'VALIDATION_ERROR', {
            ...properties,
            field: context.field || null
        });
    }
    if (errorCode === 20106) {
        return new MerossDeviceError(message, 'NOT_FOUND', {
            ...properties,
            resourceType: context.resourceType || null,
            resourceId: context.resourceId || null
        });
    }
    if (errorCode === 20112) {
        return new MerossDeviceError(message, 'UNSUPPORTED', {
            ...properties,
            operation: context.operation || null,
            reason: context.reason || null
        });
    }

    return new MerossError(
        message || `Meross error code ${errorCode}`,
        errorCode
    );
}

module.exports = {
    MerossError,
    MerossAuthError,
    MerossDeviceError,
    MerossApiError,
    MerossNetworkError,
    mapErrorCodeToError
};
