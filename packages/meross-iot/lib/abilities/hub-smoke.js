'use strict';

const { registerNamespaceDescriptor, mutateChannelState } = require('../dispatcher');
const { getMessageTimestamp } = require('../utilities/state-ordering');
const { applySubdeviceOnline, publishHubGet, publishHubSet, subdeviceIs } = require('./hub');
const SmokeAlarmState = require('../states/smoke-alarm-state');
const { SmokeAlarmStatusCodec, SmokeTestTypeCodec } = require('../enums');

/**
 * Dispatcher descriptors for hub smoke detector subdevices (MA151, etc.).
 *
 * @module abilities/hub-smoke
 */

const smokeAlarmDescriptor = {
    namespace: 'Appliance.Hub.Sensor.Smoke',
    stateMap: '_smokeAlarmStateByChannel',
    StateClass: SmokeAlarmState,
    eventType: 'smokeAlarm',
    gateKey: '_handleSmoke',
    snapshot: (s) => s.toSnapshot()
};

/**
 * Records a firmware test event on the subdevice when present in the smoke payload.
 *
 * @param {object} device
 * @param {Object|undefined} testEvent
 * @returns {void}
 */
function processSmokeTestEvent(device, testEvent) {
    if (!testEvent || !testEvent.test) {
        return;
    }

    const { type, timestamp } = testEvent.test;
    if (!device._testEvents) {
        device._testEvents = [];
        device._maxTestEvents = device._maxTestEvents ?? 10;
    }

    if (device._testEvents.length >= device._maxTestEvents) {
        device._testEvents.shift();
    }
    const typeLabel = typeof type === 'number'
        ? SmokeTestTypeCodec.fromWire(type)
        : type;
    device._testEvents.push({ type: typeLabel, typeWire: type, timestamp });
}

/**
 * @param {object} device
 * @param {Object|Array} alarmData
 * @param {string} source
 * @returns {void}
 */
function applySmokeAlarmPayload(device, alarmData, source) {
    mutateChannelState(device, smokeAlarmDescriptor, (state) => {
        processSmokeTestEvent(device, state.update(alarmData));
    }, source);
}

/**
 * @param {object} device
 * @returns {SmokeAlarmState|undefined}
 */
function getSmokeAlarmState(device) {
    return device._smokeAlarmStateByChannel?.get(0);
}

/**
 * @param {object} device
 * @returns {SmokeAlarmState}
 */
function ensureSmokeAlarmState(device) {
    const map = device._smokeAlarmStateByChannel;
    if (!map) {
        throw new Error('Smoke alarm state map is not initialized');
    }
    let state = map.get(0);
    if (!state) {
        state = new SmokeAlarmState();
        map.set(0, state);
    }
    return state;
}

