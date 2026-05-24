'use strict';

const GenericPushNotification = require('./generic');
const OnlinePushNotification = require('./online');
const AlarmPushNotification = require('./alarm');
const UpgradePushNotification = require('./upgrade');
const OverTempPushNotification = require('./over-temp');
const BindPushNotification = require('./bind');
const UnbindPushNotification = require('./unbind');
const WaterLeakPushNotification = require('./water-leak');
const HubOnlinePushNotification = require('./hub-online');
const HubToggleXPushNotification = require('./hub-togglex');
const HubBatteryPushNotification = require('./hub-battery');
const HubSensorAllPushNotification = require('./hub-sensor-all');
const HubSensorTempHumPushNotification = require('./hub-sensor-temphum');
const HubSensorAlertPushNotification = require('./hub-sensor-alert');
const HubSensorSmokePushNotification = require('./hub-sensor-smoke');
const HubMts100AllPushNotification = require('./hub-mts100-all');
const HubMts100ModePushNotification = require('./hub-mts100-mode');
const HubMts100TemperaturePushNotification = require('./hub-mts100-temperature');
const HubSubdeviceListPushNotification = require('./hub-subdevicelist');
const SensorLatestXPushNotification = require('./sensor-latestx');
const TimerXPushNotification = require('./timerx');
const TriggerXPushNotification = require('./triggerx');
const ToggleXPushNotification = require('./togglex');
const PresenceStudyPushNotification = require('./presence-study');
const DiffuserLightPushNotification = require('./diffuser-light');
const DiffuserSprayPushNotification = require('./diffuser-spray');
const { extractHubItems } = require('../abilities/hub');

const PUSH_NOTIFICATION_BINDING = {
    'Appliance.System.Online': OnlinePushNotification,
    'Appliance.Control.Alarm': AlarmPushNotification,
    'Appliance.Control.Upgrade': UpgradePushNotification,
    'Appliance.Control.OverTemp': OverTempPushNotification,
    'Appliance.Control.Bind': BindPushNotification,
    'Appliance.Control.Unbind': UnbindPushNotification,
    'Appliance.Control.ToggleX': ToggleXPushNotification,
    'Appliance.Control.TimerX': TimerXPushNotification,
    'Appliance.Control.TriggerX': TriggerXPushNotification,
    'Appliance.Hub.Sensor.WaterLeak': WaterLeakPushNotification,
    'Appliance.Hub.Online': HubOnlinePushNotification,
    'Appliance.Hub.ToggleX': HubToggleXPushNotification,
    'Appliance.Hub.Battery': HubBatteryPushNotification,
    'Appliance.Hub.Mts100.Battery': HubBatteryPushNotification,
    'Appliance.Hub.Sensor.All': HubSensorAllPushNotification,
    'Appliance.Hub.Sensor.TempHum': HubSensorTempHumPushNotification,
    'Appliance.Hub.Sensor.Alert': HubSensorAlertPushNotification,
    'Appliance.Hub.Sensor.Smoke': HubSensorSmokePushNotification,
    'Appliance.Hub.Mts100.All': HubMts100AllPushNotification,
    'Appliance.Hub.Mts100.Mode': HubMts100ModePushNotification,
    'Appliance.Hub.Mts100.Temperature': HubMts100TemperaturePushNotification,
    'Appliance.Hub.SubdeviceList': HubSubdeviceListPushNotification,
    'Appliance.Control.Sensor.LatestX': SensorLatestXPushNotification,
    'Appliance.Control.Presence.Study': PresenceStudyPushNotification,
    'Appliance.Control.Diffuser.Light': DiffuserLightPushNotification,
    'Appliance.Control.Diffuser.Spray': DiffuserSprayPushNotification
};

/**
 * Strategy functions for extracting data arrays from raw payloads.
 *
 * Some hub notifications have non-standard data structures that don't follow the standard
 * namespace-to-key mapping. These strategies handle special cases like nested structures
 * or inconsistent property names. Data normalization (single object to array) happens
 * at parse time in constructors.
 */
const DATA_EXTRACTION_STRATEGIES = {
    /**
     * Extracts subdevice list data.
     *
     * Handles the inconsistent structure where subdevices may be nested in a 'subdevice'
     * property or directly in 'subdeviceList'.
     */
    'Appliance.Hub.SubdeviceList': (rawData) => {
        if (rawData.subdeviceList) {
            return rawData.subdeviceList.subdevice || rawData.subdeviceList;
        }
        return rawData.subdeviceList;
    }
};

