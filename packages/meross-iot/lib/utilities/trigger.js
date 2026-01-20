'use strict';

const TriggerType = require('../model/enums').TriggerType;
const { normalizeWeekBitmask, generateTimerId } = require('./timer');
const { MerossErrorValidation } = require('../model/exception');

/**
 * Trigger utility functions.
 *
 * Provides helper functions for creating and working with Meross trigger configurations.
 * Triggers are countdown timers that execute an action after a specified duration, unlike
 * timers which execute at a specific time. Triggers count down from when they're activated.
 *
 * @module utilities/trigger
 */

/**
 * Parses numeric duration value.
 *
 * Validates that numeric duration values are non-negative, as negative durations
 * are not meaningful for countdown timers.
 *
 * @private
 * @param {number} value - Numeric duration in seconds
 * @returns {number} Duration in seconds
 * @throws {MerossErrorValidation} If duration is negative
 */
function parseNumericDuration(value) {
    if (value < 0) {
        throw new MerossErrorValidation(`Invalid duration: ${value}. Duration must be non-negative`, 'duration');
    }
    return value;
}

/**
 * Parses duration string with unit suffix.
 *
 * Converts human-readable duration strings (e.g., "30m", "2h", "45s") to seconds.
 * Supports seconds (s), minutes (m), and hours (h) units. Returns null if the format
 * doesn't match, allowing other parsers to attempt conversion.
 *
 * @private
 * @param {string} str - Duration string with unit suffix
 * @returns {number|null} Duration in seconds, or null if format doesn't match
 * @throws {MerossErrorValidation} If format is invalid
 */
function parseUnitSuffixDuration(str) {
    const timeUnitMatch = str.match(/^(\d+)([smh])$/i);
    if (!timeUnitMatch) {
        return null;
    }

    const value = parseInt(timeUnitMatch[1], 10);
    const unit = timeUnitMatch[2].toLowerCase();

    if (unit === 's') {
        return value;
    } else if (unit === 'm') {
        return value * 60;
    } else if (unit === 'h') {
        return value * 3600;
    }

    return null;
}

/**
 * Validates time components for MM:SS format.
 *
 * Ensures minutes and seconds values are within valid ranges (minutes >= 0,
 * seconds 0-59) before converting to total seconds.
 *
 * @private
 * @param {number} minutes - Minutes value
 * @param {number} seconds - Seconds value
 * @param {string} originalDuration - Original duration string for error messages
 * @throws {MerossErrorValidation} If validation fails
 */
function validateMMSS(minutes, seconds, originalDuration) {
    if (isNaN(minutes) || isNaN(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) {
        const { MerossErrorValidation } = require('../model/exception');
        throw new MerossErrorValidation(`Invalid time format: "${originalDuration}". Expected MM:SS`, 'duration');
    }
}

/**
 * Validates time components for HH:MM:SS format.
 *
 * Ensures hours, minutes, and seconds values are within valid ranges (hours >= 0,
 * minutes 0-59, seconds 0-59) before converting to total seconds.
 *
 * @private
 * @param {number} hours - Hours value
 * @param {number} minutes - Minutes value
 * @param {number} seconds - Seconds value
 * @param {string} originalDuration - Original duration string for error messages
 * @throws {MerossErrorValidation} If validation fails
 */
function validateHHMMSS(hours, minutes, seconds, originalDuration) {
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) ||
        hours < 0 || minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) {
        const { MerossErrorValidation } = require('../model/exception');
        throw new MerossErrorValidation(`Invalid time format: "${originalDuration}". Expected HH:MM:SS`, 'duration');
    }
}

/**
 * Parses time string in "HH:MM:SS" or "MM:SS" format.
 *
 * Converts time-formatted duration strings to total seconds. Supports both full
 * hour:minute:second format and abbreviated minute:second format. Returns null if
 * the format doesn't match, allowing other parsers to attempt conversion.
 *
 * @private
 * @param {string} str - Time string in "HH:MM:SS" or "MM:SS" format
 * @param {string} originalDuration - Original duration string for error messages
 * @returns {number|null} Duration in seconds, or null if format doesn't match
 * @throws {MerossErrorValidation} If format is invalid
 */
function parseTimeStringDuration(str, originalDuration) {
    const timePattern = /^(?:(\d+):)?(\d+):(\d+)$/;
    if (!timePattern.test(str)) {
        return null;
    }

    const parts = str.split(':');
    if (parts.length === 2) {
        const minutes = parseInt(parts[0], 10);
        const seconds = parseInt(parts[1], 10);
        validateMMSS(minutes, seconds, originalDuration);
        return minutes * 60 + seconds;
    } else if (parts.length === 3) {
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        const seconds = parseInt(parts[2], 10);
        validateHHMMSS(hours, minutes, seconds, originalDuration);
        return hours * 3600 + minutes * 60 + seconds;
    }

    return null;
}

