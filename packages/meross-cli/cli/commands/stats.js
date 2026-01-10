'use strict';

const chalk = require('chalk');
const { createDebugUtils } = require('meross-iot');

function showStats(manager) {
    const debug = createDebugUtils(manager);
    const statsEnabled = debug.isStatsEnabled();
    const mqttStats = debug.getMqttStats();
    const httpStats = debug.getHttpStats();

    console.log(`\n${chalk.bold.underline('Statistics')}\n`);

    const statsInfo = [
        ['Tracking', statsEnabled ? chalk.green('Enabled') : chalk.red('Disabled')]
    ];

    const maxLabelLength = Math.max(...statsInfo.map(([label]) => label.length));
    statsInfo.forEach(([label, value]) => {
        const padding = ' '.repeat(maxLabelLength - label.length);
        console.log(`  ${chalk.gray.bold(label)}:${padding} ${value}`);
    });

    if (!statsEnabled) {
        console.log(`\n  ${chalk.yellow('Statistics tracking is disabled. Use "stats on" to enable it.')}\n`);
        return;
    }

    if (mqttStats) {
        const delayedStats = debug.getDelayedMqttStats();
        const droppedStats = debug.getDroppedMqttStats();

        const sent = mqttStats.globalStats.totalCalls;
        const delayed = delayedStats ? delayedStats.globalStats.totalCalls : 0;
        const dropped = droppedStats ? droppedStats.globalStats.totalCalls : 0;
        const total = sent + delayed + dropped;

        console.log(`\n  ${chalk.bold.underline('MQTT Statistics')}`);
        const mqttInfo = [
            ['Total Calls', chalk.cyan(total)],
            ['Sent', sent],
            ['Delayed', delayed],
            ['Dropped', dropped]
        ];
        const mqttMaxLabelLength = Math.max(...mqttInfo.map(([label]) => label.length));
        mqttInfo.forEach(([label, value]) => {
            const padding = ' '.repeat(mqttMaxLabelLength - label.length);
            console.log(`    ${chalk.gray.bold(label)}:${padding} ${value}`);
        });
    } else {
        console.log(`\n  ${chalk.bold.underline('MQTT Statistics')}`);
        console.log(`    ${chalk.gray.bold('Not available (stats not enabled)')}`);
    }

    if (httpStats) {
        console.log(`\n  ${chalk.bold.underline('HTTP Statistics')}`);
        const httpInfo = [
            ['Total Calls', chalk.cyan(httpStats.globalStats.totalCalls)]
        ];
        const httpMaxLabelLength = Math.max(...httpInfo.map(([label]) => label.length));
        httpInfo.forEach(([label, value]) => {
            const padding = ' '.repeat(httpMaxLabelLength - label.length);
            console.log(`    ${chalk.gray.bold(label)}:${padding} ${value}`);
        });

        const byHttpCode = httpStats.globalStats.byHttpResponseCode();
        if (byHttpCode.length > 0) {
            console.log(`\n    ${chalk.gray.bold('By HTTP Response Code:')}`);
            byHttpCode.forEach(([code, count]) => {
                console.log(`      ${code}: ${chalk.cyan(count)}`);
            });
        }

        const byApiCode = httpStats.globalStats.byApiStatusCode();
        if (byApiCode.length > 0) {
            console.log(`\n    ${chalk.gray.bold('By API Status Code:')}`);
            byApiCode.forEach(([code, count]) => {
                console.log(`      ${code}: ${chalk.cyan(count)}`);
            });
        }
    } else {
        console.log(`\n  ${chalk.bold.underline('HTTP Statistics')}`);
        console.log(`    ${chalk.gray.bold('Not available (stats not enabled)')}`);
    }

    console.log('');
}

module.exports = { showStats };

