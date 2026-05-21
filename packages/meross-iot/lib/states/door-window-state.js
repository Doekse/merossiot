'use strict';

/**
 * Hub door/window contact sensor channel state (MS200, etc.).
 *
 * @class
 */
class DoorWindowState {
    /**
     * @param {Object} [state]
     * @param {number|null} [state.status] - Raw firmware status (1 = open)
     * @param {number|null} [state.lmTime]
     * @param {number|null} [state.syncedTime]
     */
    constructor(state = null) {
        this._status = state?.status ?? null;
        this._lmTime = state?.lmTime ?? null;
        this._syncedTime = state?.syncedTime ?? null;
        this._samples = state?.samples ?? [];
    }

    /**
     * @param {Object} data - Door/window payload slice
     * @param {Object} [options]
     * @param {boolean} [options.applyStatus=true]
     * @param {boolean} [options.applyLmTime=true]
     */
    update(data, { applyStatus = true, applyLmTime = true } = {}) {
        if (!data) {
            return;
        }
        if (applyStatus && data.status !== undefined && data.status !== null) {
            this._status = data.status;
        }
        if (applyLmTime && data.lmTime !== undefined && data.lmTime !== null) {
            this._lmTime = data.lmTime;
        }
        if (data.syncedTime !== undefined && data.syncedTime !== null) {
            this._syncedTime = data.syncedTime;
        }
        if (data.sample && Array.isArray(data.sample)) {
            this._samples = data.sample.map(([status, ts]) => ({ status, timestamp: ts }));
        }
    }

    /**
     * @returns {Array<{status: number, timestamp: number}>}
     */
    get samples() {
        return [...this._samples];
    }

    /** @returns {number|null} Raw contact status */
    get status() {
        return this._status;
    }

    /** @returns {boolean|null} Whether the contact reports open */
    get isOpen() {
        if (this._status === null || this._status === undefined) {
            return null;
        }
        return this._status === 1;
    }

    /** @returns {number|null} Last modification time from hub */
    get lmTime() {
        return this._lmTime;
    }

    /** @returns {number|null} Hub-reported sync timestamp */
    get syncedTime() {
        return this._syncedTime;
    }

    /**
     * @returns {Object}
     */
    toSnapshot() {
        return {
            isOpen: this.isOpen,
            lmTime: this._lmTime,
            syncedTime: this._syncedTime
        };
    }
}

module.exports = DoorWindowState;
