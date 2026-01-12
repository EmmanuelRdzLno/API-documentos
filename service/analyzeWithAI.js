const OpenAI = require("openai");
const sharp = require("sharp");
require("dotenv").config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function normalizeBase64(input) {
  if (!input) return null;
  let b64 = String(input).trim();

  // Si viene como dataURL -> tomar solo el payload base64
  const m = b64.match(/^data:([^;]+);base64,(.*)$/i);
  if (m) b64 = m[2];

  // Quitar whitespaces (a veces llegan con saltos)
  b64 = b64.replace(/\s+/g, "");
  return b64;
}

function getMimeFromDataUrl(input) {
  if (!input) return null;
  const s = String(input).trim();
  const m = s.match(/^data:([^;]+);base64,/i);
  return m ? m[1].toLowerCase() : null;
}

// Detección por magic bytes (sin libs ESM)
function detectMimeFromBuffer(buf) {
  if (!buf || buf.length < 8) return "application/octet-stream";

  // PDF: %PDF-
  if (buf.slice(0, 5).toString("ascii") === "%PDF-") return "application/pdf";

  // JPG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((v, i) => buf[i] === v)) return "image/png";

  // GIF: GIF87a / GIF89a
  const gif = buf.slice(0, 6).toString("ascii");
  if (gif === "GIF87a" || gif === "GIF89a") return "image/gif";

  // WEBP: RIFF....WEBP
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }

  return "application/octet-stream";
}

function ensureImageDataUrl(base64Clean, mime = "image/png") {
  if (!base64Clean) return null;
  const b64 = String(base64Clean).trim();
  if (/^data:[^;]+;base64,/i.test(b64)) return b64;
  return `data:${mime};base64,${b64}`;
}

async function analyzeImage(base64Any, forcedMime = null) {
  try {
    const clean = normalizeBase64(base64Any);
    if (!clean) return { ok: false, error: "base64 vacío" };

    let mime = forcedMime || getMimeFromDataUrl(base64Any) || "image/png";

    // Normalizar/optimizar imagen para Vision (reduce tamaño y evita errores)
    const inputBuf = Buffer.from(clean, "base64");
    const optimized = await sharp(inputBuf)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const optimizedB64 = optimized.toString("base64");
    const dataUrl = ensureImageDataUrl(optimizedB64, "image/jpeg");
    mime = "image/jpeg";

    const resp = await client.responses.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Extrae la información relevante del documento/imagen. " +
                "Devuelve un JSON claro y estructurado (solo JSON). Agrega un key en el json llamado descripcion, donde resumas que es la imagen/documento." +
                "Si es nota/ticket agrega los keys relevantes de la nota. ",
            },
            { type: "input_image", image_url: dataUrl },
          ],
        },
      ],
    });

    const text = (resp && resp.output_text) ? resp.output_text.trim() : "";
    // Intento de parseo JSON, si no, regreso texto como summary
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (_) {}

    return { ok: true, mime, structured: parsed, summary: parsed ? null : text };
  } catch (err) {
    console.error("❌ analyzeImage error:", err);
    const msg = err?.error?.message || err.message || "Error analizando la imagen";
    return { ok: false, error: msg };
  }
}

async function analyzePdfText(extractedText, filename = "documento.pdf") {
  try {
    const prompt =
      "Vas a recibir texto extraído de un PDF. " +
      "Devuelve SOLO un JSON con datos relevantes. " +
      "Si es factura/nota: emisor, RFC, fecha, subtotal, impuestos, total, conceptos (si se detectan). " +
      "Si no encuentras algo, usa null.\n\n" +
      `FILENAME: ${filename}\n\n` +
      `TEXTO:\n${extractedText}`;

    const resp = await client.responses.create({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
      input: [{ role: "user", content: prompt }],
    });

    const out = (resp && resp.output_text) ? resp.output_text.trim() : "";
    let parsed = null;
    try {
      parsed = JSON.parse(out);
    } catch (_) {}

    return { ok: true, structured: parsed, summary: parsed ? null : out };
  } catch (err) {
    console.error("❌ analyzePdfText error:", err);
    const msg = err?.error?.message || err.message || "Error analizando el PDF";
    return { ok: false, error: msg };
  }
}

module.exports = {
  normalizeBase64,
  getMimeFromDataUrl,
  detectMimeFromBuffer,
  ensureImageDataUrl,
  analyzeImage,
  analyzePdfText,
};
