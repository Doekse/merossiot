'use strict';

const chalk = require('chalk');

/**
 * @param {import('meross-iot').MerossSubDevice} subdevice
 * @returns {import('meross-iot').WaterLeakFeature}
 */
function getWaterLeak(subdevice) {
    if (!subdevice.waterLeak) {
        throw new Error('Sensor has no waterLeak ability');
    }
    return subdevice.waterLeak;
}

function display(subdevice) {
    const waterLeak = getWaterLeak(subdevice);
    const isLeaking = waterLeak.isLeaking();
    const leakTime = waterLeak.getLatestDetectedWaterLeakTs();
    const battery = subdevice.getBattery();

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

module.exports = { display };
