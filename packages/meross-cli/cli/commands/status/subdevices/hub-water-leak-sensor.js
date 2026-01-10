'use strict';

const chalk = require('chalk');

function displayWaterLeakSensorStatus(subdevice) {
    const isLeaking = subdevice.isLeaking();
    const leakTime = subdevice.getLatestDetectedWaterLeakTs();
    const battery = subdevice.getCachedBattery();

    console.log(`\n    ${chalk.bold.underline('Sensors')}`);

    console.log(`      ${chalk.white.bold('Water Leak')}: ${chalk.italic(isLeaking ? 'WARNING: LEAK DETECTED' : 'OK: No leak')}`);
    if (battery !== null && battery !== undefined) {
        console.log(`      ${chalk.white.bold('Battery')}: ${chalk.italic(`${battery}%`)}`);
    }

    console.log(`\n    ${chalk.bold.underline('Configuration')}`);

    if (leakTime) {
        console.log(`      ${chalk.white.bold('Last Detection')}: ${chalk.italic(new Date(leakTime * 1000).toISOString())}`);
    }

    return true;
}

module.exports = { displayWaterLeakSensorStatus };

