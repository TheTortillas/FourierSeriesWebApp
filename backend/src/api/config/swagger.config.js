const swaggerJsdoc = require("swagger-jsdoc");

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Mini Fourier API",
      version: "1.0.0",
      description: "API para cálculo de series de Fourier",
      contact: {
        name: "Sebastián Morales Palacios",
        email: "sebasthefallen@gmail.com",
        url: "https://github.com/TheTortillas",
      },
    },
    // servers: [
    //   {
    //     url: 'http://localhost:3000'
    //   }
    // ]
  },
  apis: ["./api/routes/*.js"],
};

module.exports = swaggerJsdoc(swaggerOptions);
