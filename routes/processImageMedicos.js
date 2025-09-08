const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { analyzeMedicalImage } = require('../service/analyzeWithAI');

// Guardar imagen en /uploads
function saveBase64Image(base64, filename) {
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return filePath;
}

/**
 * @swagger
 * /process-image/:
 *   post:
 *     tags:
 *       - Procesamiento de imágenes
 *     summary: Procesa una imagen en base64 y devuelve JSON estructurado con IA
 *     description: Esta ruta recibe una imagen codificada en base64, la analiza con IA médica y devuelve un JSON estructurado.
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
 *                 description: Imagen codificada en base64
 *     responses:
 *       200:
 *         description: JSON analizado con IA
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 structuredJSON:
 *                   type: object
 *                   description: Resultado analizado por IA
 *                 file:
 *                   type: string
 *                   description: Nombre del archivo temporal generado
 *       400:
 *         description: No se recibió base64
 *       500:
 *         description: Error interno del servidor
 */
router.post('/', async (req, res) => {
  try {
    let { base64 } = req.body;
    if (!base64) return res.status(400).json({ error: 'No se recibió base64' });
    if (base64.includes(',')) base64 = base64.split(',')[1];

    const fileName = `image_${Date.now()}.png`;

    // Guardar imagen
    const imagePath = saveBase64Image(base64, fileName);

    // Analizar con IA
    const aiResult = await analyzeMedicalImage(base64);

    // Eliminar archivo temporal
    fs.unlinkSync(imagePath);

    res.json({ structuredJSON: aiResult, file: fileName });
  } catch (error) {
    console.error('❌ Error procesando imagen:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
