'use strict';

// Main entry point - re-export everything from new modular structure
const ManagerMeross = require('./lib/manager');
const enums = require('./lib/model/enums');
const errors = require('./lib/model/exception');
const states = require('./lib/model/states');

// Export main class
module.exports = ManagerMeross;

// Export error classes
const httpExceptions = require('./lib/model/http/exception');
module.exports.MerossError = errors.MerossError;
module.exports.MerossErrorHttpApi = httpExceptions.MerossErrorHttpApi;
module.exports.MerossErrorAuthentication = errors.MerossErrorAuthentication;
module.exports.MerossErrorMFARequired = httpExceptions.MerossErrorMFARequired;
module.exports.MerossErrorMissingMFA = httpExceptions.MerossErrorMissingMFA;
module.exports.MerossErrorWrongMFA = httpExceptions.MerossErrorWrongMFA;
module.exports.MerossErrorTokenExpired = httpExceptions.MerossErrorTokenExpired;
module.exports.MerossErrorTooManyTokens = httpExceptions.MerossErrorTooManyTokens;
module.exports.MerossErrorUnauthorized = httpExceptions.MerossErrorUnauthorized;
module.exports.MerossErrorBadDomain = httpExceptions.MerossErrorBadDomain;
module.exports.MerossErrorApiLimitReached = errors.MerossErrorApiLimitReached;
module.exports.MerossErrorResourceAccessDenied = errors.MerossErrorResourceAccessDenied;
module.exports.MerossErrorCommandTimeout = errors.MerossErrorCommandTimeout;
module.exports.MerossErrorCommand = errors.MerossErrorCommand;
module.exports.MerossErrorMqtt = errors.MerossErrorMqtt;
module.exports.MerossErrorUnconnected = errors.MerossErrorUnconnected;
module.exports.MerossErrorUnknownDeviceType = errors.MerossErrorUnknownDeviceType;
module.exports.MerossErrorValidation = errors.MerossErrorValidation;
module.exports.MerossErrorNotFound = errors.MerossErrorNotFound;
module.exports.MerossErrorNetworkTimeout = errors.MerossErrorNetworkTimeout;
module.exports.MerossErrorParse = errors.MerossErrorParse;
module.exports.MerossErrorRateLimit = errors.MerossErrorRateLimit;
module.exports.MerossErrorOperationLocked = errors.MerossErrorOperationLocked;
module.exports.MerossErrorUnsupported = errors.MerossErrorUnsupported;
module.exports.MerossErrorInitialization = errors.MerossErrorInitialization;
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

/**
 * Prefer `connect()` on the package default export for authentication instead of constructing this
 * class. Kept for backward compatibility during migration.
 *
 * @deprecated
 */
const MerossHttpClient = require('./lib/http-api');
module.exports.MerossHttpClient = MerossHttpClient;

// Export ManagerSubscription class
const ManagerSubscription = require('./lib/managers/subscription');
module.exports.ManagerSubscription = ManagerSubscription;
