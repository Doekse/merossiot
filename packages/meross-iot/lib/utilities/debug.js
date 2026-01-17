'use strict';

const { MqttStatsCounter, HttpStatsCounter } = require('./stats');

/**
 * Debugging utilities for Meross manager development and troubleshooting.
 *
 * Provides access to internal debugging methods that expose implementation details
 * useful for development and troubleshooting. These methods are not part of the
 * stable public API and may change between versions.
 *
 * @module utilities/debug
 */

/**
 * Creates debugging utilities for a MerossManager instance
 *
 * @param {MerossManager} manager - MerossManager instance
 * @returns {Object} Debug utilities object
 */
function createDebugUtils(manager) {
    return {
        /**
         * Gets the current error budget for a device.
         *
         * Error budgets prevent repeated failed communication attempts from consuming
         * excessive resources. When the budget is exhausted, LAN HTTP communication is
         * temporarily disabled for that device to avoid flooding the network with failed requests.
         *
         * @param {string} deviceUuid - Device UUID
         * @returns {number} Current error budget (number of errors remaining)
         */
        getErrorBudget(deviceUuid) {
            return manager._errorBudgetManager.getBudget(deviceUuid);
        },

        /**
         * Resets the error budget for a device.
         *
         * Manually resets a device's error budget, immediately re-enabling LAN HTTP
         * communication. Useful when a device's budget was exhausted due to temporary
         * network issues that have since been resolved.
         *
         * @param {string} deviceUuid - Device UUID
         */
        resetErrorBudget(deviceUuid) {
            manager._errorBudgetManager.resetBudget(deviceUuid);
        },

        /**
         * Gets MQTT statistics for a given time window.
         *
         * Returns aggregated statistics about MQTT API calls if statistics tracking is enabled.
         * Statistics include total calls, calls grouped by method/namespace combination, and
         * calls grouped by device. Useful for monitoring API usage patterns and identifying
         * potential bottlenecks.
         *
         * @param {number} [timeWindowMs=60000] - Time window in milliseconds (default: 1 minute)
         * @returns {ApiStatsResult|null} Statistics result object or null if statistics not enabled
         */
        getMqttStats(timeWindowMs = 60000) {
            return manager.statistics.getMqttStats(timeWindowMs);
        },

        /**
         * Gets HTTP statistics for a given time window.
         *
         * Returns aggregated statistics about HTTP API calls if statistics tracking is enabled.
         * Statistics include total calls, calls grouped by HTTP status code, calls grouped by
         * Meross API status code, and calls grouped by URL. Useful for monitoring API health
         * and identifying error patterns.
         *
         * @param {number} [timeWindowMs=60000] - Time window in milliseconds (default: 1 minute)
         * @returns {HttpStatsResult|null} Statistics result object or null if statistics not enabled
         */
        getHttpStats(timeWindowMs = 60000) {
            return manager.statistics.getHttpStats(timeWindowMs);
        },

        /**
         * Gets delayed MQTT statistics for a given time window.
         *
         * Returns statistics about MQTT API calls that were delayed (e.g., due to rate limiting
         * or queue management) if statistics tracking is enabled. High numbers of delayed calls
         * may indicate that request rates exceed device capabilities or queue capacity limits.
         *
         * @param {number} [timeWindowMs=60000] - Time window in milliseconds (default: 1 minute)
         * @returns {ApiStatsResult|null} Statistics result object or null if statistics not enabled
         */
        getDelayedMqttStats(timeWindowMs = 60000) {
            return manager.statistics.getDelayedMqttStats(timeWindowMs);
        },

        /**
         * Gets dropped MQTT statistics for a given time window.
         *
         * Returns statistics about MQTT API calls that were dropped (e.g., due to queue overflow
         * or resource constraints) if statistics tracking is enabled. Dropped calls indicate that
         * the system could not process all requests, potentially requiring queue size adjustments
         * or reduced request rates.
         *
         * @param {number} [timeWindowMs=60000] - Time window in milliseconds (default: 1 minute)
         * @returns {ApiStatsResult|null} Statistics result object or null if statistics not enabled
         */
        getDroppedMqttStats(timeWindowMs = 60000) {
            return manager.statistics.getDroppedMqttStats(timeWindowMs);
        },

        /**
         * Enables statistics tracking for HTTP and MQTT requests.
         *
         * Initializes statistics collection for both HTTP and MQTT communication channels.
         * Statistics are stored in memory with a configurable limit to prevent unbounded growth.
         *
         * @param {number} [maxStatsSamples=1000] - Maximum number of samples to keep in statistics
         */
        enableStats(maxStatsSamples = 1000) {
            if (!manager._mqttStatsCounter) {
                manager._mqttStatsCounter = new MqttStatsCounter(maxStatsSamples);
            }
            if (!manager.httpClient._httpStatsCounter) {
                manager.httpClient._httpStatsCounter = new HttpStatsCounter(maxStatsSamples);
            }
        },

        /**
         * Disables statistics tracking for HTTP and MQTT requests.
         *
         * Stops collecting statistics and releases associated memory. Existing statistics
         * are discarded when tracking is disabled.
         */
        disableStats() {
            manager._mqttStatsCounter = null;
            if (manager.httpClient) {
                manager.httpClient._httpStatsCounter = null;
            }
        },

        /**
         * Checks if statistics tracking is enabled.
         *
         * @returns {boolean} True if statistics tracking is enabled, false otherwise
         */
        isStatsEnabled() {
            return manager.statistics.isEnabled();
        }
    };
}

module.exports = {
    createDebugUtils
};

