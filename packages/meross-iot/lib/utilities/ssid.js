'use strict';

/**
 * Decodes a base64-encoded SSID string.
 *
 * Meross devices store WiFi SSIDs as base64-encoded strings in their configuration.
 * This function decodes them to their original UTF-8 representation for display or
 * comparison purposes. Returns the original string if decoding fails, allowing the
 * function to handle both encoded and already-decoded SSIDs gracefully.
 *
 * @param {string} encodedSSID - Base64-encoded SSID string
 * @returns {string} Decoded SSID string, or original string if decoding fails
 * @example
 * const decoded = decodeSSID('SG9tZQ=='); // Returns "Home"
 * const decoded2 = decodeSSID('not-base64'); // Returns "not-base64" (not valid base64)
 */
function decodeSSID(encodedSSID) {
    if (!encodedSSID || typeof encodedSSID !== 'string') {
        return encodedSSID || '';
    }

    try {
        const decoded = Buffer.from(encodedSSID, 'base64').toString('utf-8');
        if (decoded && decoded.length > 0) {
            return decoded;
        }
    } catch (error) {
        // Decoding failed, return original string
    }

    return encodedSSID;
}

module.exports = {
    decodeSSID
};

