'use strict';

const crypto = require('crypto');

const DEFAULT_IV = Buffer.from('0000000000000000', 'utf8');

function _deriveEncryptionKey(uuid, mrskey, mac) {
    const strtohash = uuid.substring(3, 22) +
                     mrskey.substring(1, 9) +
                     mac +
                     mrskey.substring(10, 28);
    const hash = crypto.createHash('md5').update(strtohash).digest('hex');
    return Buffer.from(hash, 'utf8');
}

function _padTo16Bytes(data) {
    const blockSize = 16;
    const padLength = blockSize - (data.length % blockSize);
    const padding = Buffer.alloc(padLength, 0);
    return Buffer.concat([data, padding]);
}

function _encrypt(messageData, key) {
    let dataBuffer;
    if (typeof messageData === 'string') {
        dataBuffer = Buffer.from(messageData, 'utf8');
    } else {
        dataBuffer = messageData;
    }

    const paddedData = _padTo16Bytes(dataBuffer);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, DEFAULT_IV);
    cipher.setAutoPadding(false);

    let encrypted = cipher.update(paddedData);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return encrypted.toString('base64');
}

function _decrypt(encryptedData, key) {
    let encryptedBuffer;
    if (typeof encryptedData === 'string') {
        encryptedBuffer = Buffer.from(encryptedData, 'base64');
    } else {
        encryptedBuffer = encryptedData;
    }

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, DEFAULT_IV);
    decipher.setAutoPadding(false);

    let decrypted = decipher.update(encryptedBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    let result = decrypted;
    let lastNonZero = result.length - 1;
    while (lastNonZero >= 0 && result[lastNonZero] === 0) {
        lastNonZero--;
    }
    if (lastNonZero < result.length - 1) {
        result = result.slice(0, lastNonZero + 1);
    }

    return result;
}

/**
 * Creates an encryption feature object for a device.
 *
 * Handles encryption key management and message encryption/decryption for devices that support it.
 *
 * @param {Object} device - The device instance
 * @returns {Object} Encryption feature object with encryption methods
 */
function createEncryptionFeature(device) {
    /**
     * Initializes encryption support state.
     *
     * @private
     */
    function initializeEncryption() {
        if (device._encryptionKey === undefined) {
            device._encryptionKey = null;
        }
        if (device._supportsEncryption === undefined) {
            device._supportsEncryption = false;
        }
    }

    return {
        /**
         * Checks if the device supports encryption.
         *
         * @returns {boolean} True if device supports encryption, false otherwise
         */
        supportEncryption() {
            initializeEncryption();
            return device._supportsEncryption;
        },

        /**
         * Checks if the encryption key has been set for this device.
         *
         * @returns {boolean} True if encryption key is set, false otherwise
         */
        isEncryptionKeySet() {
            initializeEncryption();
            return device._encryptionKey !== null;
        },

        /**
         * Sets the encryption key for this device.
         *
         * @param {string} uuid - Device UUID
         * @param {string} mrskey - Meross key from cloud instance
         * @param {string} mac - Device MAC address
         */
        setEncryptionKey(uuid, mrskey, mac) {
            initializeEncryption();
            device._encryptionKey = _deriveEncryptionKey(uuid, mrskey, mac);
            device._macAddress = mac;
        },

        /**
         * Encrypts a message using the device's encryption key.
         *
         * @param {Object|string|Buffer} messageData - Message data to encrypt
         * @returns {string} Base64-encoded encrypted message
         */
        encryptMessage(messageData) {
            if (!this.isEncryptionKeySet()) {
                const { MerossErrorCommand } = require('../../model/exception');
                throw new MerossErrorCommand('Encryption key is not set! Please invoke setEncryptionKey first.', null, device.uuid);
            }
            return _encrypt(messageData, device._encryptionKey);
        },

        /**
         * Decrypts an encrypted message using the device's encryption key.
         *
         * @param {string|Buffer} encryptedData - Encrypted message data to decrypt
         * @returns {Buffer} Decrypted message data
         */
        decryptMessage(encryptedData) {
            if (!this.isEncryptionKeySet()) {
                const { MerossErrorCommand } = require('../../model/exception');
                throw new MerossErrorCommand('Encryption key is not set! Please invoke setEncryptionKey first.', null, device.uuid);
            }
            return _decrypt(encryptedData, device._encryptionKey);
        },

        /**
         * Updates device abilities and detects encryption support.
         *
         * @param {Object} abilities - Device abilities object
         */
        _updateAbilitiesWithEncryption(abilities) {
            initializeEncryption();
            device._supportsEncryption = abilities && typeof abilities === 'object' &&
                                       'Appliance.Encrypt.ECDHE' in abilities;
        },

        /**
         * Updates MAC address and automatically sets encryption key if conditions are met.
         *
         * @param {string} mac - Device MAC address
         */
        _updateMacAddressWithEncryption(mac) {
            device._macAddress = mac;
            if (device._supportsEncryption && !this.isEncryptionKeySet() && device._macAddress &&
                device.cloudInst && device.cloudInst.key) {
                this.setEncryptionKey(device.uuid, device.cloudInst.key, device._macAddress);
            }
        }
    };
}

module.exports = createEncryptionFeature;
