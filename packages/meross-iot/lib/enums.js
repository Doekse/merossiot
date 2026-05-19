'use strict';

/**
 * Transport mode for device communication.
 *
 * Determines how the library communicates with Meross devices. Each mode
 * uses different protocols and network paths, affecting latency, reliability,
 * and whether remote access is required.
 *
 * @enum {number}
 * @readonly
 */
const TransportMode = {
    /**
     * MQTT-only communication.
     *
     * All commands route through the Meross cloud MQTT broker. Required when
     * devices are not on the local network or when local network access is
     * unavailable, but introduces cloud latency compared to direct LAN communication.
     *
     * @constant {number}
     */
    MQTT_ONLY: 0,

    /**
     * LAN HTTP with MQTT fallback.
     *
     * Attempts direct HTTP communication over the local network first for lower
     * latency. Falls back to MQTT if the device is unreachable locally, enabling
     * both fast local access and remote access when needed.
     *
     * @constant {number}
     */
    LAN_HTTP_FIRST: 1,

    /**
     * LAN HTTP for reads only, MQTT for writes.
     *
     * Uses LAN HTTP for read operations (GET requests) to reduce latency for
     * status queries. Write operations (SET requests) route through MQTT to
     * ensure consistency across multiple clients and enable remote access.
     *
     * @constant {number}
     */
    LAN_HTTP_FIRST_ONLY_GET: 2
};

/**
 * Thermostat operating mode.
 *
 * Defines the working mode of the thermostat. Each mode determines how
 * the device maintains temperature and which temperature parameters are used.
 *
 * @enum {number}
 * @readonly
 */
const ThermostatMode = {
    /**
     * Heating mode.
     *
     * Working mode: Heating. Device only heats to reach the target temperature.
     *
     * @constant {number}
     */
    HEAT: 0,

    /**
     * Cooling mode.
     *
     * Working mode: Cooling. Device only cools to reach the target temperature.
     *
     * @constant {number}
     */
    COOL: 1,

    /**
     * Economy mode.
     *
     * Working mode: Economic. Reduces energy consumption by operating at
     * economic temperature settings.
     *
     * @constant {number}
     */
    ECONOMY: 2,

    /**
     * Auto mode.
     *
     * Working mode: Automatic. Device automatically selects heating or cooling
     * as needed to maintain the target temperature.
     *
     * @constant {number}
     */
    AUTO: 3,

    /**
     * Manual mode.
     *
     * Working mode: Manual. User directly controls heating and cooling without
     * automatic temperature regulation.
     *
     * @constant {number}
     */
    MANUAL: 4
};

/**
 * Thermostat working status.
 *
 * Indicates the current active operation when the thermostat is maintaining
 * temperature. Used with `ThermostatMode.AUTO` to determine which system
 * is currently active. Note: 0 indicates Idle status.
 *
 * @enum {number}
 * @readonly
 * @see {@link ThermostatMode}
 */
const ThermostatWorkingMode = {
    /**
     * Heating is active.
     *
     * Working status: Heating. Indicates the thermostat is currently heating
     * to reach the target temperature.
     *
     * @constant {number}
     */
    HEAT: 1,

    /**
     * Cooling is active.
     *
     * Working status: Cooling. Indicates the thermostat is currently cooling
     * to reach the target temperature.
     *
     * @constant {number}
     */
    COOL: 2
};

/**
 * Thermostat Mode B state.
 *
 * Indicates whether the thermostat is actively operating or idle. Some
 * thermostat models use this field instead of or in addition to
 * `ThermostatWorkingMode` to report operational status.
 *
 * @enum {number}
 * @readonly
 */
const ThermostatModeBState = {
    /**
     * Actively heating or cooling.
     *
     * Indicates the thermostat is currently operating to change the temperature.
     *
     * @constant {number}
     */
    HEATING_COOLING: 1,

    /**
     * Idle - not currently heating or cooling.
     *
     * Indicates the thermostat has reached the target temperature or is waiting
     * for conditions that require heating or cooling.
     *
     * @constant {number}
     */
    NOT_HEATING_COOLING: 2
};

