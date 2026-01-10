'use strict';

const { controlDeviceMenu } = require('./menu');
const { executeControlCommand } = require('./execute');
const { collectControlParameters } = require('./params');

module.exports = {
    controlDeviceMenu,
    executeControlCommand,
    collectControlParameters
};

