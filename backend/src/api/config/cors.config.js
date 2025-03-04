const corsOptions = {
  origin: "http://localhost:4200",
  optionsSuccessStatus: 200,
};

// Middleware para establecer cabeceras CORS adicionales
function setCorsHeaders(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
}

module.exports = {
  corsOptions,
  setCorsHeaders,
};
