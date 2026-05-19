'use strict';

const chalk = require('chalk');
const { MerossError } = require('meross-iot');

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
    if (error instanceof MerossError) {
        switch (error.code) {
        case 'MFA_REQUIRED':
            return chalk.red('\n✗ MFA (Multi-Factor Authentication) is required.\n') +
                    chalk.dim(`  Error Code: ${error.code}\n`) +
                    chalk.yellow('  Please provide MFA code using --mfa-code option or set MEROSS_MFA_CODE environment variable.\n');
        case 'MFA_WRONG':
            return chalk.red('\n✗ MFA code is incorrect.\n') +
                    chalk.dim(`  Error Code: ${error.code}\n`) +
                    chalk.yellow('  Please check your MFA code and try again.\n');
        case 'AUTHENTICATION':
        case 'TOKEN_EXPIRED':
        case 'TOO_MANY_TOKENS':
        case 'UNAUTHORIZED':
            return chalk.red('\n✗ Authentication failed.\n') +
                    chalk.dim(`  Error Code: ${error.code}\n`);
        case 'BAD_DOMAIN':
            return chalk.yellow('\n⚠ Bad domain error.\n') +
                    chalk.dim(`  Error Code: ${error.code}\n`);
        case 'COMMAND_FAILED':
            return chalk.red('\n✗ Device command failed.\n') +
                    chalk.dim(`  Error Code: ${error.code}\n`) +
                    (error.deviceUuid ? chalk.dim(`  Device: ${error.deviceUuid}\n`) : '');
        case 'COMMAND_TIMEOUT':
            return chalk.yellow('\n⚠ Command timeout.\n') +
                    chalk.dim(`  Error Code: ${error.code}\n`) +
                    (error.deviceUuid ? chalk.dim(`  Device: ${error.deviceUuid}\n`) : '') +
                    (error.timeout ? chalk.dim(`  Timeout: ${error.timeout}ms\n`) : '');
        case 'MQTT_ERROR':
            return chalk.red('\n✗ MQTT error.\n') +
                    chalk.dim(`  Error Code: ${error.code}\n`) +
                    (error.topic ? chalk.dim(`  Topic: ${error.topic}\n`) : '');
        case 'HTTP_API_ERROR':
            return chalk.red('\n✗ HTTP API error.\n') +
                    chalk.dim(`  Error Code: ${error.code}\n`) +
                    (error.httpStatusCode ? chalk.dim(`  HTTP Status: ${error.httpStatusCode}\n`) : '') +
                    (error.cause && verbose ? chalk.dim(`  Caused by: ${error.cause.message}\n`) : '');
        case 'API_LIMIT_REACHED':
        case 'RATE_LIMIT':
            return chalk.yellow('\n⚠ API rate limit reached.\n') +
                    chalk.dim(`  Error Code: ${error.code}\n`);
        case 'RESOURCE_ACCESS_DENIED':
            return chalk.red('\n✗ Resource access denied.\n') +
                    chalk.dim(`  Error Code: ${error.code}\n`);
        case 'VALIDATION_ERROR':
            return chalk.red('\n✗ Validation error.\n') +
                    chalk.dim(`  Error Code: ${error.code}\n`) +
                    (error.field ? chalk.dim(`  Field: ${error.field}\n`) : '');
        case 'NOT_FOUND':
            return chalk.red('\n✗ Resource not found.\n') +
                    chalk.dim(`  Error Code: ${error.code}\n`);
        case 'UNSUPPORTED':
        case 'UNKNOWN_DEVICE_TYPE':
        case 'INITIALIZATION_FAILED':
            return chalk.red(`\n✗ ${error.message}\n`) +
                    chalk.dim(`  Error Code: ${error.code}\n`);
        case 'NETWORK_TIMEOUT':
            return chalk.yellow('\n⚠ Network request timeout.\n') +
                    chalk.dim(`  Error Code: ${error.code}\n`) +
                    (error.timeout ? chalk.dim(`  Timeout: ${error.timeout}ms\n`) : '');
        case 'PARSE_ERROR':
            return chalk.red('\n✗ Parse error.\n') +
                    chalk.dim(`  Error Code: ${error.code}\n`);
        default:
            break;
        }

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