/**
 * Parses a push notification from raw MQTT message data.
 *
 * Factory function that instantiates the appropriate notification class based on namespace.
 * Falls back to GenericPushNotification if no specific class exists or if instantiation fails,
 * ensuring all notifications can be handled even for unknown or malformed payloads.
 *
 * @param {string} namespace - The namespace of the push notification (e.g., 'Appliance.Control.ToggleX')
 * @param {Object} messagePayload - The raw message payload from MQTT
 * @param {string} deviceUuid - The UUID of the device that originated the notification
 * @param {Object} [header] - Optional MQTT message header (e.g. timestamp) to attach for hub routing
 * @returns {GenericPushNotification|null} The parsed notification object, or null if invalid
 * @example
 * const notification = parsePushNotification(
 *     'Appliance.Control.ToggleX',
 *     { togglex: [{ channel: 0, onoff: 1 }] },
 *     'device-uuid-123',
 *     messageHeader
 * );
 * if (notification instanceof ToggleXPushNotification) {
 *     console.log('Toggle state changed');
 * }
 */
function parsePushNotification(namespace, messagePayload, deviceUuid, header) {
    if (!namespace || typeof namespace !== 'string') {
        return null;
    }

    if (!deviceUuid || typeof deviceUuid !== 'string') {
        return null;
    }

    const NotificationClass = PUSH_NOTIFICATION_BINDING[namespace];

    if (NotificationClass) {
        try {
            const notification = new NotificationClass(deviceUuid, messagePayload, namespace);
            notification.setMessageHeader(header);
            return notification;
        } catch (error) {
            // Fall back to generic notification if specific class fails to parse
            return new GenericPushNotification(namespace, deviceUuid, messagePayload, header);
        }
    }

    // Return generic notification for unmapped namespaces (unknown notification types)
    return new GenericPushNotification(namespace, deviceUuid, messagePayload, header);
}

/**
 * Extracts the data array from a raw payload based on namespace.
 *
 * Uses namespace-specific extraction strategies for non-standard structures, otherwise
 * falls back to the standard data key mapping. Returns null if extraction fails.
 *
 * @param {string} namespace - The namespace of the push notification
 * @param {Object} rawData - The raw data payload
 * @returns {Array|null} Data array or null if extraction fails
 * @private
 */
function extractDataArray(namespace, rawData) {
    const extractionStrategy = DATA_EXTRACTION_STRATEGIES[namespace];
    if (extractionStrategy) {
        const extracted = extractionStrategy(rawData);
        if (extracted === null || extracted === undefined) {
            return null;
        }
        return Array.isArray(extracted) ? extracted : [extracted];
    }

    return extractHubItems(namespace, rawData);
}

/**
 * Routes a hub push notification to the appropriate subdevices.
 *
 * Extracts subdevice data from a hub notification and forwards it to the corresponding
 * subdevice instances. Each subdevice processes the notification asynchronously via
 * {@link MerossSubDevice#handleMessage}. Skips unregistered subdevices and logs warnings.
 *
 * @param {GenericPushNotification} notification - The push notification instance
 * @param {MerossHubDevice} hubDevice - The hub device instance
 * @example
 * const notification = parsePushNotification(namespace, payload, hubUuid);
 * if (notification.namespace.startsWith('Appliance.Hub.')) {
 *     routeToSubdevices(notification, hubDevice);
 * }
 */
function routeToSubdevices(notification, hubDevice) {
    if (!notification || !hubDevice || typeof hubDevice.getSubdevice !== 'function') {
        return;
    }

    const { namespace } = notification;
    const rawData = notification.rawData || {};

    // Extract data array using namespace-specific extraction logic
    const dataArray = extractDataArray(namespace, rawData);

    if (!Array.isArray(dataArray)) {
        return;
    }

    for (const item of dataArray) {
        // Handle inconsistent subdevice ID field names across notification types
        const subdeviceId = item.subId || item.id;
        if (!subdeviceId) {
            continue;
        }

        const subdevice = hubDevice.getSubdevice(subdeviceId);
        if (!subdevice) {
            const logger = hubDevice.meross.options.logger || console.warn;
            logger(`Received update for subdevice (id ${subdeviceId}) that has not been registered with hub ${hubDevice.uuid}. Update will be skipped.`);
            continue;
        }

        // Process asynchronously and catch errors to prevent one failure from blocking others
        if (typeof subdevice.handleMessage === 'function') {
            subdevice.handleMessage({ header: notification.header, namespace, payload: item }).catch(err => {
                const logger = hubDevice.meross.options.logger || console.error;
                logger(`Error routing hub ${namespace} notification to subdevice ${subdeviceId}: ${err.message}`);
            });
        }
    }
}

module.exports = {
    parsePushNotification,
    routeToSubdevices
};

