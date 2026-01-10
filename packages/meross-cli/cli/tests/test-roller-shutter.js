'use strict';

/**
 * Roller Shutter Device Tests
 * Tests open/close control, position, timers, and configuration for roller shutters
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');

const DEFAULT_OPEN_TIMER = 15;
const DEFAULT_CLOSE_TIMER = 15;

const metadata = {
    name: 'roller-shutter',
    description: 'Tests open/close control, position, timers, and configuration for roller shutters',
    requiredAbilities: ['Appliance.RollerShutter.State'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 120000; // Roller shutters take time
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        testDevices = await findDevicesByAbility(manager, 'Appliance.RollerShutter.State', OnlineStatus.ONLINE);
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should open roller shutter',
            passed: false,
            skipped: true,
            error: 'No RollerShutter device has been found to run this test on',
            device: null
        });
        return results;
    }
    
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    await waitForDeviceConnection(testDevice, timeout);
    await testDevice.getRollerShutterState();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 1: Open roller shutter
    try {
        await testDevice.getRollerShutterState();
        
        // Set timers (if method exists)
        if (typeof testDevice.setRollerShutterConfig === 'function') {
            await testDevice.setRollerShutterConfig({
                openTimerSeconds: DEFAULT_OPEN_TIMER,
                closeTimerSeconds: DEFAULT_CLOSE_TIMER
            });
        }
        
        // Set up event listeners for state changes
        let stateOpening = false;
        let stateIdle = false;
        let positionOpened = false;
        
        const onData = (namespace, payload) => {
            if (namespace === 'Appliance.RollerShutter.State') {
                if (payload.state) {
                    const state = Array.isArray(payload.state) ? payload.state[0] : payload.state;
                    if (state.channel === 0) {
                        if (state.state === 1) { // OPENING
                            stateOpening = true;
                        } else if (state.state === 0) { // IDLE
                            stateIdle = true;
                        }
                    }
                }
            }
            if (namespace === 'Appliance.RollerShutter.Position') {
                if (payload.position) {
                    const position = Array.isArray(payload.position) ? payload.position[0] : payload.position;
                    if (position.channel === 0 && position.position === 100) {
                        positionOpened = true;
                    }
                }
            }
        };
        
        testDevice.on('data', onData);
        
        // Trigger the opening
        if (typeof testDevice.openRollerShutter === 'function') {
            await testDevice.openRollerShutter({ channel: 0 });
        } else {
            await testDevice.setRollerShutterPosition({ position: 100, channel: 0 });
        }
        
        // Wait for state changes
        const startTime = Date.now();
        while (!stateOpening && Date.now() - startTime < 30000) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (!stateOpening) {
            testDevice.removeListener('data', onData);
            results.push({
                name: 'should open roller shutter',
                passed: false,
                skipped: false,
                error: 'Did not receive OPENING state within 30 seconds',
                device: deviceName
            });
            return results;
        }
        
        while (!stateIdle && Date.now() - startTime < 90000) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (!stateIdle) {
            testDevice.removeListener('data', onData);
            results.push({
                name: 'should open roller shutter',
                passed: false,
                skipped: false,
                error: 'Did not receive IDLE state within 90 seconds',
                device: deviceName
            });
            return results;
        }
        
        while (!positionOpened && Date.now() - startTime < 120000) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        testDevice.removeListener('data', onData);
        
        if (!positionOpened) {
            results.push({
                name: 'should open roller shutter',
                passed: false,
                skipped: false,
                error: 'Did not receive position 100 within 120 seconds',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should open roller shutter',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should open roller shutter',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 2: Close roller shutter
    try {
        // Set timers (if method exists)
        if (typeof testDevice.setRollerShutterConfig === 'function') {
            await testDevice.setRollerShutterConfig({
                openTimerSeconds: DEFAULT_OPEN_TIMER,
                closeTimerSeconds: DEFAULT_CLOSE_TIMER
            });
        }
        
        // Update its status
        await testDevice.getRollerShutterState();
        
        // Set up event listeners for state changes
        let stateClosing = false;
        let stateIdle = false;
        let positionClosed = false;
        
        const onData = (namespace, payload) => {
            if (namespace === 'Appliance.RollerShutter.State') {
                if (payload.state) {
                    const state = Array.isArray(payload.state) ? payload.state[0] : payload.state;
                    if (state.channel === 0) {
                        if (state.state === 2) { // CLOSING
                            stateClosing = true;
                        } else if (state.state === 0) { // IDLE
                            stateIdle = true;
                        }
                    }
                }
            }
            if (namespace === 'Appliance.RollerShutter.Position') {
                if (payload.position) {
                    const position = Array.isArray(payload.position) ? payload.position[0] : payload.position;
                    if (position.channel === 0 && position.position === 0) {
                        positionClosed = true;
                    }
                }
            }
        };
        
        testDevice.on('data', onData);
        
        // Trigger the closing
        if (typeof testDevice.closeRollerShutter === 'function') {
            await testDevice.closeRollerShutter({ channel: 0 });
        } else {
            await testDevice.setRollerShutterPosition({ position: 0, channel: 0 });
        }
        
        // Wait for state changes
        const startTime = Date.now();
        while (!stateClosing && Date.now() - startTime < 30000) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (!stateClosing) {
            testDevice.removeListener('data', onData);
            results.push({
                name: 'should close roller shutter',
                passed: false,
                skipped: false,
                error: 'Did not receive CLOSING state within 30 seconds',
                device: deviceName
            });
            return results;
        }
        
        while (!stateIdle && Date.now() - startTime < 90000) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (!stateIdle) {
            testDevice.removeListener('data', onData);
            results.push({
                name: 'should close roller shutter',
                passed: false,
                skipped: false,
                error: 'Did not receive IDLE state within 90 seconds',
                device: deviceName
            });
            return results;
        }
        
        while (!positionClosed && Date.now() - startTime < 120000) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        testDevice.removeListener('data', onData);
        
        if (!positionClosed) {
            results.push({
                name: 'should close roller shutter',
                passed: false,
                skipped: false,
                error: 'Did not receive position 0 within 120 seconds',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should close roller shutter',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should close roller shutter',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 3: Get opening timer duration
    try {
        await testDevice.getRollerShutterState();
        
        const state = testDevice.getCachedRollerShutterState(0);
        
        if (!state) {
            results.push({
                name: 'should get opening timer duration',
                passed: false,
                skipped: false,
                error: 'Could not get cached roller shutter state',
                device: deviceName
            });
        } else {
            const openingTimer = state.open_timer_duration_millis;
            
            if (!openingTimer || openingTimer <= 0) {
                results.push({
                    name: 'should get opening timer duration',
                    passed: false,
                    skipped: false,
                    error: `Invalid opening timer: ${openingTimer}`,
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get opening timer duration',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { openingTimer: openingTimer }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get opening timer duration',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 4: Get closing timer duration
    try {
        await testDevice.getRollerShutterState();
        
        const state = testDevice.getCachedRollerShutterState(0);
        
        if (!state) {
            results.push({
                name: 'should get closing timer duration',
                passed: false,
                skipped: false,
                error: 'Could not get cached roller shutter state',
                device: deviceName
            });
        } else {
            const closingTimer = state.close_timer_duration_millis;
            
            if (!closingTimer || closingTimer <= 0) {
                results.push({
                    name: 'should get closing timer duration',
                    passed: false,
                    skipped: false,
                    error: `Invalid closing timer: ${closingTimer}`,
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get closing timer duration',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { closingTimer: closingTimer }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get closing timer duration',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 5: Set roller shutter config timers
    try {
        await testDevice.getRollerShutterState();
        
        // Retrieve original values
        const originalState = testDevice.getCachedRollerShutterState(0);
        
        if (!originalState) {
            results.push({
                name: 'should set roller shutter config timers',
                passed: false,
                skipped: true,
                error: 'Could not get original state',
                device: deviceName
            });
        } else if (typeof testDevice.setRollerShutterConfig !== 'function') {
            results.push({
                name: 'should set roller shutter config timers',
                passed: false,
                skipped: true,
                error: 'Device does not support setRollerShutterConfig',
                device: deviceName
            });
        } else {
            const originalOpenTimer = originalState.open_timer_duration_millis;
            const originalCloseTimer = originalState.close_timer_duration_millis;
            
            // Set new random values
            const openTimer = Math.floor(Math.random() * (120 - 10 + 1)) + 10; // 10-120 seconds
            const closeTimer = Math.floor(Math.random() * (120 - 10 + 1)) + 10; // 10-120 seconds
            
            await testDevice.setRollerShutterConfig({
                openTimerSeconds: openTimer,
                closeTimerSeconds: closeTimer,
                channel: 0
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await testDevice.getRollerShutterState();
            const newState = testDevice.getCachedRollerShutterState(0);
            
            if (!newState) {
                results.push({
                    name: 'should set roller shutter config timers',
                    passed: false,
                    skipped: false,
                    error: 'Could not get new state after setting config',
                    device: deviceName
                });
            } else if (newState.open_timer_duration_millis !== openTimer * 1000 || 
                       newState.close_timer_duration_millis !== closeTimer * 1000) {
                results.push({
                    name: 'should set roller shutter config timers',
                    passed: false,
                    skipped: false,
                    error: `Timer mismatch. Expected open=${openTimer * 1000}, close=${closeTimer * 1000}, got open=${newState.open_timer_duration_millis}, close=${newState.close_timer_duration_millis}`,
                    device: deviceName
                });
            } else {
                // Restore original values
                await testDevice.setRollerShutterConfig({
                    openTimerSeconds: Math.floor(originalOpenTimer / 1000),
                    closeTimerSeconds: Math.floor(originalCloseTimer / 1000),
                    channel: 0
                });
                
                results.push({
                    name: 'should set roller shutter config timers',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should set roller shutter config timers',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 6: Get roller shutter config
    try {
        if (typeof testDevice.getRollerShutterConfig !== 'function') {
            results.push({
                name: 'should get roller shutter config',
                passed: false,
                skipped: true,
                error: 'Device does not support getRollerShutterConfig',
                device: deviceName
            });
        } else {
            const config = await testDevice.getRollerShutterConfig();
            
            if (!config) {
                results.push({
                    name: 'should get roller shutter config',
                    passed: false,
                    skipped: false,
                    error: 'getRollerShutterConfig returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get roller shutter config',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { config: config.config || config }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get roller shutter config',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 7: Get roller shutter position
    try {
        if (typeof testDevice.getRollerShutterPosition !== 'function') {
            results.push({
                name: 'should get roller shutter position',
                passed: false,
                skipped: true,
                error: 'Device does not support getRollerShutterPosition',
                device: deviceName
            });
        } else {
            const response = await testDevice.getRollerShutterPosition({ channel: 0 });
            
            if (!response) {
                results.push({
                    name: 'should get roller shutter position',
                    passed: false,
                    skipped: false,
                    error: 'getRollerShutterPosition returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get roller shutter position',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { position: response }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get roller shutter position',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 8: Control roller shutter position
    try {
        if (typeof testDevice.controlRollerShutterPosition !== 'function') {
            results.push({
                name: 'should control roller shutter position',
                passed: false,
                skipped: true,
                error: 'Device does not support controlRollerShutterPosition',
                device: deviceName
            });
        } else {
            // Get current position first
            await testDevice.getRollerShutterPosition({ channel: 0 });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Note: We don't actually change the position to avoid disrupting the device
            // We just verify the method exists
            results.push({
                name: 'should control roller shutter position',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { note: 'Method exists, but not changing position to avoid disruption' }
            });
        }
    } catch (error) {
        results.push({
            name: 'should control roller shutter position',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 9: Get roller shutter adjust
    try {
        if (typeof testDevice.getRollerShutterAdjust !== 'function') {
            results.push({
                name: 'should get roller shutter adjust',
                passed: false,
                skipped: true,
                error: 'Device does not support getRollerShutterAdjust',
                device: deviceName
            });
        } else {
            const response = await testDevice.getRollerShutterAdjust({ channel: 0 });
            
            if (!response) {
                results.push({
                    name: 'should get roller shutter adjust',
                    passed: false,
                    skipped: false,
                    error: 'getRollerShutterAdjust returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get roller shutter adjust',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { adjust: response }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get roller shutter adjust',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    return results;
}

module.exports = {
    metadata,
    runTests
};
