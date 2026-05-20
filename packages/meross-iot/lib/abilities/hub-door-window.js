'use strict';

const { registerNamespaceDescriptor } = require('../dispatcher');
const { getMessageTimestamp } = require('../utilities/state-ordering');

/**
 * Dispatcher descriptors for hub door/window contact sensors (MS200, etc.).
 *
 * @module abilities/hub-door-window
 */

registerNamespaceDescriptor('Appliance.Hub.Sensor.DoorWindow', {
    namespace: 'Appliance.Hub.Sensor.DoorWindow',
    gateKey: '_handleDoorWindow',
    customApply: (device, payload, _source, header) => {
        if (device.constructor.name !== 'HubDoorWindowSensor' ||
            typeof device._handleDoorWindow !== 'function') {
            return;
        }
        device._handleDoorWindow(payload, getMessageTimestamp(header));
    }
});

registerNamespaceDescriptor('Appliance.Hub.Sensor.All', {
    namespace: 'Appliance.Hub.Sensor.All',
    gateKey: '_handleSensorAll',
    customApply: (device, payload, _source, header) => {
        if (device.constructor.name !== 'HubDoorWindowSensor') {
            return;
        }
        device._handleSensorAll(payload, getMessageTimestamp(header));
    }
});
