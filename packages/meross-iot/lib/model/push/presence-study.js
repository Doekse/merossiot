'use strict';

const GenericPushNotification = require('./generic');

/**
 * Push notification for presence sensor study/calibration status changes.
 *
 * Emitted when a presence sensor's study/calibration mode status changes (e.g., study mode
 * started or stopped). Contains the updated study status for one or more channels.
 *
 * @class
 * @extends GenericPushNotification
 * @example
 * device.on('pushNotification', (notification) => {
 *     if (notification instanceof PresenceStudyPushNotification) {
 *         const studyData = notification.studyData;
 *         studyData.forEach(study => {
 *             console.log(`Channel ${study.channel} study status: ${study.status === 1 ? 'active' : 'inactive'}`);
 *             console.log(`Study value: ${study.value}`);
 *         });
 *     }
 * });
 */
class PresenceStudyPushNotification extends GenericPushNotification {
    /**
     * Creates a new PresenceStudyPushNotification instance.
     *
     * @param {string} originatingDeviceUuid - UUID of the device that sent the notification
     * @param {Object} rawData - Raw notification data from the device
     * @param {Object|Array} [rawData.study] - Study status data (single object or array)
     * @param {number} [rawData.study.channel] - Channel number
     * @param {number} [rawData.study.value] - Study mode value (typically 1-3)
     * @param {number} [rawData.study.status] - Study status (0 = stop/inactive, 1 = start/active)
     */
    constructor(originatingDeviceUuid, rawData) {
        super('Appliance.Control.Presence.Study', originatingDeviceUuid, rawData);

        // Devices may send single objects or arrays; normalize to array for consistent processing
        const studyRaw = rawData?.study;
        const study = GenericPushNotification.normalizeToArray(studyRaw);

        // Update rawData so routing logic receives normalized structure
        if (rawData && studyRaw !== study) {
            rawData.study = study;
        }

        this._studyData = study;
    }

    /**
     * Gets the study status data array.
     *
     * @returns {Array} Array of study status objects (empty array if no data)
     */
    get studyData() {
        return this._studyData;
    }
}

module.exports = PresenceStudyPushNotification;

