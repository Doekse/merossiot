'use strict';

/**
 * Shared helpers for runnable examples (credentials and graceful shutdown).
 */

/**
 * Resolves login options from environment variables or placeholder defaults.
 *
 * @returns {{ email: string, password: string, mfaCode?: string }}
 */
function getCredentials() {
    const email = process.env.MEROSS_EMAIL;
    const password = process.env.MEROSS_PASSWORD;
    if (email && password) {
        const creds = { email, password };
        if (process.env.MEROSS_MFA_CODE) {
            creds.mfaCode = process.env.MEROSS_MFA_CODE;
        }
        return creds;
    }
    return {
        email: 'your@email.com',
        password: 'yourpassword'
    };
}

/**
 * Logs out and tears down MQTT when an example exits.
 *
 * @param {import('../index')} meross - Connected manager instance
 * @returns {Promise<void>}
 */
async function shutdown(meross) {
    try {
        if (meross?.authenticated) {
            await meross.logout();
        }
    } catch {
        // Ignore logout errors during shutdown
    }
    if (meross) {
        meross.disconnectAll(true);
    }
}

/**
 * Registers SIGINT to call {@link shutdown}.
 *
 * @param {import('../index')} meross - Connected manager instance
 * @returns {void}
 */
function bindShutdown(meross) {
    process.on('SIGINT', async () => {
        await shutdown(meross);
        process.exit(0);
    });
}

module.exports = {
    getCredentials,
    shutdown,
    bindShutdown
};
