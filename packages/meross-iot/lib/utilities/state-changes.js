'use strict';

/**
 * Builds an object containing only the fields that have changed between old and new state values.
 *
 * This utility centralizes state change detection logic used across multiple feature update
 * methods. It minimizes unnecessary API calls by only including fields that actually changed.
 * Supports both simple value comparisons and deep comparisons for arrays and objects (like RGB tuples)
 * that require structural comparison rather than reference equality.
 *
 * @param {Object|undefined} oldValue - The previous state value object, or undefined if no previous state exists
 * @param {Object} fieldValues - Object mapping field names to their new values (e.g., `{isOn: state.isOn, brightness: state.luminance}`)
 * @param {Array<string>} [deepCompareFields=[]] - Array of field names that require deep comparison using JSON.stringify (e.g., `['rgb']`)
 * @returns {Object} Object containing only the changed fields, or empty object if nothing changed
 *
 * @example
 * // Simple field comparison
 * const oldValue = { isOn: true, mode: 1 };
 * const fieldValues = { isOn: false, mode: 1 };
 * const changes = buildStateChanges(oldValue, fieldValues);
 * // Returns: { isOn: false }
 *
 * @example
 * // Deep comparison for arrays/objects
 * const oldValue = { rgb: [255, 0, 0], mode: 1 };
 * const fieldValues = { rgb: [0, 255, 0], mode: 1 };
 * const changes = buildStateChanges(oldValue, fieldValues, ['rgb']);
 * // Returns: { rgb: [0, 255, 0] }
 *
 * @example
 * // First time (oldValue is undefined) - all fields included
 * const changes = buildStateChanges(undefined, { isOn: true, mode: 1 });
 * // Returns: { isOn: true, mode: 1 }
 */
function buildStateChanges(oldValue, fieldValues, deepCompareFields = []) {
    if (!fieldValues || typeof fieldValues !== 'object') {
        return {};
    }

    const newValue = {};

    for (const [fieldName, newFieldValue] of Object.entries(fieldValues)) {
        if (oldValue === undefined) {
            newValue[fieldName] = newFieldValue;
            continue;
        }

        const oldFieldValue = oldValue[fieldName];

        if (deepCompareFields.includes(fieldName)) {
            if (JSON.stringify(oldFieldValue) !== JSON.stringify(newFieldValue)) {
                newValue[fieldName] = newFieldValue;
            }
        } else {
            if (oldFieldValue !== newFieldValue) {
                newValue[fieldName] = newFieldValue;
            }
        }
    }

    return newValue;
}

module.exports = {
    buildStateChanges
};
