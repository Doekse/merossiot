'use strict';

const Meross = require('./lib/meross');
const enums = require('./lib/enums');
const errors = require('./lib/exception');

module.exports = Meross;

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

const baseDevice = require('./lib/device/device');
const hubDevice = require('./lib/device/hubdevice');
module.exports.MerossDevice = baseDevice.MerossDevice;
module.exports.MerossHubDevice = hubDevice.MerossHubDevice;

const subdevice = require('./lib/device/subdevice');
module.exports.MerossSubDevice = subdevice.MerossSubDevice;
module.exports.HubTempHumSensor = subdevice.HubTempHumSensor;
module.exports.HubDoorWindowSensor = subdevice.HubDoorWindowSensor;
module.exports.HubThermostatValve = subdevice.HubThermostatValve;
module.exports.HubWaterLeakSensor = subdevice.HubWaterLeakSensor;
module.exports.HubSmokeDetector = subdevice.HubSmokeDetector;

