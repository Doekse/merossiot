'use strict';

const { registerNamespaceDescriptor } = require('../dispatcher');
const { getMessageTimestamp } = require('../utilities/state-ordering');

/**
 * Dispatcher descriptors for hub smoke detector subdevices (MA151, etc.).
 *
 * @module abilities/hub-smoke
 */

registerNamespaceDescriptor('Appliance.Hub.Sensor.Smoke', {
    namespace: 'Appliance.Hub.Sensor.Smoke',
    gateKey: '_handleSmoke',
    customApply: (device, payload) => {
        if (device.constructor.name !== 'HubSmokeDetector' ||
            typeof device._handleSmoke !== 'function') {
            return;
        }
        device._handleSmoke(payload);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Sensor.All', {
    namespace: 'Appliance.Hub.Sensor.All',
    gateKey: '_handleSensorAll',
    customApply: (device, payload, _source, header) => {
        if (device.constructor.name !== 'HubSmokeDetector') {
            return;
        }
        device._handleSensorAll(payload, getMessageTimestamp(header));
    }
});
