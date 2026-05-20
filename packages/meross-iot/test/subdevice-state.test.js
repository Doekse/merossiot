'use strict';

const assert = require('node:assert');
const { describe, it } = require('node:test');

const { diffSubdeviceStateSlices } = require('../lib/utilities/subdevice-state');

describe('diffSubdeviceStateSlices', () => {
    it('detects feature slice and online changes', () => {
        const oldState = {
            online: 1,
            timestamp: 1,
            battery: { 0: 50 }
        };
        const newState = {
            online: 2,
            timestamp: 2,
            battery: { 0: 55 },
            temperature: { 0: { latest: 21.5 } }
        };

        const events = diffSubdeviceStateSlices(oldState, newState);

        assert.deepStrictEqual(
            events.find(e => e.type === 'battery'),
            { type: 'battery', channel: 0, value: 55 }
        );
        assert.deepStrictEqual(
            events.find(e => e.type === 'temperature'),
            { type: 'temperature', channel: 0, value: { latest: 21.5 } }
        );
        assert.deepStrictEqual(
            events.find(e => e.type === 'online'),
            { type: 'online', value: 2 }
        );
    });
});
