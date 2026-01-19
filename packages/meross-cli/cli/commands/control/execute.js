'use strict';

const ManagerMeross = require('meross-iot');

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

    if (typeof device[methodName] !== 'function') {
        throw new ManagerMeross.MerossErrorUnsupported(
            `Control method not available: ${methodName}`,
            methodName,
            'Method not supported by this device'
        );
    }

    // All methods now use unified options pattern, so we can call directly with params
    return await device[methodName](params);
}

module.exports = { executeControlCommand };

