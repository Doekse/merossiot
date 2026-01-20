'use strict';

const { collectThermostatModeParams } = require('./thermostat');
const { collectSetTimerXParams, collectDeleteTimerXParams } = require('./timer');
const { collectSetTriggerXParams, collectDeleteTriggerXParams } = require('./trigger');
const { collectSetLightColorParams } = require('./light');
const { collectGenericParams } = require('./generic');

/**
 * Main entry point for collecting control parameters interactively.
 *
 * Routes to feature-specific parameter collection handlers when available, allowing
 * specialized prompts for complex features. Falls back to generic collection for
 * simpler methods or when feature-specific handlers are unavailable.
 *
 * @param {string} methodName - Control method name (e.g., "toggle.set", "light.set")
 * @param {Object} methodMetadata - Method metadata from control registry
 * @param {Object} device - Device instance
 * @returns {Promise<Object>} Collected parameters object
 */
async function collectControlParameters(methodName, methodMetadata, device) {
    if (!methodMetadata || !methodMetadata.params) {
        return {};
    }

    switch (methodName) {
    case 'thermostat.set':
        return await collectThermostatModeParams(methodMetadata, device);

    case 'light.set':
        return await collectSetLightColorParams(methodMetadata, device);

    case 'timer.set':
        return await collectSetTimerXParams(methodMetadata, device);

    case 'timer.delete': {
        const result = await collectDeleteTimerXParams(methodMetadata, device);
        if (result !== null) {
            return result;
        }
        break;
    }

    case 'trigger.set':
        return await collectSetTriggerXParams(methodMetadata, device);

    case 'trigger.delete': {
        const result = await collectDeleteTriggerXParams(methodMetadata, device);
        if (result !== null) {
            return result;
        }
        break;
    }
    }

    return await collectGenericParams(methodMetadata);
}

module.exports = { collectControlParameters };

