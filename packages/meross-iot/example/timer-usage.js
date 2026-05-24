'use strict';

/**
 * Timers via {@link TimerFeature} (`device.timer`).
 */

const Meross = require('../index.js');
const { getCredentials, shutdown } = require('./shared.js');

(async () => {
    try {
        console.log('Connecting…');
        const meross = await Meross.connect({
            ...getCredentials(),
            logger: console.log
        });

        const device = meross.devices.list().find((d) => d.timer);
        if (!device) {
            console.log('No timer-capable device in registry.');
            await shutdown(meross);
            return;
        }

        if (!device.isOnline) {
            console.log('Waiting for device connection…');
            await new Promise((resolve) => device.once('connected', resolve));
        }

        console.log(`\nDevice: ${device.name}\n`);

        if (!device.timer) {
            throw new Error('device.timer feature missing');
        }

        const timer = device.timer;

        console.log('=== Create daily timer ===');
        try {
            const created = await timer.set({
                time: '18:00',
                alias: 'Evening Lights',
                days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
                on: true,
                channel: 0
            });
            console.log('Created:', created?.timerx ?? created);
        } catch (err) {
            console.error('Daily timer:', err.message);
        }

        console.log('\n=== Create weekday timer ===');
        try {
            await timer.set({
                time: '09:00',
                alias: 'Work Start',
                days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                on: true,
                channel: 0
            });
            console.log('Weekday timer set.');
        } catch (err) {
            console.error('Weekday timer:', err.message);
        }

        console.log('\n=== One-shot timer ===');
        try {
            await timer.set({
                time: '20:00',
                days: ['friday'],
                alias: 'Movie Night',
                on: true,
                channel: 0,
                type: 'single-point-single-shot'
            });
            console.log('One-shot timer set.');
        } catch (err) {
            console.error('One-shot timer:', err.message);
        }

        console.log('\n=== List timers ===');
        try {
            const response = await timer.get({ channel: 0 });
            const list = response?.timerx;
            if (Array.isArray(list) && list.length > 0) {
                for (const t of list) {
                    const hours = Math.floor((t.time || 0) / 60);
                    const minutes = (t.time || 0) % 60;
                    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                    console.log(`  - ${t.alias || 'Unnamed'}: ${timeStr} (${t.enable === 1 ? 'on' : 'off'})`);
                }
            } else {
                console.log('  (none)');
            }
        } catch (err) {
            console.error('List:', err.message);
        }

        console.log('\n=== Find by alias ===');
        try {
            const found = await timer.findTimerByAlias({ alias: 'Evening Lights', channel: 0 });
            console.log(found ? `Found id ${found.id}` : 'Not found');
        } catch (err) {
            console.error('Find:', err.message);
        }

        console.log('\n=== Delete by alias ===');
        try {
            await timer.deleteTimerByAlias({ alias: 'Movie Night', channel: 0 });
            console.log('Deleted "Movie Night" (if it existed).');
        } catch (err) {
            console.error('Delete:', err.message);
        }

        console.log('\n=== Utilities ===');
        console.log('timeToMinutes("14:30"):', timer.timeToMinutes('14:30'));
        console.log('minutesToTime(870):', timer.minutesToTime(870));
        console.log('daysToWeekMask(["monday","friday"]):', timer.daysToWeekMask(['monday', 'friday']));

        await shutdown(meross);
        console.log('\nDone.');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
})();
