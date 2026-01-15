/* jshint -W097 */
/* jshint -W030 */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

/**
 * Timer Usage Example
 *
 * This example demonstrates how to easily create and manage timers using
 * the convenient helper methods and utilities.
 */

const { ManagerMeross, MerossHttpClient } = require('../index.js');

(async () => {
    try {
        // Create HTTP client
        const httpClient = await MerossHttpClient.fromUserPassword({
            email: 'your@email.com',
            password: 'yourpassword',
            logger: console.log
        });

        // Create manager
        const meross = new ManagerMeross({
            httpClient: httpClient,
            logger: console.log
        });

        console.log('Connecting to Meross Cloud...');
        await meross.connect();

        // Get a device (assumes you have at least one device) using property access pattern
        const devices = meross.devices.list();
        if (devices.length === 0) {
            console.log('No devices found.');
            return;
        }

        const device = devices[0];
        console.log(`\nUsing device: ${device.dev?.devName || 'Unknown'}`);

        // Wait for device to connect
        if (!device.deviceConnected) {
            console.log('Waiting for device to connect...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Example 1: Create a daily timer (every day at 18:00)
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

        // Example 2: Weekday timer (Monday-Friday at 09:00)
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

        // Example 3: Custom days timer
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

        // Example 4: One-time timer
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

        // Example 6: List all timers
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

        // Example 7: Find a timer by alias
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

        // Example 8: Delete a timer by alias
        console.log('\n=== Deleting Timer by Alias ===');
        try {
            const result = await device.deleteTimerByAlias({ alias: 'Movie Night', channel: 0 });
            console.log('✓ Timer deleted:', result);
        } catch (error) {
            console.error('Failed to delete timer:', error.message);
        }

        // Example 9: Delete all timers (be careful!)
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

        // Example 5: Using timer utilities directly
        console.log('\n=== Using Timer Utilities ===');
        const { timeToMinutes, daysToWeekMask, minutesToTime } = require('../lib/utilities/timer');

        // Convert time formats
        console.log('Time to minutes:', timeToMinutes('14:30')); // 870
        console.log('Minutes to time:', minutesToTime(870)); // "14:30"

        // Convert days to bitmask
        console.log('Days to bitmask:', daysToWeekMask(['monday', 'friday'])); // 131 (bits 0+4+7)

        console.log('\n✓ Examples completed!');

    } catch (error) {
        console.error('Error:', error);
        if (error.stack) {
            console.error(error.stack);
        }
    }
})();

