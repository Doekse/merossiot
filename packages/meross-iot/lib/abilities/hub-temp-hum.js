'use strict';

const { registerNamespaceDescriptor } = require('../dispatcher');
const { getMessageTimestamp } = require('../utilities/state-ordering');

/**
 * Dispatcher descriptors for hub temperature/humidity subdevices (MS100, MS130, etc.).
 *
 * @module abilities/hub-temp-hum
 */

registerNamespaceDescriptor('Appliance.Hub.Sensor.TempHum', {
    namespace: 'Appliance.Hub.Sensor.TempHum',
    gateKey: '_handleSensorAll',
    customApply: (device, payload, _source, header) => {
        if (device.constructor.name !== 'HubTempHumSensor') {
            return;
        }
        device._handleSensorAll(payload, getMessageTimestamp(header));
    }
});

registerNamespaceDescriptor('Appliance.Hub.Sensor.All', {
    namespace: 'Appliance.Hub.Sensor.All',
    gateKey: '_handleSensorAll',
    customApply: (device, payload, _source, header) => {
        if (device.constructor.name !== 'HubTempHumSensor') {
            return;
        }
        device._handleSensorAll(payload, getMessageTimestamp(header));
    }
});

registerNamespaceDescriptor('Appliance.Control.Sensor.LatestX', {
    namespace: 'Appliance.Control.Sensor.LatestX',
    gateKey: '_handleLatestX',
    customApply: (device, payload) => {
        if (device.constructor.name !== 'HubTempHumSensor' ||
            typeof device._handleLatestX !== 'function') {
            return;
        }
        device._handleLatestX(payload);
    }
});
