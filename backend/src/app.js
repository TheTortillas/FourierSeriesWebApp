const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./api/config/swagger.config');
const { corsOptions, setCorsHeaders } = require('./api/config/cors.config');

const fourierSeriesRoutes = require('./api/routes/fourier-series.routes');

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(setCorsHeaders);

// Documentación
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Rutas
app.use('/fourier-series', fourierSeriesRoutes);

module.exports = app;