'use strict';

const Manager = require('./base');

/**
 * Manages statistics tracking for HTTP and MQTT communication.
 *
 * @class ManagerStatistics
 * @extends Manager
 */
class ManagerStatistics extends Manager {
    constructor(meross) {
        super(meross);
        this._mqttStatsCounter = null;
        this._httpStatsCounter = null;
    }

    /**
     * Wires HTTP request tracking onto the shared client before early API traffic occurs.
     *
     * @param {import('../lib/api/client')} client - Meross cloud API client
     * @param {number} [maxSamples=1000]
     */
    attachHttpClient(client, maxSamples = 1000) {
        const { HttpStatsCounter } = require('../lib/utilities/stats');
        client._onHttpRequest = (url, method, httpCode, apiCode) => {
            this.notifyHttpRequest(url, method, httpCode, apiCode);
        };
        if (this._httpStatsCounter || this._mqttStatsCounter) {
            client._httpStatsCounter = this._httpStatsCounter || new HttpStatsCounter(maxSamples);
            this._httpStatsCounter = client._httpStatsCounter;
        }
    }

    /**
     * Allocates counters when stats are opted in after construction.
     *
     * @param {number} [maxSamples=1000]
     */
    enable(maxSamples = 1000) {
        const { MqttStatsCounter, HttpStatsCounter } = require('../lib/utilities/stats');
        if (!this._mqttStatsCounter) {
            this._mqttStatsCounter = new MqttStatsCounter(maxSamples);
        }
        if (!this._httpStatsCounter) {
            this._httpStatsCounter = new HttpStatsCounter(maxSamples);
            this.meross.auth.client._httpStatsCounter = this._httpStatsCounter;
        }
    }

    disable() {
        this._mqttStatsCounter = null;
        this._httpStatsCounter = null;
        this.meross.auth.client._httpStatsCounter = null;
    }

    notifyHttpRequest(url, method, httpCode, apiCode) {
        if (this._httpStatsCounter) {
            this._httpStatsCounter.notifyHttpRequest(url, method, httpCode, apiCode);
        }
    }

    notifyMqttCall(deviceUuid, namespace, method) {
        if (this._mqttStatsCounter) {
            this._mqttStatsCounter.notifyApiCall(deviceUuid, namespace, method);
        }
    }

    notifyDelayedCall(deviceUuid, namespace, method) {
        if (this._mqttStatsCounter) {
            this._mqttStatsCounter.notifyDelayedCall(deviceUuid, namespace, method);
        }
    }

    notifyDroppedCall(deviceUuid, namespace, method) {
        if (this._mqttStatsCounter) {
            this._mqttStatsCounter.notifyDroppedCall(deviceUuid, namespace, method);
        }
    }

    getHttpStats(timeWindowMs = 60000) {
        if (this._httpStatsCounter) {
            return this._httpStatsCounter.getStats(timeWindowMs);
        }
        return null;
    }

    getMqttStats(timeWindowMs = 60000) {
        if (this._mqttStatsCounter) {
            return this._mqttStatsCounter.getApiStats(timeWindowMs);
        }
        return null;
    }

    getDelayedMqttStats(timeWindowMs = 60000) {
        if (this._mqttStatsCounter) {
            return this._mqttStatsCounter.getDelayedApiStats(timeWindowMs);
        }
        return null;
    }

    getDroppedMqttStats(timeWindowMs = 60000) {
        if (this._mqttStatsCounter) {
            return this._mqttStatsCounter.getDroppedApiStats(timeWindowMs);
        }
        return null;
    }

    isEnabled() {
        return !!(this._mqttStatsCounter || this._httpStatsCounter);
    }
}

module.exports = ManagerStatistics;
