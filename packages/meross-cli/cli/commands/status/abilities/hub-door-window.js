'use strict';

const chalk = require('chalk');

/**
 * @param {import('meross-iot').MerossSubDevice} subdevice
 * @returns {import('meross-iot').DoorWindowFeature}
 */
function getDoorWindow(subdevice) {
    if (!subdevice.doorWindow) {
        throw new Error('Sensor has no doorWindow ability');
    }
    return subdevice.doorWindow;
}

function display(subdevice) {
    const doorWindow = getDoorWindow(subdevice);
    const isOpen = doorWindow.isOpen();
    const battery = subdevice.getBattery();
    const lastChange = doorWindow.getLatestLmTime();

    let hasReadings = false;

    console.log(`\n    ${chalk.bold.underline('Sensors')}`);

    if (isOpen !== null && isOpen !== undefined) {
        const stateText = isOpen ? 'Open' : 'Closed';
        console.log(`      ${chalk.white.bold('Contact')}: ${chalk.italic(stateText)}`);
        hasReadings = true;
    }

    if (battery !== null && battery !== undefined) {
        console.log(`      ${chalk.white.bold('Battery')}: ${chalk.italic(`${battery}%`)}`);
        hasReadings = true;
    }

    console.log(`\n    ${chalk.bold.underline('Configuration')}`);

    if (lastChange) {
        console.log(`      ${chalk.white.bold('Last Change')}: ${chalk.italic(new Date(lastChange * 1000).toISOString())}`);
    }

    return hasReadings;
}

module.exports = { display };
