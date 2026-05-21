'use strict';

const { registerNamespaceDescriptor, mutateChannelState } = require('../dispatcher');
const { getCachedOrFetch } = require('../utilities/cache');
const { getMessageTimestamp } = require('../utilities/state-ordering');
const { applySubdeviceOnline, publishHubGet } = require('./hub');
const HubThermostatState = require('../states/hub-thermostat-state');
const { MerossDeviceError } = require('../exception');
const { subdeviceIs } = require('./hub');

/**
 * Dispatcher descriptors for hub MTS100 thermostat valve subdevices.
 *
 * @module abilities/hub-mts100
 */

const thermostatDescriptor = {
    namespace: 'Appliance.Hub.Mts100.All',
    stateMap: '_hubThermostatStateByChannel',
    StateClass: HubThermostatState,
    eventType: 'thermostat',
    gateKey: '_handleMts100All',
    snapshot: (s) => s.toSnapshot()
};

/**
 * @param {object} device
 * @returns {HubThermostatState|undefined}
 */
function getThermostatState(device) {
    return device._hubThermostatStateByChannel?.get(0);
}

/**
 * @param {object} device
 * @returns {HubThermostatState}
 */
function ensureThermostatState(device) {
    const map = device._hubThermostatStateByChannel;
    if (!map) {
        throw new Error('MTS100 state map is not initialized');
    }
    let state = map.get(0);
    if (!state) {
        state = new HubThermostatState();
        map.set(0, state);
    }
    return state;
}

/**
 * @param {object} device
 * @param {(state: HubThermostatState) => void} updateFn
 * @param {string} source
 * @returns {void}
 */
function applyThermostatUpdate(device, updateFn, source) {
    mutateChannelState(device, thermostatDescriptor, updateFn, source);
}

registerNamespaceDescriptor('Appliance.Hub.Mts100.All', {
    ...thermostatDescriptor,
    customApply: (device, payload, source, header) => {
        if (!subdeviceIs(device, 'mts100')) {
            return;
        }
        const messageTs = getMessageTimestamp(header);
        applySubdeviceOnline(device, payload, messageTs, source, { touchLastActiveTime: true });
        applyThermostatUpdate(device, (state) => {
            state.update({
                scheduleBMode: payload.scheduleBMode,
                togglex: payload.togglex,
                mode: payload.mode,
                temperature: payload.temperature,
                adjust: payload.adjust,
                touchTemperatureSampleTime: !!payload.temperature,
                touchAdjustSampleTime: !!payload.adjust
            });
        }, source);
    }
});

