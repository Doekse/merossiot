'use strict';

const { RollerShutterStatusCodec, RollerShutterStoppedByCodec, RollerShutterCalibrationStatusCodec } = require('../enums');

/**
 * Represents the state of a roller shutter device channel.
 *
 * @class
 * @example
 * const rollerShutterState = device.getCachedRollerShutterState(0);
 * if (rollerShutterState) {
 *     console.log('Position:', rollerShutterState.position);
 *     console.log('Status:', rollerShutterState.state);
 * }
 */
class RollerShutterState {
    /**
     * @param {Object} [state=null] - Initial state object (wire-format numbers)
     */
    constructor(state = null) {
        this._state = state || {};
    }

    /**
     * @param {Object} state - New state data to merge
     */
    update(state) {
        if (state) {
            Object.assign(this._state, state);
        }
    }

    /**
     * Movement status.
     *
     * @returns {'idle'|'opening'|'closing'|'unknown'|undefined}
     */
    get state() {
        const { state } = this._state;
        if (state === undefined || state === null) {return undefined;}
        return RollerShutterStatusCodec.fromWire(state);
    }

    /**
     * @returns {number|undefined} Position value (0-100) or undefined if not available
     */
    get position() {
        const { position } = this._state;
        if (position === undefined || position === null) {return undefined;}
        return position;
    }

    /**
     * Reason the shutter stopped moving (present when {@link state} is idle).
     *
     * @returns {'completed'|'manual'|'overheated'|'hall-stop'|'reed-stop'|'hall-failure'|'reed-failure'|'ntc-failure'|'hall-recoil'|'reed-recoil'|undefined}
     */
    get stoppedBy() {
        const { stoppedBy } = this._state;
        if (stoppedBy === undefined || stoppedBy === null) {return undefined;}
        return RollerShutterStoppedByCodec.fromWire(stoppedBy);
    }

    /**
     * Calibration status from {@link Appliance.RollerShutter.Adjust}.
     *
     * @returns {'success'|'timeout'|'stall'|'value-too-large'|'value-too-small'|'hall-failure'|'reed-failure'|'not-calibrated'|undefined}
     */
    get calibrationStatus() {
        const { status } = this._state;
        if (status === undefined || status === null) {return undefined;}
        return RollerShutterCalibrationStatusCodec.fromWire(status);
    }

    /**
     * @returns {number|undefined} Channel number or undefined if not available
     */
    get channel() {
        const { channel } = this._state;
        if (channel === undefined || channel === null) {return undefined;}
        return channel;
    }
}

module.exports = RollerShutterState;
