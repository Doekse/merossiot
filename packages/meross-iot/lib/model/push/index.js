/**
 * @module lib/model/push
 * @description
 * Push notification classes for handling real-time updates from Meross devices.
 *
 * Provides classes for parsing and handling various types of push notifications sent by
 * Meross devices via MQTT. These notifications enable real-time event handling without
 * polling, covering device state changes, alarms, hub subdevice updates, and configuration
 * changes. Each notification type extends GenericPushNotification and provides type-specific
 * data accessors and change extraction methods.
 *
 * @example
 * const { parsePushNotification, ToggleXPushNotification } = require('./lib/model/push');
 *
 * device.on('pushNotificationReceived', (notification) => {
 *     if (notification instanceof ToggleXPushNotification) {
 *         console.log('Toggle state changed');
 *     }
 * });
 */

'use strict';

const GenericPushNotification = require('./generic');
const OnlinePushNotification = require('./online');
const AlarmPushNotification = require('./alarm');
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
const { HardwareInfo, FirmwareInfo, TimeInfo } = require('./common');
const { parsePushNotification } = require('./factory');

module.exports = {
    GenericPushNotification,
    OnlinePushNotification,
    AlarmPushNotification,
    BindPushNotification,
    UnbindPushNotification,
    WaterLeakPushNotification,
    HubOnlinePushNotification,
    HubToggleXPushNotification,
    HubBatteryPushNotification,
    HubSensorAllPushNotification,
    HubSensorTempHumPushNotification,
    HubSensorAlertPushNotification,
    HubSensorSmokePushNotification,
    HubMts100AllPushNotification,
    HubMts100ModePushNotification,
    HubMts100TemperaturePushNotification,
    HubSubdeviceListPushNotification,
    SensorLatestXPushNotification,
    TimerXPushNotification,
    TriggerXPushNotification,
    ToggleXPushNotification,
    PresenceStudyPushNotification,
    DiffuserLightPushNotification,
    DiffuserSprayPushNotification,
    HardwareInfo,
    FirmwareInfo,
    TimeInfo,
    parsePushNotification
};

