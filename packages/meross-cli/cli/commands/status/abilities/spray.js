'use strict';

const { shouldFetchFeature } = require('./utils');

function fetch(device, ctx) {
    const hasSprayState = device.spray.getMode({ channel: ctx.primaryChannel }) !== undefined;
    if (shouldFetchFeature(hasSprayState, ctx.isMqttConnected)) {
        ctx.fetchPromises.push(
            device.spray.get({ channel: ctx.primaryChannel }).catch(() => null)
        );
    }
}

module.exports = { fetch };
