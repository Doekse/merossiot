'use strict';

const TimerType = require('../model/enums').TimerType;
const { MerossErrorValidation } = require('../model/exception');

/**
 * Timer utility functions.
 *
 * Provides helper functions for creating and working with Meross timer configurations.
 * Timers execute actions at specific times on specified days of the week, following
 * Meross device timer format conventions.
 *
 * @module utilities/timer
 */

/**
 * Converts time to minutes since midnight.
 *
 * Meross devices store timer times as minutes since midnight (0-1439). This function
 * normalizes various time formats (HH:MM strings, Date objects, or already-converted
 * minutes) to this device-compatible format.
 *
 * @param {string|Date|number} time - Time in HH:MM format (24-hour), Date object, or minutes since midnight
 * @returns {number} Minutes since midnight (0-1439)
 * @throws {MerossErrorValidation} If time format is invalid
 * @example
 * timeToMinutes('14:30'); // Returns 870
 * timeToMinutes(new Date(2023, 0, 1, 14, 30)); // Returns 870 (14:30)
 * timeToMinutes(870); // Returns 870 (already in minutes)
 */
function timeToMinutes(time) {
    if (typeof time === 'number') {
        if (time >= 0 && time < 1440) {
            return time;
        }
        throw new MerossErrorValidation(`Invalid time value: ${time}. Must be 0-1439 minutes`, 'time');
    }

    if (time instanceof Date) {
        return time.getHours() * 60 + time.getMinutes();
    }

    if (typeof time === 'string') {
        const trimmed = time.trim();
        const timePattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (!timePattern.test(trimmed)) {
            const { MerossErrorValidation } = require('../model/exception');
            throw new MerossErrorValidation(`Invalid time format: "${time}". Expected HH:MM (24-hour format)`, 'time');
        }
        const [hours, minutes] = trimmed.split(':').map(Number);
        return hours * 60 + minutes;
    }

    const { MerossErrorValidation } = require('../model/exception');
    throw new MerossErrorValidation(`Invalid time type: ${typeof time}. Expected string (HH:MM), Date, or number`, 'time');
}

/**
 * Converts minutes since midnight to HH:MM format string.
 *
 * Converts the internal timer format (minutes since midnight) to a human-readable
 * 24-hour time string for display purposes.
 *
 * @param {number} minutes - Minutes since midnight (0-1439)
 * @returns {string} Time in HH:MM format (24-hour)
 * @throws {MerossErrorValidation} If minutes value is invalid
 * @example
 * minutesToTime(870); // Returns "14:30"
 * minutesToTime(0); // Returns "00:00"
 */
