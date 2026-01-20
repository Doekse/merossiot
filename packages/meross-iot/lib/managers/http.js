'use strict';

const { MerossErrorCommand, MerossErrorNetworkTimeout } = require('../model/exception');
const { MerossErrorHttpApi } = require('../model/http/exception');

/**
 * Manages LAN HTTP communication with devices.
 *
 * Handles direct HTTP POST requests to device local IP addresses, including
 * encryption/decryption support and response parsing. Provides a clean interface
 * for HTTP operations separate from MQTT and transport concerns.
 *
 * @class ManagerHttp
 */
class ManagerHttp {
    /**
     * Creates a new ManagerHttp instance.
     *
     * @param {ManagerMeross} manager - Parent manager instance
     */
    constructor(manager) {
        this.manager = manager;
    }

    /**
     * Encrypts message if device supports encryption.
     *
     * Sets up encryption key if needed and encrypts the message data.
     * Returns both the encrypted message data and a flag indicating whether
     * the response should be decrypted.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance
     * @param {string} messageData - JSON stringified message data
     * @returns {{messageData: string, decryptResponse: boolean}} Object with encrypted message data and decryption flag
     * @throws {MerossErrorCommand} If encryption is required but MAC address not available
     * @private
     */
    _encryptMessage(device, messageData) {
        let decryptResponse = false;

        if (device && typeof device.supportEncryption === 'function' && device.supportEncryption()) {
            if (!device.isEncryptionKeySet()) {
                // Encryption key is derived from MAC address, so it must be available
                if (device.macAddress && this.manager.key) {
                    device.setEncryptionKey(device.uuid, this.manager.key, device.macAddress);
                } else {
                    if (this.manager.options.logger) {
                        this.manager.options.logger(`Warning: Device ${device.uuid} supports encryption but MAC address not available yet. Falling back to MQTT.`);
                    }
                    throw new MerossErrorCommand('Encryption required but MAC address not available', null, device.uuid);
                }
            }

            try {
                messageData = device.encryptMessage(messageData);
                decryptResponse = true;
            } catch (err) {
                if (this.manager.options.logger) {
                    this.manager.options.logger(`Error encrypting message for ${device.uuid}: ${err.message}`);
                }
                throw err;
            }
        }

        return { messageData, decryptResponse };
    }

