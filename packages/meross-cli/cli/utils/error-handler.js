'use strict';

const chalk = require('chalk');
const ManagerMeross = require('meross-iot');

/**
 * Formats error messages for display in the CLI.
 *
 * Provides user-friendly error messages based on error type, with specific
 * guidance for common error scenarios like MFA, authentication, and command failures.
 *
 * @param {Error} error - The error to format
 * @param {boolean} verbose - Whether to show detailed error information
 * @returns {string} Formatted error message
 */
function formatError(error, verbose = false) {
    if (error instanceof ManagerMeross.MerossErrorMFARequired) {
        return chalk.red('\n✗ MFA (Multi-Factor Authentication) is required.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`) +
            chalk.yellow('  Please provide MFA code using --mfa-code option or set MEROSS_MFA_CODE environment variable.\n');
    }

    if (error instanceof ManagerMeross.MerossErrorWrongMFA) {
        return chalk.red('\n✗ MFA code is incorrect.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`) +
            chalk.yellow('  Please check your MFA code and try again.\n');
    }

    if (error instanceof ManagerMeross.MerossErrorAuthentication) {
        return chalk.red('\n✗ Authentication failed.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`) +
            chalk.yellow('  Please check your email and password.\n');
    }

    if (error instanceof ManagerMeross.MerossErrorTokenExpired) {
        return chalk.yellow('\n⚠ Authentication token has expired.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`) +
            chalk.dim('  The library will automatically attempt to login again.\n');
    }

    if (error instanceof ManagerMeross.MerossErrorBadDomain) {
        return chalk.yellow('\n⚠ Bad domain error.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`) +
            chalk.dim('  The API domain may be incorrect. Auto-retry is enabled.\n');
    }

    if (error instanceof ManagerMeross.MerossErrorCommand) {
        let message = chalk.red('\n✗ Device command failed.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`);
        if (error.deviceUuid) {
            message += chalk.dim(`  Device: ${error.deviceUuid}\n`);
        }
        if (error.errorPayload) {
            message += chalk.dim(`  Device Response: ${JSON.stringify(error.errorPayload, null, 2)}\n`);
        }
        return message;
    }

    if (error instanceof ManagerMeross.MerossErrorCommandTimeout) {
        let message = chalk.yellow('\n⚠ Command timeout.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`);
        if (error.deviceUuid) {
            message += chalk.dim(`  Device: ${error.deviceUuid}\n`);
        }
        if (error.timeout) {
            message += chalk.dim(`  Timeout: ${error.timeout}ms\n`);
        }
        message += chalk.dim('  The device may be offline or experiencing network issues.\n');
        return message;
    }

    if (error instanceof ManagerMeross.MerossErrorMqtt) {
        let message = chalk.red('\n✗ MQTT error.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`);
        if (error.topic) {
            message += chalk.dim(`  Topic: ${error.topic}\n`);
        }
        return message;
    }

    if (error instanceof ManagerMeross.MerossErrorUnauthorized) {
        return chalk.red('\n✗ Unauthorized access.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`) +
            chalk.dim(`  HTTP Status: ${error.httpStatusCode || 401}\n`) +
            chalk.yellow('  Authentication token may be invalid or expired.\n');
    }

    if (error instanceof ManagerMeross.MerossErrorHttpApi) {
        let message = chalk.red('\n✗ HTTP API error.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`);
        if (error.httpStatusCode) {
            message += chalk.dim(`  HTTP Status: ${error.httpStatusCode}\n`);
        }
        if (error.cause && verbose) {
            message += chalk.dim(`  Caused by: ${error.cause.message}\n`);
        }
        return message;
    }

    if (error instanceof ManagerMeross.MerossErrorApiLimitReached) {
        return chalk.yellow('\n⚠ API rate limit reached.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`) +
            chalk.dim('  Please wait before making more requests.\n');
    }

    if (error instanceof ManagerMeross.MerossErrorResourceAccessDenied) {
        return chalk.red('\n✗ Resource access denied.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`) +
            chalk.yellow('  You may not have permission to access this resource.\n');
    }

    if (error instanceof ManagerMeross.MerossErrorUnconnected) {
        return chalk.yellow('\n⚠ Device is not connected.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`) +
            chalk.dim('  Please wait for the device to connect before sending commands.\n');
    }

    if (error instanceof ManagerMeross.MerossErrorValidation) {
        let message = chalk.red('\n✗ Validation error.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`);
        if (error.field) {
            message += chalk.dim(`  Field: ${error.field}\n`);
        }
        return message;
    }

    if (error instanceof ManagerMeross.MerossErrorNotFound) {
        let message = chalk.red('\n✗ Resource not found.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`);
        if (error.resourceType) {
            message += chalk.dim(`  Type: ${error.resourceType}\n`);
        }
        if (error.resourceId) {
            message += chalk.dim(`  ID: ${error.resourceId}\n`);
        }
        return message;
    }

    if (error instanceof ManagerMeross.MerossErrorTooManyTokens) {
        return chalk.red('\n✗ Too many authentication tokens.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`) +
            chalk.yellow('  You have issued too many tokens without logging out. Please log out from other sessions.\n');
    }

    if (error instanceof ManagerMeross.MerossErrorRateLimit) {
        return chalk.yellow('\n⚠ Request rate limit exceeded.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`) +
            chalk.dim('  Please wait before making more requests.\n');
    }

    if (error instanceof ManagerMeross.MerossErrorOperationLocked) {
        return chalk.yellow('\n⚠ Operation is locked.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`) +
            chalk.dim('  The operation may become available after a delay.\n');
    }

    if (error instanceof ManagerMeross.MerossErrorUnsupported) {
        let message = chalk.red('\n✗ Unsupported operation.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`);
        if (error.operation) {
            message += chalk.dim(`  Operation: ${error.operation}\n`);
        }
        if (error.reason) {
            message += chalk.dim(`  Reason: ${error.reason}\n`);
        }
        return message;
    }

    if (error instanceof ManagerMeross.MerossErrorInitialization) {
        let message = chalk.red('\n✗ Initialization failed.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`);
        if (error.component) {
            message += chalk.dim(`  Component: ${error.component}\n`);
        }
        if (error.reason) {
            message += chalk.dim(`  Reason: ${error.reason}\n`);
        }
        return message;
    }

    if (error instanceof ManagerMeross.MerossErrorNetworkTimeout) {
        let message = chalk.yellow('\n⚠ Network request timeout.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`);
        if (error.timeout) {
            message += chalk.dim(`  Timeout: ${error.timeout}ms\n`);
        }
        if (error.url) {
            message += chalk.dim(`  URL: ${error.url}\n`);
        }
        return message;
    }

    if (error instanceof ManagerMeross.MerossErrorParse) {
        let message = chalk.red('\n✗ Parse error.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`);
        if (error.format) {
            message += chalk.dim(`  Format: ${error.format}\n`);
        }
        return message;
    }

    if (error instanceof ManagerMeross.MerossErrorUnknownDeviceType) {
        let message = chalk.red('\n✗ Unknown or unsupported device type.\n') +
            chalk.dim(`  Error Code: ${error.code}\n`);
        if (error.deviceType) {
            message += chalk.dim(`  Device Type: ${error.deviceType}\n`);
        }
        return message;
    }

    if (error instanceof ManagerMeross.MerossError) {
        let message = chalk.red(`\n✗ ${error.message}\n`);
        if (error.code) {
            message += chalk.dim(`  Error Code: ${error.code}\n`);
        }
        if (error.errorCode !== null && error.errorCode !== undefined) {
            message += chalk.dim(`  API Error Code: ${error.errorCode}\n`);
        }
        return message;
    }

    // Generic error fallback
    return chalk.red(`\n✗ ${error.message}\n`);
}

/**
 * Handles and displays errors with appropriate formatting.
 *
 * Formats the error message and optionally displays the stack trace
 * if verbose mode is enabled.
 *
 * @param {Error} error - The error to handle
 * @param {Object} options - Options for error handling
 * @param {boolean} [options.verbose=false] - Whether to show stack trace
 * @param {boolean} [options.exit=false] - Whether to exit the process after displaying error
 * @param {number} [options.exitCode=1] - Exit code to use if exiting
 */
function handleError(error, options = {}) {
    const { verbose = false, exit = false, exitCode = 1 } = options;

    const formattedMessage = formatError(error, verbose);
    console.error(formattedMessage);

    if (verbose && error.stack) {
        console.error(chalk.dim('\nStack trace:'));
        console.error(chalk.dim(error.stack));
    }

    if (exit) {
        process.exit(exitCode);
    }
}

module.exports = {
    formatError,
    handleError
};
