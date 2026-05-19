'use strict';

const mqtt = require('mqtt');
const crypto = require('crypto');
const {
    buildDeviceRequestTopic,
    buildClientResponseTopic,
    buildClientUserTopic,
    deviceUuidFromPushNotification,
    generateClientAndAppId,
    generateMqttPassword
} = require('../lib/utilities/mqtt');
const Manager = require('./base');
const { MerossDeviceError, MerossNetworkError } = require('../lib/exception');

/**
 * Manages MQTT connections and message publishing.
 *
 * Owns broker clients and message encoding so device and transport managers
 * do not duplicate connection lifecycle or routing rules.
 *
 * @class ManagerMqtt
 * @extends Manager
 */
class ManagerMqtt extends Manager {
    /**
     * @param {import('../lib/meross')} meross - Root Meross instance
     */
    constructor(meross) {
        super(meross);
        this.mqttConnections = {};
        this._connectionPromises = new Map();
        this._pendingMessagesFutures = new Map();
        this._appId = null;
        this.clientResponseTopic = null;
    }

    /**
     * @returns {string}
     */
    get mqttDomain() {
        return this.meross.auth.mqttDomain;
    }

    /**
     * Seeds MQTT client identity after authentication.
     *
     * @param {string} userId - Meross user ID
     * @param {string} appId - Application ID for MQTT client
     */
    seedSession(userId, appId) {
        this._appId = appId;
        this.clientResponseTopic = buildClientResponseTopic(userId, appId);
    }

    /**
     * @param {string} domain - MQTT broker domain
     * @returns {boolean}
     */
    hasConnection(domain) {
        return !!(this.mqttConnections[domain]?.client);
    }

    /**
     * @param {string} domain - MQTT broker domain
     * @returns {Object|null}
     */
    getConnection(domain) {
        return this.mqttConnections[domain] || null;
    }

    /**
     * Ensures the device's domain has a broker client before enrollment continues.
     *
     * @param {Object} dev - Device definition object with uuid and optional domain
     * @returns {Promise<void>}
     */
    async init(dev) {
        const domain = dev.domain || this.mqttDomain;

        if (!this.mqttConnections[domain]) {
            this.mqttConnections[domain] = {};
        }

        await this._getMqttClient(domain, dev.uuid);
    }

    /**
     * Returns false instead of throwing when no broker exists so transport callers
     * can fall back without extra error handling.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance
     * @param {Object} data - Message data object with header and payload
     * @returns {boolean} True if the message was queued for publish
     */
    send(device, data) {
        const domain = device.domain || this.mqttDomain;
        if (!this.mqttConnections[domain] || !this.mqttConnections[domain].client) {
            return false;
        }

        this._logMessage(device.uuid, data);

        if (data && data.header) {
            const namespace = data.header.namespace || 'Unknown';
            const method = data.header.method || 'Unknown';
            this.meross.statistics.notifyMqttCall(device.uuid, namespace, method);
        }

        const topic = buildDeviceRequestTopic(device.uuid);
        this.mqttConnections[domain].client.publish(topic, JSON.stringify(data), undefined, err => {
            if (err) {
                this._logError(device.uuid, err);
                const deviceObj = this.meross.devices.get(device.uuid) || null;
                if (deviceObj) {
                    deviceObj.emit('error', err);
                }
            }
        });
        return true;
    }

