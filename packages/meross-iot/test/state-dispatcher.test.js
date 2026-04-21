'use strict';

/**
 * Unit tests for {@link module:controller/state-dispatcher} dispatch paths and registry.
 */

const assert = require('node:assert');
const { describe, it, beforeEach } = require('node:test');
const EventEmitter = require('node:events');

const {
    dispatch,
    registerNamespaceDescriptor,
    getNamespaceDescriptors
} = require('../lib/controller/state-dispatcher');

const REGISTRY_PROBE_NS = 'Test.Registry.Probe.Dispatch';

/**
 * Minimal state object for generic stateful dispatch tests.
 */
class TestChannelState {
    /**
     * @param {object} data
     */
    constructor(data) {
        this.val = data.val;
    }

    /**
     * @param {object} data
     * @returns {void}
     */
    update(data) {
        if (data.val !== undefined) {
            this.val = data.val;
        }
    }
}

describe('state-dispatcher dispatch', () => {
    /** @type {EventEmitter & { _map: Map<number, TestChannelState>, lastFullUpdateTimestamp?: number }} */
    let device;

    beforeEach(() => {
        const emitter = new EventEmitter();
        device = Object.assign(emitter, {
            _map: new Map()
        });
    });

    it('applies stateful items, updates map, and emits stateChange with diff', () => {
        const descriptor = {
            namespace: 'Test.Stateful',
            payloadKey: 'items',
            stateMap: '_map',
            StateClass: TestChannelState,
            eventType: 'test',
            snapshot: (s) => ({ val: s.val })
        };
        const events = [];
        device.on('stateChange', (e) => events.push(e));

        dispatch(
            device,
            descriptor,
            { items: [{ channel: 0, val: 1 }] },
            'response',
            null,
            undefined
        );

        assert.strictEqual(device._map.get(0).val, 1);
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'test');
        assert.strictEqual(events[0].channel, 0);
        assert.deepStrictEqual(events[0].value, { val: 1 });
        assert.ok(device.lastFullUpdateTimestamp);
    });

    it('skips stateful update when messageTs is older than last applied for that channel', () => {
        const descriptor = {
            namespace: 'Test.Stateful.Ordered',
            payloadKey: 'items',
            stateMap: '_map',
            StateClass: TestChannelState,
            eventType: 'test',
            snapshot: (s) => ({ val: s.val })
        };
        const events = [];
        device.on('stateChange', (e) => events.push(e));

        dispatch(device, descriptor, { items: [{ channel: 0, val: 10 }] }, 'a', 200, undefined);
        assert.strictEqual(device._map.get(0).val, 10);
        const afterFirst = events.length;

        dispatch(device, descriptor, { items: [{ channel: 0, val: 99 }] }, 'b', 100, undefined);
        assert.strictEqual(device._map.get(0).val, 10, 'stale message must not overwrite value');
        assert.strictEqual(events.length, afterFirst, 'stale message must not emit');
    });

    it('runs customApply when newer or equal, and skips when messageTs is older', () => {
        let n = 0;
        const descriptor = {
            namespace: 'Test.Custom.Whole',
            customApply: () => {
                n += 1;
            },
            gateKey: 'Test.Custom.Whole'
        };

        dispatch(device, descriptor, { x: 1 }, 'a', 50, undefined);
        assert.strictEqual(n, 1);
        dispatch(device, descriptor, { x: 2 }, 'b', 40, undefined);
        assert.strictEqual(n, 1, 'older ts must not run customApply');
        dispatch(device, descriptor, { x: 3 }, 'c', 50, undefined);
        assert.strictEqual(n, 2);
    });

    it('customApplyItem gates each channel separately for the same messageTs', () => {
        const descriptor = {
            namespace: 'Test.Custom.Items',
            payloadKey: 'rows',
            customApplyItem: (d, item) => {
                const ch = item.channel === null || item.channel === undefined ? 0 : item.channel;
                d._map.set(ch, item.v);
            }
        };

        dispatch(device, descriptor, { rows: [{ channel: 0, v: 'A' }] }, 'a', 10, undefined);
        assert.strictEqual(device._map.get(0), 'A');

        dispatch(
            device,
            descriptor,
            { rows: [{ channel: 0, v: 'stale' }, { channel: 1, v: 'B' }] },
            'b',
            5,
            undefined
        );
        assert.strictEqual(device._map.get(0), 'A', 'ch0 lastTs 10; 5 is older');
        assert.strictEqual(device._map.get(1), 'B', 'ch1 first apply at 5');
    });
});

describe('state-dispatcher registry', () => {
    it('registerNamespaceDescriptor appends descriptors retrievable by getNamespaceDescriptors', () => {
        const probe = { namespace: REGISTRY_PROBE_NS, customApply: () => {}, gateKey: REGISTRY_PROBE_NS };
        const n = getNamespaceDescriptors(REGISTRY_PROBE_NS).length;
        registerNamespaceDescriptor(REGISTRY_PROBE_NS, probe);
        const list = getNamespaceDescriptors(REGISTRY_PROBE_NS);
        assert.ok(list.length >= n + 1);
        assert.ok(list.includes(probe) || list.some((d) => d.gateKey === REGISTRY_PROBE_NS));
    });
});
