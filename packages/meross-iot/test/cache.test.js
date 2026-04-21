'use strict';

/**
 * Unit tests for {@link module:utilities/cache}.
 */

const assert = require('node:assert');
const { describe, it, beforeEach, afterEach } = require('node:test');

const { CACHE_MAX_AGE, readCache, getCachedOrFetch } = require('../lib/utilities/cache');

describe('utilities/cache', () => {
    /** @type {() => number} */
    let dateNow;

    beforeEach(() => {
        dateNow = Date.now;
    });

    afterEach(() => {
        Date.now = dateNow;
    });

    it('exports CACHE_MAX_AGE', () => {
        assert.strictEqual(CACHE_MAX_AGE, 5000);
    });

    it('readCache returns undefined when lastFullUpdateTimestamp is missing', () => {
        const device = {
            lastFullUpdateTimestamp: null,
            _stateByChannel: new Map([[0, 'x']])
        };
        assert.strictEqual(readCache(device, '_stateByChannel', 0), undefined);
    });

    it('readCache returns undefined when cache is stale', () => {
        const now = 10_000_000;
        Date.now = () => now;
        const device = {
            lastFullUpdateTimestamp: now - CACHE_MAX_AGE - 1,
            _stateByChannel: new Map([[1, 'v']])
        };
        assert.strictEqual(readCache(device, '_stateByChannel', 1), undefined);
    });

    it('readCache returns the map value when cache is fresh', () => {
        const now = 10_000_000;
        Date.now = () => now;
        const device = {
            lastFullUpdateTimestamp: now - CACHE_MAX_AGE + 1,
            _stateByChannel: new Map([[2, { ok: true }]])
        };
        assert.deepStrictEqual(readCache(device, '_stateByChannel', 2), { ok: true });
    });

    it('readCache returns undefined when the state map is missing', () => {
        const now = 10_000_000;
        Date.now = () => now;
        const device = { lastFullUpdateTimestamp: now };
        assert.strictEqual(readCache(device, '_stateByChannel', 0), undefined);
    });

    it('readCache respects maxAgeMs override', () => {
        const now = 10_000_000;
        Date.now = () => now;
        const device = {
            lastFullUpdateTimestamp: now - 6000,
            _stateByChannel: new Map([[3, 'wide']])
        };
        assert.strictEqual(readCache(device, '_stateByChannel', 3), undefined);
        assert.strictEqual(
            readCache(device, '_stateByChannel', 3, { maxAgeMs: 10_000 }),
            'wide'
        );
    });

    it('getCachedOrFetch returns post-fetch map value', async () => {
        const now = 10_000_000;
        Date.now = () => now;
        const map = new Map();
        const device = {
            lastFullUpdateTimestamp: now - CACHE_MAX_AGE - 1,
            _stateByChannel: map
        };
        let fetcherCalls = 0;
        const result = await getCachedOrFetch(device, '_stateByChannel', 7, async () => {
            fetcherCalls += 1;
            map.set(7, 'after-fetch');
        });
        assert.strictEqual(fetcherCalls, 1);
        assert.strictEqual(result, 'after-fetch');
    });

    it('getCachedOrFetch does not call fetcher when readCache returns a value', async () => {
        const now = 10_000_000;
        Date.now = () => now;
        const device = {
            lastFullUpdateTimestamp: now,
            _stateByChannel: new Map([[0, 'hit']])
        };
        let fetcherCalls = 0;
        const result = await getCachedOrFetch(device, '_stateByChannel', 0, async () => {
            fetcherCalls += 1;
        });
        assert.strictEqual(fetcherCalls, 0);
        assert.strictEqual(result, 'hit');
    });
});
