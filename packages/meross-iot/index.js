'use strict';

const Meross = require('./lib/meross');
const errors = require('./lib/exception');

module.exports = Meross;

module.exports.MerossError = errors.MerossError;
module.exports.MerossAuthError = errors.MerossAuthError;
module.exports.MerossDeviceError = errors.MerossDeviceError;
module.exports.MerossApiError = errors.MerossApiError;
module.exports.MerossNetworkError = errors.MerossNetworkError;

const baseDevice = require('./lib/device/device');
const hubDevice = require('./lib/device/hubdevice');
module.exports.MerossDevice = baseDevice.MerossDevice;
module.exports.MerossHubDevice = hubDevice.MerossHubDevice;

const subdevice = require('./lib/device/subdevice');
module.exports.MerossSubDevice = subdevice.MerossSubDevice;

