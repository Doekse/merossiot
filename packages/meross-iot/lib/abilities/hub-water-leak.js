'use strict';

const { registerNamespaceDescriptor } = require('../dispatcher');
const { getMessageTimestamp } = require('../utilities/state-ordering');

/**
 * Dispatcher descriptors for hub water leak subdevices (MS400, MS405, etc.).
 *
 * @module abilities/hub-water-leak
 */

registerNamespaceDescriptor('Appliance.Hub.Sensor.WaterLeak', {
    namespace: 'Appliance.Hub.Sensor.WaterLeak',
    gateKey: '_handleWaterLeak',
    customApply: (device, payload) => {
        if (device.constructor.name !== 'HubWaterLeakSensor' ||
            typeof device._handleWaterLeak !== 'function') {
            return;
        }
        device._handleWaterLeak(payload);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Sensor.All', {
    namespace: 'Appliance.Hub.Sensor.All',
    gateKey: '_handleSensorAll',
    customApply: (device, payload, _source, header) => {
        if (device.constructor.name !== 'HubWaterLeakSensor') {
            return;
        }
        device._handleSensorAll(payload, getMessageTimestamp(header));
    }
});
