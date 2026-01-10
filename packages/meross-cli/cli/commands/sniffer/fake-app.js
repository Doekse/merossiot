'use strict';

const mqtt = require('mqtt');
const {
    buildDeviceRequestTopic,
    buildClientResponseTopic,
    buildClientUserTopic,
    generateClientAndAppId,
    generateMqttPassword
} = require('meross-iot/lib/utilities/mqtt');
const MessageQueue = require('./message-queue');

/**
 * AppSniffer - Impersonates a Meross app client to capture push notifications.
 *
 * Connects to MQTT broker using app credentials and subscribes to multiple topics
 * to capture push notifications and device responses.
 */
class AppSniffer {
    constructor(options) {
        const { userId, cloudKey, deviceUuid, mqttHost, mqttPort, logger } = options;

        this._userId = userId;
        this._cloudKey = cloudKey;
        this._deviceUuid = deviceUuid.toLowerCase();
        this._mqttHost = mqttHost;
        this._mqttPort = mqttPort || 2001;
        this._logger = logger || console.log;

        this._client = null;
        this._pushQueue = new MessageQueue();
        this._connected = false;
        this._subscribed = false;

        // Generate app ID and client ID
        // Match Python: app_id is "sniffer", client_id is "app:sniffer-{randomHash}"
        const { clientId } = generateClientAndAppId();
        this._appId = 'sniffer'; // Fixed app ID like Python version
        this._clientId = `app:sniffer-${clientId.replace('app:', '')}`;

        // Build topics
        this._deviceTopic = buildDeviceRequestTopic(this._deviceUuid);
        this._clientResponseTopic = buildClientResponseTopic(this._userId, this._appId);
        this._userTopic = buildClientUserTopic(this._userId);

        // Generate MQTT password
        this._mqttPassword = generateMqttPassword(this._userId, this._cloudKey);

        // Track subscription state
        this._subscriptionPromise = null;
        this._subscriptionResolve = null;
        this._subscriptionReject = null;
    }

    /**
     * Subscribe to topics sequentially, waiting for each subscription to complete
     * Matches Python implementation pattern
     * @private
     */
    _subscribeSequentially(resolve, _reject) {
        const topics = [
            { topic: this._deviceTopic, name: 'device' },
            { topic: this._clientResponseTopic, name: 'client-response' },
            { topic: this._userTopic, name: 'user' }
        ];

        let currentIndex = 0;

        const subscribeNext = () => {
            if (currentIndex >= topics.length) {
                // All subscriptions completed
                this._subscribed = true;
                resolve();
                return;
            }

            const { topic, name } = topics[currentIndex];
            this._logger(`Subscribing to ${name} topic: ${topic}`);

            // Subscribe and wait for acknowledgment
            this._client.subscribe(topic, (err) => {
                if (err) {
                    const errorMsg = err.message || err.toString() || 'Unknown subscription error';
                    this._logger(`Warning: Subscription to ${name} topic failed: ${errorMsg}`);
                    this._logger(`Topic: ${topic}`);
                    // Continue to next subscription even if this one fails
                    currentIndex++;
                    setImmediate(() => subscribeNext());
                    return;
                }
                // Success - proceed to next subscription
                this._logger(`Subscribed to ${name} topic: ${topic}`);
                currentIndex++;
                // Wait a tiny bit before next subscription (like Python's event.wait())
                setImmediate(() => subscribeNext());
            });
        };

        // Start sequential subscriptions
        subscribeNext();
    }

    /**
     * Start the app sniffer and connect to MQTT broker
     * @param {number} timeout - Connection timeout in milliseconds
     * @returns {Promise<void>}
     */
    async start(timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                if (!this._connected) {
                    this._client?.end();
                    reject(new Error('App sniffer connection timeout'));
                }
            }, timeout);

            this._client = mqtt.connect({
                protocol: 'mqtts',
                host: this._mqttHost,
                port: this._mqttPort,
                clientId: this._clientId,
                username: this._userId,
                password: this._mqttPassword,
                rejectUnauthorized: true,
                reconnectPeriod: 0 // Disable auto-reconnect for sniffer
            });

            this._client.on('connect', (connack) => {
                this._connected = true;
                clearTimeout(timeoutId);
                this._logger(`App sniffer connected to ${this._mqttHost}:${this._mqttPort}`);

                if (connack && connack.returnCode !== 0) {
                    const error = new Error(`Connection refused: return code ${connack.returnCode}`);
                    this._logger(`Connection error: ${error.message}`);
                    reject(error);
                    return;
                }

                // Subscribe to topics sequentially, matching Python implementation
                // Python subscribes one at a time, waiting for each to complete
                this._subscribeSequentially(resolve, reject);
            });

            this._client.on('error', (error) => {
                clearTimeout(timeoutId);
                this._logger(`App sniffer MQTT error: ${error.message}`);
                if (!this._connected) {
                    reject(error);
                }
            });

            this._client.on('message', (topic, message) => {
                try {
                    const parsed = JSON.parse(message.toString());
                    const method = parsed.header?.method || 'UNKNOWN';

                    // Only capture PUSH notifications
                    if (method === 'PUSH') {
                        this._logger(`App sniffer received PUSH on ${topic}: ${JSON.stringify(parsed)}`);
                        this._pushQueue.syncPut(parsed);
                    }
                } catch (err) {
                    this._logger(`Error parsing message: ${err.message}`);
                }
            });

            this._client.on('close', () => {
                this._connected = false;
                this._subscribed = false;
                this._logger('App sniffer disconnected');
            });
        });
    }

    /**
     * Stop the app sniffer and disconnect from MQTT broker
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
     * Wait for a push notification
     * @returns {Promise<Object>} Parsed push notification message
     */
    async waitForPushNotification() {
        return await this._pushQueue.asyncGet();
    }

    /**
     * Check if the sniffer is connected
     * @returns {boolean}
     */
    get isConnected() {
        return this._connected && this._subscribed;
    }
}

module.exports = AppSniffer;
