'use strict';

const { TransportMode } = require('../model/enums');
const { MerossErrorMqtt } = require('../model/exception');

/**
 * Manages transport mode selection and message routing.
 *
 * Handles transport mode configuration and coordinates between MQTT and HTTP
 * managers to route messages based on the selected transport mode. Provides
 * error budget checking and automatic fallback logic.
 *
 * @class ManagerTransport
 */
class ManagerTransport {
    /**
     * Creates a new ManagerTransport instance.
     *
     * @param {ManagerMeross} manager - Parent manager instance
     */
    constructor(manager) {
        this.manager = manager;
    }

    /**
     * Gets the default transport mode for device communication.
     *
     * @returns {number} Transport mode from TransportMode enum
     */
    get defaultMode() {
        return this.manager._defaultTransportMode;
    }

    /**
     * Sets the default transport mode for device communication.
     *
     * @param {number} value - Transport mode from TransportMode enum
     * @throws {MqttError} If invalid transport mode is provided
     */
    set defaultMode(value) {
        if (!Object.values(TransportMode).includes(value)) {
            throw new MerossErrorMqtt(`Invalid transport mode: ${value}. Must be one of: ${Object.values(TransportMode).join(', ')}`);
        }
        this.manager._defaultTransportMode = value;
    }

    /**
     * Requests a message to be sent to a device (with throttling support).
     *
     * This method queues requests per device and processes them in batches to prevent
     * rate limiting. Requests are throttled regardless of transport mode (HTTP or MQTT).
     * If throttling is disabled, requests are executed immediately.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance
     * @param {string|null} ip - Device LAN IP address (null if not available)
     * @param {Object} data - Message data object with header and payload
     * @param {number|null} [overrideMode=null] - Override transport mode (from TransportMode enum)
     * @returns {Promise<boolean>} Promise that resolves to true if message was sent successfully
     * @throws {CommandError} If message cannot be sent
     * @throws {HttpApiError} If HTTP request fails
     * @throws {MqttError} If MQTT publish fails
     */
    async request(device, ip, data, overrideMode = null) {
        if (!this.manager._requestQueue) {
            return this._send(device, ip, data, overrideMode);
        }

        return this.manager._requestQueue.enqueue(device.uuid, () =>
            this._send(device, ip, data, overrideMode)
        );
    }

    /**
     * Gets the effective transport mode to use.
     *
     * @param {number|null} overrideMode - Override transport mode (from TransportMode enum)
     * @returns {number} Effective transport mode
     * @private
     */
    _getTransportMode(overrideMode) {
        return overrideMode !== null ? overrideMode : this.manager._defaultTransportMode;
    }

    /**
     * Checks if fallback to MQTT is supported for the transport mode.
     *
     * @param {number} transportMode - Transport mode (from TransportMode enum)
     * @returns {boolean} True if fallback to MQTT is supported
     * @private
     */
    _canFallback(transportMode) {
        return transportMode === TransportMode.LAN_HTTP_FIRST ||
               transportMode === TransportMode.LAN_HTTP_FIRST_ONLY_GET;
    }

    /**
     * Checks if LAN HTTP can be used based on transport mode and message type.
     *
     * @param {number} transportMode - Transport mode (from TransportMode enum)
     * @param {string} method - Message method ('GET', 'SET', etc.)
     * @param {string|null} ip - Device LAN IP address (null if not available)
     * @returns {boolean} True if LAN HTTP can be used
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
     * Checks if device has exhausted error budget and logs warning.
     *
     * @param {string} deviceUuid - Device UUID
     * @returns {boolean} True if error budget is exhausted
     * @private
     */
    _checkErrorBudget(deviceUuid) {
        if (this.manager._errorBudgetManager.isOutOfBudget(deviceUuid)) {
            if (this.manager.options.logger) {
                this.manager.options.logger(
                    `Cannot issue command via LAN (http) against device ${deviceUuid} - device has no more error budget left. Using MQTT.`
                );
            }
            return true;
        }
        return false;
    }

    /**
     * Sends message via HTTP with error handling.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance
     * @param {string} ip - Device LAN IP address
     * @param {Object} data - Message data object with header and payload
     * @returns {Promise<boolean>} Promise that resolves to true if sent successfully
     * @throws {HttpApiError} If HTTP request fails
     * @private
     */
    async _sendViaHttp(device, ip, data) {
        try {
            // Use shorter timeout for LAN requests to fail fast and fallback to MQTT
            const lanTimeout = Math.min(this.manager.timeout, 1000);
            await this.manager.http.send(device, ip, data, lanTimeout);
            return true;
        } catch (err) {
            // Distinguish HTTP-level failures from parsing errors that occur after successful HTTP 200
            const { MerossErrorHttpApi } = require('../model/http/exception');
            const isHttpFailure = !(err instanceof MerossErrorHttpApi) ||
                                 (err instanceof MerossErrorHttpApi && err.httpStatusCode !== null && err.httpStatusCode !== undefined);

            if (isHttpFailure) {
                this.manager._errorBudgetManager.notifyError(device.uuid);
            }

            if (this.manager.options.logger) {
                this.manager.options.logger(
                    `An error occurred while attempting to send a message over internal LAN to device ${device.uuid}. Retrying with MQTT transport.`
                );
            }

            throw err;
        }
    }

    /**
     * Sends a message to a device via HTTP or MQTT (internal implementation).
     *
     * This method handles the actual message sending logic, including transport mode
     * selection, error budget checking, HTTP fallback to MQTT, and error handling.
     * It is called by request() which handles throttling/queuing.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance
     * @param {string|null} ip - Device LAN IP address (null if not available)
     * @param {Object} data - Message data object with header and payload
     * @param {number|null} [overrideMode=null] - Override transport mode (from TransportMode enum)
     * @returns {Promise<boolean>} Promise that resolves to true if message was sent successfully
     * @throws {CommandError} If message cannot be sent
     * @throws {HttpApiError} If HTTP request fails
     * @throws {MqttError} If MQTT publish fails
     * @private
     */
    async _send(device, ip, data, overrideMode = null) {
        const transportMode = this._getTransportMode(overrideMode);
        const method = data?.header?.method?.toUpperCase();

        if (this._canUseLan(transportMode, method, ip)) {
            if (this._checkErrorBudget(device.uuid)) {
                // Error budget exhausted, fallback to MQTT if supported, otherwise use MQTT directly
                return this.manager.mqtt.send(device, data);
            }

            try {
                return await this._sendViaHttp(device, ip, data);
            } catch (err) {
                if (this._canFallback(transportMode)) {
                    return this.manager.mqtt.send(device, data);
                }
                throw err;
            }
        }

        return this.manager.mqtt.send(device, data);
    }
}

module.exports = ManagerTransport;
