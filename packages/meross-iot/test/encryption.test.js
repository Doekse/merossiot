'use strict';

/**
 * Mocked-device tests for {@link module:abilities/encryption}.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const createEncryptionAbility = require('../lib/abilities/encryption');
const { MerossDeviceError } = require('..');

describe('encryption ability (mocked device)', () => {
    it('encryptMessage throws when key is not set', () => {
        const device = { uuid: 'u1', publishMessage: async () => ({ header: {}, payload: {} }) };
        const enc = createEncryptionAbility(device);

        assert.throws(() => enc.encryptMessage('hello'), MerossDeviceError);
    });

    it('setEncryptionKey enables encrypt and decrypt round-trip', () => {
        const device = {
            uuid: '12345678-0000-0000-0000-000000000000',
            meross: { key: '0123456789abcdefghijklmnopqr' },
            publishMessage: async () => ({ header: {}, payload: {} })
        };
        const enc = createEncryptionAbility(device);

        enc.setEncryptionKey(device.uuid, device.meross.key, 'aa:bb:cc:dd:ee:ff');

        assert.strictEqual(enc.isEncryptionKeySet(), true);
        const cipher = enc.encryptMessage('ping');
        assert.strictEqual(typeof cipher, 'string');
        assert.ok(cipher.length > 0);
        const plain = enc.decryptMessage(cipher);
        assert.ok(plain.toString().includes('ping'));
    });

    it('_updateAbilitiesWithEncryption tracks ECDHE support', () => {
        const device = { uuid: 'u1', publishMessage: async () => ({ header: {}, payload: {} }) };
        const enc = createEncryptionAbility(device);

        enc._updateAbilitiesWithEncryption({ 'Appliance.Encrypt.ECDHE': {} });

        assert.strictEqual(enc.supportEncryption(), true);
    });
});
