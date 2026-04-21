'use strict';

/**
 * Unit tests for {@link module:utilities/state-ordering}.
 */

const assert = require('node:assert');
const { describe, it, beforeEach } = require('node:test');

const { getMessageTimestamp, shouldApplyUpdate } = require('../lib/utilities/state-ordering');

describe('getMessageTimestamp', () => {
    it('returns null for missing or falsy header', () => {
        assert.strictEqual(getMessageTimestamp(null), null);
        assert.strictEqual(getMessageTimestamp(undefined), null);
    });

    it('returns combined ms from timestamp and timestampMs', () => {
        assert.strictEqual(
            getMessageTimestamp({ timestamp: 1, timestampMs: 500 }),
            1500
        );
    });

    it('treats missing numeric fields as zero', () => {
        assert.strictEqual(getMessageTimestamp({}), 0);
        assert.strictEqual(getMessageTimestamp({ timestamp: 2 }), 2000);
        assert.strictEqual(getMessageTimestamp({ timestampMs: 100 }), 100);
    });
});

describe('shouldApplyUpdate', () => {
    /** @type {{ _stateUpdateTimestamps?: Map<string, number> }} */
    let device;

    beforeEach(() => {
        device = {};
    });

    it('returns true and does not create a map when messageTs is null or undefined', () => {
        assert.strictEqual(shouldApplyUpdate(device, 'a', null), true);
        assert.strictEqual(shouldApplyUpdate(device, 'a', undefined), true);
        assert.strictEqual(device._stateUpdateTimestamps, undefined);
    });

    it('accepts first message for a key and records timestamp', () => {
        assert.strictEqual(shouldApplyUpdate(device, 'k', 100), true);
        assert.ok(device._stateUpdateTimestamps instanceof Map);
        assert.strictEqual(device._stateUpdateTimestamps.get('k'), 100);
    });

    it('rejects strictly older messages for the same key', () => {
        assert.strictEqual(shouldApplyUpdate(device, 'k', 200), true);
        assert.strictEqual(shouldApplyUpdate(device, 'k', 100), false);
        assert.strictEqual(device._stateUpdateTimestamps.get('k'), 200);
    });

    it('accepts equal or newer timestamps and refreshes last-seen', () => {
        assert.strictEqual(shouldApplyUpdate(device, 'k', 200), true);
        assert.strictEqual(shouldApplyUpdate(device, 'k', 200), true);
        assert.strictEqual(device._stateUpdateTimestamps.get('k'), 200);
        assert.strictEqual(shouldApplyUpdate(device, 'k', 300), true);
        assert.strictEqual(device._stateUpdateTimestamps.get('k'), 300);
    });

    it('tracks keys independently', () => {
        assert.strictEqual(shouldApplyUpdate(device, 'a', 500), true);
        assert.strictEqual(shouldApplyUpdate(device, 'b', 100), true);
        assert.strictEqual(shouldApplyUpdate(device, 'a', 400), false);
        assert.strictEqual(shouldApplyUpdate(device, 'b', 200), true);
        assert.strictEqual(device._stateUpdateTimestamps.get('a'), 500);
        assert.strictEqual(device._stateUpdateTimestamps.get('b'), 200);
    });
});
