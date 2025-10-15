// routes/processFile.js
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { Buffer } = require("buffer");
const { analyzeImage, ensureImageDataUrl } = require("../service/analyzeWithAI");

// Dir de guardado para pruebas/depuración
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Guarda un archivo en disco (opcional, útil para depurar)
function saveBuffer(buffer, filename) {
  const safe = filename || `upload_${Date.now()}`;
  const filePath = path.join(UPLOADS_DIR, safe);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * @swagger
 * /process-file:
 *   post:
 *     tags:
 *       - OCR / Análisis de Archivos (imagen o PDF)
 *     summary: Procesa una imagen (JPG/PNG/WEBP/GIF) o un PDF en base64 y devuelve análisis/metadata
 *     description: >
 *       Envía un JSON con **base64** del archivo e **indica si es PDF o imagen**.  
 *       - Si es **PDF**: procesa el PDF (puedes hacer OCR + resumen si lo implementas).  
 *       - Si es **imagen**: valida y normaliza la imagen y llama a OpenAI para un breve resumen.
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [base64]
 *             properties:
 *               base64:
 *                 type: string
 *                 description: Archivo en base64 (puede venir con o sin prefijo dataURL)
 *               filename:
 *                 type: string
 *                 description: Nombre sugerido de archivo (opcional)
 *               mimeType:
 *                 type: string
 *                 description: Mime esperado (opcional)
 *               kind:
 *                 type: string
 *                 enum: [image, pdf]
 *                 description: Fuerza el tipo si lo conoces; si no, se intenta deducir
 *           example:
 *             # Imagen (con dataURL)
 *             base64: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD..."
 *             filename: "ticket.jpg"
 *             mimeType: "image/jpeg"
 *             kind: "image"
 *     responses:
 *       200:
 *         description: Resultado del análisis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 kind:
 *                   type: string
 *                   description: Tipo detectado (image/pdf)
 *                 savedFile:
 *                   type: string
 *                   description: Ruta local guardada (para depurar)
 *                 summary:
 *                   type: string
 *                   description: Resumen/Texto de salida (en caso de imagen)
 *                 details:
 *                   type: object
 *                   description: Campo libre para anexar datos adicionales
 *       400:
 *         description: Datos inválidos
 *       500:
 *         description: Error interno
 */
router.post("/", async (req, res) => {
  try {
    const { base64, filename, mimeType, kind } = req.body || {};
    if (!base64 || typeof base64 !== "string") {
      return res.status(400).json({ ok: false, error: "Se requiere 'base64' en el body." });
    }

    // Normalizamos base64 y armamos buffer para guardar (opcional)
    let clean = base64;
    const m = String(base64).match(/^data:([^;]+);base64,(.*)$/i);
    let hintedMime = mimeType;
    if (m) {
      hintedMime = hintedMime || m[1];
      clean = m[2];
    }
    const buf = Buffer.from(clean.replace(/\s+/g, ""), "base64");

    // Heurística: si el mimeType / kind indica PDF, vamos por PDF
    const isPdf =
      (kind === "pdf") ||
      (hintedMime && /^application\/pdf$/i.test(hintedMime)) ||
      filename?.toLowerCase().endsWith(".pdf");

    // Guardamos el archivo en disco para depurar
    const safeName =
      filename ||
      (isPdf ? `archivo_${Date.now()}.pdf` : `imagen_${Date.now()}.bin`);
    const savedPath = saveBuffer(buf, safeName);

    if (isPdf) {
      // ---- Rama PDF ----
      // Aquí podrías invocar tu OCR/PDF pipeline. Para el ejemplo, devolvemos metadata simple.
      return res.json({
        ok: true,
        kind: "pdf",
        savedFile: savedPath,
        details: {
          filename: path.basename(savedPath),
          size_bytes: buf.length,
          note:
            "PDF recibido y guardado. Implementa aquí tu OCR o parser específico si lo requieres."
        }
      });
    }

    // ---- Rama Imagen ----
    // 1) Validamos/re-encodeamos si hace falta y obtenemos dataURL válido
    let ensured;
    try {
      ensured = await ensureImageDataUrl(base64, hintedMime);
    } catch (e) {
      console.error("❌ Validación de imagen:", e?.message || e);
      return res.status(400).json({ ok: false, error: e?.message || "Imagen inválida." });
    }

    // 2) Llamamos a OpenAI con la imagen (ya validada)
    const ai = await analyzeImage(ensured.dataUrl, ensured.mime);
    if (!ai.ok) {
      return res.status(400).json({ ok: false, error: ai.error });
    }

    return res.json({
      ok: true,
      kind: "image",
      savedFile: savedPath,
      summary: ai.summary,
      details: { mime: ensured.mime, filename: path.basename(savedPath) }
    });
  } catch (err) {
    console.error("❌ Error procesando archivo:", err);
    return res.status(500).json({ ok: false, error: "Error interno al procesar archivo" });
  }
});

module.exports = router;
