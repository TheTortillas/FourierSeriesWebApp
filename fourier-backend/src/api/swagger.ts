import swaggerJsdoc from "swagger-jsdoc";
import type { Options } from "swagger-jsdoc";

const options: Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Fourier Series Calculator API",
      version: "1.0.0",
      description:
        "API para cálculo de series de Fourier trigonométricas, de medio rango y complejas",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        PiecewiseSegment: {
          type: "object",
          required: ["expression", "from", "to"],
          properties: {
            expression: {
              type: "string",
              example: "cosh(x)",
              description: "Expresión matemática en notación Maxima",
            },
            from: {
              type: "string",
              example: "-%pi",
              description: "Límite inferior del segmento",
            },
            to: {
              type: "string",
              example: "%pi",
              description: "Límite superior del segmento",
            },
          },
        },
        FourierInput: {
          type: "object",
          required: ["segments", "seriesType"],
          properties: {
            segments: {
              type: "array",
              items: { $ref: "#/components/schemas/PiecewiseSegment" },
            },
            seriesType: {
              type: "string",
              enum: ["trigonometric", "halfRange", "complex"],
            },
            intVar: {
              type: "string",
              description: "Variable de integración (default: x)",
              example: "x",
            },
          },
        },
        SymbolicExpression: {
          type: "object",
          properties: {
            maxima: {
              type: "string",
              description: "Expresión en notación Maxima para graficación",
            },
            tex: {
              type: "string",
              description: "Expresión en LaTeX para renderizado con MathJax",
            },
          },
        },
        FourierResult: {
          type: "object",
          properties: {
            input: { $ref: "#/components/schemas/FourierInput" },
            coefficients: {
              type: "object",
              properties: {
                a0: { $ref: "#/components/schemas/SymbolicExpression" },
                an: { $ref: "#/components/schemas/SymbolicExpression" },
                bn: { $ref: "#/components/schemas/SymbolicExpression" },
                cn: { $ref: "#/components/schemas/SymbolicExpression" },
              },
            },
            series: { $ref: "#/components/schemas/SymbolicExpression" },
            validation: {
              type: "object",
              properties: {
                decision: {
                  type: "string",
                  enum: ["proceed", "warn", "reject"],
                },
                singularities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      point: { type: "string" },
                      type: { type: "string" },
                    },
                  },
                },
                message: { type: "string" },
              },
            },
            executionTimeMs: { type: "number" },
          },
        },
      },
    },
  },
  apis: ["./src/api/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
