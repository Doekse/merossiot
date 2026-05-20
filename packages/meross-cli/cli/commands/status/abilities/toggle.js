'use strict';

const chalk = require('chalk');
const { getChannelIds } = require('../../../utils/device');
const { shouldFetchFeature } = require('./utils');

function fetch(device, ctx) {
    for (const channel of getChannelIds(device)) {
        const hasToggleState = device.toggle.isOn({ channel }) !== undefined;
        if (shouldFetchFeature(hasToggleState, ctx.isMqttConnected)) {
            ctx.fetchPromises.push(
                device.toggle.get({ channel }).catch(() => null)
            );
        }
    }
}

function display(device, ctx) {
    const toggleStatesByChannel = device.toggle.getAll();
    if (toggleStatesByChannel.size === 0) {
        return;
    }

    const deviceChannels = device.channels && device.channels.length > 0 ? device.channels : [];
    const channelsToDisplay = Array.from(toggleStatesByChannel.keys()).sort((a, b) => a - b);
    const isSingleChannel = deviceChannels.length === 1 || (channelsToDisplay.length === 1 && channelsToDisplay[0] === 0);
    const baseLabel = ctx.hasElectricity ? 'State' : 'Power';

    /**
     * Formats channel name for status display.
     * @param {number} channelIndex - Channel index
     * @returns {string} Formatted channel name
     */
    const formatChannelName = (channelIndex) => {
        const channel = deviceChannels.find(ch => ch.index === channelIndex);
        if (channel) {
            const channelLabel = channel.isMasterChannel ? 'Master' : `Channel ${channel.index}`;
            const channelName = channel.name ? ` (${channel.name})` : '';
            return `${channelLabel}${channelName}`;
        }
        return `Socket ${channelIndex}`;
    };

    if (isSingleChannel) {
        const channelIndex = channelsToDisplay[0];
        const state = toggleStatesByChannel.get(channelIndex);
        const stateColor = state ? chalk.green('On') : chalk.red('Off');
        ctx.sensorLines.push(`    ${chalk.white.bold(baseLabel)}: ${chalk.italic(stateColor)}`);
    } else {
        channelsToDisplay.forEach(channelIndex => {
            const state = toggleStatesByChannel.get(channelIndex);
            const stateColor = state ? chalk.green('On') : chalk.red('Off');
            const channelName = formatChannelName(channelIndex);
            ctx.sensorLines.push(`    ${chalk.white.bold(`${channelName}:`)} ${chalk.italic(stateColor)}`);
        });
    }
    ctx.hasReadings = true;
}

module.exports = { fetch, display };
