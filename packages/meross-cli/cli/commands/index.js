'use strict';

// Export all command handlers
const { listDevices } = require('./list');
const { showStats } = require('./stats');
const { dumpRegistry } = require('./dump');
const { listMqttConnections } = require('./mqtt');
const { getDeviceStatus } = require('./status');
const { showDeviceInfo } = require('./info');
const { controlDeviceMenu, executeControlCommand, collectControlParameters } = require('./control');
const { runTestCommand, selectDeviceForTest } = require('./test');
const { snifferMenu } = require('./sniffer');

// Note: The following large functions still need to be extracted:
// - menuMode and all menu-related functions

// For now, these will remain in the main CLI file until extracted
// TODO: Extract remaining command handlers

module.exports = {
    listDevices,
    showStats,
    dumpRegistry,
    listMqttConnections,
    getDeviceStatus,
    showDeviceInfo,
    controlDeviceMenu,
    executeControlCommand,
    collectControlParameters,
    runTestCommand,
    selectDeviceForTest,
    snifferMenu
};

