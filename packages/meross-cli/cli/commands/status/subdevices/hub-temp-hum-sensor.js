'use strict';

const chalk = require('chalk');

function displayTempHumSensorStatus(subdevice) {
    const temp = subdevice.getLastSampledTemperature();
    const humidity = subdevice.getLastSampledHumidity();
    const battery = subdevice.getCachedBattery();
    const lux = subdevice.getLux && subdevice.getLux();
    const sampleTime = subdevice.getLastSampledTime();

    let hasReadings = false;

    console.log(`\n    ${chalk.bold.underline('Sensors')}`);

    if (temp !== null) {
        console.log(`      ${chalk.white.bold('Temperature')}: ${chalk.italic(`${temp.toFixed(1)}°C`)}`);
        hasReadings = true;
    }
    if (humidity !== null) {
        console.log(`      ${chalk.white.bold('Humidity')}: ${chalk.italic(`${humidity.toFixed(1)}%`)}`);
        hasReadings = true;
    }
    if (lux !== null && lux !== undefined) {
        console.log(`      ${chalk.white.bold('Light')}: ${chalk.italic(`${lux} lx`)}`);
        hasReadings = true;
    }
    if (battery !== null && battery !== undefined) {
        console.log(`      ${chalk.white.bold('Battery')}: ${chalk.italic(`${battery}%`)}`);
        hasReadings = true;
    }

    console.log(`\n    ${chalk.bold.underline('Configuration')}`);

    if (sampleTime) {
        console.log(`      ${chalk.white.bold('Last Sample')}: ${chalk.italic(sampleTime.toISOString())}`);
    }

    return hasReadings;
}

module.exports = { displayTempHumSensorStatus };

