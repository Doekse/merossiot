'use strict';

function fetch(device, ctx) {
    ctx.fetchPromises.push(
        device.system.getAllData().catch(() => null)
    );
}

module.exports = { fetch };
