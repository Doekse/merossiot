'use strict';

const { registerNamespaceDescriptor } = require('../dispatcher');
const { getMessageTimestamp } = require('../utilities/state-ordering');

/**
 * Dispatcher descriptors for hub MTS100 thermostat valve subdevices.
 *
 * @module abilities/hub-mts100
 */

registerNamespaceDescriptor('Appliance.Hub.Mts100.All', {
    namespace: 'Appliance.Hub.Mts100.All',
    gateKey: '_handleMts100All',
    customApply: (device, payload, _source, header) => {
        if (device.constructor.name !== 'HubThermostatValve') {
            return;
        }
        device._handleMts100All(payload, getMessageTimestamp(header));
    }
});

registerNamespaceDescriptor('Appliance.Hub.ToggleX', {
    namespace: 'Appliance.Hub.ToggleX',
    gateKey: '_handleToggleX',
    customApply: (device, payload) => {
        if (device.constructor.name !== 'HubThermostatValve' ||
            typeof device._handleToggleX !== 'function') {
            return;
        }
        device._handleToggleX(payload);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Mts100.Mode', {
    namespace: 'Appliance.Hub.Mts100.Mode',
    gateKey: '_handleMts100Mode',
    customApply: (device, payload) => {
        if (device.constructor.name !== 'HubThermostatValve' ||
            typeof device._handleMts100Mode !== 'function') {
            return;
        }
        device._handleMts100Mode(payload);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Mts100.Temperature', {
    namespace: 'Appliance.Hub.Mts100.Temperature',
    gateKey: '_handleMts100Temperature',
    customApply: (device, payload) => {
        if (device.constructor.name !== 'HubThermostatValve' ||
            typeof device._handleMts100Temperature !== 'function') {
            return;
        }
        device._handleMts100Temperature(payload);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Mts100.Adjust', {
    namespace: 'Appliance.Hub.Mts100.Adjust',
    gateKey: '_handleMts100Adjust',
    customApply: (device, payload, _source, header) => {
        if (device.constructor.name !== 'HubThermostatValve' ||
            typeof device._handleMts100Adjust !== 'function') {
            return;
        }
        device._handleMts100Adjust(payload, getMessageTimestamp(header));
    }
});

registerNamespaceDescriptor('Appliance.Hub.Mts100.SuperCtl', {
    namespace: 'Appliance.Hub.Mts100.SuperCtl',
    gateKey: '_handleMts100SuperCtl',
    customApply: (device, payload) => {
        if (device.constructor.name !== 'HubThermostatValve' ||
            typeof device._handleMts100SuperCtl !== 'function') {
            return;
        }
        device._handleMts100SuperCtl(payload);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Mts100.ScheduleB', {
    namespace: 'Appliance.Hub.Mts100.ScheduleB',
    gateKey: '_handleMts100ScheduleB',
    customApply: (device, payload) => {
        if (device.constructor.name !== 'HubThermostatValve' ||
            typeof device._handleMts100ScheduleB !== 'function') {
            return;
        }
        device._handleMts100ScheduleB(payload);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Mts100.Config', {
    namespace: 'Appliance.Hub.Mts100.Config',
    gateKey: '_handleMts100Config',
    customApply: (device, payload) => {
        if (device.constructor.name !== 'HubThermostatValve' ||
            typeof device._handleMts100Config !== 'function') {
            return;
        }
        device._handleMts100Config(payload);
    }
});
