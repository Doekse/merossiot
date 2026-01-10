'use strict';

const { collectThermostatModeParams } = require('./thermostat');
const { collectSetTimerXParams, collectDeleteTimerXParams } = require('./timer');
const { collectSetTriggerXParams, collectDeleteTriggerXParams } = require('./trigger');
const { collectSetLightColorParams } = require('./light');
const { collectGenericParams } = require('./generic');

/**
 * Main entry point for collecting control parameters.
 * Routes to feature-specific handlers or falls back to generic collection.
 */
async function collectControlParameters(methodName, methodMetadata, device) {
    if (!methodMetadata || !methodMetadata.params) {
        return {};
    }

    // Route to feature-specific handlers
    switch (methodName) {
    case 'setThermostatMode':
        return await collectThermostatModeParams(methodMetadata, device);

    case 'setLightColor':
        return await collectSetLightColorParams(methodMetadata, device);

    case 'setTimerX':
        return await collectSetTimerXParams(methodMetadata, device);

    case 'deleteTimerX': {
        const result = await collectDeleteTimerXParams(methodMetadata, device);
        if (result !== null) {
            return result;
        }
        // Fall through to generic collection if no timers found
        break;
    }

    case 'setTriggerX':
        return await collectSetTriggerXParams(methodMetadata, device);

    case 'deleteTriggerX': {
        const result = await collectDeleteTriggerXParams(methodMetadata, device);
        if (result !== null) {
            return result;
        }
        // Fall through to generic collection if no triggers found
        break;
    }
    }

    // Default to generic parameter collection
    return await collectGenericParams(methodMetadata);
}

module.exports = { collectControlParameters };

