'use strict';

/**
 * Applies {@link ../enums.js} codecs to inbound Meross payload shapes so abilities
 * and push handlers expose decoded string labels instead of wire integers.
 *
 * @module utilities/normalize-payload
 */

const {
    AlarmActionCodec,
    AlarmScopeCodec,
    OverTempValueCodec,
    OverTempTypeCodec,
    UpgradeStatusCodec,
    UpgradeTransferStatusCodec,
    NetTypeCodec,
    IotStatusCodec
} = require('../enums');

/**
 * Decodes alarm event sub-objects (`interConn`, `security`, `maSecurity`) to string labels.
 *
 * @param {Object} field - Raw firmware event slice with `value` and optional `type`
 * @returns {Object}
 */
function decodeAlarmEventField(field) {
    if (!field || typeof field !== 'object') {
        return field;
    }
    const out = { ...field };
    if (field.value !== undefined && field.value !== null) {
        out.action = AlarmActionCodec.fromWire(field.value);
        delete out.value;
    }
    if (field.type !== undefined && field.type !== null) {
        out.scope = AlarmScopeCodec.fromWire(field.type);
        delete out.type;
    }
    return out;
}

/**
 * Normalizes one `alarm[]` item for storage and `stateChange` emission.
 *
 * @param {Object} item
 * @returns {Object}
 */
function normalizeAlarmItem(item) {
    if (!item || typeof item !== 'object') {
        return item;
    }
    if (!item.event || typeof item.event !== 'object') {
        return { ...item };
    }
    const event = { ...item.event };
    for (const key of ['interConn', 'security', 'maSecurity']) {
        if (event[key]) {
            event[key] = decodeAlarmEventField(event[key]);
        }
    }
    return { ...item, event };
}

/**
 * Normalizes `upgradeInfo` from {@link Appliance.Control.Upgrade} payloads.
 *
 * @param {Object} info
 * @returns {Object}
 */
function normalizeUpgradeInfo(info) {
    if (!info || typeof info !== 'object') {
        return info;
    }
    const out = { ...info };
    if (info.status !== undefined && info.status !== null) {
        out.status = UpgradeStatusCodec.fromWire(info.status);
    }
    if (Array.isArray(info.subdev)) {
        out.subdev = info.subdev.map((entry) => {
            if (!entry || typeof entry !== 'object') {
                return entry;
            }
            const sub = { ...entry };
            if (entry.status !== undefined && entry.status !== null) {
                sub.status = UpgradeTransferStatusCodec.fromWire(entry.status);
            }
            return sub;
        });
    }
    return out;
}

/**
 * Normalizes `overTemp` from control or config namespaces.
 *
 * @param {Object} overTemp
 * @param {{ decodeValue?: boolean }} [options]
 * @returns {Object}
 */
function normalizeOverTemp(overTemp, { decodeValue = true } = {}) {
    if (!overTemp || typeof overTemp !== 'object') {
        return overTemp;
    }
    const out = { ...overTemp };
    if (decodeValue && overTemp.value !== undefined && overTemp.value !== null) {
        out.value = OverTempValueCodec.fromWire(overTemp.value);
    }
    if (overTemp.type !== undefined && overTemp.type !== null) {
        out.type = OverTempTypeCodec.fromWire(overTemp.type);
    }
    return out;
}

/**
 * Normalizes `runtime` from {@link Appliance.System.Runtime}.
 *
 * @param {Object} runtime
 * @returns {Object}
 */
function normalizeRuntime(runtime) {
    if (!runtime || typeof runtime !== 'object') {
        return runtime;
    }
    const out = { ...runtime };
    if (runtime.netType !== undefined && runtime.netType !== null) {
        out.netType = NetTypeCodec.fromWire(runtime.netType);
    }
    if (runtime.iotStatus !== undefined && runtime.iotStatus !== null) {
        out.iotStatus = IotStatusCodec.fromWire(runtime.iotStatus);
    }
    return out;
}

module.exports = {
    decodeAlarmEventField,
    normalizeAlarmItem,
    normalizeUpgradeInfo,
    normalizeOverTemp,
    normalizeRuntime
};
