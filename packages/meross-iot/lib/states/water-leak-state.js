'use strict';

const { WaterLeakCodec } = require('../enums');

/**
 * Hub water leak sensor channel state (MS405, MS400, etc.).
 *
 * Applies monotonic timestamp ordering and maintains a bounded leak-event history
 * for {@link module:abilities/hub-water-leak} `getLastEvents()` when configured.
 *
 * @class
 */
class WaterLeakState {
    /**
     * @param {Object} [options]
     * @param {number} [options.maxEvents=30] - FIFO cap for cached leak events
     */
    constructor(options = {}) {
        this._isLeaking = null;
        this._latestSampleTime = null;
        this._latestDetectedTs = null;
        this._cachedEvents = [];
        this._maxEvents = options.maxEvents ?? 30;
    }

    /**
     * Records a fresh water-leak sample when its timestamp advances state.
     *
     * @param {boolean} leaking - Whether water leak is detected
     * @param {number} timestamp - Event timestamp from hub payload
     * @returns {boolean} True when state or event history changed
     */
    update(leaking, timestamp) {
        if (this._latestSampleTime !== null && timestamp <= this._latestSampleTime) {
            return false;
        }

        let changed = false;

        if (this._latestSampleTime === null || timestamp >= this._latestSampleTime) {
            this._latestSampleTime = timestamp;
            this._isLeaking = leaking;
            changed = true;
        }

        if (leaking && (this._latestDetectedTs === null || timestamp >= this._latestDetectedTs)) {
            this._latestDetectedTs = timestamp;
        }

        if (this._cachedEvents.length >= this._maxEvents) {
            this._cachedEvents.shift();
        }
        this._cachedEvents.push({ leaking, timestamp });

        return changed;
    }

    /**
     * @returns {'dry'|'leaking'|null}
     */
    get leakState() {
        if (this._isLeaking === null || this._isLeaking === undefined) {
            return null;
        }
        return WaterLeakCodec.fromWire(this._isLeaking ? 1 : 0);
    }

    /** @returns {boolean|null} Current leak detection */
    get isLeaking() {
        return this._isLeaking;
    }

    /** @returns {number|null} Timestamp of the latest sample */
    get latestSampleTime() {
        return this._latestSampleTime;
    }

    /** @returns {number|null} Timestamp of the latest positive leak detection */
    get latestDetectedTs() {
        return this._latestDetectedTs;
    }

    /**
     * Copy of cached leak events (newest appended last).
     *
     * @returns {Array<{ leaking: boolean, timestamp: number }>}
     */
    getEvents() {
        return [...this._cachedEvents];
    }

    /**
     * @returns {Object}
     */
    toSnapshot() {
        return {
            leakState: this.leakState,
            isLeaking: this._isLeaking,
            latestSampleTime: this._latestSampleTime,
            latestDetectedTs: this._latestDetectedTs
        };
    }
}

module.exports = WaterLeakState;
