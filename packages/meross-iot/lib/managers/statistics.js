'use strict';

/**
 * Manages statistics tracking for HTTP and MQTT communication.
 *
 * Provides a unified interface for tracking and retrieving statistics from both
 * HTTP and MQTT communication channels. Handles null checks internally to gracefully
 * handle disabled statistics.
 *
 * @class ManagerStatistics
 */
class ManagerStatistics {
    /**
     * Creates a new ManagerStatistics instance.
     *
     * @param {ManagerMeross} manager - Parent manager instance
     */
    constructor(manager) {
        this.manager = manager;
    }

    /**
     * Notifies the statistics system of an HTTP request.
     *
     * Tracks HTTP request/response statistics if statistics are enabled.
     * No-op if statistics are disabled.
     *
     * @param {string} url - Request URL
     * @param {string} method - HTTP method (e.g., 'GET', 'POST')
     * @param {number} httpCode - HTTP response status code
     * @param {number|null} apiCode - Meross API response code (null if not applicable)
     */
    notifyHttpRequest(url, method, httpCode, apiCode) {
        if (this.manager.httpClient && this.manager.httpClient._httpStatsCounter) {
            this.manager.httpClient._httpStatsCounter.notifyHttpRequest(url, method, httpCode, apiCode);
        }
    }

    /**
     * Notifies the statistics system of an MQTT API call.
     *
     * Tracks MQTT API call statistics if statistics are enabled.
     * No-op if statistics are disabled.
     *
     * @param {string} deviceUuid - Device UUID
     * @param {string} namespace - Message namespace
     * @param {string} method - Message method
     */
    notifyMqttCall(deviceUuid, namespace, method) {
        if (this.manager._mqttStatsCounter) {
            this.manager._mqttStatsCounter.notifyApiCall(deviceUuid, namespace, method);
        }
    }

    /**
     * Notifies the statistics system of a delayed MQTT call.
     *
     * Tracks delayed MQTT call statistics if statistics are enabled.
     * No-op if statistics are disabled.
     *
     * @param {string} deviceUuid - Device UUID
     * @param {string} namespace - Message namespace
     * @param {string} method - Message method
     */
    notifyDelayedCall(deviceUuid, namespace, method) {
        if (this.manager._mqttStatsCounter) {
            this.manager._mqttStatsCounter.notifyDelayedCall(deviceUuid, namespace, method);
        }
    }

    /**
     * Notifies the statistics system of a dropped MQTT call.
     *
     * Tracks dropped MQTT call statistics if statistics are enabled.
     * No-op if statistics are disabled.
     *
     * @param {string} deviceUuid - Device UUID
     * @param {string} namespace - Message namespace
     * @param {string} method - Message method
     */
    notifyDroppedCall(deviceUuid, namespace, method) {
        if (this.manager._mqttStatsCounter) {
            this.manager._mqttStatsCounter.notifyDroppedCall(deviceUuid, namespace, method);
        }
    }

    /**
     * Gets HTTP statistics for a given time window.
     *
     * Returns aggregated HTTP statistics if statistics are enabled, null otherwise.
     *
     * @param {number} [timeWindowMs=60000] - Time window in milliseconds (default: 1 minute)
     * @returns {HttpStatsResult|null} Statistics result or null if statistics not enabled
     */
    getHttpStats(timeWindowMs = 60000) {
        if (this.manager.httpClient && this.manager.httpClient._httpStatsCounter) {
            return this.manager.httpClient._httpStatsCounter.getStats(timeWindowMs);
        }
        return null;
    }

    /**
     * Gets MQTT statistics for a given time window.
     *
     * Returns aggregated MQTT API call statistics if statistics are enabled, null otherwise.
     *
     * @param {number} [timeWindowMs=60000] - Time window in milliseconds (default: 1 minute)
     * @returns {ApiStatsResult|null} Statistics result or null if statistics not enabled
     */
    getMqttStats(timeWindowMs = 60000) {
        if (this.manager._mqttStatsCounter) {
            return this.manager._mqttStatsCounter.getApiStats(timeWindowMs);
        }
        return null;
    }

    /**
     * Gets delayed MQTT statistics for a given time window.
     *
     * Returns aggregated delayed MQTT call statistics if statistics are enabled, null otherwise.
     *
     * @param {number} [timeWindowMs=60000] - Time window in milliseconds (default: 1 minute)
     * @returns {ApiStatsResult|null} Statistics result or null if statistics not enabled
     */
    getDelayedMqttStats(timeWindowMs = 60000) {
        if (this.manager._mqttStatsCounter) {
            return this.manager._mqttStatsCounter.getDelayedApiStats(timeWindowMs);
        }
        return null;
    }

    /**
     * Gets dropped MQTT statistics for a given time window.
     *
     * Returns aggregated dropped MQTT call statistics if statistics are enabled, null otherwise.
     *
     * @param {number} [timeWindowMs=60000] - Time window in milliseconds (default: 1 minute)
     * @returns {ApiStatsResult|null} Statistics result or null if statistics not enabled
     */
    getDroppedMqttStats(timeWindowMs = 60000) {
        if (this.manager._mqttStatsCounter) {
            return this.manager._mqttStatsCounter.getDroppedApiStats(timeWindowMs);
        }
        return null;
    }

    /**
     * Checks if statistics tracking is enabled.
     *
     * @returns {boolean} True if statistics are enabled, false otherwise
     */
    isEnabled() {
        return (this.manager._mqttStatsCounter !== null) &&
               (this.manager.httpClient && this.manager.httpClient._httpStatsCounter !== null);
    }
}

module.exports = ManagerStatistics;