    /**
     * Sends HTTP request to device with timeout handling.
     *
     * Executes a POST request to the device URL with proper timeout handling
     * using AbortController. Validates response status and returns the response.
     *
     * @param {string} url - Request URL
     * @param {string} messageData - Request body data
     * @param {number} timeout - Request timeout in milliseconds
     * @returns {Promise<Response>} Fetch response object
     * @throws {MerossErrorNetworkTimeout} If request times out
     * @throws {MerossErrorHttpApi} If response status is not 200
     * @private
     */
    async _sendRequest(url, messageData, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: messageData,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new MerossErrorNetworkTimeout('Request timeout', null, url);
            }
            throw error;
        }

        if (response.status !== 200) {
            throw new MerossErrorHttpApi(`HTTP ${response.status}: ${response.statusText}`, null, response.status);
        }

        return response;
    }

    /**
     * Parses HTTP response body, handling encryption if needed.
     *
     * Decrypts and parses encrypted responses, or parses unencrypted JSON responses.
     * Returns the parsed response object.
     *
     * @param {string} body - Response body text
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance
     * @param {boolean} decryptResponse - Whether response is encrypted
     * @returns {Object} Parsed response object
     * @throws {MerossErrorHttpApi} If decryption or parsing fails
     * @private
     */
    _parseResponse(body, device, decryptResponse) {
        let responseBody = body;

        if (decryptResponse && device) {
            try {
                const decrypted = device.decryptMessage(body);
                // Remove null padding that encryption adds to match block size
                responseBody = decrypted.toString('utf8').replace(/\0+$/, '');
                try {
                    responseBody = JSON.parse(responseBody);
                } catch (parseErr) {
                    if (this.manager.options.logger) {
                        this.manager.options.logger(`Error parsing decrypted response for ${device.uuid}: ${parseErr.message}`);
                    }
                    throw new MerossErrorHttpApi(`Failed to parse decrypted response: ${parseErr.message}`, null, null, { cause: parseErr });
                }
            } catch (decryptErr) {
                if (this.manager.options.logger) {
                    this.manager.options.logger(`Error decrypting response for ${device.uuid}: ${decryptErr.message}`);
                }
                throw decryptErr;
            }
        } else {
            try {
                responseBody = JSON.parse(responseBody);
            } catch (parseErr) {
                if (this.manager.options.logger) {
                    this.manager.options.logger(`Error parsing response for ${device.uuid}: ${parseErr.message}`);
                }
                throw new MerossErrorHttpApi(`Failed to parse response: ${parseErr.message}`, null, null, { cause: parseErr });
            }
        }

        return responseBody;
    }

    /**
     * Tracks HTTP error statistics.
     *
     * Extracts HTTP status code from various error types and records it
     * in the statistics tracker if enabled.
     *
     * @param {string} url - Request URL
     * @param {Error|MerossErrorHttpApi} error - Error object
     * @private
     */
    _trackError(url, error) {
        let errorHttpCode = null;
        const errorApiCode = null;

        if (error instanceof MerossErrorHttpApi && error.httpStatusCode !== null && error.httpStatusCode !== undefined) {
            errorHttpCode = error.httpStatusCode;
        } else if (!(error instanceof MerossErrorHttpApi)) {
            // Extract HTTP status code from network errors, timeouts, and connection failures
            if (error.statusCode) {
                errorHttpCode = error.statusCode;
            } else if (error.message && error.message.includes('HTTP')) {
                const match = error.message.match(/HTTP (\d+)/);
                if (match) {
                    errorHttpCode = parseInt(match[1], 10);
                }
            }
            if (errorHttpCode === null) {
                errorHttpCode = 0;
            }
        }

        if (errorHttpCode !== null) {
            this.manager.statistics.notifyHttpRequest(url, 'POST', errorHttpCode, errorApiCode);
        }
    }

    /**
     * Logs HTTP request.
     *
     * @param {string} deviceUuid - Device UUID
     * @param {Object} options - Request options
     * @param {boolean} decryptResponse - Whether response is encrypted
     * @private
     */
    _logRequest(deviceUuid, options, decryptResponse) {
        if (this.manager.options.logger) {
            const encryptedFlag = decryptResponse ? ' [ENCRYPTED]' : '';
            this.manager.options.logger(`HTTP-Local-Call ${deviceUuid}${encryptedFlag}: ${JSON.stringify(options)}`);
        }
    }

    /**
     * Logs HTTP response.
     *
     * @param {string} deviceUuid - Device UUID
     * @param {string} body - Response body
     * @param {boolean} decryptResponse - Whether response is encrypted
     * @private
     */
    _logResponse(deviceUuid, body, decryptResponse) {
        if (this.manager.options.logger) {
            const encryptedFlag = decryptResponse ? ' [ENCRYPTED]' : '';
            this.manager.options.logger(`HTTP-Local-Response ${deviceUuid}${encryptedFlag} OK: ${body}`);
        }
    }

    /**
     * Logs HTTP error response.
     *
     * @param {string} deviceUuid - Device UUID
     * @param {number} statusCode - HTTP status code
     * @param {boolean} decryptResponse - Whether response is encrypted
     * @private
     */
    _logErrorResponse(deviceUuid, statusCode, decryptResponse) {
        if (this.manager.options.logger) {
            const encryptedFlag = decryptResponse ? ' [ENCRYPTED]' : '';
            this.manager.options.logger(`HTTP-Local-Response ${deviceUuid}${encryptedFlag} Error: Status=${statusCode}`);
        }
    }

    /**
     * Tracks HTTP success statistics.
     *
     * @param {string} url - Request URL
     * @private
     */
    _trackSuccess(url) {
        this.manager.statistics.notifyHttpRequest(url, 'POST', 200, null);
    }

    /**
     * Sends a message to a device via LAN HTTP.
     *
     * Sends an HTTP POST request directly to the device's local IP address. Handles encryption
     * if the device supports it. Decrypts and parses the response, then routes it to the device's
     * handleMessage method. Tracks HTTP statistics if enabled.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance
     * @param {string} ip - Device LAN IP address
     * @param {Object} payload - Message payload object with header and payload
     * @param {number} [timeoutOverride=this.manager.timeout] - Request timeout in milliseconds
     * @returns {Promise<void>} Promise that resolves when message is sent and response is handled
     * @throws {MerossErrorCommand} If encryption is required but MAC address not available
     * @throws {MerossErrorHttpApi} If HTTP request fails or response is invalid
     */
    async send(device, ip, payload, timeoutOverride = this.manager.timeout) {
        const url = `http://${ip}/config`;
        let messageData = JSON.stringify(payload);

        // Encrypt message if device supports encryption
        const { messageData: encryptedMessageData, decryptResponse } = this._encryptMessage(device, messageData);
        messageData = encryptedMessageData;

        // Log request
        const options = {
            url,
            method: 'POST',
            json: payload,
            timeout: timeoutOverride
        };
        this._logRequest(device.uuid, options, decryptResponse);

        try {
            // Send HTTP request
            const response = await this._sendRequest(url, messageData, timeoutOverride);

            // Log response status
            const body = await response.text();
            this._logResponse(device.uuid, body, decryptResponse);

            // Track HTTP success before parsing to avoid counting parsing errors as HTTP failures
            this._trackSuccess(url);

            // Parse response
            const responseBody = this._parseResponse(body, device, decryptResponse);

            // Route response to device
            if (responseBody && typeof responseBody === 'object') {
                setImmediate(() => {
                    if (device) {
                        device.handleMessage(responseBody);
                    }
                });
                return;
            }
            throw new MerossErrorHttpApi(`Invalid response: ${typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)}`, null, null);
        } catch (error) {
            // Log error response if it's an MerossErrorHttpApi with status
            if (error instanceof MerossErrorHttpApi && error.httpStatusCode) {
                this._logErrorResponse(device.uuid, error.httpStatusCode, decryptResponse);
            }

            // Track HTTP-level errors only, not parsing errors that occur after successful HTTP 200
            this._trackError(url, error);

            throw error;
        }
    }
}

module.exports = ManagerHttp;
