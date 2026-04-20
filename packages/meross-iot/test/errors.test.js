'use strict';

/**
 * Snapshot-style checks for the {@link MerossError} hierarchy used in public APIs and logging.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const {
    MerossError,
    MerossAuthError,
    MerossDeviceError,
    MerossApiError,
    MerossNetworkError
} = require('..');

describe('MerossError hierarchy', () => {
    it('MerossError sets code from options or falls back to constructor name', () => {
        const e = new MerossError('x', 42, { code: 'CUSTOM' });
        assert.strictEqual(e.code, 'CUSTOM');
        assert.strictEqual(e.errorCode, 42);
        assert.strictEqual(e.name, 'MerossError');
    });

    it('MerossDeviceError uses string code as MerossError.code', () => {
        const e = new MerossDeviceError('bad', 'VALIDATION_ERROR', { field: 'x' });
        assert.strictEqual(e.code, 'VALIDATION_ERROR');
        assert.strictEqual(e.errorCode, null);
        assert.strictEqual(e.field, 'x');
    });

    it('MerossAuthError and MerossApiError preserve category-specific construction', () => {
        const auth = new MerossAuthError('nope', 'MFA_REQUIRED', { mfa: true });
        assert.ok(auth instanceof MerossError);
        assert.strictEqual(auth.code, 'MFA_REQUIRED');

        const api = new MerossApiError('limit', 'RATE_LIMIT', { retryAfter: 1 });
        assert.ok(api instanceof MerossError);
        assert.strictEqual(api.code, 'RATE_LIMIT');
    });

    it('MerossNetworkError extends MerossError', () => {
        const net = new MerossNetworkError('timeout', 'TIMEOUT', {});
        assert.ok(net instanceof MerossError);
        assert.strictEqual(net.code, 'TIMEOUT');
    });

    it('toJSON returns stable serializable fields without stack', () => {
        const e = new MerossDeviceError('msg', 'VALIDATION_ERROR', { field: 'f' });
        const j = e.toJSON();
        assert.deepStrictEqual(j, {
            name: 'MerossDeviceError',
            code: 'VALIDATION_ERROR',
            message: 'msg',
            isOperational: true
        });
        assert.strictEqual(e.field, 'f');
        assert.strictEqual('stack' in j, false);
    });
});
