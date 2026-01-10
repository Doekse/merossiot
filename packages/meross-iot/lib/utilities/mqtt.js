'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Builds the MQTT topic where commands should be sent to specific devices.
 *
 * Meross devices subscribe to this topic pattern to receive commands. The topic structure
 * follows the Meross protocol convention: /appliance/{deviceUuid}/subscribe
 *
 * @param {string} clientUuid - Device UUID
 * @returns {string} MQTT topic string
 * @example
 * const topic = buildDeviceRequestTopic('device-uuid-123');
 * // Returns: '/appliance/device-uuid-123/subscribe'
 */
function buildDeviceRequestTopic(clientUuid) {
    return `/appliance/${clientUuid}/subscribe`;
}

/**
 * Builds the MQTT topic where devices send acknowledgment responses to commands.
 *
 * The client application subscribes to this topic to receive responses from devices.
 * The topic combines userId and appId to create a unique subscription channel per application instance.
 *
 * @param {string} userId - User ID
 * @param {string} appId - Application ID
 * @returns {string} MQTT topic string
 * @example
 * const topic = buildClientResponseTopic('user123', 'app456');
 * // Returns: '/app/user123-app456/subscribe'
 */
function buildClientResponseTopic(userId, appId) {
    return `/app/${userId}-${appId}/subscribe`;
}

/**
 * Builds the MQTT topic where user push notifications are received.
 *
 * This topic is used for device-initiated push notifications (e.g., state changes, alerts)
 * that are broadcast to all of a user's applications, as opposed to command responses
 * which are sent to a specific app instance.
 *
 * @param {string} userId - User ID
 * @returns {string} MQTT topic string
 * @example
 * const topic = buildClientUserTopic('user123');
 * // Returns: '/app/user123/subscribe'
 */
function buildClientUserTopic(userId) {
    return `/app/${userId}/subscribe`;
}

/**
 * Extracts the device UUID from the "from" header of received messages.
 *
 * Meross MQTT messages include a "from" field containing the topic path. The device UUID
 * is located at a fixed position in this path, allowing extraction without full topic parsing.
 *
 * @param {string} fromTopic - The "from" topic string from message header
 * @returns {string} Device UUID
 * @example
 * const uuid = deviceUuidFromPushNotification('/appliance/device-uuid-123/subscribe');
 * // Returns: 'device-uuid-123'
 */
function deviceUuidFromPushNotification(fromTopic) {
    return fromTopic.split('/')[2];
}

/**
 * Generates a new app ID and client ID for MQTT connection.
 *
 * Meross MQTT protocol requires unique identifiers for each application instance. This function
 * generates a random UUID, hashes it with MD5 (as required by the protocol), and formats the
 * client ID with the 'app:' prefix that Meross servers expect.
 *
 * @returns {Object} Object with appId and clientId properties
 * @returns {string} returns.appId - Application ID (MD5 hash)
 * @returns {string} returns.clientId - Client ID in format 'app:{appId}'
 * @example
 * const { appId, clientId } = generateClientAndAppId();
 * // appId: 'a1b2c3d4e5f6...'
 * // clientId: 'app:a1b2c3d4e5f6...'
 */
function generateClientAndAppId() {
    const md5Hash = crypto.createHash('md5');
    const rndUuid = uuidv4();
    md5Hash.update(`API${rndUuid}`);
    const appId = md5Hash.digest('hex');
    const clientId = `app:${appId}`;
    return { appId, clientId };
}

/**
 * Generates the MQTT password for connecting to Meross MQTT servers.
 *
 * Meross requires passwords to be MD5 hashes of the concatenated userId and cloud key.
 * This matches the authentication mechanism used by the official Meross mobile app.
 *
 * @param {string} userId - User ID
 * @param {string} key - Meross cloud key
 * @returns {string} MD5 hash of userId + key
 * @example
 * const password = generateMqttPassword('user123', 'secret-key');
 * // Returns: 'a1b2c3d4e5f6...' (MD5 hash)
 */
function generateMqttPassword(userId, key) {
    const md5Hash = crypto.createHash('md5');
    const clearPwd = `${userId}${key}`;
    md5Hash.update(clearPwd);
    return md5Hash.digest('hex');
}

/**
 * Verifies if a message header has a valid signature.
 *
 * Meross messages include signatures to prevent tampering. The signature is computed as
 * MD5(messageId + key + timestamp) and must match the sign field in the header. Comparison
 * is case-insensitive to handle variations in how signatures are encoded.
 *
 * @param {Object} header - Message header object
 * @param {string} header.messageId - Message ID
 * @param {string} header.sign - Signature to verify
 * @param {number} header.timestamp - Timestamp
 * @param {string} key - Meross cloud key
 * @returns {boolean} True if signature is valid, false otherwise
 * @example
 * const isValid = verifyMessageSignature(
 *     { messageId: 'abc123', sign: 'def456', timestamp: 1234567890 },
 *     'secret-key'
 * );
 */
function verifyMessageSignature(header, key) {
    const messageHash = crypto.createHash('md5');
    const strToHash = `${header.messageId}${key}${header.timestamp}`;
    messageHash.update(strToHash);
    const expectedSignature = messageHash.digest('hex').toLowerCase();
    return expectedSignature === header.sign.toLowerCase();
}

module.exports = {
    buildDeviceRequestTopic,
    buildClientResponseTopic,
    buildClientUserTopic,
    deviceUuidFromPushNotification,
    generateClientAndAppId,
    generateMqttPassword,
    verifyMessageSignature
};

