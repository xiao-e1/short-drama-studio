const { app, configStore } = require('./app');

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, () => {
  console.log(`Short Drama Studio: http://localhost:${PORT}`);
  console.log(configStore.hasKey() ? 'Agnes API Key is configured.' : 'Agnes API Key is not configured. Open the app to set it.');
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error);
});

/** Gracefully closes the HTTP server.
 * @param {NodeJS.Signals} signal termination signal
 * @returns {void}
 */
function shutdown(signal) {
  console.log(`${signal}: closing server...`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

