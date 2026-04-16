'use strict';

const ManagerMeross = require('./lib/manager');
const enums = require('./lib/model/enums');
const errors = require('./lib/model/exception');

module.exports = ManagerMeross;

module.exports.MerossError = errors.MerossError;
module.exports.MerossAuthError = errors.MerossAuthError;
module.exports.MerossDeviceError = errors.MerossDeviceError;
module.exports.MerossApiError = errors.MerossApiError;
module.exports.MerossNetworkError = errors.MerossNetworkError;

module.exports.TransportMode = enums.TransportMode;
module.exports.ThermostatMode = enums.ThermostatMode;
module.exports.LightMode = enums.LightMode;
module.exports.DiffuserLightMode = enums.DiffuserLightMode;
module.exports.DiffuserSprayMode = enums.DiffuserSprayMode;
module.exports.SprayMode = enums.SprayMode;
module.exports.DNDMode = enums.DNDMode;
module.exports.OnlineStatus = enums.OnlineStatus;
module.exports.SmokeAlarmStatus = enums.SmokeAlarmStatus;
module.exports.TimerType = enums.TimerType;
module.exports.TriggerType = enums.TriggerType;

const baseDevice = require('./lib/controller/device');
const hubDevice = require('./lib/controller/hub-device');
module.exports.MerossDevice = baseDevice.MerossDevice;
module.exports.MerossHubDevice = hubDevice.MerossHubDevice;

const subdevice = require('./lib/controller/subdevice');
module.exports.MerossSubDevice = subdevice.MerossSubDevice;
module.exports.HubTempHumSensor = subdevice.HubTempHumSensor;
module.exports.HubThermostatValve = subdevice.HubThermostatValve;
module.exports.HubWaterLeakSensor = subdevice.HubWaterLeakSensor;
module.exports.HubSmokeDetector = subdevice.HubSmokeDetector;

