const express = require("express");
const router = express.Router();
const controller = require("../controllers/processDocumentController");

/**
 * @swagger
 * /process-document:
 *   post:
 *     tags:
 *       - Documentos
 *     summary: Procesa un documento en base64 y devuelve JSON estructurado
 *     description: Endpoint que recibe un archivo codificado en base64 (imagen, PDF o CSV) y lo analiza con IA.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - base64
 *             properties:
 *               base64:
 *                 type: string
 *                 description: Archivo codificado en base64 (imagen, PDF o CSV)
 *     responses:
 *       200:
 *         description: Documento procesado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 type:
 *                   type: string
 *                 result:
 *                   type: object
 *       400:
 *         description: No se recibió base64
 *       500:
 *         description: Error interno del servidor
 */
router.post("/", controller.processDocument);

module.exports = router;