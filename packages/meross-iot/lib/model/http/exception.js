'use strict';

const { MerossError, AuthenticationError } = require('../exception');

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
class HttpApiError extends MerossError {
    constructor(message, errorCode = null, httpStatusCode = null) {
        super(message || 'HTTP API error occurred', errorCode);
        this.httpStatusCode = httpStatusCode;
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
 * @extends HttpApiError
 * @property {number} httpStatusCode - HTTP status code (typically 401)
 */
class UnauthorizedError extends HttpApiError {
    constructor(message, errorCode = null, httpStatusCode = 401) {
        super(message || 'Unauthorized access', errorCode, httpStatusCode);
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
class BadDomainError extends MerossError {
    constructor(message, apiDomain = null, mqttDomain = null) {
        super(message || 'Redirect app to login other than this region', 1030);
        this.apiDomain = apiDomain;
        this.mqttDomain = mqttDomain;
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
class TokenExpiredError extends MerossError {
    constructor(message, errorCode) {
        super(message || 'Token has expired or is invalid', errorCode);
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
class TooManyTokensError extends MerossError {
    constructor(message) {
        super(message || 'You have issued too many tokens without logging out and your account might have been temporarily disabled.', 1301);
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
 * @extends AuthenticationError
 * @property {number} errorCode - Always 1033
 */
class MFARequiredError extends AuthenticationError {
    constructor(message) {
        super(message || 'MFA is activated for the account but MFA code not provided. Please provide a current MFA code.', 1033);
    }
}

/**
 * Alias for MFARequiredError
 *
 * Provided for backward compatibility and clearer naming in contexts where
 * the error represents a missing MFA code rather than a general MFA requirement.
 *
 * @class
 * @extends MFARequiredError
 */
class MissingMFAError extends MFARequiredError {
}

/**
 * Wrong MFA code error (error code 1032)
 *
 * Thrown when an invalid or expired MFA code is provided during login.
 * The code provided does not match the current valid code from the
 * authenticator application.
 *
 * @class
 * @extends AuthenticationError
 * @property {number} errorCode - Always 1032
 */
class WrongMFAError extends AuthenticationError {
    constructor(message) {
        super(message || 'Invalid MFA code. Please use a current MFA code.', 1032);
    }
}

module.exports = {
    HttpApiError,
    UnauthorizedError,
    BadDomainError,
    TokenExpiredError,
    TooManyTokensError,
    MFARequiredError,
    MissingMFAError,
    WrongMFAError
};

