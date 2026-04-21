'use strict';

/**
 * Validates {@link ManagerMeross.authenticate} rejects invalid option shapes before any HTTP work,
 * and that password login issues a Meross sign-in request matching the HTTP client contract.
 */

const assert = require('node:assert');
const crypto = require('node:crypto');
const { describe, it, beforeEach, afterEach } = require('node:test');

const ManagerMeross = require('..');
const { MerossDeviceError } = require('..');
const { MEROSS_DOMAIN, LOGIN_URL } = require('../lib/model/constants');

const EXPECTED_LOGIN_URL = `https://${MEROSS_DOMAIN}${LOGIN_URL}`;

/**
 * @param {unknown} body
 * @returns {Promise<{ status: number, statusText: string, ok: boolean, text: () => Promise<string> }>}
 */
function jsonFetchResponse(body) {
    const text = JSON.stringify(body);
    return Promise.resolve({
        status: 200,
        statusText: 'OK',
        ok: true,
        async text() {
            return text;
        }
    });
}

describe('ManagerMeross.authenticate', () => {
    describe('validation errors (fetch not invoked)', () => {
        beforeEach((t) => {
            t.mock.method(globalThis, 'fetch', async () => {
                throw new Error('fetch must not be called');
            });
        });

        afterEach((t) => {
            t.mock.restoreAll();
        });

        it('throws MerossDeviceError with VALIDATION_ERROR when neither password nor token auth is provided', async () => {
            await assert.rejects(
                () => ManagerMeross.authenticate({}),
                (err) => {
                    assert.ok(err instanceof MerossDeviceError);
                    assert.strictEqual(err.code, 'VALIDATION_ERROR');
                    assert.match(err.message, /email.*password|token.*key/i);
                    return true;
                }
            );
            assert.strictEqual(globalThis.fetch.mock.callCount(), 0);
        });

        it('throws for undefined options like empty object', async () => {
            await assert.rejects(
                () => ManagerMeross.authenticate(undefined),
                (err) => err instanceof MerossDeviceError && err.code === 'VALIDATION_ERROR'
            );
            assert.strictEqual(globalThis.fetch.mock.callCount(), 0);
        });

        it('throws when email is present without password', async () => {
            await assert.rejects(
                () => ManagerMeross.authenticate({ email: 'a@b.c' }),
                (err) => err instanceof MerossDeviceError && err.code === 'VALIDATION_ERROR'
            );
            assert.strictEqual(globalThis.fetch.mock.callCount(), 0);
        });

        it('throws when token auth is incomplete', async () => {
            await assert.rejects(
                () => ManagerMeross.authenticate({ token: 't', key: 'k' }),
                (err) => err instanceof MerossDeviceError && err.code === 'VALIDATION_ERROR'
            );
            assert.strictEqual(globalThis.fetch.mock.callCount(), 0);
        });
    });

    it('password login: POSTs signed payload to Meross signIn URL', async (t) => {
        const email = 'user@example.com';
        const password = 'plain-secret';

        t.mock.method(globalThis, 'fetch', async (url, _init) => {
            const href = typeof url === 'string' ? url : String(url);
            if (href.includes(LOGIN_URL)) {
                return jsonFetchResponse({
                    apiStatus: 0,
                    data: {
                        token: 'stub-token',
                        key: 'stub-key',
                        userid: 'stub-user',
                        email
                    }
                });
            }
            if (href.includes('/v1/log/user')) {
                return jsonFetchResponse({ apiStatus: 0, data: {} });
            }
            throw new Error(`unexpected fetch URL: ${href}`);
        });

        try {
            const manager = await ManagerMeross.authenticate({ email, password });
            assert.ok(manager);

            const calls = globalThis.fetch.mock.calls;
            const signInCall = calls.find((c) => String(c.arguments[0]).includes(LOGIN_URL));
            assert.ok(signInCall, 'expected a signIn fetch');

            const [, init] = signInCall.arguments;
            assert.strictEqual(init.method, 'POST');
            assert.strictEqual(typeof init.body, 'string');

            const parsed = JSON.parse(init.body);
            assert.strictEqual(typeof parsed.params, 'string');
            assert.strictEqual(typeof parsed.sign, 'string');
            assert.strictEqual(typeof parsed.timestamp, 'number');
            assert.strictEqual(typeof parsed.nonce, 'string');

            const decoded = JSON.parse(Buffer.from(parsed.params, 'base64').toString('utf8'));
            assert.strictEqual(decoded.email, email);
            assert.strictEqual(
                decoded.password,
                crypto.createHash('md5').update(password).digest('hex')
            );
            assert.strictEqual(decoded.encryption, 1);
            assert.strictEqual(decoded.accountCountryCode, '--');
            assert.strictEqual(decoded.agree, 1);
            assert.strictEqual(decoded.mobileInfo.resolution, '--');
            assert.strictEqual(decoded.mobileInfo.carrier, '--');
            assert.strictEqual(decoded.mobileInfo.deviceModel, '--');
            assert.strictEqual(decoded.mobileInfo.mobileOs, process.platform);
            assert.strictEqual(decoded.mobileInfo.mobileOSVersion, '--');
            assert.strictEqual(typeof decoded.mobileInfo.uuid, 'string');

            assert.strictEqual(String(signInCall.arguments[0]), EXPECTED_LOGIN_URL);
        } finally {
            t.mock.restoreAll();
        }
    });
});
