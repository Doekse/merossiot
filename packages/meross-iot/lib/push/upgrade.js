'use strict';

const GenericPushNotification = require('./generic');
const { normalizeUpgradeInfo } = require('../utilities/normalize-payload');

/**
 * Push notification for firmware upgrade progress.
 *
 * @class
 * @extends GenericPushNotification
 */
class UpgradePushNotification extends GenericPushNotification {
    /**
     * @param {string} originatingDeviceUuid
     * @param {Object} rawData
     * @param {Object} [rawData.upgradeInfo]
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Control.Upgrade', originatingDeviceUuid, rawData);

        const info = rawData?.upgradeInfo;
        if (info) {
            this._upgradeInfo = normalizeUpgradeInfo(info);
        }
    }

    /** @returns {Object|undefined} Decoded upgrade progress */
    get upgradeInfo() {
        return this._upgradeInfo;
    }

    /** @returns {string|undefined} Decoded overall upgrade status */
    get status() {
        return this._upgradeInfo?.status;
    }

    /** @returns {number|undefined} Sub-device download progress percentage */
    get percent() {
        return this._upgradeInfo?.percent;
    }

    /** @returns {Array<Object>|undefined} Sub-device transfer entries with decoded `status` */
    get subdev() {
        return this._upgradeInfo?.subdev;
    }
}

module.exports = UpgradePushNotification;