/**
 * Light mode for RGB-capable lights.
 *
 * Defines which color control method the light uses based on capacity flags.
 * Each mode determines which parameters are valid (RGB values, color temperature,
 * or brightness only). These values correspond to capacity bit flags.
 *
 * @enum {number}
 * @readonly
 */
const LightMode = {
    /**
     * RGB color mode.
     *
     * Capacity flag 0x1: RGB field is valid. Full color control using red, green,
     * and blue component values (0x0~0xFFFFFF). Requires RGB parameter.
     *
     * @constant {number}
     */
    MODE_RGB: 1,

    /**
     * Color temperature mode.
     *
     * Capacity flag 0x2: Temperature field is valid. Controls color temperature
     * along the warm-to-cool white spectrum. Value range is 1~100 where larger
     * values are colder (1 is yellowest, 100 is coldest).
     *
     * @constant {number}
     */
    MODE_TEMPERATURE: 2,

    /**
     * Luminance-only mode.
     *
     * Capacity flag 0x4: Luminance field is valid. Controls brightness only
     * without color control. Value range is 1-100 (or 0-100 for WWA standard).
     *
     * @constant {number}
     */
    MODE_LUMINANCE: 4
};

/**
 * Light mode for diffuser devices.
 *
 * Defines how the LED lights on a diffuser device operate. Diffusers support
 * RGB cycle mode, fixed RGB colors, or night light mode (warm white).
 *
 * @enum {number}
 * @readonly
 */
const DiffuserLightMode = {
    /**
     * RGB cycle mode.
     *
     * Colors cycle automatically through a predefined sequence without
     * requiring continuous updates.
     *
     * @constant {number}
     */
    ROTATING_COLORS: 0,

    /**
     * Fixed color mode.
     *
     * Fixed RGB color. Displays a specific RGB color until changed.
     * Requires RGB parameter. This parameter is only valid when mode is fixed color.
     *
     * @constant {number}
     */
    FIXED_RGB: 1,

    /**
     * Night light mode.
     *
     * Fixed to warm white light with default brightness 100%.
     * Used for night light functionality.
     *
     * @constant {number}
     */
    FIXED_LUMINANCE: 2
};

/**
 * Spray mode for diffuser devices (mod100).
 *
 * Controls the mist/spray output intensity from a diffuser device.
 * mod100 supports 3 modes. The newly added mod150 continues to use 'mod100'
 * because the corresponding mode items are consistent.
 *
 * @enum {number}
 * @readonly
 */
const DiffuserSprayMode = {
    /**
     * Small spray.
     *
     * Lower mist output rate, suitable for smaller spaces or extended operation.
     *
     * @constant {number}
     */
    LIGHT: 0,

    /**
     * Large spray.
     *
     * Higher mist output rate, suitable for larger spaces or faster diffusion.
     *
     * @constant {number}
     */
    STRONG: 1,

    /**
     * Spray off.
     *
     * Mist/spray output is turned off.
     *
     * @constant {number}
     */
    OFF: 2
};

/**
 * Spray mode for spray devices.
 *
 * Controls the spray pattern for devices that spray liquids (e.g., misting devices).
 * Determines whether spraying is continuous or cycles on and off.
 *
 * @enum {number}
 * @readonly
 */
const SprayMode = {
    /**
     * Spray disabled.
     *
     * Spray output is turned off.
     *
     * @constant {number}
     */
    OFF: 0,

    /**
     * Continuous spray.
     *
     * Sprays continuously without interruption until manually stopped or
     * the device runs out of liquid. Provides consistent output without
     * cycling.
     *
     * @constant {number}
     */
    CONTINUOUS: 1,

    /**
     * Intermittent spray.
     *
     * Sprays in repeating on/off cycles to conserve liquid and reduce
     * over-saturation. The device automatically cycles between spraying
     * and pausing.
     *
     * @constant {number}
     */
    INTERMITTENT: 2
};

