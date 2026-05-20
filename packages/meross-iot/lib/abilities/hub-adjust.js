'use strict';

const { registerNamespaceDescriptor } = require('../dispatcher');
const { getMessageTimestamp } = require('../utilities/state-ordering');

/**
 * Dispatcher descriptors for hub temperature/humidity calibration offsets.
 *
 * @module abilities/hub-adjust
 */

registerNamespaceDescriptor('Appliance.Hub.Sensor.Adjust', {
    namespace: 'Appliance.Hub.Sensor.Adjust',
    gateKey: '_handleAdjust',
    customApply: (device, payload, _source, header) => {
        if (device.constructor.name !== 'HubTempHumSensor' ||
            typeof device._handleAdjust !== 'function') {
            return;
        }
        device._handleAdjust(payload, getMessageTimestamp(header));
    }
});
