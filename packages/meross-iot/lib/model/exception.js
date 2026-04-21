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
 * Exact `errorCode` → typed error mapping. Optional `pick` lists context keys
 * merged with `|| null` so omitted values stay serializable like the legacy branches.
 *
 * @type {Map<number, { ErrorClass: typeof MerossAuthError | typeof MerossApiError | typeof MerossDeviceError, code: string, pick?: string[] }>}
 */
const ERROR_CODE_MAP = new Map([
    [1019, { ErrorClass: MerossAuthError, code: 'TOKEN_EXPIRED' }],
    [1022, { ErrorClass: MerossAuthError, code: 'TOKEN_EXPIRED' }],
    [1200, { ErrorClass: MerossAuthError, code: 'TOKEN_EXPIRED' }],
    [1301, { ErrorClass: MerossAuthError, code: 'TOO_MANY_TOKENS' }],
    [1032, { ErrorClass: MerossAuthError, code: 'MFA_WRONG' }],
    [1033, { ErrorClass: MerossAuthError, code: 'MFA_REQUIRED' }],
    [1030, { ErrorClass: MerossApiError, code: 'BAD_DOMAIN', pick: ['apiDomain', 'mqttDomain'] }],
    [1042, { ErrorClass: MerossApiError, code: 'API_LIMIT_REACHED' }],
    [1043, { ErrorClass: MerossApiError, code: 'RESOURCE_ACCESS_DENIED' }],
    [1028, { ErrorClass: MerossApiError, code: 'RATE_LIMIT' }],
    [1035, { ErrorClass: MerossApiError, code: 'OPERATION_LOCKED' }],
    [20101, { ErrorClass: MerossDeviceError, code: 'VALIDATION_ERROR', pick: ['field'] }],
    [20106, { ErrorClass: MerossDeviceError, code: 'NOT_FOUND', pick: ['resourceType', 'resourceId'] }],
    [20112, { ErrorClass: MerossDeviceError, code: 'UNSUPPORTED', pick: ['operation', 'reason'] }]
]);

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
    const { getErrorMessage } = require('./http/error-codes');
    const { info, httpStatusCode } = context;
    const message = info || getErrorMessage(errorCode);
    const { info: _i, httpStatusCode: _h, ...rest } = context;
    const base = { ...rest, errorCode };

    if (httpStatusCode === 401) {
        return new MerossAuthError(message, 'UNAUTHORIZED', {
            ...base,
            httpStatusCode
        });
    }
    if (httpStatusCode && httpStatusCode >= 400) {
        return new MerossApiError(message, 'HTTP_API_ERROR', {
            ...base,
            httpStatusCode
        });
    }

    const entry = ERROR_CODE_MAP.get(errorCode);
    if (entry) {
        const extras = (entry.pick || []).reduce(
            (acc, key) => ({ ...acc, [key]: context[key] || null }),
            {}
        );
        return new entry.ErrorClass(message, entry.code, { ...base, ...extras });
    }

    if (errorCode >= 1000 && errorCode <= 1008) {
        return new MerossAuthError(message, 'AUTHENTICATION', base);
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
