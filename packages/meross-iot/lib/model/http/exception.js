'use strict';

const { MerossError, MerossErrorAuthentication } = require('../exception');

/**
 * Base class for HTTP API errors
 *
 * Extends MerossError with HTTP status code information to distinguish between
 * different types of HTTP failures (client errors, server errors, etc.).
 *
 * @class
 * @extends MerossError
 * @property {number|null} httpStatusCode - HTTP status code (e.g., 400, 500)
 */
class MerossErrorHttpApi extends MerossError {
    constructor(message, errorCode = null, httpStatusCode = null, options = {}) {
        super(message || 'HTTP API error occurred', errorCode, {
            code: 'HTTP_API_ERROR',
            isOperational: true,
            ...options
        });
        this.httpStatusCode = httpStatusCode;
    }

    toJSON() {
        const result = super.toJSON();
        if (this.httpStatusCode !== null) {
            result.httpStatusCode = this.httpStatusCode;
        }
        return result;
    }
}

/**
 * Unauthorized access error (HTTP 401 or similar)
 *
 * Thrown when an API request is made without proper authentication or with invalid
 * credentials. Typically indicates token expiration or an invalid token that
 * cannot be used for authorization.
 *
 * @class
 * @extends MerossErrorHttpApi
 * @property {number} httpStatusCode - HTTP status code (typically 401)
 */
class MerossErrorUnauthorized extends MerossErrorHttpApi {
    constructor(message, errorCode = null, httpStatusCode = 401, options = {}) {
        super(message || 'Unauthorized access', errorCode, httpStatusCode, {
            code: 'UNAUTHORIZED',
            isOperational: true,
            ...options
        });
    }
}

/**
 * Bad domain / region redirect error (error code 1030)
 *
 * Thrown when Meross API redirects to a different regional domain. This occurs
 * when the account is registered in a different region than the one being used
 * for API requests. The error response includes the correct regional endpoints
 * that should be used for subsequent requests.
 *
 * @class
 * @extends MerossError
 * @property {number} errorCode - Always 1030
 * @property {string|null} apiDomain - The correct API domain for this account
 * @property {string|null} mqttDomain - The correct MQTT domain for this account
 */
class MerossErrorBadDomain extends MerossError {
    constructor(message, apiDomain = null, mqttDomain = null, options = {}) {
        super(message || 'Redirect app to login other than this region', 1030, {
            code: 'BAD_DOMAIN',
            isOperational: true,
            ...options
        });
        this.apiDomain = apiDomain;
        this.mqttDomain = mqttDomain;
    }

    toJSON() {
        const result = super.toJSON();
        if (this.apiDomain !== null) {
            result.apiDomain = this.apiDomain;
        }
        if (this.mqttDomain !== null) {
            result.mqttDomain = this.mqttDomain;
        }
        return result;
    }
}

/**
 * Token expired or invalid errors (error codes 1019, 1022, 1200)
 *
 * Thrown when the authentication token has expired or is invalid. Tokens
 * expire after a period of inactivity or when explicitly invalidated by the
 * authentication service.
 *
 * @class
 * @extends MerossError
 * @property {number} errorCode - API error code (1019, 1022, or 1200)
 */
class MerossErrorTokenExpired extends MerossError {
    constructor(message, errorCode, options = {}) {
        super(message || 'Token has expired or is invalid', errorCode, {
            code: 'TOKEN_EXPIRED',
            isOperational: true,
            ...options
        });
    }
}

/**
 * Too many tokens error (error code 1301)
 *
 * Thrown when too many authentication tokens have been issued without logging out.
 * Meross enforces a limit on concurrent sessions per account, and exceeding this
 * limit results in account-level restrictions until tokens are revoked.
 *
 * @class
 * @extends MerossError
 * @property {number} errorCode - Always 1301
 */
class MerossErrorTooManyTokens extends MerossError {
    constructor(message, options = {}) {
        super(message || 'You have issued too many tokens without logging out and your account might have been temporarily disabled.', 1301, {
            code: 'TOO_MANY_TOKENS',
            isOperational: true,
            ...options
        });
    }
}

/**
 * MFA code required error (error code 1033)
 *
 * Thrown when MFA (Multi-Factor Authentication) is enabled for the account but
 * no MFA code was provided during login. The login process requires an additional
 * authentication step that was not completed.
 *
 * @class
 * @extends MerossErrorAuthentication
 * @property {number} errorCode - Always 1033
 */
class MerossErrorMFARequired extends MerossErrorAuthentication {
    constructor(message, options = {}) {
        super(message || 'MFA is activated for the account but MFA code not provided. Please provide a current MFA code.', 1033, {
            code: 'MFA_REQUIRED',
            isOperational: true,
            ...options
        });
    }
}

/**
 * Alias for MerossErrorMFARequired
 *
 * Provided for clearer naming in contexts where
 * the error represents a missing MFA code rather than a general MFA requirement.
 *
 * @class
 * @extends MerossErrorMFARequired
 */
class MerossErrorMissingMFA extends MerossErrorMFARequired {
    constructor(message, options = {}) {
        super(message, {
            code: 'MFA_MISSING',
            ...options
        });
    }
}

/**
 * Wrong MFA code error (error code 1032)
 *
 * Thrown when an invalid or expired MFA code is provided during login.
 * The code provided does not match the current valid code from the
 * authenticator application.
 *
 * @class
 * @extends MerossErrorAuthentication
 * @property {number} errorCode - Always 1032
 */
class MerossErrorWrongMFA extends MerossErrorAuthentication {
    constructor(message, options = {}) {
        super(message || 'Invalid MFA code. Please use a current MFA code.', 1032, {
            code: 'MFA_WRONG',
            isOperational: true,
            ...options
        });
    }
}

module.exports = {
    MerossErrorHttpApi,
    MerossErrorUnauthorized,
    MerossErrorBadDomain,
    MerossErrorTokenExpired,
    MerossErrorTooManyTokens,
    MerossErrorMFARequired,
    MerossErrorMissingMFA,
    MerossErrorWrongMFA
};

