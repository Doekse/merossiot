'use strict';

const ManagerMeross = require('meross-iot');

/**
 * Executes a control command using the feature-based API.
 *
 * Routes commands to device feature modules based on method name format "feature.action".
 * This allows dynamic command execution without hardcoding device-specific logic.
 *
 * @param {Object} manager - ManagerMeross instance
 * @param {string} uuid - Device UUID (hub UUID when controlling a subdevice)
 * @param {string|null|undefined} [subdeviceIdOrMethodName] - Subdevice ID for hub children, or method name when omitted (4-arg form)
 * @param {string|Object} [methodNameOrParams] - Method name (`feature.action`) or params object in 4-arg form
 * @param {Object} [params] - Parameters to pass to the feature method (5-arg form only)
 * @returns {Promise<*>} Result from the feature method
 */
async function executeControlCommand(manager, uuid, subdeviceIdOrMethodName, methodNameOrParams, params) {
    let subdeviceId = null;
    let methodName;
    let callParams;
    if (params !== undefined) {
        subdeviceId = subdeviceIdOrMethodName;
        methodName = methodNameOrParams;
        callParams = params;
    } else {
        methodName = subdeviceIdOrMethodName;
        callParams = methodNameOrParams;
    }

    const device = subdeviceId
        ? manager.devices.get({ hubUuid: uuid, id: subdeviceId })
        : manager.devices.get(uuid);

    if (!device) {
        throw new ManagerMeross.MerossDeviceError(
            subdeviceId
                ? `Subdevice with ID ${subdeviceId} not found in hub ${uuid}`
                : `Device not found: ${uuid}`,
            'NOT_FOUND',
            subdeviceId
                ? { resourceType: 'subdevice', resourceId: subdeviceId, hubUuid: uuid }
                : { resourceType: 'device', resourceId: uuid }
        );
    }

    if (!device.deviceConnected) {
        throw new ManagerMeross.MerossDeviceError(
            'Device is not connected. Please wait for device to connect.',
            'DEVICE_UNCONNECTED',
            { deviceUuid: device.uuid }
        );
    }

    const parts = String(methodName).split('.');
    if (parts.length !== 2) {
        throw new ManagerMeross.MerossDeviceError(
            `Invalid method name format: ${methodName}. Expected format: "feature.action" (e.g., "toggle.set")`,
            'UNSUPPORTED',
            { operation: String(methodName), reason: 'Method name must be in format: feature.action' }
        );
    }

    const [abilityName, action] = parts;
    const ability = device[abilityName];
    const availableAbilities = Object.keys(device).filter(key => {
        const candidate = device[key];
        return candidate && typeof candidate === 'object' && typeof candidate.get === 'function';
    });

    if (!ability || typeof ability !== 'object') {
        throw new ManagerMeross.MerossDeviceError(
            `Ability '${abilityName}' is not available on this device`,
            'UNSUPPORTED',
            {
                operation: String(methodName),
                reason: availableAbilities.length > 0
                    ? `Available abilities: ${availableAbilities.join(', ')}`
                    : 'Device has no callable abilities available'
            }
        );
    }

    if (typeof ability[action] !== 'function') {
        throw new ManagerMeross.MerossDeviceError(
            `Action '${action}' not available on ability '${abilityName}'`,
            'UNSUPPORTED',
            {
                operation: String(methodName),
                reason: `Ability ${abilityName} does not support ${action} action`
            }
        );
    }

    return await ability[action](callParams);
}

module.exports = { executeControlCommand };
