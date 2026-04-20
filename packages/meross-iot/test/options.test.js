'use strict';

/**
 * Unit tests for {@link module:utilities/options} helpers used by feature modules.
 */

const assert = require('node:assert');
const { describe, it } = require('node:test');

const { normalizeChannel, validateRequired } = require('../lib/utilities/options');
const { MerossDeviceError } = require('..');

describe('normalizeChannel', () => {
    it('returns default when options is null or not an object', () => {
        assert.strictEqual(normalizeChannel(null, 2), 2);
        assert.strictEqual(normalizeChannel(undefined, 1), 1);
        assert.strictEqual(normalizeChannel('x', 0), 0);
    });

    it('reads options.channel when set, otherwise defaultChannel', () => {
        assert.strictEqual(normalizeChannel({ channel: 3 }), 3);
        assert.strictEqual(normalizeChannel({}), 0);
        assert.strictEqual(normalizeChannel({}, 5), 5);
    });
});

describe('validateRequired', () => {
    it('throws MerossDeviceError when options is not a non-null object', () => {
        assert.throws(() => validateRequired(null, ['a']), MerossDeviceError);
        assert.throws(() => validateRequired(undefined, ['a']), MerossDeviceError);
    });

    it('throws listing missing fields', () => {
        assert.throws(
            () => validateRequired({ a: 1 }, ['b', 'c']),
            (e) => e instanceof MerossDeviceError && e.message.includes('b') && e.message.includes('c')
        );
    });

    it('passes when all required keys are present', () => {
        validateRequired({ on: false, channel: 0 }, ['on']);
    });
});
