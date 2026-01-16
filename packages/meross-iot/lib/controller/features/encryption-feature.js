'use strict';

const crypto = require('crypto');

/**
 * Default initialization vector (IV) for AES encryption.
 *
 * Meross devices require a zero-filled IV rather than a random IV. This is a
 * protocol requirement that must be followed for compatibility with Meross firmware.
 *
 * @constant {Buffer}
 * @private
 */
const DEFAULT_IV = Buffer.from('0000000000000000', 'utf8');

/**
 * Derives the encryption key from device UUID, Meross key, and MAC address.
 *
 * The Meross protocol requires a specific key derivation algorithm that combines
 * portions of the device UUID, Meross cloud key, and MAC address. The specific
 * substring ranges used here match the Meross firmware implementation.
 *
 * MD5 is used because it's part of the Meross protocol specification, despite
 * being cryptographically weak. The hex digest is encoded as UTF-8 bytes to
 * produce a 32-byte key suitable for AES-256-CBC encryption.
 *
 * @param {string} uuid - Device UUID (full UUID string)
 * @param {string} mrskey - Meross cloud key (from device configuration)
 * @param {string} mac - Device MAC address
 * @returns {Buffer} 32-byte encryption key (MD5 hex string encoded as UTF-8 bytes) for AES-256-CBC
 * @private
 */
function _deriveEncryptionKey(uuid, mrskey, mac) {
    const strtohash = uuid.substring(3, 22) +
                     mrskey.substring(1, 9) +
                     mac +
                     mrskey.substring(10, 28);
    const hash = crypto.createHash('md5').update(strtohash).digest('hex');
    return Buffer.from(hash, 'utf8');
}

/**
 * Pads data to 16-byte blocks with zero bytes.
 *
 * AES encryption requires data to be aligned to 16-byte block boundaries.
 * Meross devices use zero padding rather than standard PKCS7 padding, so
 * zero bytes are appended until the data length is a multiple of 16.
 *
 * @param {Buffer} data - Data to pad
 * @returns {Buffer} Padded data aligned to 16-byte blocks
 * @private
 */
function _padTo16Bytes(data) {
    const blockSize = 16;
    const padLength = blockSize - (data.length % blockSize);
    const padding = Buffer.alloc(padLength, 0);
    return Buffer.concat([data, padding]);
}

/**
 * Encrypts message data using AES-256-CBC encryption.
 *
 * Encrypts message data for communication with Meross devices. The data is padded
 * to 16-byte blocks using zero padding, then encrypted with AES-256-CBC using a
 * zero-filled IV. Auto-padding is disabled because manual zero padding is used
 * instead of the default PKCS7 padding.
 *
 * @param {Buffer|string} messageData - Message data to encrypt. Can be a Buffer or a JSON string.
 * @param {Buffer} key - 32-byte encryption key (MD5 hex string encoded as UTF-8).
 * @returns {string} Base64-encoded encrypted message
 * @private
 */
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

/**
 * Decrypts encrypted message data using AES-256-CBC decryption.
 *
 * Decrypts message data received from Meross devices. The data is decoded from
 * base64, decrypted using AES-256-CBC with a zero-filled IV, and zero padding
 * is removed from the result. Auto-padding is disabled because manual zero padding
 * removal is required instead of standard PKCS7 unpadding.
 *
 * @param {string|Buffer} encryptedData - Base64-encoded encrypted data (as string) or encrypted Buffer
 * @param {Buffer} key - 32-byte encryption key (MD5 hex string encoded as UTF-8).
 * @returns {Buffer} Decrypted data as Buffer
 * @private
 */
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

    // Remove zero padding by finding the last non-zero byte
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
 * Encryption feature module.
 * Handles encryption key management and message encryption/decryption for devices that support it.
 */
