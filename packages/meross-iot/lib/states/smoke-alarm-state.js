'use strict';

const { SmokeAlarmStatusCodec, SmokeInterConnCodec } = require('../enums');

/**
 * Derives alarm channel classification from a semantic status string.
 *
 * @param {string|null|undefined} status - Semantic status string
 * @returns {'smoke'|'temperature'|'battery'|'normal'|'interconnection'|'unknown'}
 */
function deriveAlarmCategory(status) {
    if (!status || status === 'unknown') {
        return 'unknown';
    }
    if (status === 'normal') {
        return 'normal';
    }
    if (status === 'interconnection') {
        return 'interconnection';
    }
    if (status.includes('battery')) {
        return 'battery';
    }
    if (status.includes('temperature')) {
        return 'temperature';
    }
    if (status.includes('smoke')) {
        return 'smoke';
    }
    return 'unknown';
}

/**
 * @param {string|null|undefined} status
 * @returns {boolean}
 */
function isFaultStatus(status) {
    return Boolean(status && status.startsWith('error-'));
}

/**
 * @param {string|null|undefined} status
 * @returns {boolean}
 */
function isAlarmingStatus(status) {
    return status === 'alarm-temperature' || status === 'alarm-smoke';
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
     * @param {number|null} [state.status] - Wire status code from firmware
     * @param {number|null} [state.interConn]
     * @param {number|null} [state.lastStatusUpdate]
     */
    constructor(state = null) {
        const initial = state || {};
        const raw = initial.status ?? null;
        this._status = raw !== null ? SmokeAlarmStatusCodec.fromWire(raw) : null;
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
            this._status = typeof status === 'number'
                ? SmokeAlarmStatusCodec.fromWire(status)
                : status;
        }
        if (interConn !== undefined && interConn !== null) {
            this._interConn = interConn;
        }

        return alarmData.event;
    }

    /** @returns {string|null} Semantic status string, or null if not yet received */
    get status() {
        return this._status;
    }

    /** @returns {number|null|undefined} Raw interconnection wire value from firmware */
    get interConn() {
        return this._interConn;
    }

    /**
     * @returns {'inactive'|'active'|null}
     */
    get interConnStatus() {
        if (this._interConn === null || this._interConn === undefined) {
            return null;
        }
        return SmokeInterConnCodec.fromWire(this._interConn);
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
        const s = this._status;
        if (!s || s === 'unknown') { return 'unknown'; }
        if (s === 'normal' || s === 'interconnection') { return 'safe'; }
        if (isFaultStatus(s)) { return 'fault'; }
        if (isAlarmingStatus(s)) { return 'alarming'; }
        if (s === 'mute-smoke' || s === 'mute-temperature') { return 'silenced'; }
        return 'unknown';
    }

    /**
     * Sensor channel when {@link condition} is alarming, silenced, or fault.
     *
     * @returns {'smoke'|'temperature'|'battery'|null}
     */
    get channel() {
        const s = this._status;
        if (!s || s === 'unknown') { return null; }
        if (s === 'mute-smoke') { return 'smoke'; }
        if (s === 'mute-temperature') { return 'temperature'; }
        if (!isFaultStatus(s) && !isAlarmingStatus(s)) { return null; }
        const category = deriveAlarmCategory(s);
        return ['smoke', 'temperature', 'battery'].includes(category) ? category : null;
    }

    /**
     * Mesh linkage when status is `'interconnection'`.
     *
     * @returns {{ linkActive: boolean, raw: number }|null}
     */
    get interconnect() {
        if (this._status !== 'interconnection') { return null; }
        if (this._interConn === null || this._interConn === undefined) { return null; }
        return {
            linkActive: SmokeInterConnCodec.fromWire(this._interConn) === 'active',
            raw: this._interConn
        };
    }

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
