/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Timer Usage Example
 *
 * Demonstrates how to create and manage timers using helper methods and utilities.
 */

const { ManagerMeross, MerossHttpClient } = require('../index.js');

(async () => {
    try {
        const httpClient = await MerossHttpClient.fromUserPassword({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
        });

        const meross = new ManagerMeross({
            httpClient: httpClient,
            logger: console.log
        });

        console.log('Connecting to Meross Cloud...');
        await meross.connect();

        const devices = meross.devices.list();
        if (devices.length === 0) {
            console.log('No devices found.');
            return;
        }

        const device = devices[0];
        console.log(`\nUsing device: ${device.name || 'Unknown'}`);

        if (!device.deviceConnected) {
            console.log('Waiting for device to connect...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        console.log('\n=== Creating Daily Timer ===');
        try {
            const dailyTimer = await device.setTimerX({
                time: '18:00',
                alias: 'Evening Lights',
                days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
                on: true,
                channel: 0
            });
            console.log('✓ Daily timer created:', dailyTimer);
        } catch (error) {
            console.error('Failed to create daily timer:', error.message);
        }

        console.log('\n=== Creating Weekday Timer ===');
        try {
            const weekdayTimer = await device.setTimerX({
                time: '09:00',
                alias: 'Work Start',
                days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                on: true,
                channel: 0
            });
            console.log('✓ Weekday timer created:', weekdayTimer);
        } catch (error) {
            console.error('Failed to create weekday timer:', error.message);
        }

        console.log('\n=== Creating Custom Days Timer ===');
        try {
            const customTimer = await device.setTimerX({
                alias: 'Custom Schedule',
                time: '14:30',
                days: ['monday', 'wednesday', 'friday'],
                on: false,
                channel: 0,
                enabled: true
            });
            console.log('✓ Custom timer created:', customTimer);
        } catch (error) {
            console.error('Failed to create custom timer:', error.message);
        }

        console.log('\n=== Creating One-Time Timer ===');
        try {
            const oneTimeTimer = await device.setTimerX({
                time: '20:00',
                days: ['friday'],
                alias: 'Movie Night',
                on: true,
                channel: 0,
                type: require('../lib/model/enums').TimerType.SINGLE_POINT_SINGLE_SHOT
            });
            console.log('✓ One-time timer created:', oneTimeTimer);
        } catch (error) {
            console.error('Failed to create one-time timer:', error.message);
        }

        console.log('\n=== Listing All Timers ===');
        try {
            const timers = await device.getTimerX({ channel: 0 });
            if (timers && timers.timerx && Array.isArray(timers.timerx)) {
                console.log(`Found ${timers.timerx.length} timer(s):`);
                timers.timerx.forEach(timer => {
                    const hours = Math.floor((timer.time || 0) / 60);
                    const minutes = (timer.time || 0) % 60;
                    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                    console.log(`  - ${timer.alias || 'Unnamed'}: ${timeStr} (${timer.enable === 1 ? 'Enabled' : 'Disabled'})`);
                });
            } else {
                console.log('No timers found.');
            }
        } catch (error) {
            console.error('Failed to list timers:', error.message);
        }

        console.log('\n=== Finding Timer by Alias ===');
        try {
            const timer = await device.findTimerByAlias({ alias: 'Evening Lights', channel: 0 });
            if (timer) {
                console.log('✓ Found timer:', {
                    id: timer.id,
                    alias: timer.alias,
                    time: timer.time,
                    enabled: timer.enable
                });
            } else {
                console.log('Timer not found.');
            }
        } catch (error) {
            console.error('Failed to find timer:', error.message);
        }

        console.log('\n=== Deleting Timer by Alias ===');
        try {
            const result = await device.deleteTimerByAlias({ alias: 'Movie Night', channel: 0 });
            console.log('✓ Timer deleted:', result);
        } catch (error) {
            console.error('Failed to delete timer:', error.message);
        }

        // Uncomment to delete all timers:
        /*
        console.log('\n=== Deleting All Timers ===');
        try {
            const results = await device.deleteAllTimers({ channel: 0 });
            console.log(`✓ Deleted ${results.length} timer(s)`);
        } catch (error) {
            console.error('Failed to delete timers:', error.message);
        }
        */

        console.log('\n=== Using Timer Utilities ===');
        const { timeToMinutes, daysToWeekMask, minutesToTime } = require('../lib/utilities/timer');

        console.log('Time to minutes:', timeToMinutes('14:30'));
        console.log('Minutes to time:', minutesToTime(870));
        console.log('Days to bitmask:', daysToWeekMask(['monday', 'friday']));

        console.log('\n✓ Examples completed!');

    } catch (error) {
        console.error('Error:', error);
        if (error.stack) {
            console.error(error.stack);
        }
    }
})();

