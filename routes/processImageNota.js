const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { analyzeImage } = require('../service/analyzeWithAI');

// Guardar imagen en /uploads
function saveBase64Image(base64, filename) {
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return filePath;
}


router.post('/', async (req, res) => {
  try {
    let { base64 } = req.body;
    if (!base64) return res.status(400).json({ error: 'No se recibió base64' });
    if (base64.includes(',')) base64 = base64.split(',')[1];

    const fileName = `image_${Date.now()}.png`;

    // Guardar imagen
    const imagePath = saveBase64Image(base64, fileName);

    // Analizar con IA
    const aiResult = await analyzeImage(base64);

    // Eliminar archivo temporal
    fs.unlinkSync(imagePath);

    res.json({ structuredJSON: aiResult, file: fileName });
  } catch (error) {
    console.error('❌ Error procesando imagen:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
