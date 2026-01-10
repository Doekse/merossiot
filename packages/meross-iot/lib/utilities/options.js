'use strict';

/**
 * Options normalization utilities.
 *
 * Provides helper functions for normalizing and validating options objects used across
 * feature methods. These utilities ensure consistent handling of optional parameters,
 * default values, and required field validation.
 *
 * @module utilities/options
 */

/**
 * Normalizes channel parameter from options object.
 *
 * Many Meross devices support multiple channels (e.g., multi-outlet power strips).
 * This function extracts the channel number from options, defaulting to 0 (first channel)
 * if not specified. Handles null or non-object inputs gracefully.
 *
 * @param {Object} options - Options object
 * @param {number} [defaultChannel=0] - Default channel value if not specified
 * @returns {number} Channel number
 * @example
 * normalizeChannel({channel: 1}); // Returns 1
 * normalizeChannel({}); // Returns 0
 * normalizeChannel({}, 1); // Returns 1
 */
function normalizeChannel(options = {}, defaultChannel = 0) {
    if (options === null || typeof options !== 'object') {
        return defaultChannel;
    }
    return options.channel !== undefined ? options.channel : defaultChannel;
}

/**
 * Validates that required fields are present in options object.
 *
 * Ensures that all specified required fields exist in the options object before
 * proceeding with operations that depend on them. Provides clear error messages
 * listing all missing fields when validation fails.
 *
 * @param {Object} options - Options object to validate
 * @param {Array<string>} requiredFields - Array of required field names
 * @throws {Error} If any required field is missing
 * @example
 * validateRequired({onoff: true}, ['onoff']); // OK
 * validateRequired({}, ['onoff']); // Throws error
 */
function validateRequired(options = {}, requiredFields = []) {
    if (!options || typeof options !== 'object') {
        throw new Error('Options must be an object');
    }

    const missing = requiredFields.filter(field => options[field] === undefined);
    if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
}

module.exports = {
    normalizeChannel,
    validateRequired
};

