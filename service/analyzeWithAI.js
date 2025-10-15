// service/analyzeWithAI.js
const OpenAI = require("openai");
const sharp = require("sharp");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Normaliza base64: quita encabezados y espacios
function normalizeBase64(input) {
  if (!input) return null;
  let b64 = String(input).trim();
  // quita data:*;base64,
  const m = b64.match(/^data:[^;]+;base64,(.*)$/i);
  if (m) b64 = m[1];
  // quita whitespaces / saltos
  b64 = b64.replace(/\s+/g, "");
  return b64;
}

const SUPPORTED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXT_TO_MIME = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif"
};

/**
 * Valida un base64 como imagen, detecta su formato real con sharp y,
 * si no está soportado, lo re-encodea a PNG. Devuelve { dataUrl, mime }
 */
async function ensureImageDataUrl(base64Str, hintedMime) {
  const clean = normalizeBase64(base64Str);
  if (!clean) {
    throw new Error("Imagen base64 vacía o inválida.");
  }

  let buf;
  try {
    buf = Buffer.from(clean, "base64");
  } catch {
    throw new Error("No se pudo decodificar base64 de la imagen.");
  }

  let meta;
  try {
    meta = await sharp(buf).metadata();
  } catch (e) {
    throw new Error("El buffer no corresponde a una imagen válida.");
  }

  // mime por metadata (sharp)
  let detectedMime = EXT_TO_MIME[meta.format] || hintedMime || "image/png";

  let outBuf = buf;
  let outMime = detectedMime;

  // Si el formato no está soportado, reconvertimos a PNG
  if (!SUPPORTED_MIME.has(detectedMime)) {
    outBuf = await sharp(buf).png().toBuffer();
    outMime = "image/png";
  }

  const outB64 = outBuf.toString("base64");
  const dataUrl = `data:${outMime};base64,${outB64}`;

  return { dataUrl, mime: outMime };
}

/**
 * Analiza imagen con OpenAI (Responses API + input_image).
 * inputBase64: base64 con o sin dataURL
 * hintMime: mime opcional recibido a priori (no es obligatorio)
 */
async function analyzeImage(inputBase64, hintMime) {
  const { dataUrl, mime } = await ensureImageDataUrl(inputBase64, hintMime);

  try {
    const resp = await client.responses.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-5",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Extrae texto clave y da un breve resumen del contenido de la imagen." },
            { type: "input_image", image_url: dataUrl }
          ]
        }
      ]
    });

    const text = resp?.output_text ?? "";
    return { ok: true, mime, summary: text };
  } catch (err) {
    console.error("❌ error imagen", err);
    const msg = err?.error?.message || err.message || "Error analizando la imagen";
    return { ok: false, error: msg };
  }
}

module.exports = { analyzeImage, ensureImageDataUrl, normalizeBase64 };
