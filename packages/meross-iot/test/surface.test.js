'use strict';

/**
 * Smoke tests for the public `meross-iot` entry: default export, named exports, and constructors.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const meross = require('..');

/** @type {string[]} Keys assigned on the package root in {@link index.js} (excluding runtime mutations). */
const EXPECTED_NAMED_EXPORTS = [
    'MerossError',
    'MerossAuthError',
    'MerossDeviceError',
    'MerossApiError',
    'MerossNetworkError',
    'MerossDevice',
    'MerossHubDevice',
    'MerossSubDevice'
];

describe('meross-iot module surface', () => {
    it('exports Meross as the default', () => {
        assert.strictEqual(typeof meross, 'function');
        assert.strictEqual(meross.name, 'Meross');
    });

    it('exports the documented named symbols from index.js', () => {
        for (const key of EXPECTED_NAMED_EXPORTS) {
            assert.ok(
                Object.prototype.hasOwnProperty.call(meross, key),
                `missing export: ${key}`
            );
        }
    });

    it('does not export undocumented keys on the module root', () => {
        const actual = Object.keys(meross).filter((k) => k !== 'default');
        const unexpected = actual.filter((k) => !EXPECTED_NAMED_EXPORTS.includes(k));
        assert.deepStrictEqual(
            unexpected,
            [],
            `unexpected public exports: ${unexpected.join(', ')}`
        );
    });

    it('exports error classes', () => {
        assert.strictEqual(typeof meross.MerossError, 'function');
        assert.strictEqual(typeof meross.MerossAuthError, 'function');
        assert.strictEqual(typeof meross.MerossDeviceError, 'function');
        assert.strictEqual(typeof meross.MerossApiError, 'function');
        assert.strictEqual(typeof meross.MerossNetworkError, 'function');
    });

    it('exports device class constructors', () => {
        assert.strictEqual(typeof meross.MerossDevice, 'function');
        assert.strictEqual(typeof meross.MerossHubDevice, 'function');
        assert.strictEqual(typeof meross.MerossSubDevice, 'function');
    });
});