    /**
     * Encodes a message for Meross device communication.
     *
     * Creates a properly formatted message object with header containing messageId, signature,
     * timestamp, and other required fields. The signature is computed as MD5(messageId + key + timestamp).
     *
     * @param {string} method - Message method ('GET', 'SET', 'PUSH')
     * @param {string} namespace - Message namespace (e.g., 'Appliance.Control.ToggleX')
     * @param {Object} payload - Message payload object
     * @param {string} deviceUuid - Target device UUID
     * @returns {Object} Encoded message object with header and payload
     * @returns {Object} returns.header - Message header
     * @returns {string} returns.header.from - Response topic
     * @returns {string} returns.header.messageId - Unique message ID (MD5 hash)
     * @returns {string} returns.header.method - Message method
     * @returns {string} returns.header.namespace - Message namespace
     * @returns {number} returns.header.payloadVersion - Payload version (always 1)
     * @returns {string} returns.header.sign - Message signature (MD5 hash)
     * @returns {number} returns.header.timestamp - Unix timestamp in seconds
     * @returns {string} returns.header.triggerSrc - Trigger source (always 'Android')
     * @returns {string} returns.header.uuid - Device UUID
     * @returns {Object} returns.payload - Message payload
     */
    encode(method, namespace, payload, deviceUuid) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let randomstring = '';
        for (let i = 0; i < 16; i++) {
            randomstring += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const messageId = crypto.createHash('md5').update(randomstring).digest('hex').toLowerCase();
        const timestamp = Math.round(new Date().getTime() / 1000);

        const signature = crypto.createHash('md5').update(messageId + this.meross.auth.key + timestamp).digest('hex');

        return {
            'header': {
                'from': this.clientResponseTopic,
                messageId,
                method,
                namespace,
                'payloadVersion': 1,
                'sign': signature,
                timestamp,
                'triggerSrc': 'Android',
                'uuid': deviceUuid
            },
            payload
        };
    }

    /**
     * Disconnects all MQTT connections.
     *
     * Closes all MQTT client connections and clears connection state.
     * This should be called when shutting down the application.
     *
     * @param {boolean} [force] - Force disconnect flag (passed to MQTT client end() method)
     * @returns {void}
     */
    disconnectAll(force) {
        for (const domain of Object.keys(this.mqttConnections)) {
            if (this.mqttConnections[domain]?.client) {
                this.mqttConnections[domain].client.removeAllListeners();
                this.mqttConnections[domain].client.end(force);
            }
        }

        this.mqttConnections = {};
        this._connectionPromises.clear();
    }

    /**
     * Parses MQTT message from buffer.
     *
     * Handles JSON parsing and validates message structure.
     * Returns parsed message object or null if parsing fails.
     *
     * @param {Buffer|string} message - Raw message buffer or string
     * @returns {Object|null} Parsed message object or null if invalid
     * @private
     */
    _parseMessage(message) {
        if (!message) {
            return null;
        }

        try {
            const parsed = JSON.parse(message.toString());
            if (!parsed.header) {
                return null;
            }
            return parsed;
        } catch (err) {
            this.meross.emit('error', new MerossNetworkError(`JSON parse error: ${err.message}`, 'PARSE_ERROR', { data: message.toString(), format: 'json', cause: err }), null);
            return null;
        }
    }

    /**
     * Resolves a pending future based on message method.
     *
     * Handles ERROR, GETACK/SETACK/DELETEACK, and unexpected methods.
     * Clears timeout and resolves or rejects the pending future appropriately.
     *
     * @param {Object} pendingFuture - Pending future object with resolve/reject methods
     * @param {string} messageMethod - Message method (ERROR, GETACK, SETACK, DELETEACK, etc.)
     * @param {Object} message - Parsed message object
     * @private
     */
    _resolvePendingFuture(pendingFuture, messageMethod, message) {
        if (pendingFuture.timeout) {
            clearTimeout(pendingFuture.timeout);
        }

        if (messageMethod === 'ERROR') {
            const errorPayload = message.payload || {};
            const deviceUuid = message.header?.from ? deviceUuidFromPushNotification(message.header.from) : null;
            pendingFuture.reject(new MerossDeviceError(
                `Device returned error: ${JSON.stringify(errorPayload)}`,
                'COMMAND_FAILED',
                { errorPayload, deviceUuid }
            ));
        } else if (messageMethod === 'GETACK' || messageMethod === 'SETACK' || messageMethod === 'DELETEACK') {
            pendingFuture.resolve(message.payload || message);
        } else {
            const topic = message.header?.from || null;
            pendingFuture.reject(new MerossNetworkError(
                `Unexpected message method: ${messageMethod}`,
                'MQTT_ERROR',
                { topic, data: message }
            ));
        }
    }

