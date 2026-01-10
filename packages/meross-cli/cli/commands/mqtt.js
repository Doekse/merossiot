'use strict';

const chalk = require('chalk');

async function listMqttConnections(manager, options = {}) {
    const { verbose = false, json = false } = options;
    const mqttConnections = manager.mqttConnections || {};
    const domains = Object.keys(mqttConnections);

    if (domains.length === 0) {
        if (json) {
            console.log(JSON.stringify({ connections: [] }, null, 2));
        } else {
            console.log(chalk.yellow('No MQTT connections found.'));
        }
        return;
    }

    const connectionsData = domains.map(domain => {
        const conn = mqttConnections[domain];
        const client = conn?.client;

        let status = 'disconnected';
        if (client) {
            if (client.connected) {
                status = 'connected';
            } else if (client.reconnecting) {
                status = 'reconnecting';
            }
        }

        const deviceCount = conn?.deviceList?.length || 0;
        const deviceUuids = conn?.deviceList || [];

        const subscribedTopics = [];
        if (manager.userId) {
            subscribedTopics.push(`/app/${manager.userId}/subscribe`);
        }
        if (manager.clientResponseTopic) {
            subscribedTopics.push(manager.clientResponseTopic);
        }

        const namespaces = new Set();
        deviceUuids.forEach(uuid => {
            const device = manager.getDevice(uuid);
            if (device && device.abilities) {
                Object.keys(device.abilities).forEach(namespace => {
                    namespaces.add(namespace);
                });
            }
        });
        const namespacesList = Array.from(namespaces).sort();

        let clientId = 'N/A';
        let keepalive = 'N/A';
        let port = 'N/A';
        let protocol = 'N/A';
        let protocolRaw = 'N/A';

        if (client && client.options) {
            clientId = client.options.clientId || 'N/A';
            keepalive = client.options.keepalive || 'N/A';
            port = client.options.port || 'N/A';
            const protocolValue = client.options.protocol || client.options.protocolId;
            if (protocolValue) {
                protocolRaw = protocolValue;
                protocol = protocolValue === 'mqtts' ? 'MQTTS (TLS)' : protocolValue.toUpperCase();
            }
        }

        return {
            domain,
            status,
            deviceCount,
            deviceUuids,
            clientId,
            keepalive,
            port,
            protocol: protocolRaw,
            protocolDisplay: protocol,
            subscribedTopics,
            namespaces: namespacesList
        };
    });

    if (json) {
        const jsonData = connectionsData.map(conn => ({
            domain: conn.domain,
            status: conn.status,
            deviceCount: conn.deviceCount,
            deviceUuids: conn.deviceUuids,
            clientId: conn.clientId,
            keepalive: conn.keepalive,
            port: conn.port,
            protocol: conn.protocol,
            subscribedTopics: conn.subscribedTopics,
            namespaces: conn.namespaces
        }));
        console.log(JSON.stringify({ connections: jsonData }, null, 2));
        return;
    }

    console.log(`\n${chalk.bold.underline('MQTT Connections')}\n`);

    connectionsData.forEach((conn, index) => {
        console.log(`  [${index}] ${chalk.bold.underline(conn.domain)}`);

        const statusColor = conn.status === 'connected'
            ? chalk.green('Connected')
            : conn.status === 'reconnecting'
                ? chalk.yellow('Reconnecting')
                : chalk.red('Disconnected');

        const connectionInfo = [
            ['Status', statusColor],
            ['Port', chalk.cyan(conn.port)],
            ['Protocol', chalk.cyan(conn.protocolDisplay || conn.protocol)],
            ['Devices', chalk.cyan(conn.deviceCount.toString())]
        ];

        const maxLabelLength = Math.max(...connectionInfo.map(([label]) => label.length));

        connectionInfo.forEach(([label, value]) => {
            const padding = ' '.repeat(maxLabelLength - label.length);
            console.log(`  ${chalk.white.bold(label)}:${padding} ${chalk.italic(value)}`);
        });

        if (conn.subscribedTopics.length > 0) {
            console.log(`\n  ${chalk.white.bold(`Subscribed Topics (${chalk.cyan(conn.subscribedTopics.length)}):`)}`);
            conn.subscribedTopics.forEach(topic => {
                console.log(`    ${chalk.cyan(topic)}`);
            });
        }

        if (conn.namespaces.length > 0) {
            console.log(`\n  ${chalk.white.bold(`Namespaces (${chalk.cyan(conn.namespaces.length)}):`)}`);
            if (verbose) {
                conn.namespaces.forEach(namespace => {
                    console.log(`    ${chalk.cyan(namespace)}`);
                });
            } else {
                const displayCount = Math.min(5, conn.namespaces.length);
                conn.namespaces.slice(0, displayCount).forEach(namespace => {
                    console.log(`    ${chalk.cyan(namespace)}`);
                });
                const remainingCount = conn.namespaces.length - displayCount;
                if (remainingCount > 0) {
                    console.log(`    ${chalk.gray(`... and ${remainingCount} more (use --verbose to see all)`)}`);
                }
            }
        } else if (conn.deviceCount > 0) {
            console.log(`\n  ${chalk.gray('Namespaces: No abilities loaded yet')}`);
        }

        if (verbose) {
            const clientIdDisplay = conn.clientId !== 'N/A' && conn.clientId.length > 20
                ? `${conn.clientId.substring(0, 8)}...${conn.clientId.substring(conn.clientId.length - 8)}`
                : conn.clientId;

            const verboseInfo = [
                ['Client ID', chalk.cyan(clientIdDisplay)],
                ['Keepalive', chalk.cyan(`${conn.keepalive}s`)]
            ];

            verboseInfo.forEach(([label, value]) => {
                const padding = ' '.repeat(maxLabelLength - label.length);
                console.log(`  ${chalk.white.bold(label)}:${padding} ${chalk.italic(value)}`);
            });

            if (conn.deviceUuids.length > 0) {
                console.log(`\n  ${chalk.white.bold(`Device UUIDs (${chalk.cyan(conn.deviceUuids.length)}):`)}`);
                conn.deviceUuids.forEach((uuid) => {
                    const device = manager.getDevice(uuid);
                    const deviceName = device ? (device.name || 'Unknown') : 'Unknown';
                    console.log(`    ${chalk.cyan(uuid)} ${chalk.gray(`(${deviceName})`)}`);
                });
            }
        }

        if (index < connectionsData.length - 1) {
            console.log('');
        }
    });
}

module.exports = { listMqttConnections };