registerNamespaceDescriptor('Appliance.Hub.ToggleX', {
    namespace: 'Appliance.Hub.ToggleX',
    gateKey: '_handleToggleX',
    customApply: (device, payload, source) => {
        if (!subdeviceIs(device, 'mts100')) {
            return;
        }
        applyThermostatUpdate(device, (state) => {
            state.updateToggleOnoff(payload.onoff);
        }, source);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Mts100.Mode', {
    namespace: 'Appliance.Hub.Mts100.Mode',
    gateKey: '_handleMts100Mode',
    customApply: (device, payload, source) => {
        if (!subdeviceIs(device, 'mts100')) {
            return;
        }
        applyThermostatUpdate(device, (state) => {
            state.updateModeState(payload.state);
        }, source);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Mts100.Temperature', {
    namespace: 'Appliance.Hub.Mts100.Temperature',
    gateKey: '_handleMts100Temperature',
    customApply: (device, payload, source) => {
        if (!subdeviceIs(device, 'mts100')) {
            return;
        }
        applyThermostatUpdate(device, (state) => {
            state.update({ temperature: payload, touchTemperatureSampleTime: true });
        }, source);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Mts100.Adjust', {
    namespace: 'Appliance.Hub.Mts100.Adjust',
    gateKey: '_handleMts100Adjust',
    customApply: (device, payload, source) => {
        if (!subdeviceIs(device, 'mts100')) {
            return;
        }
        applyThermostatUpdate(device, (state) => {
            if (payload.temperature !== undefined) {
                state.update({
                    adjust: { temperature: payload.temperature },
                    touchAdjustSampleTime: true
                });
            }
        }, source);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Mts100.SuperCtl', {
    namespace: 'Appliance.Hub.Mts100.SuperCtl',
    gateKey: '_handleMts100SuperCtl',
    customApply: (device, payload, source) => {
        if (!subdeviceIs(device, 'mts100')) {
            return;
        }
        applyThermostatUpdate(device, (state) => {
            state.update({ superCtl: { ...payload } });
        }, source);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Mts100.ScheduleB', {
    namespace: 'Appliance.Hub.Mts100.ScheduleB',
    gateKey: '_handleMts100ScheduleB',
    customApply: (device, payload, source) => {
        if (!subdeviceIs(device, 'mts100')) {
            return;
        }
        applyThermostatUpdate(device, (state) => {
            state.update({ scheduleB: { ...payload } });
        }, source);
    }
});

registerNamespaceDescriptor('Appliance.Hub.Mts100.Config', {
    namespace: 'Appliance.Hub.Mts100.Config',
    gateKey: '_handleMts100Config',
    customApply: (device, payload, source) => {
        if (!subdeviceIs(device, 'mts100')) {
            return;
        }
        applyThermostatUpdate(device, (state) => {
            state.update({ config: { ...payload } });
        }, source);
    }
});

/** @type {ReadonlyArray<string>} */
const SUPPORTED_PRESETS = ['custom', 'comfort', 'economy', 'away'];

/** @type {ReadonlyArray<{ namespace: string, payloadKey: string, requestKey?: string, responseKeys?: string[], transport?: null, label: string }>} */
const MTS100_GET_POLLS = [
    { namespace: 'Appliance.Hub.Mts100.All', payloadKey: 'all', transport: null, label: 'all' },
    { namespace: 'Appliance.Hub.Mts100.Adjust', payloadKey: 'adjust', label: 'adjust' },
    { namespace: 'Appliance.Hub.Mts100.SuperCtl', payloadKey: 'superCtl', label: 'super control' },
    {
        namespace: 'Appliance.Hub.Mts100.ScheduleB',
        payloadKey: 'scheduleB',
        requestKey: 'schedule',
        responseKeys: ['schedule', 'scheduleB'],
        label: 'schedule B'
    },
    { namespace: 'Appliance.Hub.Mts100.Config', payloadKey: 'config', label: 'config' }
];

/**
 * Polls one MTS100 GET namespace for the given valve IDs.
 *
 * @param {object} device
 * @param {string[]} ids
 * @param {{ namespace: string, payloadKey: string, requestKey?: string, responseKeys?: string[], transport?: null }} spec
 * @returns {Promise<Object|undefined>}
 */
async function pollMts100Namespace(device, ids, spec) {
    return publishHubGet(device, {
        namespace: spec.namespace,
        payloadKey: spec.payloadKey,
        requestKey: spec.requestKey,
        responseKeys: spec.responseKeys,
        ids,
        transport: spec.transport
    });
}

/**
 * @param {object} device
 * @param {string[]} ids
 * @returns {Promise<Object|undefined>}
 */
async function pollMts100All(device, ids) {
    return pollMts100Namespace(device, ids, MTS100_GET_POLLS[0]);
}

/**
 * Polls auxiliary MTS100 namespaces (Adjust, SuperCtl, ScheduleB, Config).
 * Failures are logged and do not abort remaining polls.
 *
 * @param {object} device
 * @param {string[]} ids
 * @returns {Promise<void>}
 */
async function pollMts100Auxiliary(device, ids) {
    const logger = device.meross?.options?.logger || console.debug;
    for (const spec of MTS100_GET_POLLS.slice(1)) {
        try {
            await pollMts100Namespace(device, ids, spec);
        } catch (error) {
            logger(`Failed to fetch MTS100 ${spec.label}: ${error.message}`);
        }
    }
}

/**
 * Creates an MTS100 thermostat feature object for a hub or valve subdevice.
 *
 * @param {Object} device - Hub or MTS100 valve subdevice instance
 * @returns {Object} MTS100 feature with get/set and cached read methods
 */
function createMts100Ability(device) {
    return {
        /**
         * Fetches MTS100 state and updates local caches.
         *
         * On a valve subdevice, uses {@link getCachedOrFetch} on `_hubThermostatStateByChannel` and polls
         * `Appliance.Hub.Mts100.All` when stale. Pass `complete: true` to also poll Adjust, SuperCtl,
         * ScheduleB, and Config (used by hub refresh, not the default hot path).
         *
         * On a hub, polls All for `options.ids` and returns the raw API response. When `complete` is not
         * `false`, auxiliary namespaces are polled as well (same as {@link refreshState}).
         *
         * @param {Object} [options={}] - Get options
         * @param {Array<string>} [options.ids] - Hub only: MTS100 subdevice ID(s)
         * @param {boolean} [options.complete] - Subdevice: poll auxiliary namespaces; hub: defaults to true
         * @returns {Promise<HubThermostatState|Object|undefined>}
         */
        async get(options = {}) {
            if (device.subdeviceId) {
                const ids = [device.subdeviceId];
                const fetcher = async () => {
                    await pollMts100Namespace(device, ids, MTS100_GET_POLLS[0]);
                    if (options.complete) {
                        await pollMts100Auxiliary(device, ids);
                    }
                };
                return getCachedOrFetch(device, '_hubThermostatStateByChannel', 0, fetcher, options);
            }

            const ids = Array.isArray(options.ids) ? options.ids : [];
            const response = await pollMts100Namespace(device, ids, MTS100_GET_POLLS[0]);
            if (options.complete !== false) {
                await pollMts100Auxiliary(device, ids);
            }
            return response;
        },

        /**
         * Sets MTS100 super control mode.
         *
         * @param {Object} options - Set options
         * @param {number} [options.enable] - 1 = disable, 2 = enable (firmware values)
         * @param {number} [options.level] - Super control level (1–3)
         * @param {number} [options.alert] - Alert state (1 = normal, 2 = over-temp warning)
         * @param {string} [options.subId] - Hub only: MTS100 subdevice ID
         * @param {Object} [options.superCtlData] - Hub only: raw superCtl entry (must include `id`)
         * @returns {Promise<Object>}
         */
        async setSuperCtl(options) {
            const subId = device.subdeviceId || options.subId;
            const entry = options.superCtlData
                ? { ...options.superCtlData, id: options.superCtlData.id || subId }
                : {
                    id: subId,
                    enable: options.enable,
                    level: options.level,
                    alert: options.alert
                };

            const { payload: out } = await device.publishMessage('SET', 'Appliance.Hub.Mts100.SuperCtl', {
                superCtl: [entry]
            }, null);

            if (device.subdeviceId) {
                applyThermostatUpdate(device, (state) => {
                    state.update({ superCtl: { ...entry } });
                }, 'response');
            }

            return out;
        },

        /**
         * Sets MTS100 weekly schedule B (v3 valves).
         *
         * Day keys: `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun` — each an array of
         * `[durationMinutes, tempCelsius×10]` periods (`0xFFFF` = off).
         *
         * @param {Object} options - Set options
         * @param {string} [options.subId] - Hub only: MTS100 subdevice ID
         * @param {Object} [options.scheduleData] - Raw schedule entry (must include `id`)
         * @param {Array<Array<number>>} [options.mon]
         * @param {Array<Array<number>>} [options.tue]
         * @param {Array<Array<number>>} [options.wed]
         * @param {Array<Array<number>>} [options.thu]
         * @param {Array<Array<number>>} [options.fri]
         * @param {Array<Array<number>>} [options.sat]
         * @param {Array<Array<number>>} [options.sun]
         * @returns {Promise<Object>}
         */
        async setScheduleB(options) {
            const subId = device.subdeviceId || options.subId;
            const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
            const entry = options.scheduleData
                ? { ...options.scheduleData, id: options.scheduleData.id || subId }
                : { id: subId };

            if (!options.scheduleData) {
                for (const day of weekdays) {
                    if (options[day] !== undefined) {
                        entry[day] = options[day];
                    }
                }
            }

            const { payload: out } = await device.publishMessage('SET', 'Appliance.Hub.Mts100.ScheduleB', {
                schedule: [entry]
            }, null);

            if (device.subdeviceId) {
                applyThermostatUpdate(device, (state) => {
                    state.update({ scheduleB: { ...entry } });
                }, 'response');
            }

            return out;
        },

        /**
         * Sets MTS100 PID configuration (e.g. MTS150P).
         *
         * @param {Object} options - Set options
         * @param {string} [options.subId] - Hub only: MTS100 subdevice ID
         * @param {Object} [options.configData] - Raw config entry (must include `id`)
         * @param {Object} [options.pid] - Subdevice: `{ grade, p, i, d? }` PID block
         * @returns {Promise<Object>}
         */
        async setConfig(options) {
            const subId = device.subdeviceId || options.subId;
            const entry = options.configData
                ? { ...options.configData, id: options.configData.id || subId }
                : { id: subId, pid: options.pid };

            const { payload: out } = await device.publishMessage('SET', 'Appliance.Hub.Mts100.Config', {
                config: [entry]
            }, null);

            if (device.subdeviceId) {
                applyThermostatUpdate(device, (state) => {
                    state.update({ config: { ...entry } });
                }, 'response');
            }

            return out;
        },

        /**
         * Sets valve on/off state.
         *
         * @param {Object} options - Toggle options
         * @param {boolean} options.on - True to turn on, false to turn off
         * @returns {Promise<void>}
         */
        async setToggle(options) {
            if (!device.subdeviceId) {
                throw new Error('mts100.setToggle() is only supported on MTS100 subdevices');
            }
            const { on } = options;
            await device.publishMessage('SET', 'Appliance.Hub.ToggleX', {
                togglex: [{ id: device.subdeviceId, onoff: on ? 1 : 0, channel: 0 }]
            }, null);
            ensureThermostatState(device).updateToggleOnoff(on ? 1 : 0);
        },

        /**
         * Toggles valve on/off state.
         *
         * @returns {Promise<void>}
         */
        async toggle() {
            await this.setToggle({ on: !this.isOn() });
        },

        /**
         * Sets thermostat mode.
         *
         * @param {Object} options - Mode options
         * @param {number} options.mode - Mode value from {@link ThermostatMode} enum
         * @param {string} [options.subId] - Hub only: MTS100 subdevice ID
         * @returns {Promise<Object>}
         */
        async setMode(options) {
            const subId = device.subdeviceId || options.subId;
            const { mode } = options;
            const payload = { mode: [{ id: subId, state: mode }] };
            const { payload: out } = await device.publishMessage('SET', 'Appliance.Hub.Mts100.Mode', payload);
            if (device.subdeviceId) {
                ensureThermostatState(device).updateModeState(mode);
            }
            return out;
        },

        /**
         * Sets target temperature.
         *
         * @param {Object} options - Temperature options
         * @param {number} options.temperature - Target temperature in Celsius
         * @param {string} [options.subId] - Hub only: MTS100 subdevice ID
         * @param {Object} [options.temp] - Hub only: raw temperature object (mutated with subId)
         * @returns {Promise<Object>}
         */
        async setTargetTemperature(options) {
            if (device.subdeviceId) {
                const { temperature } = options;
                const targetTemp = temperature * 10;
                const { payload: out } = await device.publishMessage('SET', 'Appliance.Hub.Mts100.Temperature', {
                    temperature: [{ id: device.subdeviceId, custom: targetTemp }]
                }, null);
                ensureThermostatState(device).update({ temperature: { currentSet: targetTemp } });
                return out;
            }

            const { subId, temp } = options;
            temp.id = subId;
            const payload = { temperature: [temp] };
            return (await device.publishMessage('SET', 'Appliance.Hub.Mts100.Temperature', payload)).payload;
        },

        /**
         * Sets temperature for a preset.
         *
         * @param {Object} options - Preset options
         * @param {string} options.preset - Preset name
         * @param {number} options.temperature - Temperature in Celsius
         * @returns {Promise<void>}
         */
        async setPresetTemperature(options) {
            if (!device.subdeviceId) {
                throw new Error('mts100.setPresetTemperature() is only supported on MTS100 subdevices');
            }
            const { preset, temperature } = options;
            if (!SUPPORTED_PRESETS.includes(preset)) {
                throw new MerossDeviceError(`Preset ${preset} is not supported`, 'COMMAND_FAILED', { preset, deviceUuid: device.uuid });
            }
            const targetTemp = temperature * 10;
            await device.publishMessage('SET', 'Appliance.Hub.Mts100.Temperature', {
                temperature: [{ id: device.subdeviceId, [preset]: targetTemp }]
            }, null);
            const state = getThermostatState(device);
            if (state) {
                state.update({ temperature: { [preset]: targetTemp } });
            }
        },

        /**
         * Sets temperature adjustment offset.
         *
         * @param {Object} options - Adjustment options
         * @param {number} options.temperature - Adjustment offset in Celsius
         * @param {string} [options.subId] - Hub only: MTS100 subdevice ID
         * @param {Object} [options.adjustData] - Hub only: raw adjust object (mutated with subId)
         * @returns {Promise<Object>}
         */
        async setAdjust(options) {
            if (device.subdeviceId) {
                const { temperature } = options;
                const adjustTemp = temperature * 100;
                const { payload: out } = await device.publishMessage('SET', 'Appliance.Hub.Mts100.Adjust', {
                    adjust: [{ id: device.subdeviceId, temperature: adjustTemp }]
                }, null);
                const state = getThermostatState(device);
                if (state) {
                    state.update({
                        adjust: { temperature: adjustTemp },
                        touchAdjustSampleTime: true
                    });
                }
                return out;
            }

            const { subId, adjustData } = options;
            adjustData.id = subId;
            const payload = { adjust: [adjustData] };
            return (await device.publishMessage('SET', 'Appliance.Hub.Mts100.Adjust', payload)).payload;
        },

        /**
         * Whether the valve is on from cached state.
         *
         * @returns {boolean}
         */
        isOn() {
            return getThermostatState(device)?.isOn ?? false;
        },

        /**
         * Current thermostat mode from cached state.
         *
         * @returns {number|undefined}
         */
        getMode() {
            return getThermostatState(device)?.mode;
        },

        /**
         * Target temperature in Celsius from cached state.
         *
         * @returns {number|null}
         */
        getTargetTemperature() {
            return getThermostatState(device)?.targetTemp ?? null;
        },

        /**
         * Last sampled room temperature in Celsius from cached state.
         *
         * @returns {number|null}
         */
        getLastSampledTemperature() {
            return getThermostatState(device)?.roomTemp ?? null;
        },

        /**
         * Minimum supported temperature in Celsius from cached state.
         *
         * @returns {number|null}
         */
        getMinSupportedTemperature() {
            return getThermostatState(device)?.minSupportedTemperature ?? null;
        },

        /**
         * Maximum supported temperature in Celsius from cached state.
         *
         * @returns {number|null}
         */
        getMaxSupportedTemperature() {
            return getThermostatState(device)?.maxSupportedTemperature ?? null;
        },

        /**
         * Whether the valve is heating from cached state.
         *
         * @returns {boolean}
         */
        isHeating() {
            return getThermostatState(device)?.heating ?? false;
        },

        /**
         * Whether window open detection is active from cached state.
         *
         * @returns {boolean}
         */
        isWindowOpen() {
            return getThermostatState(device)?.windowOpen ?? false;
        },

        /**
         * Supported temperature preset names.
         *
         * @returns {Array<string>}
         */
        getSupportedPresets() {
            return [...SUPPORTED_PRESETS];
        },

        /**
         * Temperature for a preset from cached state.
         *
         * @param {string} preset - Preset name
         * @returns {number|null}
         */
        getPresetTemperature(preset) {
            if (!SUPPORTED_PRESETS.includes(preset)) {
                return null;
            }
            return getThermostatState(device)?.getPresetTemperature(preset) ?? null;
        },

        /**
         * Temperature adjustment offset in Celsius from cached state.
         *
         * @returns {number|null}
         */
        getAdjust() {
            return getThermostatState(device)?.adjust ?? null;
        },

        /**
         * Super control settings from cached state.
         *
         * @returns {Object|null}
         */
        getSuperCtl() {
            return getThermostatState(device)?.superCtl ?? null;
        },

        /**
         * Schedule B weekly timetable from cached state (`mon`–`sun` arrays).
         *
         * @returns {Object|null}
         */
        getScheduleB() {
            return getThermostatState(device)?.scheduleB ?? null;
        },

        /**
         * MTS100 PID/config from cached state.
         *
         * @returns {Object|null}
         */
        getConfig() {
            return getThermostatState(device)?.config ?? null;
        }
    };
}

/**
 * Gets MTS100 capability information for a hub thermostat valve subdevice.
 *
 * @param {Object} device - The device instance
 * @param {Array<number>} channelIds - Array of channel IDs
 * @returns {Object|null} MTS100 capability object or null if not supported
 */
function getCapabilities(device, channelIds) {
    if (!subdeviceIs(device, 'mts100')) {
        return null;
    }

    return {
        supported: true,
        channels: channelIds,
        mts100: true,
        mode: !!device.abilities['Appliance.Hub.Mts100.Mode'],
        temperature: !!device.abilities['Appliance.Hub.Mts100.Temperature'],
        adjust: !!device.abilities['Appliance.Hub.Mts100.Adjust'],
        schedule: !!device.abilities['Appliance.Hub.Mts100.ScheduleB']
    };
}

module.exports = createMts100Ability;
module.exports.getCapabilities = getCapabilities;
module.exports.pollMts100All = pollMts100All;
module.exports.pollMts100Auxiliary = pollMts100Auxiliary;
module.exports.ability = {
    key: 'mts100',
    namespaces: [
        'Appliance.Hub.Mts100.All',
        'Appliance.Hub.Mts100.Temperature',
        'Appliance.Hub.Mts100.Mode',
        'Appliance.Hub.Mts100.Adjust',
        'Appliance.Hub.Mts100.SuperCtl',
        'Appliance.Hub.Mts100.ScheduleB',
        'Appliance.Hub.Mts100.Config'
    ],
    family: 'mts100',
    caches: ['_hubThermostatStateByChannel'],
    create: createMts100Ability,
    getCapabilities
};
