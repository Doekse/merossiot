'use strict';

/**
 * Converts RGB color to integer representation used by Meross devices.
 *
 * Meross devices expect RGB colors as a single integer value where each color component
 * occupies specific bit ranges: red in bits 16-23, green in bits 8-15, and blue in bits 0-7.
 * This function normalizes various input formats (array, object, or already-converted integer)
 * to this device-compatible format.
 *
 * @param {number|Array<number>|Object} rgb - RGB color value
 * @param {number} [rgb] - If number, treated as already converted integer
 * @param {Array<number>} [rgb] - If array, expected format [r, g, b] where each is 0-255
 * @param {Object} [rgb] - If object, expected format {r, g, b} or {red, green, blue}
 * @returns {number} RGB color as integer
 * @throws {CommandError} If RGB value is invalid
 * @example
 * const rgbInt = rgbToInt([255, 0, 0]); // Red
 * const rgbInt2 = rgbToInt({r: 0, g: 255, b: 0}); // Green
 * const rgbInt3 = rgbToInt(16711680); // Already an integer (red)
 */
function rgbToInt(rgb) {
    if (typeof rgb === 'number') {
        return rgb;
    } else if (Array.isArray(rgb) && rgb.length === 3) {
        const [red, green, blue] = rgb;
        return (red << 16) | (green << 8) | blue;
    } else if (rgb && typeof rgb === 'object') {
        const red = rgb.r || rgb.red || 0;
        const green = rgb.g || rgb.green || 0;
        const blue = rgb.b || rgb.blue || 0;
        return (red << 16) | (green << 8) | blue;
    } else {
        const { CommandError } = require('../model/exception');
        throw new CommandError('Invalid value for RGB! Must be integer, [r,g,b] tuple, or {r,g,b} object', { rgb });
    }
}

/**
 * Converts RGB integer to [r, g, b] array.
 *
 * Extracts individual color components from the packed integer format used by Meross devices
 * by masking and shifting the appropriate bit ranges.
 *
 * @param {number} rgbInt - RGB color as integer
 * @returns {Array<number>} RGB tuple [r, g, b] where each value is 0-255
 * @example
 * const rgb = intToRgb(16711680); // Returns [255, 0, 0] (red)
 * const [r, g, b] = intToRgb(65280); // Returns [0, 255, 0] (green)
 */
function intToRgb(rgbInt) {
    const red = (rgbInt & 16711680) >> 16;
    const green = (rgbInt & 65280) >> 8;
    const blue = (rgbInt & 255);
    return [red, green, blue];
}

module.exports = {
    rgbToInt,
    intToRgb
};

