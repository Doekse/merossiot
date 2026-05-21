'use strict';

const BATTERY_UNSUPPORTED = new Set([0xFFFFFFFF, -1]);

/**
 * Hub subdevice battery level (Appliance.Hub.Battery / Mts100.Battery).
 *
 * Subscription payloads use a scalar per channel (`getState().battery[0]`).
 *
 * @class
 */
class HubBatteryState {
    /**
     * @param {number|null} [percent]
     */
    constructor(percent = null) {
        this._percent = percent;
    }

    /**
     * @param {Object|number|null} data - Hub `{ value }` payload or direct percent
     */
    update(data) {
        let value;
        if (typeof data === 'number' || data === null) {
            value = data;
        } else if (data && data.value !== undefined) {
            value = data.value;
        } else {
            return;
        }

        if (value === undefined || value === null || BATTERY_UNSUPPORTED.has(value)) {
            return;
        }

        this._percent = value;
    }

    /** @returns {number|null} Battery percentage (0–100) */
    get percent() {
        return this._percent;
    }

    /**
     * Scalar channel value for `battery[0]` and scalar `stateChange` emission.
     *
     * @returns {number|null}
     */
    toSnapshot() {
        return this._percent;
    }
}

module.exports = HubBatteryState;
