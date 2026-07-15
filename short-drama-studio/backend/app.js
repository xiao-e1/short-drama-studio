const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

const { createConfigStore } = require('./config/store');
const { createAgnesClient } = require('./services/agnes');
const { createTextRouter } = require('./routes/text');
const { createImageRouter } = require('./routes/image');
const { createVideoRouter } = require('./routes/video');
const { createConfigRouter } = require('./routes/config');
const { notFoundHandler, errorHandler } = require('./middleware/errors');

const OUTPUTS_DIR = path.join(__dirname, '..', 'outputs');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
fs.ensureDirSync(OUTPUTS_DIR);

const configStore = createConfigStore(process.env.AGNES_API_KEY || '');
const agnesClient = createAgnesClient({ getApiKey: () => configStore.getKey(), outputsDir: OUTPUTS_DIR });
const app = express();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const staticOptions = { maxAge: '1d', etag: true, immutable: false };
app.use(express.static(FRONTEND_DIR, staticOptions));
app.use('/outputs', express.static(OUTPUTS_DIR, { ...staticOptions, maxAge: '7d', immutable: true }));

app.use('/api/config', createConfigRouter({ configStore }));
app.use('/api', createTextRouter({ agnesClient }));
app.use('/api', createImageRouter({ agnesClient }));
app.use('/api', createVideoRouter({ agnesClient, outputsDir: OUTPUTS_DIR }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, apiKeyConfigured: configStore.hasKey() });
});

app.use('/api', notFoundHandler);
app.get('*', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app, configStore };
