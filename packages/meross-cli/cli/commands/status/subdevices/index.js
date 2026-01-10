'use strict';

const { HubTempHumSensor, HubWaterLeakSensor, HubSmokeDetector, HubThermostatValve } = require('meross-iot');
const { displayTempHumSensorStatus } = require('./hub-temp-hum-sensor');
const { displayWaterLeakSensorStatus } = require('./hub-water-leak-sensor');
const { displaySmokeDetectorStatus } = require('./hub-smoke-detector');
const { displayThermostatValveStatus } = require('./hub-thermostat-valve');

function displaySubdeviceStatus(subdevice) {
    if (subdevice instanceof HubTempHumSensor) {
        return displayTempHumSensorStatus(subdevice);
    } else if (subdevice instanceof HubWaterLeakSensor) {
        return displayWaterLeakSensorStatus(subdevice);
    } else if (subdevice instanceof HubSmokeDetector) {
        return displaySmokeDetectorStatus(subdevice);
    } else if (subdevice instanceof HubThermostatValve) {
        return displayThermostatValveStatus(subdevice);
    }
    return false;
}

module.exports = { displaySubdeviceStatus };

