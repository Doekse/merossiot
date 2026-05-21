'use strict';

const { SmokeAlarmStatus } = require('../enums');

/**
 * Derives legacy subscription fields from a raw firmware status code.
 *
 * @param {number|null|undefined} status
 * @returns {{ alarmType: string, isActive: boolean, isMuted: boolean, isError: boolean }}
 */
function deriveAlarmFields(status) {
    if (status === null || status === undefined) {
        return {
            alarmType: 'unknown',
            isActive: false,
            isMuted: false,
            isError: false
        };
    }

    const isError = status === SmokeAlarmStatus.ERROR_TEMPERATURE ||
        status === SmokeAlarmStatus.ERROR_SMOKE ||
        status === SmokeAlarmStatus.ERROR_BATTERY ||
        status === SmokeAlarmStatus.ERROR_TEMPERATURE_MUTED ||
        status === SmokeAlarmStatus.ERROR_SMOKE_MUTED ||
        status === SmokeAlarmStatus.ERROR_BATTERY_MUTED;

    const isMuted = status === SmokeAlarmStatus.ERROR_TEMPERATURE_MUTED ||
        status === SmokeAlarmStatus.ERROR_SMOKE_MUTED ||
        status === SmokeAlarmStatus.ERROR_BATTERY_MUTED ||
        status === SmokeAlarmStatus.MUTE_TEMPERATURE_ALARM ||
        status === SmokeAlarmStatus.MUTE_SMOKE_ALARM;

    const isActive = status === SmokeAlarmStatus.ALARM_TEMPERATURE ||
        status === SmokeAlarmStatus.ALARM_SMOKE;

    let alarmType = 'unknown';
    if (status === SmokeAlarmStatus.NORMAL) {
        alarmType = 'normal';
    } else if (status === SmokeAlarmStatus.INTERCONNECTION_STATUS) {
        alarmType = 'interconnection';
    } else if (status === SmokeAlarmStatus.ERROR_BATTERY ||
        status === SmokeAlarmStatus.ERROR_BATTERY_MUTED) {
        alarmType = 'battery';
    } else if (status === SmokeAlarmStatus.ERROR_TEMPERATURE ||
        status === SmokeAlarmStatus.ERROR_TEMPERATURE_MUTED ||
        status === SmokeAlarmStatus.ALARM_TEMPERATURE ||
        status === SmokeAlarmStatus.MUTE_TEMPERATURE_ALARM) {
        alarmType = 'temperature';
    } else if (status === SmokeAlarmStatus.ERROR_SMOKE ||
        status === SmokeAlarmStatus.ERROR_SMOKE_MUTED ||
        status === SmokeAlarmStatus.ALARM_SMOKE ||
        status === SmokeAlarmStatus.MUTE_SMOKE_ALARM) {
        alarmType = 'smoke';
    }

    return { alarmType, isActive, isMuted, isError };
}

/**
 * Normalizes smoke alarm payload entries (object or single-element array).
 *
 * @param {Object|Array|undefined|null} data
 * @returns {Object|undefined}
 */
function normalizeAlarmData(data) {
    if (Array.isArray(data) && data.length > 0) {
        return data[0];
    }
    return data;
}

/**
 * Resolves ordering timestamp from Sensor.Smoke or Sensor.All payload variants.
 *
 * @param {Object|undefined|null} alarmData
 * @returns {number|undefined}
 */
function resolveAlarmTimestamp(alarmData) {
    return alarmData?.timestamp ?? alarmData?.lmTime ?? alarmData?.lmtime;
}

/**
 * Hub smoke detector channel state (MA151, etc.).
 *
 * Holds raw firmware fields internally; {@link toSnapshot} exposes only derived
 * subscription fields aligned with `getState().smokeAlarm[0]`.
 *
 * @class
 */
class SmokeAlarmState {
    /**
     * @param {Object} [state]
     * @param {number|null} [state.status]
     * @param {number|null} [state.interConn]
     * @param {number|null} [state.lastStatusUpdate]
     */
    constructor(state = null) {
        const initial = state || {};
        this._status = initial.status ?? null;
        this._interConn = initial.interConn ?? null;
        this._lastStatusUpdate = initial.lastStatusUpdate ?? null;
    }

