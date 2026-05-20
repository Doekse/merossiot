'use strict';

const { registerNamespaceDescriptor } = require('../dispatcher');
const { getMessageTimestamp } = require('../utilities/state-ordering');

/**
 * Dispatcher descriptors for hub temperature/humidity alert thresholds.
 *
 * @module abilities/hub-alert
 */

registerNamespaceDescriptor('Appliance.Hub.Sensor.Alert', {
    namespace: 'Appliance.Hub.Sensor.Alert',
    gateKey: '_handleAlert',
    customApply: (device, payload, _source, header) => {
        if (device.constructor.name !== 'HubTempHumSensor' ||
            typeof device._handleAlert !== 'function') {
            return;
        }
        device._handleAlert(payload, getMessageTimestamp(header));
    }
});
