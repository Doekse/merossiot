'use strict';

// Main entry point - re-export everything from new modular structure
const ManagerMeross = require('./lib/manager');
const enums = require('./lib/model/enums');
const errors = require('./lib/model/exception');
const states = require('./lib/model/states');
const push = require('./lib/model/push');

// Export main class
module.exports = ManagerMeross;

// Export error classes
const httpExceptions = require('./lib/model/http/exception');
module.exports.MerossError = errors.MerossError;
module.exports.HttpApiError = httpExceptions.HttpApiError;
module.exports.AuthenticationError = errors.AuthenticationError;
module.exports.MFARequiredError = httpExceptions.MFARequiredError;
module.exports.MissingMFAError = httpExceptions.MissingMFAError;
module.exports.WrongMFAError = httpExceptions.WrongMFAError;
module.exports.TokenExpiredError = httpExceptions.TokenExpiredError;
module.exports.TooManyTokensError = httpExceptions.TooManyTokensError;
module.exports.UnauthorizedError = httpExceptions.UnauthorizedError;
module.exports.BadDomainError = httpExceptions.BadDomainError;
module.exports.ApiLimitReachedError = errors.ApiLimitReachedError;
module.exports.ResourceAccessDeniedError = errors.ResourceAccessDeniedError;
module.exports.CommandTimeoutError = errors.CommandTimeoutError;
module.exports.CommandError = errors.CommandError;
module.exports.MqttError = errors.MqttError;
module.exports.UnconnectedError = errors.UnconnectedError;
module.exports.UnknownDeviceTypeError = errors.UnknownDeviceTypeError;
module.exports.mapErrorCodeToError = errors.mapErrorCodeToError;

// Export enums
module.exports.TransportMode = enums.TransportMode;
module.exports.ThermostatMode = enums.ThermostatMode;
module.exports.ThermostatWorkingMode = enums.ThermostatWorkingMode;
module.exports.ThermostatModeBState = enums.ThermostatModeBState;
module.exports.LightMode = enums.LightMode;
module.exports.DiffuserLightMode = enums.DiffuserLightMode;
module.exports.DiffuserSprayMode = enums.DiffuserSprayMode;
module.exports.SprayMode = enums.SprayMode;
module.exports.RollerShutterStatus = enums.RollerShutterStatus;
module.exports.DNDMode = enums.DNDMode;
module.exports.OnlineStatus = enums.OnlineStatus;
module.exports.SmokeAlarmStatus = enums.SmokeAlarmStatus;
module.exports.TimerType = enums.TimerType;
module.exports.TriggerType = enums.TriggerType;
module.exports.PresenceState = enums.PresenceState;
module.exports.SensitivityLevel = enums.SensitivityLevel;
module.exports.WorkMode = enums.WorkMode;

// Export state classes
module.exports.ThermostatState = states.ThermostatState;
module.exports.LightState = states.LightState;
module.exports.DiffuserLightState = states.DiffuserLightState;
module.exports.DiffuserSprayState = states.DiffuserSprayState;
module.exports.SprayState = states.SprayState;
module.exports.RollerShutterState = states.RollerShutterState;
module.exports.GarageDoorState = states.GarageDoorState;
module.exports.TimerState = states.TimerState;
module.exports.TriggerState = states.TriggerState;
module.exports.ToggleState = states.ToggleState;
module.exports.PresenceSensorState = states.PresenceSensorState;

// Export model classes
const ChannelInfo = require('./lib/model/channel-info');
const HttpDeviceInfo = require('./lib/model/http/device');
const HttpSubdeviceInfo = require('./lib/model/http/subdevice');
module.exports.ChannelInfo = ChannelInfo;
module.exports.HttpDeviceInfo = HttpDeviceInfo;
module.exports.HttpSubdeviceInfo = HttpSubdeviceInfo;

// Export push notification classes
module.exports.GenericPushNotification = push.GenericPushNotification;
module.exports.OnlinePushNotification = push.OnlinePushNotification;
module.exports.AlarmPushNotification = push.AlarmPushNotification;
module.exports.BindPushNotification = push.BindPushNotification;
module.exports.UnbindPushNotification = push.UnbindPushNotification;
module.exports.WaterLeakPushNotification = push.WaterLeakPushNotification;
module.exports.HubOnlinePushNotification = push.HubOnlinePushNotification;
module.exports.HubToggleXPushNotification = push.HubToggleXPushNotification;
module.exports.HubBatteryPushNotification = push.HubBatteryPushNotification;
module.exports.HubSensorAllPushNotification = push.HubSensorAllPushNotification;
module.exports.HubSensorTempHumPushNotification = push.HubSensorTempHumPushNotification;
module.exports.HubSensorAlertPushNotification = push.HubSensorAlertPushNotification;
module.exports.HubSensorSmokePushNotification = push.HubSensorSmokePushNotification;
module.exports.HubMts100AllPushNotification = push.HubMts100AllPushNotification;
module.exports.HubMts100ModePushNotification = push.HubMts100ModePushNotification;
module.exports.HubMts100TemperaturePushNotification = push.HubMts100TemperaturePushNotification;
module.exports.HubSubdeviceListPushNotification = push.HubSubdeviceListPushNotification;
module.exports.SensorLatestXPushNotification = push.SensorLatestXPushNotification;
module.exports.TimerXPushNotification = push.TimerXPushNotification;
module.exports.TriggerXPushNotification = push.TriggerXPushNotification;
module.exports.ToggleXPushNotification = push.ToggleXPushNotification;
module.exports.PresenceStudyPushNotification = push.PresenceStudyPushNotification;
module.exports.DiffuserLightPushNotification = push.DiffuserLightPushNotification;
module.exports.DiffuserSprayPushNotification = push.DiffuserSprayPushNotification;
module.exports.HardwareInfo = push.HardwareInfo;
module.exports.FirmwareInfo = push.FirmwareInfo;
module.exports.TimeInfo = push.TimeInfo;
module.exports.parsePushNotification = push.parsePushNotification;

// Export timer utilities
module.exports.TimerUtils = require('./lib/utilities/timer');
// Export trigger utilities
module.exports.TriggerUtils = require('./lib/utilities/trigger');
// Export debug utilities
module.exports.createDebugUtils = require('./lib/utilities/debug').createDebugUtils;

// Export device classes
const baseDevice = require('./lib/controller/device');
const hubDevice = require('./lib/controller/hub-device');
module.exports.MerossDevice = baseDevice.MerossDevice;
module.exports.MerossHubDevice = hubDevice.MerossHubDevice;

// Export subdevice classes
const subdevice = require('./lib/controller/subdevice');
module.exports.MerossSubDevice = subdevice.MerossSubDevice;
module.exports.HubTempHumSensor = subdevice.HubTempHumSensor;
module.exports.HubThermostatValve = subdevice.HubThermostatValve;
module.exports.HubWaterLeakSensor = subdevice.HubWaterLeakSensor;
module.exports.HubSmokeDetector = subdevice.HubSmokeDetector;

// Export HTTP client class (for dependency injection pattern)
const MerossHttpClient = require('./lib/http-api');
module.exports.MerossHttpClient = MerossHttpClient;

// Export ManagerSubscription class
const ManagerSubscription = require('./lib/managers/subscription');
module.exports.ManagerSubscription = ManagerSubscription;
