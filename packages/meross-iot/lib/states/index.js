'use strict';

/**
 * @module lib/states
 * @description State classes for device channels.
 *
 * This module exports state classes that encapsulate device channel state information.
 * Each state class provides a consistent interface for accessing and updating device
 * state. State instances are managed by device controllers and updated automatically
 * when device responses or push notifications are received.
 */

const LightState = require('./light-state');
const ThermostatState = require('./thermostat-state');
const DiffuserLightState = require('./diffuser-light-state');
const DiffuserSprayState = require('./diffuser-spray-state');
const SprayState = require('./spray-state');
const RollerShutterState = require('./roller-shutter-state');
const GarageDoorState = require('./garage-door-state');
const TimerState = require('./timer-state');
const TriggerState = require('./trigger-state');
const ToggleState = require('./toggle-state');
const PresenceSensorState = require('./presence-sensor-state');
const SmokeAlarmState = require('./smoke-alarm-state');
const TemperatureState = require('./temperature-state');
const HumidityState = require('./humidity-state');
const LuxState = require('./lux-state');
const SensorAlertState = require('./sensor-alert-state');
const SensorAdjustState = require('./sensor-adjust-state');
const WaterLeakState = require('./water-leak-state');
const DoorWindowState = require('./door-window-state');
const HubThermostatState = require('./hub-thermostat-state');
const HubBatteryState = require('./hub-battery-state');

module.exports = {
    LightState,
    ThermostatState,
    DiffuserLightState,
    DiffuserSprayState,
    SprayState,
    RollerShutterState,
    GarageDoorState,
    TimerState,
    TriggerState,
    ToggleState,
    PresenceSensorState,
    SmokeAlarmState,
    TemperatureState,
    HumidityState,
    LuxState,
    SensorAlertState,
    SensorAdjustState,
    WaterLeakState,
    DoorWindowState,
    HubThermostatState,
    HubBatteryState
};