/**
 * Roller shutter status/state.
 *
 * Indicates the current motion status of the curtain controller.
 * Used to determine if the shutter is moving, stopped, or in an unknown state.
 *
 * @enum {number}
 * @readonly
 */
const RollerShutterStatus = {
    /**
     * Unknown status.
     *
     * State could not be determined, typically due to communication issues,
     * device initialization, or when the device has not yet reported its status.
     *
     * @constant {number}
     */
    UNKNOWN: -1,

    /**
     * Stopped.
     *
     * Indicates the current motion status is stopped. The shutter is not moving.
     *
     * @constant {number}
     */
    IDLE: 0,

    /**
     * Opening.
     *
     * Indicates the current motion status is opening. The shutter is moving
     * to the open position.
     *
     * @constant {number}
     */
    OPENING: 1,

    /**
     * Closing.
     *
     * Indicates the current motion status is closing. The shutter is moving
     * to the closed position.
     *
     * @constant {number}
     */
    CLOSING: 2
};

/**
 * Do Not Disturb (DND) mode.
 *
 * Currently mainly controls the on and off of the device LED light.
 * When enabled, the device LED light is turned off.
 *
 * @enum {number}
 * @readonly
 */
const DNDMode = {
    /**
     * Do Not Disturb disabled.
     *
     * DNDMode off. Device LED light operates normally.
     *
     * @constant {number}
     */
    DND_DISABLED: 0,

    /**
     * Do Not Disturb enabled.
     *
     * DNDMode on. Device LED light is turned off.
     *
     * @constant {number}
     */
    DND_ENABLED: 1
};

/**
 * Device online status.
 *
 * Indicates the online status of the device. Used to determine whether
 * a device is reachable and operational, or if it's in a transitional
 * state such as MQTT connecting or firmware upgrade.
 *
 * @enum {number}
 * @readonly
 */
const OnlineStatus = {
    /**
     * MQTT connecting.
     *
     * Device is in the process of connecting to the MQTT broker.
     * This is the initial state before establishing connection.
     *
     * @constant {number}
     */
    NOT_ONLINE: 0,

    /**
     * Online.
     *
     * Device is online and connected. Commands can be sent successfully
     * to the device.
     *
     * @constant {number}
     */
    ONLINE: 1,

    /**
     * Offline.
     *
     * Device is offline and unreachable. Indicates a connection loss.
     * Commands may fail until connectivity is restored.
     *
     * @constant {number}
     */
    OFFLINE: 2,

    /**
     * Unknown.
     *
     * Status could not be determined, typically due to communication
     * errors, incomplete device information, or when the device has not
     * yet reported its status.
     *
     * @constant {number}
     */
    UNKNOWN: -1,

    /**
     * Upgrading.
     *
     * Device is currently upgrading firmware. The device may be unresponsive
     * during this time and should not receive commands to avoid interrupting
     * the upgrade process.
     *
     * @constant {number}
     */
    UPGRADING: 3
};

/**
 * Smoke alarm status.
 *
 * Indicates the current status of a smoke detector device. Values represent
 * normal operation, muted alarm conditions, or interconnection status for
 * multi-device setups.
 *
 * @enum {number}
 * @readonly
 */
const SmokeAlarmStatus = {
    /**
     * Normal status.
     *
     * No alarms detected and device is operating normally. All sensors
     * are functioning within expected parameters.
     *
     * @constant {number}
     */
    NORMAL: 23,

    /**
     * Temperature alarm muted.
     *
     * Temperature alarm has been silenced by user action. The alarm condition
     * may still exist but audio alerts are suppressed. Visual indicators may
     * still be active.
     *
     * @constant {number}
     */
    MUTE_TEMPERATURE_ALARM: 26,

    /**
     * Smoke alarm muted.
     *
     * Smoke alarm has been silenced by user action. The alarm condition
     * may still exist but audio alerts are suppressed. Visual indicators
     * may still be active.
     *
     * @constant {number}
     */
    MUTE_SMOKE_ALARM: 27,

    /**
     * Interconnection status.
     *
     * Indicates that interconnection/linkage status information is available.
     * When status is 170, the `interConn` field indicates:
     * - interConn = 0: Not interconnected (linkage not in progress)
     * - interConn = 1: Interconnected (linkage in progress)
     *
     * This is not an alarm state, but a status indicator for the
     * interconnection system that allows multiple smoke detectors to
     * communicate and trigger each other.
     *
     * @constant {number}
     */
    INTERCONNECTION_STATUS: 170
};

