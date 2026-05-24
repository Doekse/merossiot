'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ManagerTransport = require('../manager/transport');
const { MerossNetworkError } = require('../lib/exception');

describe('ManagerTransport.defaultMode', () => {
    /**
     * @param {{ transportMode?: string }} [options]
     * @returns {ManagerTransport}
     */
    function createTransport(transportOptions = {}) {
        return new ManagerTransport({
            options: {
                httpClient: {},
                ...transportOptions
            }
        });
    }

    it('defaults to mqtt', () => {
        const transport = createTransport();
        assert.equal(transport.defaultMode, 'mqtt');
    });

    it('accepts transportMode string in constructor options', () => {
        const transport = createTransport({ transportMode: 'lan-http-first' });
        assert.equal(transport.defaultMode, 'lan-http-first');
    });

    it('get/set round-trips all public modes', () => {
        const transport = createTransport();
        const modes = ['mqtt', 'lan-http-first', 'lan-http-first-only-get'];

        for (const mode of modes) {
            transport.defaultMode = mode;
            assert.equal(transport.defaultMode, mode);
        }
    });

    it('rejects invalid defaultMode values', () => {
        const transport = createTransport();
        assert.throws(
            () => { transport.defaultMode = 'invalid'; },
            MerossNetworkError
        );
    });
});
