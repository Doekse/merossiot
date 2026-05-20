'use strict';

/**
 * Whether a feature should be fetched over the network (no cache yet, or MQTT not ready).
 *
 * @param {boolean} hasCachedState - True when a sync feature getter reports known state
 * @param {boolean} isMqttConnected - True when the device MQTT session looks ready
 * @returns {boolean}
 */
function shouldFetchFeature(hasCachedState, isMqttConnected) {
    return !hasCachedState || !isMqttConnected;
}

/**
 * Whether any of the given ability namespaces are present on the device.
 *
 * @param {Object} abilities - Device abilities dictionary
 * @param {string[]} namespaces - Ability namespace strings to check
 * @returns {boolean}
 */
function hasAbility(abilities, namespaces) {
    return namespaces.some(namespace => abilities[namespace]);
}

module.exports = { shouldFetchFeature, hasAbility };