/**
 * Timer type for device timers.
 *
 * Defines the schedule pattern for device timers. Timers can be one-time or
 * recurring, and can trigger at a single point in time or continuously over
 * a period. The type determines how the timer repeats and when it activates.
 *
 * Note: Some timer types share the same numeric value but have different
 * meanings depending on context. Currently only types 1 and 2 are used.
 * Type 1 can mean either single point weekly cycle or AUTO-OFF depending
 * on context. Type 2 can mean either single point single shot or COUNTDOWN
 * depending on context.
 *
 * @enum {number}
 * @readonly
 */
const TimerType = {
    /**
     * Single point weekly cycle.
     *
     * Timer type: 1 - single point weekly cycle. Timer triggers at a specific
     * time on specified days of the week, repeating weekly. Also used as
     * AUTO-OFF in countdown contexts.
     *
     * @constant {number}
     */
    SINGLE_POINT_WEEKLY_CYCLE: 1,

    /**
     * Single point single shot.
     *
     * Timer type: 2 - single point single shot. Timer triggers once at a
     * specific time and does not repeat. Also used as COUNTDOWN (countdown off)
     * in countdown contexts.
     *
     * @constant {number}
     */
    SINGLE_POINT_SINGLE_SHOT: 2,

    /**
     * Continuous weekly cycle.
     *
     * Timer type: 3 - continuous weekly cycle. Timer is active continuously
     * during specified time periods on specified days, repeating weekly.
     *
     * @constant {number}
     */
    CONTINUOUS_WEEKLY_CYCLE: 3,

    /**
     * Continuous single shot.
     *
     * Timer type: 4 - continuous single shot. Timer is active continuously
     * during a specific time period, one time only.
     *
     * @constant {number}
     */
    CONTINUOUS_SINGLE_SHOT: 4,

    /**
     * Auto off timer.
     *
     * AUTO-OFF timer type. Automatically turns device off after a specified
     * duration. Shares the same value (1) as `SINGLE_POINT_WEEKLY_CYCLE`
     * but used in countdown/auto-off contexts.
     *
     * @constant {number}
     */
    AUTO_OFF: 1,

    /**
     * Countdown timer.
     *
     * COUNTDOWN timer type (countdown off). Counts down from a specified
     * duration and triggers when the countdown reaches zero. Shares the same
     * value (2) as `SINGLE_POINT_SINGLE_SHOT` but used in countdown contexts.
     *
     * @constant {number}
     */
    COUNTDOWN: 2
};

/**
 * Trigger type for device triggers.
 *
 * Defines the schedule pattern for device triggers. Triggers are similar to
 * timers but execute conditional actions (e.g., "if condition X, then do Y")
 * rather than simple time-based actions. The type determines how the trigger
 * repeats and when it evaluates its conditions.
 *
 * Note: Trigger types share the same numeric values as some timer types,
 * but are used in different contexts.
 *
 * @enum {number}
 * @readonly
 * @see {@link TimerType}
 */