    /**
     * Handles manager-level queries with pending futures.
     *
     * Checks if message has a pending future and resolves it if found.
     * Returns true if handled, false otherwise.
     *
     * @param {Object} message - Parsed message object
     * @returns {boolean} True if message was handled, false otherwise
     * @private
     */
    _handlePendingFuture(message) {
        const { messageId } = message.header;
        if (!messageId || !this._pendingMessagesFutures.has(messageId)) {
            return false;
        }

        const pendingFuture = this._pendingMessagesFutures.get(messageId);
        const messageMethod = message.header.method;

        this._resolvePendingFuture(pendingFuture, messageMethod, message);

        this._pendingMessagesFutures.delete(messageId);
        return true;
    }

    /**
     * Registers a pending MQTT response future.
     *
     * @param {string} messageId - Message ID
     * @param {Object} future - Future with resolve, reject, timeout
     */
    setPendingFuture(messageId, future) {
        this._pendingMessagesFutures.set(messageId, future);
    }

    /**
     * @param {string} messageId - Message ID
     * @returns {boolean}
     */
    hasPendingFuture(messageId) {
        return this._pendingMessagesFutures.has(messageId);
    }

    /**
     * @param {string} messageId - Message ID
     */
    deletePendingFuture(messageId) {
        this._pendingMessagesFutures.delete(messageId);
    }

    /**
     * Routes message to device handler.
     *
     * Extracts device UUID from message header and routes to appropriate device.
     *
     * @param {Object} message - Parsed message object
     * @private
     */
    _routeDeviceMessage(message) {
        if (!message.header.from) {
            return;
        }

        const deviceUuid = deviceUuidFromPushNotification(message.header.from);
        const device = this.meross.devices.get(deviceUuid) || null;
        if (device) {
            device.handleMessage(message);
        }
    }

    /**
     * Logs outgoing MQTT message.
     *
     * @param {string} deviceUuid - Device UUID
     * @param {Object} data - Message data object
     * @private
     */
    _logMessage(deviceUuid, data) {
        if (this.meross.options.logger) {
            this.meross.options.logger(`MQTT-Cloud-Call ${deviceUuid}: ${JSON.stringify(data)}`);
        }
    }

    /**
     * Logs incoming MQTT message.
     *
     * @param {string} deviceUuid - Device UUID
     * @param {Object} message - Parsed message object
     * @private
     */
    _logResponse(deviceUuid, message) {
        if (this.meross.options.logger) {
            this.meross.options.logger(`MQTT-Cloud-Response ${deviceUuid}: ${JSON.stringify(message)}`);
        }
    }

    /**
     * Logs MQTT error.
     *
     * @param {string} deviceUuid - Device UUID
     * @param {Error|string} error - Error object or error message
     * @private
     */
    _logError(deviceUuid, error) {
        if (this.meross.options.logger) {
            const errorMessage = error instanceof Error ? error.message : error;
            this.meross.options.logger(`MQTT-Cloud-Error ${deviceUuid}: ${errorMessage}`);
        }
    }

