const express = require("express");
const router = express.Router();
const DFTController = require("../controllers/dft.controller");

/**
 * @openapi
 * /dft/calculate:
 *   post:
 *     tags:
 *     - DFT
 *     summary: Calcula la DFT de una función a trozos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - funcionMatrix
 *             properties:
 *               funcionMatrix:
 *                 type: array
 *                 items:
 *                   type: array
 *                   items:
 *                     type: string
 *               N:
 *                 type: integer
 *                 default: 32
 *               M:
 *                 type: integer
 *                 default: 1
 *               intVar:
 *                 type: string
 *                 default: x
 *     responses:
 *       200:
 *         description: Resultado de la DFT
 *       500:
 *         description: Error en el servidor
 */
router.post("/calculate", DFTController.calculateDFT);

module.exports = router;