const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");

const {
  normalizeBase64,
  getMimeFromDataUrl,
  detectMimeFromBuffer,
  analyzeImage,
  analyzePdfText,
} = require("../service/analyzeWithAI");

// Dir para depuración
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function safeFilename(name) {
  const base = (name || `upload_${Date.now()}`).toString();
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function saveBuffer(buffer, filename) {
  const safe = safeFilename(filename);
  const filePath = path.join(UPLOADS_DIR, safe);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function deleteFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.warn("⚠️ No pude borrar archivo temporal:", e.message);
  }
}

/**
 * @swagger
 * /process-file:
 *   post:
 *     tags:
 *       - Documentos
 *     summary: Procesa archivo (PDF o imagen) en base64 y devuelve JSON estructurado
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
 *                 description: "base64 del archivo (puede ser limpio o dataURL)"
 *               filename:
 *                 type: string
 *                 description: "Nombre del archivo (opcional)"
 *               mimeType:
 *                 type: string
 *                 description: "Opcional pero recomendado. Ejemplos: application/pdf, image/png"
 *     responses:
 *       200:
 *         description: Resultado
 */
router.post("/", async (req, res) => {
  let savedPath = null;

  try {
    const { base64, filename, mimeType } = req.body || {};
    if (!base64) return res.status(400).json({ ok: false, error: "No se recibió base64" });

    // 1) Normalizar base64 (quita dataURL y whitespaces)
    const cleanB64 = normalizeBase64(base64);
    if (!cleanB64) return res.status(400).json({ ok: false, error: "base64 vacío" });

    // 2) Decode buffer
    let buf;
    try {
      buf = Buffer.from(cleanB64, "base64");
    } catch (e) {
      return res.status(400).json({ ok: false, error: "base64 inválido (no se pudo decodificar)" });
    }

    if (!buf || buf.length < 10) {
      return res.status(400).json({ ok: false, error: "Archivo decodificado vacío o corrupto" });
    }

    // 3) Detectar MIME robusto:
    //    prioridad: mimeType body > dataURL > magic bytes
    const hinted = (mimeType || "").toLowerCase().trim();
    const fromDataUrl = getMimeFromDataUrl(base64);
    const fromMagic = detectMimeFromBuffer(buf);

    // Permitir variantes como "application/pdf; charset=binary"
    let finalMime = hinted || fromDataUrl || fromMagic;
    if (finalMime.includes(";")) finalMime = finalMime.split(";")[0].trim();

    const isPdf = finalMime === "application/pdf";
    const isImage = finalMime.startsWith("image/");

    const finalName = safeFilename(filename || (isPdf ? `document_${Date.now()}.pdf` : `image_${Date.now()}.png`));

    // Guardar temporal para debug (opcional)
    savedPath = saveBuffer(buf, finalName);

    // 4) Procesamiento
    if (isPdf) {
      // PDF -> extraer texto y mandar a IA
      const parsed = await pdfParse(buf);
      const text = (parsed.text || "").trim();

      if (!text) {
        const response = {
          ok: false,
          mimeType: finalMime,
          filename: finalName,
          error: "PDF sin texto detectable (probablemente escaneado). Implementa OCR/vision por páginas si lo necesitas.",
        };
        deleteFile(savedPath);
        return res.status(200).json(response);
      }

      const ai = await analyzePdfText(text, finalName);

      const response = {
        ok: ai.ok,
        mimeType: finalMime,
        filename: finalName,
        structuredJSON: ai.structured || null,
        summary: ai.summary || null,
        pages: parsed.numpages || null,
        textPreview: text.slice(0, 800),
      };

      deleteFile(savedPath);
      return res.json(response);
    }

    if (isImage) {
      // Imagen -> IA vision
      const ai = await analyzeImage(cleanB64, finalMime);

      const response = {
        ok: ai.ok,
        mimeType: finalMime,
        filename: finalName,
        structuredJSON: ai.structured || null,
        summary: ai.summary || null,
      };

      deleteFile(savedPath);
      return res.json(response);
    }

    // Tipo no soportado
    const response = {
      ok: false,
      mimeType: finalMime,
      filename: finalName,
      error: `Tipo de archivo no soportado: ${finalMime}`,
    };

    deleteFile(savedPath);
    return res.status(200).json(response);
  } catch (err) {
    console.error("❌ Error procesando archivo:", err);
    if (savedPath) deleteFile(savedPath);
    return res.status(500).json({ ok: false, error: err.message || "Error interno al procesar archivo" });
  }
});

module.exports = router;
