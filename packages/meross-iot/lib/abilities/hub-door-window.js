'use strict';

const { registerNamespaceDescriptor, mutateChannelState } = require('../dispatcher');
const { getMessageTimestamp, shouldApplyUpdate } = require('../utilities/state-ordering');
const { applySubdeviceBattery, applySubdeviceOnline, publishHubGet } = require('./hub');
const DoorWindowState = require('../states/door-window-state');
const { subdeviceIs } = require('./hub');

/**
 * Dispatcher descriptors for hub door/window contact sensors (MS200, etc.).
 *
 * @module abilities/hub-door-window
 */

const doorWindowDescriptor = {
    namespace: 'Appliance.Hub.Sensor.DoorWindow',
    stateMap: '_doorWindowStateByChannel',
    StateClass: DoorWindowState,
    eventType: 'doorWindow',
    gateKey: '_handleDoorWindow',
    snapshot: (s) => s.toSnapshot()
};

/**
 * @param {object} device
 * @returns {DoorWindowState|undefined}
 */
function getDoorWindowState(device) {
    return device._doorWindowStateByChannel?.get(0);
}

/**
 * @param {object} device
 * @param {Object} data
 * @param {number|null|undefined} messageTs
 * @param {string} source
 * @returns {void}
 */
function applyDoorWindowPayload(device, data, messageTs, source) {
    const applyStatus = data.status === undefined || data.status === null ||
        shouldApplyUpdate(device, 'doorWindowStatus', messageTs);
    const applyLmTime = data.lmTime === undefined || data.lmTime === null ||
        shouldApplyUpdate(device, 'doorWindowLmTime', messageTs);

    if (!applyStatus && !applyLmTime && data.syncedTime === undefined && !data.sample) {
        return;
    }

    mutateChannelState(device, doorWindowDescriptor, (state) => {
        state.update(data, { applyStatus, applyLmTime });
    }, source);
}

registerNamespaceDescriptor('Appliance.Hub.Sensor.DoorWindow', {
    ...doorWindowDescriptor,
    customApply: (device, payload, source, header) => {
        if (!subdeviceIs(device, 'doorWindow')) {
            return;
        }
        applyDoorWindowPayload(device, payload, getMessageTimestamp(header), source);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Sensor.All', {
    namespace: 'Appliance.Hub.Sensor.All',
    gateKey: '_handleSensorAll',
    customApply: (device, payload, source, header) => {
        if (!subdeviceIs(device, 'doorWindow')) {
            return;
        }
        const messageTs = getMessageTimestamp(header);
        applySubdeviceOnline(device, payload, messageTs, source);
        if (payload.doorWindow) {
            applyDoorWindowPayload(device, payload.doorWindow, messageTs, source);
        }
        if (payload.battery !== undefined && payload.battery !== null) {
            applySubdeviceBattery(device, payload.battery, source);
        }
    }
});

/**
 * Creates a door/window feature object for a hub or door/window subdevice.
 *
 * @param {Object} device - Hub or door/window subdevice instance
 * @returns {Object} Door/window feature with get and cached read methods
 */
function createDoorWindowAbility(device) {
    return {
        /**
         * Fetches door/window sensor data and updates local state.
         *
         * @param {Object} [options={}] - Get options
         * @param {string|Array<string>} [options.sensorIds=[]] - Subdevice ID(s); empty on hub gets all (max 16)
         * @returns {Promise<Object>} Response containing `doorWindow` array
         */
        async get(options = {}) {
            const { sensorIds = [] } = options;
            const ids = Array.isArray(sensorIds) && sensorIds.length > 0 ? sensorIds : undefined;
            return publishHubGet(device, {
                namespace: 'Appliance.Hub.Sensor.DoorWindow',
                payloadKey: 'doorWindow',
                ids,
                transport: device.subdeviceId ? null : undefined
            });
        },

        /**
         * Whether the contact is open from cached state.
         *
         * @returns {boolean|null}
         */
        isOpen() {
            return getDoorWindowState(device)?.isOpen ?? null;
        },

        /**
         * Decoded contact state from cached state.
         *
         * @returns {'closed'|'open'|null}
         */
        getContactState() {
            return getDoorWindowState(device)?.contactState ?? null;
        },

        /**
         * Unix timestamp of the latest door/window change from cached state.
         *
         * @returns {number|null}
         */
        getLatestLmTime() {
            return getDoorWindowState(device)?.lmTime ?? null;
        },

        /**
         * Historical open/close samples from cached state.
         *
         * @returns {Array<{status: number, timestamp: number}>}
         */
        getSamples() {
            return getDoorWindowState(device)?.samples ?? [];
        }
    };
}

/**
 * Gets door/window capability information for a hub door/window subdevice.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Door/window capability object or null if not supported
 */
function getCapabilities(device, channelIds) {
    if (!subdeviceIs(device, 'doorWindow')) {
        return null;
    }

    return {
        supported: true,
        channels: channelIds,
        doorWindow: true
    };
}

module.exports = createDoorWindowAbility;
module.exports.getCapabilities = getCapabilities;
module.exports.ability = {
    key: 'doorWindow',
    namespaces: ['Appliance.Hub.Sensor.DoorWindow'],
    family: 'doorWindow',
    caches: ['_doorWindowStateByChannel'],
    create: createDoorWindowAbility,
    getCapabilities
};
