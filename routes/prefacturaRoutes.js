const express = require("express");
const router = express.Router();
const generatePDFController = require("../controllers/generatePDFController");

/**
 * @swagger
 * /generate-pdf:
 *   post:
 *     tags:
 *       - Prefacturas
 *     summary: Genera una prefactura PDF (formato CFDI clásico) y devuelve base64
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Folio:
 *                 type: string
 *                 example: "F0001"
 *               Date:
 *                 type: string
 *                 example: "2026-03-11"
 *               Issuer:
 *                 type: object
 *                 properties:
 *                   Name:
 *                     type: string
 *                     example: "EMPRESA DEMO SA DE CV"
 *                   Rfc:
 *                     type: string
 *                     example: "AAA010101AAA"
 *                   Address:
 *                     type: string
 *                     example: "Av. Siempre Viva 123"
 *               Receiver:
 *                 type: object
 *                 properties:
 *                   Name:
 *                     type: string
 *                     example: "PUBLICO EN GENERAL"
 *                   Rfc:
 *                     type: string
 *                     example: "XAXX010101000"
 *               Items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     ProductCode:
 *                       type: string
 *                       example: "31162800"
 *                     Quantity:
 *                       type: number
 *                       example: 1
 *                     UnitPrice:
 *                       type: number
 *                       example: 500
 *                     Subtotal:
 *                       type: number
 *                       example: 500
 *                     Description:
 *                       type: string
 *                       example: "Servicio de mantenimiento"
 *                     Taxes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           Total:
 *                             type: number
 *                             example: 80
 *     responses:
 *       200:
 *         description: PDF generado
 */
router.post("/", generatePDFController.generate);

module.exports = router;