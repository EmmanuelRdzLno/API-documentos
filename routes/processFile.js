const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { fromBuffer } = require('pdf2pic');
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const { analyzePDF } = require('../service/analyzeWithAI');

// Función para guardar archivos en /uploads
function saveBase64File(base64, filename) {
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return filePath;
}

/**
 * @swagger
 * /process-file:
 *   post:
 *     tags:
 *       - Procesamiento de PDFs
 *     summary: Procesa un PDF en base64 y devuelve texto extraído y JSON estructurado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               base64:
 *                 type: string
 *                 description: Archivo PDF en base64
 *     responses:
 *       200:
 *         description: Texto extraído y análisis AI
 */
router.post('/', async (req, res) => {
  try {
    let { base64 } = req.body;
    if (!base64) return res.status(400).json({ error: 'No se recibió base64' });
    if (base64.includes(',')) base64 = base64.split(',')[1];
    try{
        const buffer = Buffer.from(base64, 'base64');
        if (buffer.slice(0, 4).toString() !== '%PDF') {
        return res.status(400).json({ error: 'El archivo no es un PDF válido' });
        }
    }
    catch (error) {
    console.error('❌ error OCR', error);
    res.status(500).json({ error: error.message });
    }
    

    // Extraer texto con pdf-parse
    const pdfData = await pdfParse(buffer);
    let extractedText = pdfData.text?.trim() || '';

    // Si no se extrajo texto, usar OCR
    if (!extractedText) {
      const convert = fromBuffer(buffer, { density: 300, format: "png", width: 1200, height: 1600 });
      let pageNum = 1, ocrText = "";
      while (true) {
        try {
          const page = await convert(pageNum);
          const { data: { text } } = await Tesseract.recognize(page.path, 'spa');
          if (!text || !text.trim()) break;
          ocrText += text + "\n";
          pageNum++;
        } catch {
          break;
        }
      }
      extractedText = ocrText.trim();
    }

    // Validar que se obtuvo texto
    if (!extractedText) {
      return res.status(400).json({ error: 'No se pudo extraer texto del PDF' });
    }

    // Limpiar caracteres no imprimibles
    extractedText = extractedText.replace(/[\x00-\x1F\x7F]/g, '');

    // Guardar archivo temporal
    const fileName = `file_${Date.now()}.pdf`;
    const pdfPath = saveBase64File(base64, fileName);

    // Enviar texto a la IA
    const aiResultRaw = await analyzePDF(extractedText);

    // Parsear respuesta de la IA
    let structuredJSON;
    if (typeof aiResultRaw === 'string') {
      try {
        structuredJSON = JSON.parse(aiResultRaw);
      } catch {
        structuredJSON = { 
          error: 'No se pudo parsear la respuesta como JSON', 
          raw: aiResultRaw 
        };
      }
    } else {
      structuredJSON = aiResultRaw;
    }

    fs.unlinkSync(pdfPath);

    res.json({
      structuredJSON,
      file: fileName
    });

  } catch (error) {
    console.error('❌ Error procesando archivo PDF:', error);
    res.status(500).json({ error: error.message });
  }
});




module.exports = router;
