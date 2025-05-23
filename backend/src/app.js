const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const swaggerUi = require("swagger-ui-express");

const swaggerSpecs = require("./api/config/swagger.config");
const { corsOptions, setCorsHeaders } = require("./api/config/cors.config");

const fourierSeriesRoutes = require("./api/routes/fourier-series.routes");
const auxiliarFunctionsRoutes = require("./api/routes/auxiliar-functions.routes");
const seriesExpansionRoutes = require("./api/routes/series-expansion.routes");
const dftRoutes = require('./api/routes/dft.routes');

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(setCorsHeaders);

// Documentación
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Rutas
app.use("/fourier-series", fourierSeriesRoutes);
app.use("/auxiliar-functions", auxiliarFunctionsRoutes);
app.use("/series-expansion", seriesExpansionRoutes);
app.use('/dft', dftRoutes);

module.exports = app;
