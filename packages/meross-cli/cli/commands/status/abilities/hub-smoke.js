'use strict';

const chalk = require('chalk');

/**
 * @param {import('meross-iot').MerossSubDevice} subdevice
 * @returns {import('meross-iot').SmokeAlarmFeature}
 */
function getSmokeAlarm(subdevice) {
    if (!subdevice.smokeAlarm) {
        throw new Error('Smoke detector has no smokeAlarm ability');
    }
    return subdevice.smokeAlarm;
}

/**
 * @param {import('meross-iot').SmokeAlarmFeature} smoke
 * @returns {string}
 */
function formatConditionLabel(condition, channel, status) {
    const isMuted = Boolean(
        status && (status.endsWith('-muted') || status.startsWith('mute-'))
    );
    if (condition === 'safe') {
        return 'Safe';
    }
    if (condition === 'alarming') {
        if (channel === 'smoke') {
            return 'Smoke alarm';
        }
        if (channel === 'temperature') {
            return 'Heat alarm';
        }
    }
    if (condition === 'silenced') {
        if (channel === 'smoke') {
            return 'Smoke alarm (silenced)';
        }
        if (channel === 'temperature') {
            return 'Heat alarm (silenced)';
        }
    }
    if (condition === 'fault') {
        const suffix = isMuted ? ' (silenced)' : '';
        if (channel === 'battery') {
            return `Battery fault${suffix}`;
        }
        if (channel === 'temperature') {
            return `Temperature sensor fault${suffix}`;
        }
        if (channel === 'smoke') {
            return `Smoke sensor fault${suffix}`;
        }
        return `Fault${suffix}`;
    }
    if (condition === 'unknown') {
        if (status === null || status === undefined) {
            return 'Unknown';
        }
        return `Unknown (code ${status})`;
    }

    return condition;
}

/**
 * @param {import('meross-iot').SmokeAlarmInterconnect} interconnect
 * @returns {string}
 */
function formatInterconnectLabel(interconnect) {
    if (interconnect.linkActive) {
        return 'Link active';
    }
    return 'Idle (no mesh event)';
}

/**
 * CLI presentation labels from the meross-iot smokeAlarm API.
 *
 * @param {import('meross-iot').SmokeAlarmFeature} smoke
 * @returns {{ condition: string, interconnect: string|null }}
 */
function deriveSmokeAlarmView(smoke) {
    const interconnect = smoke.getInterconnect();
    return {
        condition: formatConditionLabel(
            smoke.getCondition(),
            smoke.getChannel(),
            smoke.getStatus()
        ),
        interconnect: interconnect !== null ? formatInterconnectLabel(interconnect) : null
    };
}

/**
 * @param {import('meross-iot').MerossSubDevice} subdevice
 * @returns {boolean}
 */
function display(subdevice) {
    const smoke = getSmokeAlarm(subdevice);
    const view = deriveSmokeAlarmView(smoke);
    const battery = subdevice.getBattery();

    console.log(`\n    ${chalk.bold.underline('Sensors')}`);

    console.log(`      ${chalk.white.bold('Condition')}: ${chalk.italic(view.condition)}`);

    if (battery !== null && battery !== undefined) {
        console.log(`      ${chalk.white.bold('Battery')}: ${chalk.italic(`${battery}%`)}`);
    }

    if (view.interconnect !== null) {
        console.log(`\n    ${chalk.bold.underline('Interconnect')}`);
        console.log(`      ${chalk.white.bold('Mesh')}: ${chalk.italic(view.interconnect)}`);
    }

    const lastUpdate = smoke.getLastStatusUpdate();
    const testEvents = smoke.getTestEvents();
    const hasHistory = (lastUpdate !== null && lastUpdate !== undefined) ||
        (testEvents && testEvents.length > 0);

    if (hasHistory) {
        console.log(`\n    ${chalk.bold.underline('History')}`);

        if (lastUpdate !== null && lastUpdate !== undefined) {
            const updateDate = new Date(lastUpdate * 1000);
            console.log(`      ${chalk.white.bold('Last update')}: ${chalk.italic(updateDate.toISOString())}`);
        }

        if (testEvents && testEvents.length > 0) {
            console.log(`      ${chalk.white.bold('Tests')}: ${chalk.italic(testEvents.length)} recorded`);
            testEvents.slice(-3).forEach((event, idx) => {
                const eventType = event.type === 1 ? 'Manual' : event.type === 2 ? 'Automatic' : `Type ${event.type}`;
                const eventDate = event.timestamp ? new Date(event.timestamp * 1000).toISOString() : 'Unknown';
                console.log(`        ${idx + 1}. ${eventType} — ${eventDate}`);
            });
            if (testEvents.length > 3) {
                console.log(`        ... and ${testEvents.length - 3} more`);
            }
        }
    }

    return true;
}

module.exports = { display };
