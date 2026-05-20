'use strict';

function fetch(device, ctx) {
    if (ctx.abilities['Appliance.Control.Diffuser.Light']) {
        ctx.fetchPromises.push(
            device.diffuser.getLight({ channel: ctx.primaryChannel }).catch(() => null)
        );
    }
    if (ctx.abilities['Appliance.Control.Diffuser.Spray']) {
        ctx.fetchPromises.push(
            device.diffuser.getSpray({ channel: ctx.primaryChannel }).catch(() => null)
        );
    }
}

module.exports = { fetch };
