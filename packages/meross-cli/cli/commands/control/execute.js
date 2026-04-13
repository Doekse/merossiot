'use strict';

const ManagerMeross = require('meross-iot');

/**
 * Executes a control command using the feature-based API.
 *
 * Routes commands to device feature modules based on method name format "feature.action".
 * This allows dynamic command execution without hardcoding device-specific logic.
 *
 * @param {Object} manager - ManagerMeross instance
 * @param {string} uuid - Device UUID
 * @param {string} methodName - Method name in format "feature.action" (e.g., "toggle.set", "light.set")
 * @param {Object} params - Parameters to pass to the feature method
 * @returns {Promise<*>} Result from the feature method
 */
async function executeControlCommand(manager, uuid, methodName, params) {
    const device = manager.devices.get(uuid);

    if (!device) {
        throw new ManagerMeross.MerossErrorNotFound(
            `Device not found: ${uuid}`,
            'device',
            uuid
        );
    }

    if (!device.deviceConnected) {
        throw new ManagerMeross.MerossErrorUnconnected(
            'Device is not connected. Please wait for device to connect.',
            uuid
        );
    }

    const parts = methodName.split('.');
    if (parts.length !== 2) {
        throw new ManagerMeross.MerossErrorUnsupported(
            `Invalid method name format: ${methodName}. Expected format: "feature.action" (e.g., "toggle.set")`,
            methodName,
            'Method name must be in format: feature.action'
        );
    }

    const [abilityName, action] = parts;
    const ability = device[abilityName];
    const availableAbilities = Object.keys(device).filter(key => {
        const candidate = device[key];
        return candidate && typeof candidate === 'object' && typeof candidate.get === 'function';
    });

    if (!ability || typeof ability !== 'object') {
        throw new ManagerMeross.MerossErrorUnsupported(
            `Ability '${abilityName}' is not available on this device`,
            methodName,
            availableAbilities.length > 0
                ? `Available abilities: ${availableAbilities.join(', ')}`
                : 'Device has no callable abilities available'
        );
    }

    if (typeof ability[action] !== 'function') {
        throw new ManagerMeross.MerossErrorUnsupported(
            `Action '${action}' not available on ability '${abilityName}'`,
            methodName,
            `Ability ${abilityName} does not support ${action} action`
        );
    }

    return await ability[action](params);
}

module.exports = { executeControlCommand };
