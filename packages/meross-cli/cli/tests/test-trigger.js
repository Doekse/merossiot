'use strict';

/**
 * Trigger Tests
 * Tests trigger creation, management, and push notifications
 */

const { findDevicesByAbility, getDeviceName, OnlineStatus } = require('./test-helper');
const { TriggerType, TriggerUtils } = require('meross-iot');
const { createTrigger } = TriggerUtils;

const metadata = {
    name: 'trigger',
    description: 'Tests trigger creation, management, and push notifications',
    requiredAbilities: ['Appliance.Control.TriggerX'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.TriggerX', OnlineStatus.ONLINE);
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should find devices with trigger capability',
            passed: false,
            skipped: true,
            error: 'No devices with trigger capability found',
            device: null
        });
        return results;
    }
    
    results.push({
        name: 'should find devices with trigger capability',
        passed: true,
        skipped: false,
        error: null,
        device: null
    });
    
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    let createdTriggerId = null;
    
    // Test 1: Create a trigger and verify it exists
    try {
        // Create a test trigger using the utility function
        const testTrigger = createTrigger({
            alias: 'Test Trigger - CLI Test',
            duration: '30m', // 30 minutes
            days: ['weekday'],
            type: TriggerType.SINGLE_POINT_WEEKLY_CYCLE,
            channel: 0,
            enabled: true
        });
        
        // Wait for push notification after SET (as per API spec: "PUSH after SET")
        let triggerIdFromPush = null;
        const pushNotificationPromise = new Promise((resolve) => {
            const handler = (notification) => {
                if (notification.namespace === 'Appliance.Control.TriggerX' && notification.triggerxData) {
                    const triggerData = Array.isArray(notification.triggerxData) ? notification.triggerxData : [notification.triggerxData];
                    const createdTrigger = triggerData.find(t => 
                        t.channel === 0 && 
                        t.alias === 'Test Trigger - CLI Test' &&
                        t.id
                    );
                    if (createdTrigger && createdTrigger.id) {
                        triggerIdFromPush = createdTrigger.id;
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
        
        const createResult = await testDevice.trigger.set({ triggerx: testTrigger });
        
        if (!createResult) {
            results.push({
                name: 'should create trigger',
                passed: false,
                skipped: false,
                error: 'setTriggerX returned null or undefined',
                device: deviceName
            });
            return results;
        }
        
        // Wait for push notification (contains trigger with ID)
        await pushNotificationPromise;
        
        // Get the trigger ID from push notification, or fallback to generated ID
        if (triggerIdFromPush) {
            createdTriggerId = triggerIdFromPush;
        } else if (testTrigger.id) {
            createdTriggerId = testTrigger.id;
        } else {
            // Wait a bit and query by alias to find it
            await new Promise(resolve => setTimeout(resolve, 2000));
            const triggers = await testDevice.trigger.get({ channel: 0 });
            const foundTrigger = triggers?.triggerx?.find(t => t.alias === 'Test Trigger - CLI Test');
            if (foundTrigger && foundTrigger.id) {
                createdTriggerId = foundTrigger.id;
            }
        }
        
        if (!createdTriggerId) {
            results.push({
                name: 'should create trigger',
                passed: false,
                skipped: false,
                error: 'Could not get trigger ID after creation',
                device: deviceName
            });
            return results;
        }
        
        // Verify trigger exists by querying it
        const triggerInfo = await testDevice.trigger.get({ channel: 0 });
        const triggerExists = triggerInfo?.triggerx?.some(t => t.id === createdTriggerId);
        
        if (!triggerExists) {
            results.push({
                name: 'should create trigger',
                passed: false,
                skipped: false,
                error: 'Created trigger not found when querying',
                device: deviceName
            });
            return results;
        }
        
        // Verify cached trigger state
        const triggerResponse = await testDevice.trigger.get({ channel: 0 });
        const cachedTriggers = triggerResponse?.triggerx || [];
        
        results.push({
            name: 'should create trigger',
            passed: true,
            skipped: false,
            error: null,
            device: deviceName,
            details: { 
                triggerId: createdTriggerId,
                cachedTriggerCount: cachedTriggers.length
            }
        });
    } catch (error) {
        results.push({
            name: 'should create trigger',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
        return results;
    }
    
    // Test 2: Delete the trigger
    if (createdTriggerId) {
        try {
            const deleteResponse = await testDevice.deleteTriggerX(createdTriggerId, 0);
            
            // Check what the DELETE response contains
            const deleteResponseError = deleteResponse?.error;
            const hasError = deleteResponseError !== null && deleteResponseError !== undefined;
            const isIdNotFound = deleteResponseError?.code === 5050 || 
                                 deleteResponseError?.detail === 'id not found';
            
            // If DELETE returned an error other than "id not found", this is a real failure
            if (hasError && !isIdNotFound) {
                results.push({
                    name: 'should delete trigger',
                    passed: false,
                    skipped: false,
                    error: `DELETE command failed: ${JSON.stringify(deleteResponseError)}`,
                    device: deviceName,
                    details: { 
                        triggerId: createdTriggerId,
                        deleteResponse: deleteResponse
                    }
                });
            } else {
                // DELETE succeeded (no error, or error 5050)
                // Error 5050 means "id not found" which indicates the trigger is deleted (success)
                // Empty DELETEACK also means deletion was accepted
                results.push({
                    name: 'should delete trigger',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { 
                        triggerId: createdTriggerId,
                        deleteResponse: isIdNotFound ? 'Trigger deleted (error 5050 - id not found)' : 'DELETE command accepted (empty DELETEACK)'
                    }
                });
            }
        } catch (error) {
            results.push({
                name: 'should delete trigger',
                passed: false,
                skipped: false,
                error: error.message,
                device: deviceName,
                details: { 
                    triggerId: createdTriggerId
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
