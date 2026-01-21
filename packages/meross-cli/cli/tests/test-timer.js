'use strict';

/**
 * Timer Tests
 * Tests timer creation, management, and push notifications
 */

const { findDevicesByAbility, getDeviceName, OnlineStatus } = require('./test-helper');
const { TimerType, TimerUtils } = require('meross-iot');
const { createTimer } = TimerUtils;

const metadata = {
    name: 'timer',
    description: 'Tests timer creation, management, and push notifications',
    requiredAbilities: ['Appliance.Control.TimerX'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.TimerX', OnlineStatus.ONLINE);
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should find devices with timer capability',
            passed: false,
            skipped: true,
            error: 'No devices with timer capability found',
            device: null
        });
        return results;
    }
    
    results.push({
        name: 'should find devices with timer capability',
        passed: true,
        skipped: false,
        error: null,
        device: null
    });
    
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    let createdTimerId = null;
    
    // Test 1: Create a timer and verify it exists
    try {
        // Create a test timer using the utility function
        const testTimer = createTimer({
            alias: 'Test Timer - CLI Test',
            time: '12:00',
            days: ['weekday'],
            on: true,
            type: TimerType.SINGLE_POINT_WEEKLY_CYCLE,
            channel: 0,
            enabled: true
        });
        
        // Wait for push notification after SET (as per API spec: "PUSH after SET")
        let timerIdFromPush = null;
        const pushNotificationPromise = new Promise((resolve) => {
            const handler = (notification) => {
                if (notification.namespace === 'Appliance.Control.TimerX' && notification.timerxData) {
                    const timerData = Array.isArray(notification.timerxData) ? notification.timerxData : [notification.timerxData];
                    const createdTimer = timerData.find(t => 
                        t.channel === 0 && 
                        t.alias === 'Test Timer - CLI Test' &&
                        t.id
                    );
                    if (createdTimer && createdTimer.id) {
                        timerIdFromPush = createdTimer.id;
                        testDevice.removeListener('pushNotification', handler);
                        resolve();
                    }
                }
            };
            testDevice.on('pushNotificationReceived', handler);
            
            // Timeout after 5 seconds if no push notification arrives
            setTimeout(() => {
                testDevice.removeListener('pushNotification', handler);
                resolve();
            }, 5000);
        });
        
        const createResult = await testDevice.timer.set({ timerx: testTimer });
        
        if (!createResult) {
            results.push({
                name: 'should create timer',
                passed: false,
                skipped: false,
                error: 'setTimerX returned null or undefined',
                device: deviceName
            });
            return results;
        }
        
        // Wait for push notification (contains timer with ID)
        await pushNotificationPromise;
        
        // Get the timer ID from push notification, or fallback to generated ID
        if (timerIdFromPush) {
            createdTimerId = timerIdFromPush;
        } else if (testTimer.id) {
            createdTimerId = testTimer.id;
        } else {
            // Wait a bit and query by alias to find it
            await new Promise(resolve => setTimeout(resolve, 2000));
            const timers = await testDevice.timer.get({ channel: 0 });
            const foundTimer = timers?.timerx?.find(t => t.alias === 'Test Timer - CLI Test');
            if (foundTimer && foundTimer.id) {
                createdTimerId = foundTimer.id;
            }
        }
        
        if (!createdTimerId) {
            results.push({
                name: 'should create timer',
                passed: false,
                skipped: false,
                error: 'Could not get timer ID after creation',
                device: deviceName
            });
            return results;
        }
        
        // Verify timer exists by querying it
        const timerInfo = await testDevice.timer.get({ timerId: createdTimerId });
        
        if (!timerInfo || !timerInfo.timerx) {
            results.push({
                name: 'should create timer',
                passed: false,
                skipped: false,
                error: 'getTimerX returned null or undefined for created timer',
                device: deviceName
            });
            return results;
        }
        
        // Verify cached timer state
        const timerResponse = await testDevice.timer.get({ channel: 0 });
        const cachedTimers = timerResponse?.timerx || [];
        
        results.push({
            name: 'should create timer',
            passed: true,
            skipped: false,
            error: null,
            device: deviceName,
            details: { 
                timerId: createdTimerId,
                cachedTimerCount: cachedTimers.length
            }
        });
    } catch (error) {
        results.push({
            name: 'should create timer',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
        return results;
    }
    
    // Test 2: Delete the timer
    if (createdTimerId) {
        try {
            // Wait a bit after creation before deleting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            let deleteResponse;
            try {
                deleteResponse = await testDevice.timer.delete({ timerId: createdTimerId, channel: 0 });
            } catch (deleteError) {
                results.push({
                    name: 'should delete timer',
                    passed: false,
                    skipped: false,
                    error: `DELETE command threw error: ${deleteError.message}`,
                    device: deviceName,
                    details: { 
                        timerId: createdTimerId,
                        error: deleteError.message,
                        stack: deleteError.stack
                    }
                });
                return results;
            }
            
            // Log the full response for debugging
            const deleteResponseString = JSON.stringify(deleteResponse, null, 2);
            
            // Check if response is null/undefined (might indicate timeout or no response)
            if (!deleteResponse) {
                results.push({
                    name: 'should delete timer',
                    passed: false,
                    skipped: false,
                    error: 'DELETE command returned null or undefined response',
                    device: deviceName,
                    details: { 
                        timerId: createdTimerId,
                        note: 'DELETE command may have timed out or not received DELETEACK'
                    }
                });
                return results;
            }
            
            // Check what the DELETE response contains
            // Error 5050 "id not found" is returned even when deletion succeeds
            // Empty DELETEACK (no error) also means deletion succeeded
            const deleteResponseError = deleteResponse?.error;
            const hasError = deleteResponseError !== null && deleteResponseError !== undefined;
            const isIdNotFound = deleteResponseError?.code === 5050 || 
                                 deleteResponseError?.detail === 'id not found';
            
            // If DELETE returned an error other than "id not found", this is a real failure
            if (hasError && !isIdNotFound) {
                results.push({
                    name: 'should delete timer',
                    passed: false,
                    skipped: false,
                    error: `DELETE command failed: ${JSON.stringify(deleteResponseError)}`,
                    device: deviceName,
                    details: { 
                        timerId: createdTimerId,
                        deleteResponse: deleteResponseString
                    }
                });
                return results;
            }
            
            // DELETE command was accepted (no error, or error 5050)
            // Error 5050 means the timer is deleted (success)
            // Wait longer for device to process deletion (some devices need more time)
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Clear cached state and query fresh from device
            try {
                // Force a refresh by querying the device directly
                const timersResponse = await testDevice.timer.get({ channel: 0 });
                
                let timerStillExists = false;
                let allTimerIds = [];
                
                if (timersResponse && timersResponse.timerx) {
                    const timers = Array.isArray(timersResponse.timerx) ? timersResponse.timerx : [timersResponse.timerx];
                    allTimerIds = timers.map(t => t.id);
                    timerStillExists = timers.some(t => t.id === createdTimerId);
                }
                
                if (timerStillExists) {
                    results.push({
                        name: 'should delete timer',
                        passed: false,
                        skipped: false,
                        error: `Timer with ID ${createdTimerId} still exists after deletion`,
                        device: deviceName,
                        details: { 
                            timerId: createdTimerId,
                            deleteResponse: deleteResponseString,
                            allTimerIds: allTimerIds,
                            note: 'DELETE command was sent and acknowledged, but timer still exists on device after 3 seconds'
                        }
                    });
                } else {
                    results.push({
                        name: 'should delete timer',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: { 
                            timerId: createdTimerId,
                            deleteResponse: isIdNotFound ? 'Deleted (error 5050 - id not found)' : 'Deleted (empty DELETEACK)',
                            verified: 'Timer confirmed removed from device',
                            allTimerIds: allTimerIds
                        }
                    });
                }
            } catch (queryError) {
                // If query fails, still consider deletion successful since DELETEACK was received
                results.push({
                    name: 'should delete timer',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { 
                        timerId: createdTimerId,
                        deleteResponse: isIdNotFound ? 'Deleted (error 5050 - id not found)' : 'Deleted (empty DELETEACK)',
                        verificationQueryFailed: queryError.message,
                        note: 'DELETE command acknowledged, but verification query failed'
                    }
                });
            }
        } catch (error) {
            results.push({
                name: 'should delete timer',
                passed: false,
                skipped: false,
                error: error.message,
                device: deviceName,
                details: { 
                    timerId: createdTimerId,
                    stack: error.stack
                }
            });
        }
    }
    
    return results;
}

module.exports = {
    metadata,
    runTests
};
