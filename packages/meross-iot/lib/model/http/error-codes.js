'use strict';

/**
 * Error code to message mapping
 *
 * Maps Meross API error codes to human-readable error messages. These messages
 * are provided by the Meross API and used as default error messages when the
 * API doesn't provide a custom message.
 *
 * @module errorcodes
 */

const errorMessages = {
    500: 'The selected timezone is not supported',
    1000: 'Wrong or missing user',
    1001: 'Wrong or missing password',
    1002: 'Account does not exist',
    1003: 'This account has been disabled or deleted',
    1004: 'Wrong email or password',
    1005: 'Invalid email address',
    1006: 'Bad password format',
    1007: 'User already exists',
    1008: 'This email is not registered',
    1009: 'Email send failed',
    1011: 'Wrong Ticket',
    1012: 'Code Overdue',
    1013: 'Wrong Code',
    1014: 'Duplicate password',
    1015: 'Same email when changing account email',
    1019: 'Token expired',
    1021: 'Unknown error',
    1022: 'Token error',
    1023: 'Unknown error',
    1024: 'Unknown error',
    1025: 'Unknown error',
    1026: 'Unknown error',
    1027: 'Unknown error',
    1028: 'Requested too frequently',
    1030: 'Redirect app to login other than this region',
    1031: 'Username does not match',
    1032: 'Invalid MFA code. Please use a current MFA code.',
    1033: 'MFA is activated for the account but MFA code not provided. Please provide a current MFA code.',
    1035: 'Operation is locked',
    1041: 'Repeat checkin',
    1042: 'API Top limit reached',
    1043: 'Resource access deny',
    1200: 'Token has expired',
    1201: 'Server was unable to generate token',
    1202: 'Unknown error',
    1203: 'Unknown error',
    1204: 'Unknown error',
    1210: 'Unknown error',
    1211: 'Unknown error',
    1212: 'Unknown error',
    1213: 'Unknown error',
    1214: 'Unknown error',
    1215: 'Unknown error',
    1226: 'Unknown error',
    1227: 'Unknown error',
    1228: 'Unknown error',
    1229: 'Unknown error',
    1230: 'Unknown error',
    1231: 'Unknown error',
    1232: 'Unknown error',
    1233: 'Unknown error',
    1255: 'The number of remote control boards exceeded the limit',
    1256: 'Compatible mode having',
    1257: 'Compatible mode not having',
    1301: 'You have issued too many tokens without logging out and your account might have been temporarily disabled.',
    1400: 'Unknown error',
    1401: 'Unknown error',
    1402: 'Unknown error',
    1403: 'Unknown error',
    1500: 'Unknown error',
    1501: 'Unknown error',
    1502: 'Unknown error',
    1503: 'Unknown error',
    1504: 'Unknown error',
    1601: 'Unknown error',
    1602: 'Unknown error',
    1603: 'Unknown error',
    1604: 'Unknown error',
    1605: 'Unknown error',
    1700: 'Unknown error',
    5000: 'Unknown or generic error',
    5001: 'Unknown or generic error',
    5002: 'Unknown or generic error',
    5003: 'Unknown or generic error',
    5004: 'Unknown or generic error',
    5020: 'Infrared Remote device is busy',
    5021: 'Infrared record timeout',
    5022: 'Infrared record invalid',
    10001: 'System error',
    10002: 'Unknown error',
    10003: 'Serialize error',
    10006: 'Http common error',
    20101: 'Invalid parameter',
    20106: 'Not existing resource',
    20112: 'Unsupported',
    20115: 'Send email limit'
};

/**
 * Gets the error message for a given error code
 *
 * Maps Meross API error codes to human-readable messages. These messages are
 * standardized by the Meross API documentation and provide context when the API
 * response doesn't include a custom error message. Returns a generic message for
 * unmapped codes to ensure callers always receive a meaningful error description.
 *
 * @param {number} code - The error code to look up
 * @returns {string} The error message for the code, or 'Unknown error' if not found
 */
function getErrorMessage(code) {
    return errorMessages[code] || 'Unknown error';
}

module.exports = {
    getErrorMessage
};

