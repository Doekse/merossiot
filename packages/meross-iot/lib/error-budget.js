'use strict';

/**
 * Represents an error budget for a single device
 *
 * Tracks the number of errors allowed within a time window. The budget decreases
 * as errors occur and resets when the time window expires.
 *
 * @class ErrorBudget
 * @private
 */
class ErrorBudget {
    /**
     * Creates a new ErrorBudget instance
     *
     * @param {number} initialBudget - Initial error budget (number of errors allowed)
     * @param {number} windowStart - Timestamp when the time window started (milliseconds)
     */
    constructor(initialBudget, windowStart) {
        this.budget = initialBudget;
        this.windowStart = windowStart;
    }
}

/**
 * Manages error budgets for multiple devices
 *
 * Tracks error budgets per device to prevent excessive errors from overwhelming
 * devices or causing rate limiting. When a device's error budget is exhausted,
 * LAN HTTP communication is disabled for that device until the time window expires.
 *
 * @class ErrorBudgetManager
 */
class ErrorBudgetManager {
    /**
     * Creates a new ErrorBudgetManager instance
     *
     * @param {number} [maxErrors=1] - Maximum number of errors allowed per device per time window
     * @param {number} [timeWindowMs=60000] - Time window in milliseconds (default: 60 seconds)
     */
    constructor(maxErrors = 1, timeWindowMs = 60000) {
        this._devicesBudget = new Map();
        this._window = timeWindowMs;
        this._maxErrors = maxErrors;
    }

    /**
     * Gets or creates an error budget for a device and updates the time window if expired
     *
     * Resets the budget when the time window expires to allow the device to recover
     * from temporary error conditions. This prevents permanent blacklisting of devices
     * that experience transient network issues.
     *
     * @param {string} deviceUuid - Device UUID
     * @returns {ErrorBudget} Error budget for the device
     * @private
     */
    _getUpdateBudgetWindow(deviceUuid) {
        let devBudget = this._devicesBudget.get(deviceUuid);
        const now = Date.now();

        if (!devBudget) {
            devBudget = new ErrorBudget(this._maxErrors, now);
            this._devicesBudget.set(deviceUuid, devBudget);
        }

        if (now > (devBudget.windowStart + this._window)) {
            devBudget.budget = this._maxErrors;
            devBudget.windowStart = now;
        }

        return devBudget;
    }

    /**
     * Notifies that an error occurred for a device
     *
     * Decrements the device's error budget. Once exhausted, LAN HTTP communication
     * is disabled for the device until the time window resets, preventing further
     * failed requests that could cause rate limiting or device instability.
     *
     * @param {string} deviceUuid - Device UUID
     * @returns {void}
     */
    notifyError(deviceUuid) {
        const devBudget = this._getUpdateBudgetWindow(deviceUuid);
        if (devBudget.budget < 1) {
            return;
        }
        devBudget.budget -= 1;
    }

    /**
     * Checks if a device's error budget is exhausted.
     *
     * Used to determine whether LAN HTTP communication should be disabled for
     * a device to prevent further failed requests that could cause rate limiting
     * or device instability.
     *
     * @param {string} deviceUuid - Device UUID
     * @returns {boolean} True if error budget is exhausted, false otherwise
     */
    isOutOfBudget(deviceUuid) {
        const budget = this._getUpdateBudgetWindow(deviceUuid);
        return budget.budget < 1;
    }

    /**
     * Gets the current error budget for a device.
     *
     * Useful for monitoring or debugging purposes to see how many errors remain
     * before LAN HTTP communication is disabled for the device.
     *
     * @param {string} deviceUuid - Device UUID
     * @returns {number} Current error budget (number of errors remaining)
     */
    getBudget(deviceUuid) {
        const budget = this._getUpdateBudgetWindow(deviceUuid);
        return budget.budget;
    }

    /**
     * Resets the error budget for a device
     *
     * Removes the device's error budget entry, immediately re-enabling LAN HTTP
     * communication. Used when manual intervention is needed to recover from
     * error budget exhaustion.
     *
     * @param {string} deviceUuid - Device UUID
     * @returns {void}
     */
    resetBudget(deviceUuid) {
        this._devicesBudget.delete(deviceUuid);
    }
}

module.exports = ErrorBudgetManager;

