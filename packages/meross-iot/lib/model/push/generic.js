'use strict';

/**
 * Base class for all push notifications from Meross devices.
 *
 * Push notifications are emitted by devices via MQTT to notify about state changes, alarms,
 * online status changes, and other events. All specific notification types extend this base class.
 *
 * @class
 * @example
 * device.on('pushNotification', (notification) => {
 *     if (notification instanceof GenericPushNotification) {
 *         console.log('Notification from:', notification.originatingDeviceUuid);
 *         console.log('Namespace:', notification.namespace);
 *     }
 * });
 */
class GenericPushNotification {
    /**
     * Creates a new GenericPushNotification instance.
     *
     * @param {string} namespace - The namespace of the notification (e.g., 'Appliance.Control.ToggleX')
     * @param {string} originatingDeviceUuid - UUID of the device that sent the notification
     * @param {Object} [rawData={}] - Raw notification data from the device
     */
    constructor(namespace, originatingDeviceUuid, rawData) {
        this._namespace = namespace;
        this._originatingDeviceUuid = originatingDeviceUuid;
        this._rawData = rawData || {};
    }

    /**
     * Gets the namespace of the notification.
     *
     * @returns {string} Namespace string (e.g., 'Appliance.Control.ToggleX')
     */
    get namespace() {
        return this._namespace;
    }

    /**
     * Gets the UUID of the device that sent the notification.
     *
     * @returns {string} Device UUID
     */
    get originatingDeviceUuid() {
        return this._originatingDeviceUuid;
    }

    /**
     * Gets the raw notification data.
     *
     * @returns {Object} Raw data object from the device
     */
    get rawData() {
        return this._rawData;
    }

    /**
     * Routes this notification to the appropriate subdevices if it's a hub notification.
     *
     * Delegates to the factory's routing helper to avoid circular dependencies between
     * this module and the factory module. Can be overridden by specific notification
     * classes for custom routing logic.
     *
     * @param {MerossHubDevice} hubDevice - The hub device instance
     */
    routeToSubdevices(hubDevice) {
        // Import here to avoid circular dependency
        const { routeToSubdevices: routeToSubdevicesHelper } = require('./factory');
        routeToSubdevicesHelper(this, hubDevice);
    }

    /**
     * Extracts state changes from this notification.
     *
     * Returns an object describing what changed, keyed by feature type. Each notification
     * type should override this method to extract its specific changes. Used by subscription
     * managers to identify what changed in a push notification.
     *
     * @returns {Object} Changes object, e.g., { toggle: { 0: true }, presence: { 0: {...} } }
     * @example
     * const changes = notification.extractChanges();
     * if (changes.toggle) {
     *     console.log('Toggle changed:', changes.toggle);
     * }
     */
    extractChanges() {
        return {};
    }

    /**
     * Normalizes data structure to ensure consistent array format for routing.
     *
     * Converts single objects to arrays, keeps arrays as-is, and returns empty arrays
     * for null/undefined. This normalization is necessary because Meross devices may send
     * either single objects or arrays for the same data structure, and routing logic
     * expects arrays for consistent iteration.
     *
     * @param {*} data - The data to normalize (can be object, array, null, or undefined)
     * @returns {Array} Normalized array
     */
    static normalizeToArray(data) {
        if (Array.isArray(data)) {
            return data;
        }
        if (data !== null && data !== undefined) {
            return [data];
        }
        return [];
    }
}

module.exports = GenericPushNotification;

