'use strict';

const mqtt = require('mqtt');
const crypto = require('crypto');
const { buildDeviceRequestTopic } = require('meross-iot/lib/utilities/mqtt');
const MessageQueue = require('./message-queue');

/**
 * DeviceSniffer - Impersonates a Meross device to intercept app commands.
 *
 * Connects to MQTT broker using device credentials and subscribes to the device's
 * request topic to capture commands sent from the Meross app.
 */
class DeviceSniffer {
    constructor(options) {
        const { uuid, macAddress, userId, cloudKey, mqttHost, mqttPort, logger } = options;

        this._uuid = uuid.toLowerCase();
        this._macAddress = macAddress;
        this._userId = userId;
        this._cloudKey = cloudKey;
        this._mqttHost = mqttHost;
        this._mqttPort = mqttPort || 2001;
        this._logger = logger || console.log;

        this._client = null;
        this._msgQueue = new MessageQueue();
        this._connected = false;
        this._subscribed = false;
        this._deviceTopic = buildDeviceRequestTopic(this._uuid);

        // Build client ID: fmware:{uuid}_random
        this._clientId = `fmware:${this._uuid}_random`;

        // Build device password: {userId}_{MD5(macAddress + cloudKey).toLowerCase()}
        const macKeyDigest = crypto.createHash('md5')
            .update(`${macAddress}${cloudKey}`)
            .digest('hex')
            .toLowerCase();
        this._devicePassword = `${userId}_${macKeyDigest}`;
    }

    /**
     * Start the device sniffer and connect to MQTT broker
     * @param {number} timeout - Connection timeout in milliseconds
     * @returns {Promise<void>}
     */
    async start(timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                if (!this._connected) {
                    this._client?.end();
                    reject(new Error('Device sniffer connection timeout'));
                }
            }, timeout);

            this._client = mqtt.connect({
                protocol: 'mqtts',
                host: this._mqttHost,
                port: this._mqttPort,
                clientId: this._clientId,
                username: this._macAddress,
                password: this._devicePassword,
                rejectUnauthorized: true,
                reconnectPeriod: 0 // Disable auto-reconnect for sniffer
            });

            this._client.on('connect', (connack) => {
                this._connected = true;
                clearTimeout(timeoutId);
                this._logger(`Device sniffer connected to ${this._mqttHost}:${this._mqttPort}`);

                if (connack && connack.returnCode !== 0) {
                    const error = new Error(`Connection refused: return code ${connack.returnCode}`);
                    this._logger(`Connection error: ${error.message}`);
                    reject(error);
                    return;
                }

                // Subscribe to device topic after connection is established
                // Match Python pattern: subscribe after connect, wait for subscription callback
                this._logger(`Subscribing to device topic: ${this._deviceTopic}`);
                this._client.subscribe(this._deviceTopic, (err) => {
                    if (err) {
                        const errorMsg = err.message || err.toString() || 'Unknown subscription error';
                        this._logger(`Warning: Subscription to device topic failed: ${errorMsg}`);
                        this._logger(`Topic: ${this._deviceTopic}`);
                        this._logger(`Client ID: ${this._clientId}`);
                        this._logger(`Username: ${this._macAddress}`);
                        // In Python, subscription failure doesn't stop the sniffer
                        // Messages may still be routed automatically based on client ID
                        this._subscribed = true;
                        this._logger('Continuing anyway - messages may be routed automatically');
                        resolve();
                        return;
                    }
                    // Subscription successful - match Python's _on_subscribe behavior
                    this._subscribed = true;
                    this._logger(`Subscribed to topic: ${this._deviceTopic}`);
                    resolve();
                });
            });

            // Handle subscription acknowledgments (like Python's on_subscribe)
            this._client.on('packetsend', (packet) => {
                if (packet.cmd === 'subscribe') {
                    this._logger(`Subscription packet sent for topic: ${this._deviceTopic}`);
                }
            });

            this._client.on('error', (error) => {
                clearTimeout(timeoutId);
                this._logger(`Device sniffer MQTT error: ${error.message}`);
                if (!this._connected) {
                    reject(error);
                }
            });

            this._client.on('message', (topic, message) => {
                try {
                    const parsed = JSON.parse(message.toString());
                    this._logger(`Device sniffer received message on ${topic}: ${JSON.stringify(parsed)}`);
                    this._msgQueue.syncPut({ topic, message: message.toString(), parsed });
                } catch (err) {
                    this._logger(`Error parsing message: ${err.message}`);
                }
            });

            this._client.on('close', () => {
                this._connected = false;
                this._subscribed = false;
                this._logger('Device sniffer disconnected');
            });
        });
    }

    /**
     * Stop the device sniffer and disconnect from MQTT broker
     * @returns {Promise<void>}
     */
    async stop() {
        return new Promise((resolve) => {
            if (!this._client) {
                resolve();
                return;
            }

            // Remove event listeners to prevent memory leaks
            this._client.removeAllListeners();

            // Set a timeout to force resolve if end() doesn't callback
            const timeout = setTimeout(() => {
                this._connected = false;
                this._subscribed = false;
                this._client = null;
                resolve();
            }, 2000);

            try {
                this._client.end(false, () => {
                    clearTimeout(timeout);
                    this._connected = false;
                    this._subscribed = false;
                    this._client = null;
                    resolve();
                });
            } catch (err) {
                clearTimeout(timeout);
                this._connected = false;
                this._subscribed = false;
                this._client = null;
                resolve();
            }
        });
    }

    /**
     * Wait for a message from the device topic
     * Filters for SET/GET methods only (ignores ACKs and PUSH)
     * @param {string[]} validMethods - Array of valid methods to accept (default: ['SET', 'GET'])
     * @returns {Promise<{topic: string, message: string, parsed: Object, namespace: string, method: string, payload: Object}>}
     */
    async waitForMessage(validMethods = ['SET', 'GET']) {
        while (true) {
            const { topic, message, parsed } = await this._msgQueue.asyncGet();

            if (!parsed || !parsed.header) {
                continue;
            }

            const { namespace, method } = parsed.header;
            const payload = parsed.payload || {};

            // Filter for valid methods only
            if (validMethods.includes(method)) {
                return {
                    topic,
                    message,
                    parsed,
                    namespace,
                    method,
                    payload
                };
            }
        }
    }

    /**
     * Check if the sniffer is connected
     * @returns {boolean}
     */
    get isConnected() {
        return this._connected && this._subscribed;
    }
}

module.exports = DeviceSniffer;