    /**
     * Merges a smoke alarm payload when its timestamp is not stale.
     *
     * @param {Object|Array} data - Smoke alarm object or array wrapper from hub PUSH/GET
     * @returns {Object|undefined} Normalized `event.test` when present, for test-event queues on the subdevice class
     */
    update(data) {
        const alarmData = normalizeAlarmData(data);
        if (!alarmData) {
            return undefined;
        }

        const timestamp = resolveAlarmTimestamp(alarmData);
        if (timestamp !== undefined && timestamp !== null &&
            this._lastStatusUpdate !== null && timestamp <= this._lastStatusUpdate) {
            return alarmData.event;
        }

        if (timestamp !== undefined && timestamp !== null) {
            this._lastStatusUpdate = timestamp;
        }

        const { status, interConn } = alarmData;
        if (status !== undefined && status !== null) {
            this._status = status;
        }
        if (interConn !== undefined && interConn !== null) {
            this._interConn = interConn;
        }

        return alarmData.event;
    }

    /** @returns {number|null} Raw firmware status code */
    get status() {
        return this._status;
    }

    /** @returns {number|null|undefined} Interconnection flag from firmware when reported */
    get interConn() {
        return this._interConn;
    }

    /** @returns {number|null} Last applied status timestamp */
    get lastStatusUpdate() {
        return this._lastStatusUpdate;
    }

    /**
     * Primary condition derived from firmware `status`.
     *
     * @returns {'safe'|'alarming'|'silenced'|'fault'|'unknown'}
     */
    get condition() {
        const status = this._status;
        if (status === null || status === undefined) {
            return 'unknown';
        }
        if (status === SmokeAlarmStatus.NORMAL ||
            status === SmokeAlarmStatus.INTERCONNECTION_STATUS) {
            return 'safe';
        }

        const derived = deriveAlarmFields(status);
        if (derived.isError) {
            return 'fault';
        }
        if (derived.isActive) {
            return 'alarming';
        }
        if (status === SmokeAlarmStatus.MUTE_SMOKE_ALARM ||
            status === SmokeAlarmStatus.MUTE_TEMPERATURE_ALARM) {
            return 'silenced';
        }

        return 'unknown';
    }

    /**
     * Sensor channel when {@link condition} is alarming, silenced, or fault.
     *
     * @returns {'smoke'|'temperature'|'battery'|null}
     */
    get channel() {
        const status = this._status;
        if (status === null || status === undefined) {
            return null;
        }
        if (status === SmokeAlarmStatus.MUTE_SMOKE_ALARM) {
            return 'smoke';
        }
        if (status === SmokeAlarmStatus.MUTE_TEMPERATURE_ALARM) {
            return 'temperature';
        }

        const { alarmType, isError, isActive } = deriveAlarmFields(status);
        if (!isError && !isActive) {
            return null;
        }
        if (alarmType === 'smoke' || alarmType === 'temperature' || alarmType === 'battery') {
            return alarmType;
        }

        return null;
    }

    /**
     * Mesh linkage when firmware `status` is {@link SmokeAlarmStatus.INTERCONNECTION_STATUS}.
     *
     * @returns {{ linkActive: boolean, raw: number }|null}
     */
    get interconnect() {
        if (this._status !== SmokeAlarmStatus.INTERCONNECTION_STATUS) {
            return null;
        }
        if (this._interConn === null || this._interConn === undefined) {
            return null;
        }
        return { linkActive: this._interConn === 1, raw: this._interConn };
    }

    /** @returns {string} Legacy firmware category; prefer {@link condition} and {@link channel} */
    get alarmType() {
        return deriveAlarmFields(this._status).alarmType;
    }

    /** @returns {boolean} Whether an active temperature or smoke alarm is reported */
    get isActive() {
        return deriveAlarmFields(this._status).isActive;
    }

    /** @returns {boolean} Whether the detector is in a muted state */
    get isMuted() {
        return deriveAlarmFields(this._status).isMuted;
    }

    /** @returns {boolean} Whether the detector reports a fault condition */
    get isError() {
        return deriveAlarmFields(this._status).isError;
    }

    /**
     * Subscription slice for channel 0 (`smokeAlarm` event type).
     *
     * Wire-format fields (`status`, `interConn`) stay on the state instance; use
     * {@link module:abilities/hub-smoke} getters (`getStatus`, `getInterConn`, etc.).
     *
     * @returns {{
     *   condition: 'safe'|'alarming'|'silenced'|'fault'|'unknown',
     *   channel: 'smoke'|'temperature'|'battery'|null,
     *   interconnect: { linkActive: boolean, raw: number }|null,
     *   lastStatusUpdate: number|null
     * }}
     */
    toSnapshot() {
        return {
            condition: this.condition,
            channel: this.channel,
            interconnect: this.interconnect,
            lastStatusUpdate: this._lastStatusUpdate
        };
    }
}

module.exports = SmokeAlarmState;
module.exports.deriveAlarmFields = deriveAlarmFields;
