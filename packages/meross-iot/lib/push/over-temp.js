'use strict';

const GenericPushNotification = require('./generic');
const { normalizeOverTemp } = require('../utilities/normalize-payload');

/**
 * Push notification for over-temperature events.
 *
 * @class
 * @extends GenericPushNotification
 */
class OverTempPushNotification extends GenericPushNotification {
    /**
     * @param {string} originatingDeviceUuid
     * @param {Object} rawData
     * @param {Object} [rawData.overTemp]
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Control.OverTemp', originatingDeviceUuid, rawData);

        const overTemp = rawData?.overTemp;
        if (overTemp) {
            this._overTemp = normalizeOverTemp(overTemp);
        }
    }

    /** @returns {Object|undefined} Decoded over-temperature event */
    get overTemp() {
        return this._overTemp;
    }

    /** @returns {'over-temp'|'normal'|undefined} */
    get value() {
        return this._overTemp?.value;
    }

    /** @returns {'early-warning'|'shutoff-relay'|undefined} */
    get type() {
        return this._overTemp?.type;
    }

    /** @returns {number|undefined} */
    get timestamp() {
        return this._overTemp?.timestamp;
    }
}

module.exports = OverTempPushNotification;
