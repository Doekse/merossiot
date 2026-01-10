'use strict';

const fs = require('fs');

async function dumpRegistry(manager, filename) {
    const devices = manager.getAllDevices();
    const registry = devices.map(device => {
        return {
            uuid: device.uuid,
            devName: device.name,
            deviceType: device.deviceType,
            fmwareVersion: device.firmwareVersion,
            hdwareVersion: device.hardwareVersion,
            onlineStatus: device.onlineStatus,
            abilities: device.abilities || null,
            macAddress: device.macAddress || null,
            lanIp: device.lanIp || null,
            mqttHost: device.mqttHost || null,
            mqttPort: device.mqttPort || null
        };
    });

    const output = {
        timestamp: new Date().toISOString(),
        deviceCount: devices.length,
        devices: registry
    };

    fs.writeFileSync(filename, JSON.stringify(output, null, 2));
    console.log(`Device registry dumped to ${filename}`);
    console.log(`Total devices: ${devices.length}`);
}

module.exports = { dumpRegistry };

