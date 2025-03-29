const express = require("express");
const router = express.Router();
const auxiliarFunctionsController = require("../controllers/auxiliar-fuctions.controller");

/**
 * @openapi
 * /auxiliar-functions/check-integrability:
 *   post:
 *     tags:
 *     - Auxiliar Functions Controller
 *     summary: Verifica si una función es integrable
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *              - funcion
 *              - intVar
 *             properties:
 *               funcion:
 *                 type: string
 *                 description: Función a integrar
 *               intVar:
 *                 type: string
 *                 description: Variable de integración
 *               start:
 *                 type: string
 *                 description: Límite inferior (opcional)
 *               end:
 *                 type: string
 *                 description: Límite superior (opcional)
 *     responses:
 *       200:
 *         description: Resultados de integrabilidad
 *       500:
 *         description: Error en el servidor
 */
router.post(
  "/check-integrability",
  auxiliarFunctionsController.checkIntegrability
);

module.exports = router;