module.exports = {
    /**
     * Initializes encryption support state.
     *
     * Called during device construction or when abilities are updated to ensure encryption
     * state variables are properly initialized.
     *
     * @private
     */
    _initializeEncryption() {
        if (this._encryptionKey === undefined) {
            this._encryptionKey = null;
        }
        if (this._supportsEncryption === undefined) {
            this._supportsEncryption = false;
        }
    },

    /**
     * Checks if the device supports encryption.
     *
     * Encryption support is automatically detected from device abilities when abilities are updated.
     *
     * @returns {boolean} True if device supports encryption, false otherwise
     */
    supportEncryption() {
        this._initializeEncryption();
        return this._supportsEncryption;
    },

    /**
     * Checks if the encryption key has been set for this device.
     *
     * @returns {boolean} True if encryption key is set, false otherwise
     * @see setEncryptionKey
     */
    isEncryptionKeySet() {
        this._initializeEncryption();
        return this._encryptionKey !== null;
    },

    /**
     * Sets the encryption key for this device.
     *
     * The encryption key is derived from the device UUID, Meross key, and MAC address using
     * a device-specific algorithm. This is typically called automatically when encryption
     * support is detected and all required data is available.
     *
     * @param {string} uuid - Device UUID
     * @param {string} mrskey - Meross key from cloud instance
     * @param {string} mac - Device MAC address
     */
    setEncryptionKey(uuid, mrskey, mac) {
        this._initializeEncryption();
        this._encryptionKey = _deriveEncryptionKey(uuid, mrskey, mac);
        this._macAddress = mac;
    },

    /**
     * Encrypts a message using the device's encryption key.
     *
     * @param {Object|string|Buffer} messageData - Message data to encrypt
     * @returns {string} Base64-encoded encrypted message
     * @throws {import('../../model/exception').CommandError} If encryption key is not set
     * @see decryptMessage
     * @see isEncryptionKeySet
     */
    encryptMessage(messageData) {
        if (!this.isEncryptionKeySet()) {
            const { CommandError } = require('../../model/exception');
            throw new CommandError('Encryption key is not set! Please invoke setEncryptionKey first.', null, this.uuid);
        }
        return _encrypt(messageData, this._encryptionKey);
    },

    /**
     * Decrypts an encrypted message using the device's encryption key.
     *
     * @param {string|Buffer} encryptedData - Encrypted message data to decrypt
     * @returns {Buffer} Decrypted message data
     * @throws {import('../../model/exception').CommandError} If encryption key is not set
     * @see encryptMessage
     * @see isEncryptionKeySet
     */
    decryptMessage(encryptedData) {
        if (!this.isEncryptionKeySet()) {
            const { CommandError } = require('../../model/exception');
            throw new CommandError('Encryption key is not set! Please invoke setEncryptionKey first.', null, this.uuid);
        }
        return _decrypt(encryptedData, this._encryptionKey);
    },

    /**
     * Updates device abilities and detects encryption support.
     *
     * Checks for the Appliance.Encrypt.ECDHE namespace in abilities to determine if
     * the device supports encryption.
     *
     * @param {Object} abilities - Device abilities object
     * @private
     */
    _updateAbilitiesWithEncryption(abilities) {
        this._initializeEncryption();
        this._supportsEncryption = abilities && typeof abilities === 'object' &&
                                   'Appliance.Encrypt.ECDHE' in abilities;
    },

    /**
     * Updates MAC address and automatically sets encryption key if conditions are met.
     *
     * If encryption is supported, the key is not yet set, and all required data (MAC address,
     * cloud instance key) is available, the encryption key is automatically derived and set.
     *
     * @param {string} mac - Device MAC address
     * @private
     */
    _updateMacAddressWithEncryption(mac) {
        this._macAddress = mac;
        if (this._supportsEncryption && !this.isEncryptionKeySet() && this._macAddress && this.cloudInst && this.cloudInst.key) {
            this.setEncryptionKey(this.uuid, this.cloudInst.key, this._macAddress);
        }
    }
};