registerNamespaceDescriptor('Appliance.Hub.Sensor.Smoke', {
    ...smokeAlarmDescriptor,
    customApply: (device, payload, source) => {
        if (!subdeviceIs(device, 'smoke')) {
            return;
        }
        applySmokeAlarmPayload(device, payload, source);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Sensor.All', {
    namespace: 'Appliance.Hub.Sensor.All',
    gateKey: '_handleSensorAll',
    customApply: (device, payload, source, header) => {
        if (!subdeviceIs(device, 'smoke')) {
            return;
        }
        const messageTs = getMessageTimestamp(header);
        applySubdeviceOnline(device, payload, messageTs, source);
        if (payload.smokeAlarm) {
            applySmokeAlarmPayload(device, payload.smokeAlarm, source);
        }
    }
});

/**
 * Creates a smoke alarm feature object for a hub or smoke detector subdevice.
 *
 * @param {Object} device - Hub or smoke detector subdevice instance
 * @returns {Object} Smoke alarm feature with get/set and cached read methods
 */
function createSmokeAlarmAbility(device) {
    return {
        /**
         * Fetches smoke alarm status from the device and updates local state.
         *
         * On a subdevice, issues GET for this sensor and routes the response through
         * `handleMessage`. On a hub, accepts `options.sensorIds` and fans out to matching subdevices.
         *
         * @param {Object} [options={}] - Get options
         * @param {string|Array<string>} [options.sensorIds] - Hub only: smoke detector subdevice ID(s)
         * @returns {Promise<Object>} Response containing `smokeAlarm` array
         */
        async get(options = {}) {
            return publishHubGet(device, {
                namespace: 'Appliance.Hub.Sensor.Smoke',
                payloadKey: 'smokeAlarm',
                ids: options.sensorIds,
                subdeviceWholeArray: true,
                transport: null
            });
        },

        /**
         * Sets smoke alarm status on a smoke detector subdevice (e.g. mute).
         *
         * @param {Object} [options={}] - Set options
         * @param {boolean} [options.muteSmoke] - If true, mute smoke alarm; if false, mute temperature alarm
         * @param {string} [options.status] - Semantic status string (e.g. `'normal'`, `'mute-smoke'`)
         * @returns {Promise<Object>} Response from the device
         */
        async set(options = {}) {
            if (!device.subdeviceId) {
                throw new Error('smokeAlarm.set() is only supported on smoke detector subdevices');
            }

            let statusStr;
            if (options.status !== undefined && options.status !== null) {
                statusStr = options.status;
            } else {
                const muteSmoke = options.muteSmoke !== false;
                statusStr = muteSmoke ? 'mute-smoke' : 'mute-temperature';
            }

            const statusWire = SmokeAlarmStatusCodec.toWire(statusStr);
            const response = await publishHubSet(device, {
                namespace: 'Appliance.Hub.Sensor.Smoke',
                payloadKey: 'smokeAlarm',
                entries: [{
                    id: device.subdeviceId,
                    status: statusWire
                }],
                transport: null
            });

            if (response) {
                ensureSmokeAlarmState(device).update({ status: statusWire });
            }

            return response;
        },

        /**
         * Mutes the active smoke or temperature alarm (delegates to {@link #set}).
         *
         * @param {Object} [options={}]
         * @param {boolean} [options.muteSmoke=true] - Mute smoke vs temperature alarm
         * @returns {Promise<Object>}
         */
        async mute(options = {}) {
            return this.set({ muteSmoke: options.muteSmoke !== false });
        },

        /**
         * Triggers a smoke detector self-test (firmware status 23 / NORMAL).
         *
         * @returns {Promise<Object>}
         */
        async test() {
            return this.set({ status: 'normal' });
        },

        /**
         * Semantic alarm status string from cached state.
         *
         * @returns {string|null}
         */
        getStatus() {
            return getSmokeAlarmState(device)?.status ?? null;
        },

        /**
         * Primary condition: safe, alarming, silenced, fault, or unknown.
         *
         * @returns {'safe'|'alarming'|'silenced'|'fault'|'unknown'}
         */
        getCondition() {
            return getSmokeAlarmState(device)?.condition ?? 'unknown';
        },

        /**
         * Sensor channel when {@link getCondition} is alarming, silenced, or fault.
         *
         * @returns {'smoke'|'temperature'|'battery'|null}
         */
        getChannel() {
            const channel = getSmokeAlarmState(device)?.channel;
            return channel === undefined ? null : channel;
        },

        /**
         * Mesh linkage when firmware reports interconnect heartbeat (status 170).
         *
         * @returns {{ linkActive: boolean, raw: number }|null}
         */
        getInterconnect() {
            const interconnect = getSmokeAlarmState(device)?.interconnect;
            return interconnect === undefined ? null : interconnect;
        },

        /**
         * Raw interconnection wire value from cached state.
         *
         * @returns {number|null}
         */
        getInterConn() {
            return getSmokeAlarmState(device)?.interConn ?? null;
        },

        /**
         * Decoded interconnection link status from cached state.
         *
         * @returns {'inactive'|'active'|null}
         */
        getInterConnStatus() {
            return getSmokeAlarmState(device)?.interConnStatus ?? null;
        },

        /**
         * Timestamp of the last status update from cached state.
         *
         * @returns {number|null}
         */
        getLastStatusUpdate() {
            return getSmokeAlarmState(device)?.lastStatusUpdate ?? null;
        },

        /**
         * Cached firmware test events recorded from smoke payloads.
         *
         * @returns {Array<{ type: number, timestamp: number }>}
         */
        getTestEvents() {
            if (!device._testEvents) {
                return [];
            }
            return [...device._testEvents];
        }
    };
}

/**
 * Gets smoke alarm capability information for a hub smoke detector subdevice.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} Smoke alarm capability object or null if not supported
 */
function getCapabilities(device, channelIds) {
    if (!subdeviceIs(device, 'smoke')) {
        return null;
    }

    return {
        supported: true,
        channels: channelIds,
        smokeAlarm: true
    };
}

module.exports = createSmokeAlarmAbility;
module.exports.getCapabilities = getCapabilities;
module.exports.ability = {
    key: 'smokeAlarm',
    namespaces: ['Appliance.Hub.Sensor.Smoke'],
    family: 'smoke',
    caches: ['_smokeAlarmStateByChannel'],
    create: createSmokeAlarmAbility,
    getCapabilities
};
