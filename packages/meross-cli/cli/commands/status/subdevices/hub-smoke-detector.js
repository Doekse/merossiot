'use strict';

const chalk = require('chalk');
const { SmokeAlarmStatus } = require('meross-iot');

function displaySmokeDetectorStatus(subdevice) {
    const status = subdevice.getSmokeAlarmStatus();
    const interConn = subdevice.getInterConnStatus();
    const battery = subdevice.getCachedBattery();

    console.log(`\n    ${chalk.bold.underline('Sensors')}`);

    if (battery !== null && battery !== undefined) {
        console.log(`      ${chalk.white.bold('Battery')}: ${chalk.italic(`${battery}%`)}`);
    }

    let alarmStatus;
    if (status === SmokeAlarmStatus.NORMAL ||
        status === SmokeAlarmStatus.INTERCONNECTION_STATUS) {
        alarmStatus = 'Safe';
    } else if (status === SmokeAlarmStatus.MUTE_SMOKE_ALARM) {
        alarmStatus = 'Smoke Alarm Muted';
    } else if (status === SmokeAlarmStatus.MUTE_TEMPERATURE_ALARM) {
        alarmStatus = 'Temperature Alarm Muted';
    } else {
        alarmStatus = `Status: ${status}`;
    }
    console.log(`      ${chalk.white.bold('Alarm')}: ${chalk.italic(alarmStatus)}`);

    console.log(`\n    ${chalk.bold.underline('Configuration')}`);

    console.log(`      ${chalk.white.bold('Error')}: ${chalk.italic('OK')}`);

    if (interConn !== null && interConn !== undefined) {
        console.log(`      ${chalk.white.bold('Interconn')}: ${chalk.italic(interConn)}`);
    }

    let mutedStatus = 'Off';
    if (status === SmokeAlarmStatus.MUTE_SMOKE_ALARM) {
        mutedStatus = 'Smoke Alarm';
    } else if (status === SmokeAlarmStatus.MUTE_TEMPERATURE_ALARM) {
        mutedStatus = 'Temperature Alarm';
    }
    console.log(`      ${chalk.white.bold('Muted')}: ${chalk.italic(mutedStatus)}`);

    let overallStatus;
    if (status === SmokeAlarmStatus.NORMAL ||
        status === SmokeAlarmStatus.INTERCONNECTION_STATUS) {
        overallStatus = 'No issues';
    } else if (status === SmokeAlarmStatus.MUTE_SMOKE_ALARM) {
        overallStatus = 'Smoke alarm muted';
    } else if (status === SmokeAlarmStatus.MUTE_TEMPERATURE_ALARM) {
        overallStatus = 'Temperature alarm muted';
    } else {
        overallStatus = `Status code: ${status}`;
    }
    console.log(`      ${chalk.white.bold('Status')}: ${chalk.italic(overallStatus)}`);

    const lastUpdate = subdevice.getLastStatusUpdate();
    if (lastUpdate !== null && lastUpdate !== undefined) {
        const updateDate = new Date(lastUpdate * 1000);
        console.log(`      ${chalk.white.bold('Last Update')}: ${chalk.italic(updateDate.toLocaleString())}`);
    }

    const testEvents = subdevice.getTestEvents();
    if (testEvents && testEvents.length > 0) {
        console.log(`      ${chalk.white.bold('Test Events')}: ${chalk.italic(testEvents.length)}`);
        testEvents.slice(-3).forEach((event, idx) => {
            const eventType = event.type === 1 ? 'Manual' : event.type === 2 ? 'Automatic' : `Type ${event.type}`;
            const eventDate = event.timestamp ? new Date(event.timestamp * 1000).toLocaleString() : 'Unknown';
            console.log(`        ${idx + 1}. ${eventType} - ${eventDate}`);
        });
        if (testEvents.length > 3) {
            console.log(`        ... and ${testEvents.length - 3} more`);
        }
    }

    return true;
}

module.exports = { displaySmokeDetectorStatus };

