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
} = require('../utilities/mqtt');
const { MqttError, CommandError } = require('../model/exception');

/**
 * Manages MQTT connections and message publishing.
 *
 * Handles MQTT client creation, connection management, message encoding,
 * and message routing. Provides a clean interface for MQTT operations
 * separate from device management.
 *
 * @class ManagerMqtt
 */
class ManagerMqtt {
    /**
     * Creates a new ManagerMqtt instance.
     *
     * @param {ManagerMeross} manager - Parent manager instance
     */
    constructor(manager) {
        this.manager = manager;
    }

    /**
     * Initializes MQTT connection for a device.
     *
     * Creates or retrieves the MQTT client for the device's domain and ensures
     * the device is added to the connection's device list. This is a simplified
     * wrapper around `_getMqttClient()` that handles device-specific setup.
     *
     * @param {Object} dev - Device definition object with uuid and optional domain
     * @returns {Promise<void>} Promise that resolves when MQTT connection is ready
     */
    async init(dev) {
        const domain = dev.domain || this.manager.mqttDomain;

        if (!this.manager.mqttConnections[domain]) {
            this.manager.mqttConnections[domain] = {};
        }

        await this._getMqttClient(domain, dev.uuid);
    }

    /**
     * Sends a message to a device via MQTT.
     *
     * Publishes a message to the device's MQTT topic. Tracks MQTT statistics if enabled.
     * Emits error events on the device if publish fails.
     *
     * @param {MerossDevice|MerossHubDevice|MerossSubDevice} device - Device instance
     * @param {Object} data - Message data object with header and payload
     * @returns {boolean} True if message was sent successfully, false if MQTT connection not available
     */
    send(device, data) {
        const domain = device.domain || this.manager.mqttDomain;
        if (!this.manager.mqttConnections[domain] || !this.manager.mqttConnections[domain].client) {
            return false;
        }

        // Log outgoing message
        this._logMessage(device.uuid, data);

        // Track statistics
        if (data && data.header) {
            const namespace = data.header.namespace || 'Unknown';
            const method = data.header.method || 'Unknown';
            this.manager.statistics.notifyMqttCall(device.uuid, namespace, method);
        }

        // Publish message
        const topic = buildDeviceRequestTopic(device.uuid);
        this.manager.mqttConnections[domain].client.publish(topic, JSON.stringify(data), undefined, err => {
            if (err) {
                this._logError(device.uuid, err);
                const deviceObj = this.manager._deviceRegistry._devicesByUuid.get(device.uuid) || null;
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

        const signature = crypto.createHash('md5').update(messageId + this.manager.key + timestamp).digest('hex');

        return {
            'header': {
                'from': this.manager.clientResponseTopic,
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
        for (const domain of Object.keys(this.manager.mqttConnections)) {
            if (this.manager.mqttConnections[domain] && this.manager.mqttConnections[domain].client) {
                this.manager.mqttConnections[domain].client.removeAllListeners();
                this.manager.mqttConnections[domain].client.end(force);
            }
        }

        this.manager.mqttConnections = {};
        this.manager._mqttConnectionPromises.clear();
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
            this.manager.emit('error', new Error(`JSON parse error: ${err}`), null);
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
            pendingFuture.reject(new CommandError(
                `Device returned error: ${JSON.stringify(errorPayload)}`,
                errorPayload,
                deviceUuid
            ));
        } else if (messageMethod === 'GETACK' || messageMethod === 'SETACK' || messageMethod === 'DELETEACK') {
            pendingFuture.resolve(message.payload || message);
        } else {
            const topic = message.header?.from || null;
            pendingFuture.reject(new MqttError(
                `Unexpected message method: ${messageMethod}`,
                topic,
                message
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
        if (!messageId || !this.manager._pendingMessagesFutures.has(messageId)) {
            return false;
        }

        const pendingFuture = this.manager._pendingMessagesFutures.get(messageId);
        const messageMethod = message.header.method;

        this._resolvePendingFuture(pendingFuture, messageMethod, message);

        this.manager._pendingMessagesFutures.delete(messageId);
        return true;
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
        const device = this.manager._deviceRegistry._devicesByUuid.get(deviceUuid) || null;
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
        if (this.manager.options.logger) {
            this.manager.options.logger(`MQTT-Cloud-Call ${deviceUuid}: ${JSON.stringify(data)}`);
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
        if (this.manager.options.logger) {
            this.manager.options.logger(`MQTT-Cloud-Response ${deviceUuid}: ${JSON.stringify(message)}`);
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
        if (this.manager.options.logger) {
            const errorMessage = error instanceof Error ? error.message : error;
            this.manager.options.logger(`MQTT-Cloud-Error ${deviceUuid}: ${errorMessage}`);
        }
    }

    /**
     * Creates a new MQTT client and sets up all event listeners.
     *
     * This method creates a new MQTT client instance and sets up all event listeners
     * (connect, error, close, reconnect, message) exactly once.
     *
     * @param {string} domain - MQTT domain for the connection
     * @returns {mqtt.MqttClient} The created MQTT client
     * @private
     */
    _createMqttClient(domain) {
        // Generate appId if not already set (should be set in constructor when authenticated)
        if (!this.manager._appId) {
            const { appId } = generateClientAndAppId();
            this.manager._appId = appId;
            if (this.manager.userId) {
                this.manager.clientResponseTopic = buildClientResponseTopic(this.manager.userId, this.manager._appId);
            }
        }
        // Reuse same clientId for all clients since each domain connects to a different broker
        const clientId = `app:${this.manager._appId}`;

        // Meross MQTT authentication requires password as MD5 hash of userId + key
        const hashedPassword = generateMqttPassword(this.manager.userId, this.manager.key);

        const client = mqtt.connect({
            'protocol': 'mqtts',
            'host': domain,
            'port': 2001,
            clientId,
            'username': this.manager.userId,
            'password': hashedPassword,
            'rejectUnauthorized': true,
            'keepalive': 30,
            'reconnectPeriod': 5000
        });

        // Set up all event listeners once when client is created to prevent duplicate
        // listeners that would cause MaxListenersExceededWarning if the client is reused
        client.on('connect', () => {
            const userTopic = buildClientUserTopic(this.manager.userId);
            client.subscribe(userTopic, (err) => {
                if (err) {
                    this.manager.emit('error', err, null);
                }
            });

            client.subscribe(this.manager.clientResponseTopic, (err) => {
                if (err) {
                    this.manager.emit('error', err, null);
                }
            });

            // Resolve connection promise after subscriptions complete to ensure client is fully ready
            if (this.manager.mqttConnections[domain]._connectionResolve) {
                this.manager.mqttConnections[domain]._connectionResolve();
                this.manager.mqttConnections[domain]._connectionResolve = null;
            }

            this.manager.mqttConnections[domain].deviceList.forEach(devId => {
                const device = this.manager._deviceRegistry._devicesByUuid.get(devId) || null;
                if (device) {
                    device.emit('connected');
                }
            });
        });

        client.on('error', (error) => {
            // MQTT client handles reconnection automatically via reconnectPeriod option
            this.manager.mqttConnections[domain].deviceList.forEach(devId => {
                const device = this.manager._deviceRegistry._devicesByUuid.get(devId) || null;
                if (device) {
                    device.emit('error', error ? error.toString() : null);
                }
            });
        });

        client.on('close', (error) => {
            this.manager.mqttConnections[domain].deviceList.forEach(devId => {
                const device = this.manager._deviceRegistry._devicesByUuid.get(devId) || null;
                if (device) {
                    device.emit('close', error ? error.toString() : null);
                }
            });
        });

        client.on('reconnect', () => {
            this.manager.mqttConnections[domain].deviceList.forEach(devId => {
                const device = this.manager._deviceRegistry._devicesByUuid.get(devId) || null;
                if (device) {
                    device.emit('reconnect');
                }
            });
        });

        client.on('message', (topic, message) => {
            // Parse message
            const parsedMessage = this._parseMessage(message);
            if (!parsedMessage) {
                return;
            }

            // Extract device UUID for logging (if available)
            let deviceUuid = null;
            if (parsedMessage.header.from) {
                deviceUuid = deviceUuidFromPushNotification(parsedMessage.header.from);
            }

            // Log incoming message
            if (deviceUuid) {
                this._logResponse(deviceUuid, parsedMessage);
            }

            // Handle manager-level queries (pending futures) before routing to devices
            if (this._handlePendingFuture(parsedMessage)) {
                return;
            }

            // Route device-level messages
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
        if (!this.manager.mqttConnections[domain]) {
            this.manager.mqttConnections[domain] = {};
        }

        let client = this.manager.mqttConnections[domain].client;
        if (!client) {
            client = this._createMqttClient(domain);
            this.manager.mqttConnections[domain].client = client;
            this.manager.mqttConnections[domain].deviceList = this.manager.mqttConnections[domain].deviceList || [];
            if (!this.manager.mqttConnections[domain].deviceList.includes(deviceUuid)) {
                this.manager.mqttConnections[domain].deviceList.push(deviceUuid);
            }
        } else {
            if (client.connected) {
                if (!this.manager.mqttConnections[domain].deviceList.includes(deviceUuid)) {
                    this.manager.mqttConnections[domain].deviceList.push(deviceUuid);
                }
                return client;
            }
        }

        // Serialize connection attempts using promises to prevent concurrent connections
        // to the same domain. Multiple calls will wait for the same connection promise,
        // ensuring only one connection attempt is made per domain at a time
        let connectionPromise = this.manager._mqttConnectionPromises.get(domain);
        if (!connectionPromise) {
            connectionPromise = new Promise((resolve, reject) => {
                this.manager.mqttConnections[domain]._connectionResolve = resolve;

                setTimeout(() => {
                    if (this.manager.mqttConnections[domain]) {
                        this.manager.mqttConnections[domain]._connectionResolve = null;
                    }
                    this.manager._mqttConnectionPromises.delete(domain);
                    reject(new MqttError(`MQTT connection timeout for domain ${domain}`, null, null));
                }, 30000);
            });

            this.manager._mqttConnectionPromises.set(domain, connectionPromise);
        }

        await connectionPromise;
        return this.manager.mqttConnections[domain].client;
    }
}

module.exports = ManagerMqtt;
