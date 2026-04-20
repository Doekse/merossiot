'use strict';

/**
 * Encryption live tests — **Primary:** {@link MerossDevice.system} `getEncryptSuite` /
 * `getEncryptECDHE` (documented on `SystemFeature`). **Secondary:** `device.encryption`
 * for LAN/message crypto (always constructed in `meross-iot`; not a separate typings entry).
 */

const {
    findDevicesByAbility,
    waitForDeviceConnection,
    getDeviceName,
    OnlineStatus,
    deviceHasAbility
} = require('./test-helper');

const metadata = {
    name: 'encryption',
    description:
        'Tests Appliance.Encrypt.* via system.getEncryptSuite/getEncryptECDHE; optional device.encryption for keying and message encrypt/decrypt',
    requiredAbilities: ['Appliance.Encrypt.ECDHE', 'Appliance.Encrypt.Suite'],
    minDevices: 1
};

/**
 * Runs encryption scenario tests.
 *
 * @param {Object} context - Runner context
 * @returns {Promise<Array<Object>>} Result rows
 */
async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];

    let testDevices = devices || [];
    if (testDevices.length === 0) {
        const ecdhe = await findDevicesByAbility(
            manager,
            'Appliance.Encrypt.ECDHE',
            OnlineStatus.ONLINE
        );
        const suite = await findDevicesByAbility(
            manager,
            'Appliance.Encrypt.Suite',
            OnlineStatus.ONLINE
        );
        const seen = new Set();
        testDevices = [];
        for (const d of [...ecdhe, ...suite]) {
            if (!seen.has(d.uuid)) {
                seen.add(d.uuid);
                testDevices.push(d);
            }
        }
        testDevices = testDevices.slice(0, 3);
    }

    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (testDevices.length === 0) {
        results.push({
            name: 'should find a device with encrypt abilities',
            passed: false,
            skipped: true,
            error: 'No online device with Appliance.Encrypt.ECDHE or Appliance.Encrypt.Suite',
            device: null
        });
        return results;
    }

    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);

    try {
        if (!testDevice.system || typeof testDevice.system.getEncryptSuite !== 'function') {
            results.push({
                name: 'should get encryption suite via system.getEncryptSuite',
                passed: false,
                skipped: true,
                error: 'system.getEncryptSuite not available',
                device: deviceName
            });
        } else if (!deviceHasAbility(testDevice, 'Appliance.Encrypt.Suite')) {
            results.push({
                name: 'should get encryption suite via system.getEncryptSuite',
                passed: false,
                skipped: true,
                error: 'Device does not advertise Appliance.Encrypt.Suite',
                device: deviceName
            });
        } else {
            const res = await testDevice.system.getEncryptSuite();
            if (!res || typeof res !== 'object') {
                results.push({
                    name: 'should get encryption suite via system.getEncryptSuite',
                    passed: false,
                    skipped: false,
                    error: 'getEncryptSuite() did not return an object',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get encryption suite via system.getEncryptSuite',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get encryption suite via system.getEncryptSuite',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        if (!testDevice.system || typeof testDevice.system.getEncryptECDHE !== 'function') {
            results.push({
                name: 'should get ECDHE info via system.getEncryptECDHE',
                passed: false,
                skipped: true,
                error: 'system.getEncryptECDHE not available',
                device: deviceName
            });
        } else if (!deviceHasAbility(testDevice, 'Appliance.Encrypt.ECDHE')) {
            results.push({
                name: 'should get ECDHE info via system.getEncryptECDHE',
                passed: false,
                skipped: true,
                error: 'Device does not advertise Appliance.Encrypt.ECDHE',
                device: deviceName
            });
        } else {
            const res = await testDevice.system.getEncryptECDHE();
            if (!res || typeof res !== 'object') {
                results.push({
                    name: 'should get ECDHE info via system.getEncryptECDHE',
                    passed: false,
                    skipped: false,
                    error: 'getEncryptECDHE() did not return an object',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get ECDHE info via system.getEncryptECDHE',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get ECDHE info via system.getEncryptECDHE',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        if (!testDevice.encryption || typeof testDevice.encryption.supportEncryption !== 'function') {
            results.push({
                name: 'should report LAN encryption support via device.encryption',
                passed: false,
                skipped: true,
                error: 'device.encryption not available',
                device: deviceName
            });
        } else {
            const supportsEncryption = testDevice.encryption.supportEncryption();
            let isKeySet = false;
            if (supportsEncryption) {
                isKeySet = testDevice.encryption.isEncryptionKeySet();
            }
            results.push({
                name: 'should report LAN encryption support via device.encryption',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { supportsEncryption, isKeySet }
            });
        }
    } catch (error) {
        results.push({
            name: 'should report LAN encryption support via device.encryption',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        if (
            !testDevice.encryption ||
            typeof testDevice.encryption.supportEncryption !== 'function' ||
            !testDevice.encryption.supportEncryption()
        ) {
            results.push({
                name: 'should set encryption key when LAN encryption is supported',
                passed: false,
                skipped: true,
                error: 'Device does not report LAN encryption support',
                device: deviceName
            });
        } else {
            const isKeySet = testDevice.encryption.isEncryptionKeySet();
            if (!isKeySet && testDevice.uuid && manager.key && testDevice.macAddress) {
                testDevice.encryption.setEncryptionKey(
                    testDevice.uuid,
                    manager.key,
                    testDevice.macAddress
                );
                const keySetAfter = testDevice.encryption.isEncryptionKeySet();
                if (!keySetAfter) {
                    results.push({
                        name: 'should set encryption key when LAN encryption is supported',
                        passed: false,
                        skipped: false,
                        error: 'Encryption key was not set',
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should set encryption key when LAN encryption is supported',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: { keySet: true }
                    });
                }
            } else if (!isKeySet) {
                results.push({
                    name: 'should set encryption key when LAN encryption is supported',
                    passed: false,
                    skipped: true,
                    error: 'Missing uuid, manager.key, or macAddress to derive key',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should set encryption key when LAN encryption is supported',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { keySet: true, note: 'Key was already set' }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should set encryption key when LAN encryption is supported',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }

    try {
        if (
            !testDevice.encryption ||
            typeof testDevice.encryption.supportEncryption !== 'function' ||
            !testDevice.encryption.supportEncryption()
        ) {
            results.push({
                name: 'should encrypt and decrypt a payload when key is available',
                passed: false,
                skipped: true,
                error: 'Device does not report LAN encryption support',
                device: deviceName
            });
        } else {
            let keyReady = testDevice.encryption.isEncryptionKeySet();
            if (!keyReady && testDevice.uuid && manager.key && testDevice.macAddress) {
                testDevice.encryption.setEncryptionKey(
                    testDevice.uuid,
                    manager.key,
                    testDevice.macAddress
                );
                keyReady = testDevice.encryption.isEncryptionKeySet();
            }
            if (!keyReady) {
                results.push({
                    name: 'should encrypt and decrypt a payload when key is available',
                    passed: false,
                    skipped: true,
                    error: 'Encryption key not available (derive uuid/key/mac or wait for MAC)',
                    device: deviceName
                });
            } else {
                const testMessage = { test: 'data', value: 123 };
                const encrypted = testDevice.encryption.encryptMessage(
                    JSON.stringify(testMessage)
                );
                if (!encrypted) {
                    results.push({
                        name: 'should encrypt and decrypt a payload when key is available',
                        passed: false,
                        skipped: false,
                        error: 'encryptMessage returned empty',
                        device: deviceName
                    });
                } else {
                    const decrypted = testDevice.encryption.decryptMessage(encrypted);
                    const asString = Buffer.isBuffer(decrypted)
                        ? decrypted.toString('utf8').replace(/\0+$/, '')
                        : String(decrypted);
                    let roundTrip;
                    try {
                        roundTrip = JSON.parse(asString);
                    } catch {
                        roundTrip = null;
                    }
                    if (!roundTrip || JSON.stringify(roundTrip) !== JSON.stringify(testMessage)) {
                        results.push({
                            name: 'should encrypt and decrypt a payload when key is available',
                            passed: false,
                            skipped: false,
                            error: 'Decrypted payload does not match original',
                            device: deviceName
                        });
                    } else {
                        results.push({
                            name: 'should encrypt and decrypt a payload when key is available',
                            passed: true,
                            skipped: false,
                            error: null,
                            device: deviceName
                        });
                    }
                }
            }
        }
    } catch (error) {
        results.push({
            name: 'should encrypt and decrypt a payload when key is available',
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
