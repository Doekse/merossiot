'use strict';

async function executeControlCommand(manager, uuid, methodName, params) {
    const device = manager.devices.get(uuid);

    if (!device) {
        throw new Error(`Device not found: ${uuid}`);
    }

    if (!device.deviceConnected) {
        throw new Error('Device is not connected. Please wait for device to connect.');
    }

    if (typeof device[methodName] !== 'function') {
        throw new Error(`Control method not available: ${methodName}`);
    }

    // All methods now use unified options pattern, so we can call directly with params
    return await device[methodName](params);
}

module.exports = { executeControlCommand };