/**
 * Converts duration to seconds.
 *
 * Normalizes various duration formats to a consistent seconds value. Supports numeric
 * seconds, unit-suffixed strings (e.g., "30m", "2h"), and time-formatted strings
 * (e.g., "HH:MM:SS", "MM:SS"). This allows users to specify durations in the most
 * convenient format for their use case.
 *
 * @param {string|number} duration - Duration as seconds (number), "HH:MM:SS" string, "30m" (minutes), "2h" (hours), etc.
 * @returns {number} Duration in seconds
 * @throws {MerossErrorValidation} If duration format is invalid
 * @example
 * durationToSeconds(600); // Returns 600
 * durationToSeconds('10m'); // Returns 600 (10 minutes)
 * durationToSeconds('1h'); // Returns 3600 (1 hour)
 * durationToSeconds('1:30:00'); // Returns 5400 (1 hour 30 minutes)
 * durationToSeconds('30:00'); // Returns 1800 (30 minutes)
 */
function durationToSeconds(duration) {
    if (typeof duration === 'number') {
        return parseNumericDuration(duration);
    }

    if (typeof duration === 'string') {
        const trimmed = duration.trim();

        const unitSuffixResult = parseUnitSuffixDuration(trimmed);
        if (unitSuffixResult !== null) {
            return unitSuffixResult;
        }

        const timeStringResult = parseTimeStringDuration(trimmed, duration);
        if (timeStringResult !== null) {
            return timeStringResult;
        }

        throw new MerossErrorValidation(`Invalid duration format: "${duration}". Expected seconds (number), "Xm"/"Xh", or "HH:MM:SS"/"MM:SS" format`, 'duration');
    }

    throw new MerossErrorValidation(`Invalid duration type: ${typeof duration}. Expected string or number`, 'duration');
}

/**
 * Converts seconds to human-readable duration string.
 *
 * Formats duration values for display purposes, using the most appropriate units
 * (hours, minutes, seconds) and omitting zero components. Only shows seconds when
 * the duration is less than an hour to keep output concise.
 *
 * @param {number} seconds - Duration in seconds
 * @returns {string} Human-readable duration (e.g., "1h 30m", "45m", "30s")
 * @throws {MerossErrorValidation} If seconds value is invalid
 * @example
 * secondsToDuration(5400); // Returns "1h 30m"
 * secondsToDuration(600); // Returns "10m"
 * secondsToDuration(30); // Returns "30s"
 */
function secondsToDuration(seconds) {
    if (typeof seconds !== 'number' || seconds < 0) {
        throw new MerossErrorValidation(`Invalid seconds value: ${seconds}. Must be non-negative number`, 'seconds');
    }

    if (seconds === 0) {
        return '0s';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (hours > 0) {
        parts.push(`${hours}h`);
    }
    if (minutes > 0) {
        parts.push(`${minutes}m`);
    }
    if (secs > 0 && hours === 0) {
        parts.push(`${secs}s`);
    }

    return parts.join(' ') || '0s';
}

/**
 * Creates a trigger configuration object with sensible defaults.
 *
 * Builds a complete trigger configuration object in the format expected by Meross devices,
 * converting human-readable inputs (duration strings, day names) to device-compatible formats
 * (seconds, week bitmask). Triggers are countdown timers that execute an action after a
 * specified duration, unlike timers which execute at specific times.
 *
 * @param {Object} options - Trigger configuration options
 * @param {string} [options.alias] - Trigger name/alias
 * @param {string|number} [options.duration=600] - Duration as seconds (number), "30m", "1h", or "HH:MM:SS" format. Default: 600 (10 minutes)
 * @param {Array<string|number>|number} [options.days] - Days of week (array of names/numbers) or week bitmask. Default: all days
 * @param {number} [options.type=TriggerType.SINGLE_POINT_WEEKLY_CYCLE] - Trigger type
 * @param {number} [options.channel=0] - Channel number
 * @param {boolean} [options.enabled=true] - Whether trigger is enabled
 * @param {boolean} [options.repeat=true] - Whether to set repeat bit (for days array input)
 * @param {string} [options.id] - Trigger ID (auto-generated if not provided)
 * @returns {Object} Trigger configuration object
 * @example
 * createTrigger({
 *   alias: 'Auto-off after 30 minutes',
 *   duration: '30m',
 *   days: ['weekday'],
 *   channel: 0
 * });
 */
function createTrigger(options = {}) {
    const {
        alias = 'My Trigger',
        duration = 600, // Default: 10 minutes
        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        type = TriggerType.SINGLE_POINT_WEEKLY_CYCLE,
        channel = 0,
        enabled = true,
        repeat = true,
        id
    } = options;

    const durationSeconds = durationToSeconds(duration);
    const week = normalizeWeekBitmask(days, repeat);

    const triggerx = {
        id: id || generateTimerId(),
        channel,
        type,
        enable: enabled ? 1 : 0,
        alias,
        createTime: Math.floor(Date.now() / 1000),
        rule: {
            duration: durationSeconds,
            week
        }
    };

    return triggerx;
}

module.exports = {
    durationToSeconds,
    secondsToDuration,
    createTrigger
};