    /**
     * Creates a new MQTT client and registers lifecycle handlers once.
     *
     * Listeners are attached at creation time so a reused client does not accumulate
     * handlers and trigger MaxListenersExceededWarning.
     *
     * @param {string} domain - MQTT domain for the connection
     * @returns {mqtt.MqttClient} The created MQTT client
     * @private
     */
    _createMqttClient(domain) {
        // Late auth paths may reach MQTT before seedSession ran during construction
        if (!this._appId) {
            const { appId } = generateClientAndAppId();
            this.seedSession(this.meross.auth.userId, appId);
        }
        const clientId = `app:${this._appId}`;

        const hashedPassword = generateMqttPassword(this.meross.auth.userId, this.meross.auth.key);

        const client = mqtt.connect({
            'protocol': 'mqtts',
            'host': domain,
            'port': 2001,
            clientId,
            'username': this.meross.auth.userId,
            'password': hashedPassword,
            'rejectUnauthorized': true,
            'keepalive': 30,
            'reconnectPeriod': 5000
        });

        // Set up all event listeners once when client is created to prevent duplicate
        // listeners that would cause MaxListenersExceededWarning if the client is reused
        client.on('connect', () => {
            const userTopic = buildClientUserTopic(this.meross.auth.userId);
            client.subscribe(userTopic, (err) => {
                if (err) {
                    this.meross.emit('error', err, null);
                }
            });

            client.subscribe(this.clientResponseTopic, (err) => {
                if (err) {
                    this.meross.emit('error', err, null);
                }
            });

            // Resolve connection promise after subscriptions complete to ensure client is fully ready
            if (this.mqttConnections[domain]._connectionResolve) {
                this.mqttConnections[domain]._connectionResolve();
                this.mqttConnections[domain]._connectionResolve = null;
            }

            this.mqttConnections[domain].deviceList.forEach(devId => {
                const device = this.meross.devices.get(devId) || null;
                if (device) {
                    device.emit('connected');
                }
            });
        });

        client.on('error', (error) => {
            this.mqttConnections[domain].deviceList.forEach(devId => {
                const device = this.meross.devices.get(devId) || null;
                if (device) {
                    device.emit('error', error ? error.toString() : null);
                }
            });
        });

        client.on('close', (error) => {
            this.mqttConnections[domain].deviceList.forEach(devId => {
                const device = this.meross.devices.get(devId) || null;
                if (device) {
                    device.emit('disconnected', error ? error.toString() : null);
                }
            });
        });

        client.on('reconnect', () => {
            this.mqttConnections[domain].deviceList.forEach(devId => {
                const device = this.meross.devices.get(devId) || null;
                if (device) {
                    device.emit('reconnected');
                }
            });
        });

        client.on('message', (topic, message) => {
            const parsedMessage = this._parseMessage(message);
            if (!parsedMessage) {
                return;
            }

            let deviceUuid = null;
            if (parsedMessage.header.from) {
                deviceUuid = deviceUuidFromPushNotification(parsedMessage.header.from);
            }

            if (deviceUuid) {
                this._logResponse(deviceUuid, parsedMessage);
            }

            // Resolve manager-level request futures before device routing
            if (this._handlePendingFuture(parsedMessage)) {
                return;
            }

            this._routeDeviceMessage(parsedMessage);
        });

        return client;
    }

    /**
     * Gets existing MQTT client or creates a new one for the given domain.
     *
     * This method manages the MQTT client lifecycle and uses promise-based serialization
     * to prevent concurrent connection attempts. If a client already exists and is connected, it returns immediately. If a client
     * exists but is not connected, it waits for the existing connection promise. If no
     * client exists, it creates a new one and waits for connection.
     *
     * @param {string} domain - MQTT domain for the connection
     * @param {string} deviceUuid - Device UUID (for device list tracking)
     * @returns {Promise<mqtt.MqttClient>} Promise that resolves with the MQTT client
     * @private
     */
    async _getMqttClient(domain, deviceUuid) {
        if (!this.mqttConnections[domain]) {
            this.mqttConnections[domain] = {};
        }

        let client = this.mqttConnections[domain].client;
        if (!client) {
            client = this._createMqttClient(domain);
            this.mqttConnections[domain].client = client;
            this.mqttConnections[domain].deviceList = this.mqttConnections[domain].deviceList || [];
            if (!this.mqttConnections[domain].deviceList.includes(deviceUuid)) {
                this.mqttConnections[domain].deviceList.push(deviceUuid);
            }
        } else {
            if (client.connected) {
                if (!this.mqttConnections[domain].deviceList.includes(deviceUuid)) {
                    this.mqttConnections[domain].deviceList.push(deviceUuid);
                }
                return client;
            }
        }

        let connectionPromise = this._connectionPromises.get(domain);
        if (!connectionPromise) {
            connectionPromise = new Promise((resolve, reject) => {
                this.mqttConnections[domain]._connectionResolve = resolve;

                setTimeout(() => {
                    if (this.mqttConnections[domain]) {
                        this.mqttConnections[domain]._connectionResolve = null;
                    }
                    this._connectionPromises.delete(domain);
                    reject(new MerossNetworkError(`MQTT connection timeout for domain ${domain}`, 'MQTT_ERROR'));
                }, 30000);
            });

            this._connectionPromises.set(domain, connectionPromise);
        }

        await connectionPromise;
        return this.mqttConnections[domain].client;
    }
}

module.exports = ManagerMqtt;