function minutesToTime(minutes) {
    if (typeof minutes !== 'number' || minutes < 0 || minutes >= 1440) {
        throw new MerossErrorValidation(`Invalid minutes value: ${minutes}. Must be 0-1439`, 'minutes');
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Gets bitmask for special day keywords.
 *
 * Converts human-readable day group keywords to their corresponding bitmask values
 * used by Meross devices. Bit 0-6 represent Monday-Sunday, with bit 7 reserved for
 * the repeat flag.
 *
 * @private
 * @param {string} keyword - Special keyword ('weekday', 'weekend', 'daily', 'everyday')
 * @returns {number|null} Bitmask value for the keyword, or null if not a special keyword
 */
function getSpecialKeywordBitmask(keyword) {
    const keywordMap = {
        weekday: (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4),
        weekend: (1 << 5) | (1 << 6),
        daily: 0x7F,
        everyday: 0x7F
    };

    return keywordMap[keyword] !== undefined ? keywordMap[keyword] : null;
}

/**
 * Parses a single day value to day number.
 *
 * Converts day names (full or abbreviated) or day numbers to a consistent numeric
 * format where 0=Monday, 1=Tuesday, etc. This matches Meross device day numbering.
 *
 * @private
 * @param {string|number} day - Day value as number (0-6) or string (day name)
 * @returns {number} Day number (0-6, where 0=Monday)
 * @throws {MerossErrorValidation} If day value is invalid
 */
function parseDayToNumber(day) {
    const dayMap = {
        monday: 0,
        tuesday: 1,
        wednesday: 2,
        thursday: 3,
        friday: 4,
        saturday: 5,
        sunday: 6,
        mon: 0,
        tue: 1,
        wed: 2,
        thu: 3,
        fri: 4,
        sat: 5,
        sun: 6
    };

    if (typeof day === 'number') {
        if (day < 0 || day > 6) {
            const { MerossErrorValidation } = require('../model/exception');
            throw new MerossErrorValidation(`Invalid day number: ${day}. Must be 0-6 (0=Monday)`, 'day');
        }
        return day;
    }

    if (typeof day === 'string') {
        const normalized = day.toLowerCase();
        if (dayMap[normalized] !== undefined) {
            return dayMap[normalized];
        }
        throw new MerossErrorValidation(`Invalid day name: "${day}". Use 'monday', 'tuesday', etc.`, 'day');
    }

    const { MerossErrorValidation } = require('../model/exception');
    throw new MerossErrorValidation(`Invalid day type: ${typeof day}. Expected string or number`, 'day');
}

/**
 * Converts array of weekday names or numbers to week bitmask.
 *
 * Meross devices use a bitmask to represent selected days of the week, with bits 0-6
 * representing Monday-Sunday and bit 7 indicating whether the timer repeats weekly.
 * This function converts human-readable day lists to this device format.
 *
 * @param {Array<string|number>} days - Array of weekday names ('monday', 'tuesday', etc.) or numbers (0-6, where 0=Monday)
 * @param {boolean} [repeat=true] - Whether to set the repeat bit (bit 7). Default: true
 * @returns {number} Week bitmask with selected days and repeat bit
 * @throws {MerossErrorValidation} If day names are invalid
 * @example
 * daysToWeekMask(['monday', 'wednesday', 'friday']); // Returns bitmask for Mon, Wed, Fri + repeat
 * daysToWeekMask([0, 2, 4]); // Same as above using numbers
 * daysToWeekMask(['weekday']); // Returns Monday-Friday
 * daysToWeekMask(['weekend']); // Returns Saturday-Sunday
 */
function daysToWeekMask(days, repeat = true) {
    if (!Array.isArray(days) || days.length === 0) {
        throw new MerossErrorValidation('Days must be a non-empty array', 'days');
    }

    let bitmask = 0;
    const specialKeywords = new Set(['weekday', 'weekend', 'daily', 'everyday']);

    for (const day of days) {
        if (typeof day === 'string' && specialKeywords.has(day.toLowerCase())) {
            const keywordBitmask = getSpecialKeywordBitmask(day.toLowerCase());
            if (keywordBitmask !== null) {
                bitmask |= keywordBitmask;
            }
        }
    }

    for (const day of days) {
        if (typeof day === 'string' && specialKeywords.has(day.toLowerCase())) {
            continue;
        }

        const dayNum = parseDayToNumber(day);
        bitmask |= (1 << dayNum);
    }

    if (repeat) {
        bitmask |= 128;
    }

    return bitmask;
}

/**
 * Normalizes days input to week bitmask with repeat bit handling.
 *
 * Consolidates the logic for converting days to week bitmask used by both createTimer
 * and createTrigger. Handles both numeric bitmask input (preserving or modifying the
 * repeat bit) and array input (converting day names/numbers to bitmask).
 *
 * @param {Array<string|number>|number} days - Days of week (array of names/numbers) or week bitmask (number)
 * @param {boolean} [repeat=true] - Whether to set the repeat bit (bit 7). Default: true
 * @returns {number} Week bitmask with selected days and repeat bit set correctly
 * @example
 * normalizeWeekBitmask(['monday', 'wednesday', 'friday'], true); // Returns bitmask for Mon, Wed, Fri + repeat
 * normalizeWeekBitmask(159, false); // Returns 31 (removes repeat bit from existing bitmask)
 * normalizeWeekBitmask(31, true); // Returns 159 (adds repeat bit to existing bitmask)
 */
function normalizeWeekBitmask(days, repeat = true) {
    if (typeof days === 'number') {
        let week = days;
        if (repeat && (week & 128) === 0) {
            week |= 128;
        } else if (!repeat && (week & 128) !== 0) {
            week &= ~128;
        }
        return week;
    }

    return daysToWeekMask(days, repeat);
}

/**
 * Generates a unique timer ID.
 *
 * Creates a unique identifier for timers by combining the current timestamp (base36)
 * with random characters. This ensures uniqueness even when multiple timers are created
 * in rapid succession.
 *
 * @returns {string} Unique timer ID
 */
function generateTimerId() {
    return `${Date.now().toString(36)}${Math.random().toString(36).substr(2, 8)}`;
}

/**
 * Creates a timer configuration object with sensible defaults.
 *
 * Builds a complete timer configuration object in the format expected by Meross devices,
 * converting human-readable inputs (time strings, day names) to device-compatible formats
 * (minutes since midnight, week bitmask). Applies sensible defaults for optional fields.
 *
 * @param {Object} options - Timer configuration options
 * @param {string} [options.alias] - Timer name/alias
 * @param {string|Date|number} [options.time='12:00'] - Time in HH:MM format, Date object, or minutes since midnight
 * @param {Array<string|number>|number} [options.days] - Days of week (array of names/numbers) or week bitmask
 * @param {boolean} [options.on=true] - Whether to turn device on (true) or off (false)
 * @param {number} [options.type=TimerType.SINGLE_POINT_WEEKLY_CYCLE] - Timer type
 * @param {number} [options.channel=0] - Channel number
 * @param {boolean} [options.enabled=true] - Whether timer is enabled
 * @param {boolean} [options.repeat=true] - Whether to set repeat bit (for days array input)
 * @param {string} [options.id] - Timer ID (auto-generated if not provided)
 * @returns {Object} Timer configuration object
 * @example
 * createTimer({
 *   alias: 'Morning Lights',
 *   time: '07:00',
 *   days: ['weekday'],
 *   on: true
 * });
 */
function createTimer(options = {}) {
    const {
        alias = 'My Timer',
        time = '12:00',
        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        on = true,
        type = TimerType.SINGLE_POINT_WEEKLY_CYCLE,
        channel = 0,
        enabled = true,
        repeat = true,
        id
    } = options;

    const timeMinutes = timeToMinutes(time);
    const week = normalizeWeekBitmask(days, repeat);

    const timerx = {
        id: id || generateTimerId(),
        channel,
        type,
        time: timeMinutes,
        week,
        duration: 0,
        sunOffset: 0,
        enable: enabled ? 1 : 0,
        alias,
        createTime: Math.floor(Date.now() / 1000),
        extend: {
            toggle: {
                onoff: on ? 1 : 0,
                lmTime: 0
            }
        }
    };

    return timerx;
}

module.exports = {
    timeToMinutes,
    minutesToTime,
    daysToWeekMask,
    normalizeWeekBitmask,
    generateTimerId,
    createTimer
};

