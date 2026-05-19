'use strict';

const Manager = require('./base');
const RequestQueue = require('../lib/utilities/request-queue');
const { TransportMode } = require('../lib/enums');
const { MerossNetworkError, MerossApiError } = require('../lib/exception');

/**
 * Manages transport mode selection and message routing.
 *
 * @class ManagerTransport
 * @extends Manager
 */
class ManagerTransport extends Manager {
    /**
     * @param {import('../lib/meross')} meross - Root Meross instance
     */
    constructor(meross) {
        super(meross);
        const options = meross.options;

        this._defaultTransportMode = options.transportMode !== undefined
            ? options.transportMode
            : TransportMode.MQTT_ONLY;

        this._errorBudgets = new Map();
        this.errorBudgetMaxErrors = options.maxErrors !== undefined ? options.maxErrors : 1;
        this.errorBudgetTimeWindow = options.errorBudgetTimeWindow !== undefined
            ? options.errorBudgetTimeWindow
            : 60000;

        const enableRequestThrottling = options.enableRequestThrottling !== undefined
            ? options.enableRequestThrottling
            : true;
        this._requestQueue = enableRequestThrottling ? new RequestQueue({
            batchSize: options.requestBatchSize || 1,
            batchDelay: options.requestBatchDelay || 200,
            logger: options.logger
        }) : null;
    }

    get defaultMode() {
        return this._defaultTransportMode;
    }

    set defaultMode(value) {
        if (!Object.values(TransportMode).includes(value)) {
            throw new MerossNetworkError(
                `Invalid transport mode: ${value}. Must be one of: ${Object.values(TransportMode).join(', ')}`,
                'MQTT_ERROR'
            );
        }
        this._defaultTransportMode = value;
    }

    /**
     * Clears all per-device request queues on shutdown.
     *
     * @param {Array<{uuid?: string}>} devices - Devices that were connected
     */
    clearAllQueues(devices) {
        if (!this._requestQueue) {
            return;
        }
        devices.forEach(device => {
            if (device.uuid) {
                this._requestQueue.clearQueue(device.uuid);
            }
        });
    }

    /**
     * Clears the throttled request queue for one device when it is removed.
     *
     * @param {string} deviceUuid - Device UUID
     */
    clearDeviceQueue(deviceUuid) {
        if (this._requestQueue && deviceUuid) {
            this._requestQueue.clearQueue(deviceUuid);
        }
    }

    /**
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device
     * @param {string|null} ip
     * @param {Object} data
     * @param {number|null} [overrideMode=null]
     * @returns {Promise<boolean>}
     */
    async request(device, ip, data, overrideMode = null) {
        if (!this._requestQueue) {
            return this._send(device, ip, data, overrideMode);
        }

        return this._requestQueue.enqueue(device.uuid, () =>
            this._send(device, ip, data, overrideMode)
        );
    }

    /**
     * @param {number|null} overrideMode
     * @returns {number}
     * @private
     */
    _getTransportMode(overrideMode) {
        return overrideMode !== null ? overrideMode : this._defaultTransportMode;
    }

    /**
     * @param {number} transportMode
     * @returns {boolean}
     * @private
     */
    _canFallback(transportMode) {
        return transportMode === TransportMode.LAN_HTTP_FIRST ||
               transportMode === TransportMode.LAN_HTTP_FIRST_ONLY_GET;
    }

    /**
     * @param {number} transportMode
     * @param {string} method
     * @param {string|null} ip
     * @returns {boolean}
     * @private
     */
    _canUseLan(transportMode, method, ip) {
        if (!ip) {
            return false;
        }

        if (transportMode === TransportMode.LAN_HTTP_FIRST) {
            return true;
        }

        if (transportMode === TransportMode.LAN_HTTP_FIRST_ONLY_GET) {
            return method === 'GET';
        }

        return false;
    }

    /**
     * @param {string} deviceUuid
     * @returns {number}
     */
    getBudget(deviceUuid) {
        return this._errorBudgetEntry(deviceUuid).budget;
    }

    /**
     * @param {string} deviceUuid
     * @returns {boolean}
     */
    isOutOfBudget(deviceUuid) {
        return this.getBudget(deviceUuid) < 1;
    }

    /**
     * @param {string} deviceUuid
     * @returns {void}
     */
    resetBudget(deviceUuid) {
        this._errorBudgets.delete(deviceUuid);
    }

    /**
     * @param {string} deviceUuid
     * @returns {{ budget: number, windowStart: number }}
     * @private
     */
    _errorBudgetEntry(deviceUuid) {
        let entry = this._errorBudgets.get(deviceUuid);
        const now = Date.now();

        if (!entry) {
            entry = { budget: this.errorBudgetMaxErrors, windowStart: now };
            this._errorBudgets.set(deviceUuid, entry);
        }

        if (now > (entry.windowStart + this.errorBudgetTimeWindow)) {
            entry.budget = this.errorBudgetMaxErrors;
            entry.windowStart = now;
        }

        return entry;
    }

    /**
     * @param {string} deviceUuid
     * @returns {boolean} True when LAN HTTP should be skipped (budget exhausted)
     * @private
     */
    _checkErrorBudget(deviceUuid) {
        if (this.isOutOfBudget(deviceUuid)) {
            if (this.meross.options.logger) {
                this.meross.options.logger(
                    `Cannot issue command via LAN (http) against device ${deviceUuid} - device has no more error budget left. Using MQTT.`
                );
            }
            return true;
        }
        return false;
    }

    /**
     * @private
     */
    async _sendViaHttp(device, ip, data) {
        try {
            const lanTimeout = Math.min(this.meross.timeout, 1000);
            await this.meross.http.send(device, ip, data, lanTimeout);
            return true;
        } catch (err) {
            const isHttpFailure = !(err instanceof MerossApiError) ||
                (err instanceof MerossApiError && err.httpStatusCode !== null && err.httpStatusCode !== undefined);

            if (isHttpFailure) {
                const entry = this._errorBudgetEntry(device.uuid);
                if (entry.budget >= 1) {
                    entry.budget -= 1;
                }
            }

            if (this.meross.options.logger) {
                this.meross.options.logger(
                    `An error occurred while attempting to send a message over internal LAN to device ${device.uuid}. Retrying with MQTT transport.`
                );
            }

            throw err;
        }
    }

    /**
     * @private
     */
    async _send(device, ip, data, overrideMode = null) {
        const transportMode = this._getTransportMode(overrideMode);
        const method = data?.header?.method?.toUpperCase();

        if (this._canUseLan(transportMode, method, ip)) {
            if (this._checkErrorBudget(device.uuid)) {
                return this.meross.mqtt.send(device, data);
            }

            try {
                return await this._sendViaHttp(device, ip, data);
            } catch (err) {
                if (this._canFallback(transportMode)) {
                    return this.meross.mqtt.send(device, data);
                }
                throw err;
            }
        }

        return this.meross.mqtt.send(device, data);
    }
}

module.exports = ManagerTransport;
