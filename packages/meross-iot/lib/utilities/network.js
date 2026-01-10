'use strict';

/**
 * Extracts the domain/hostname from an address string.
 *
 * Parses addresses that may include port numbers, returning only the hostname portion.
 * Used when separating hostname and port information from Meross device addresses.
 *
 * @param {string} address - Address string in format "hostname:port" or just "hostname"
 * @returns {string|null} Domain/hostname portion, or null if address is empty
 * @example
 * const host = extractDomain('iot.meross.com:2001'); // Returns 'iot.meross.com'
 * const host2 = extractDomain('iot.meross.com'); // Returns 'iot.meross.com'
 */
function extractDomain(address) {
    if (!address) {
        return null;
    }
    const tokens = address.split(':');
    return tokens[0];
}

/**
 * Extracts the port from an address string.
 *
 * Parses addresses that may include port numbers, returning the port if present or
 * falling back to the provided default. Handles invalid port values gracefully by
 * returning the default rather than throwing errors.
 *
 * @param {string} address - Address string in format "hostname:port" or just "hostname"
 * @param {number} defaultPort - Default port to return if no port is specified
 * @returns {number} Port number
 * @example
 * const port = extractPort('iot.meross.com:2001', 2001); // Returns 2001
 * const port2 = extractPort('iot.meross.com', 2001); // Returns 2001 (default)
 */
function extractPort(address, defaultPort) {
    if (!address) {
        return defaultPort;
    }
    const tokens = address.split(':');
    if (tokens.length > 1) {
        const port = parseInt(tokens[1], 10);
        return isNaN(port) ? defaultPort : port;
    }
    return defaultPort;
}

module.exports = {
    extractDomain,
    extractPort
};