const TriggerType = {
    /**
     * Single point weekly cycle.
     *
     * Trigger activates at a specific time on specified days of the week,
     * repeating weekly. Useful for recurring conditional automation.
     *
     * @constant {number}
     */
    SINGLE_POINT_WEEKLY_CYCLE: 1,

    /**
     * Single point single shot.
     *
     * Trigger activates once at a specific time and does not repeat. Useful
     * for one-time conditional automation.
     *
     * @constant {number}
     */
    SINGLE_POINT_SINGLE_SHOT: 2,

    /**
     * Continuous weekly cycle.
     *
     * Trigger is active continuously during specified time periods on
     * specified days, repeating weekly. Useful for time-windowed conditional
     * automation that needs to run for extended periods.
     *
     * @constant {number}
     */
    CONTINUOUS_WEEKLY_CYCLE: 3,

    /**
     * Continuous single shot.
     *
     * Trigger is active continuously during a specific time period,
     * one time only. Useful for one-time time-windowed conditional
     * automation that needs to run for an extended period.
     *
     * @constant {number}
     */
    CONTINUOUS_SINGLE_SHOT: 4
};

/**
 * Presence detection state values.
 *
 * Indicates whether presence is currently detected by a presence sensor device.
 * Values are based on MS600 behavior analysis and represent the sensor's
 * current detection state.
 *
 * @enum {number}
 * @readonly
 */
const PresenceState = {
    /**
     * Absence detected.
     *
     * No presence is currently detected by the sensor. The monitored area
     * appears to be unoccupied.
     *
     * @constant {number}
     */
    ABSENCE: 1,

    /**
     * Presence detected.
     *
     * Presence is currently detected by the sensor. The monitored area
     * appears to be occupied.
     *
     * @constant {number}
     */
    PRESENCE: 2
};

/**
 * Presence sensor sensitivity level.
 *
 * Controls the sensitivity of presence detection. Different levels balance
 * responsiveness (how quickly presence is detected) against false positive
 * prevention (resistance to interference and non-presence triggers).
 *
 * @enum {number}
 * @readonly
 */
const SensitivityLevel = {
    /**
     * Responsive.
     *
     * Highest sensitivity level, most responsive to movement. Detects presence
     * quickly but may be more prone to false positives from interference.
     *
     * @constant {number}
     */
    RESPONSIVE: 3,

    /**
     * Anti-Interference.
     *
     * Lower sensitivity level, reduces false positives. Less responsive to
     * movement but more resistant to interference and false triggers.
     *
     * @constant {number}
     */
    ANTI_INTERFERENCE: 1,

    /**
     * Balance.
     *
     * Balanced sensitivity between responsive and anti-interference modes.
     * Provides moderate responsiveness with moderate false positive prevention,
     * suitable for most use cases.
     *
     * @constant {number}
     */
    BALANCE: 2
};

/**
 * Presence sensor work mode.
 *
 * Controls the operating mode of the presence sensor. Different modes determine
 * which detection algorithms are used and how the sensor filters and reports
 * presence events.
 *
 * @enum {number}
 * @readonly
 */
const WorkMode = {
    /**
     * Unknown work mode.
     *
     * Mode value is 0. Specific behavior is not documented. May represent
     * a default or unconfigured state.
     *
     * @constant {number}
     */
    UNKNOWN: 0,

    /**
     * Biological detection only mode.
     *
     * Detects biological presence only, filtering out non-biological movement
     * and interference. Used to reduce false positives from pets, moving objects,
     * or environmental changes. Optimized for detecting human presence.
     *
     * @constant {number}
     */
    BIOLOGICAL_DETECTION_ONLY: 1,

    /**
     * Security mode.
     *
     * Enhanced detection mode optimized for security applications. Uses more
     * aggressive detection algorithms to catch all movement, including
     * non-biological sources. Reduces false negatives at the cost of potentially
     * more false positives.
     *
     * @constant {number}
     */
    SECURITY: 2
};

module.exports = {
    TransportMode,
    ThermostatMode,
    ThermostatWorkingMode,
    ThermostatModeBState,
    LightMode,
    DiffuserLightMode,
    DiffuserSprayMode,
    SprayMode,
    RollerShutterStatus,
    DNDMode,
    OnlineStatus,
    SmokeAlarmStatus,
    TimerType,
    TriggerType,
    PresenceState,
    SensitivityLevel,
    WorkMode
};

