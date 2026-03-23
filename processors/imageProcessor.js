const sharp = require("sharp");
const client = require("../services/openaiClient");

const { loadReferenceImages } = require("../utils/referenceLoader");
const { normalizeBase64, ensureDataUrl } = require("../utils/base64Utils");
const safeJsonParse = require("../utils/safeJsonParse");

const getImagePrompt = require("../prompts/imagePrompt");
const { getFiscalDataPrompt } = require("../prompts/imagePrompt");

// Tipos de imagen que deben usar extracción de datos fiscales del receptor
const FISCAL_TIPOS = ["datos_fiscales_receptor", "constancia_fiscal"];

/**
 * Clasifica el tipo de imagen con una llamada ligera al modelo vision.
 * Retorna uno de: ticket_recibo | datos_fiscales_receptor | constancia_fiscal |
 *                 cotizacion | otro
 * En caso de fallo retorna "ticket_recibo" para preservar el comportamiento previo.
 */
async function classifyImageType(dataUrl) {
  try {
    const resp = await client.responses.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-5.2",
      temperature: 0,
      max_output_tokens: 20,
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Analiza esta imagen y determina qué tipo de documento es.
Responde ÚNICAMENTE con uno de estos valores exactos, sin explicaciones adicionales:
ticket_recibo
datos_fiscales_receptor
constancia_fiscal
cotizacion
otro`,
          },
          { type: "input_image", image_url: dataUrl },
        ],
      }],
    });
    const raw = (resp.output_text || "").trim().toLowerCase();
    const VALID = ["ticket_recibo", "datos_fiscales_receptor",
                   "constancia_fiscal", "cotizacion", "otro"];
    return VALID.find(t => raw.includes(t)) || "ticket_recibo";
  } catch (err) {
    console.warn("[DOCUMENTOS] classify falló, usando ticket_recibo por defecto:", err.message);
    return "ticket_recibo";
  }
}

exports.process = async (buffer) => {

  try {

    const base64 = buffer.toString("base64");

    const clean = normalizeBase64(base64);

    const inputBuf = Buffer.from(clean, "base64");

    let optimized;

    try {

      optimized = await sharp(inputBuf)
        .rotate()
        .resize({ width: 1800, withoutEnlargement: true })
        .grayscale()
        .normalize()
        .sharpen()
        .jpeg({ quality: 90 })
        .toBuffer();

    } catch {

      optimized = inputBuf;

    }

    const optimizedB64 = optimized.toString("base64");

    const dataUrl = ensureDataUrl(optimizedB64, "image/jpeg");

    const referenceImages = loadReferenceImages();

    // Clasificar el tipo de imagen antes de extraer
    const tipoImagen = await classifyImageType(dataUrl);
    console.log(`[DOCUMENTOS] image clasificado como ${tipoImagen}`);

    const esFiscal = FISCAL_TIPOS.includes(tipoImagen);
    const prompt = esFiscal ? getFiscalDataPrompt() : getImagePrompt();

    const resp = await client.responses.create({

      model: process.env.OPENAI_VISION_MODEL || "gpt-5.2",

      temperature: 0,

      max_output_tokens: 2000,

      text: { format: { type: "json_object" } },

      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: dataUrl },
            // Las imágenes de referencia son ejemplos de tickets; no aplican para documentos fiscales
            ...(esFiscal ? [] : referenceImages),
          ],
        }
      ]

    });

    const text = resp.output_text;
    const structured = safeJsonParse(text);

    if (esFiscal) {
      const recv = (structured || {}).receiver || {};
      const extracted = Object.keys(recv).filter(k => recv[k] != null).map(k => `receiver.${k}`);
      if (extracted.length) {
        console.log(`[DOCUMENTOS] campos extraídos: ${extracted.join(", ")}`);
      } else {
        console.warn("[DOCUMENTOS] tipo fiscal detectado pero no se extrajeron campos del receiver");
      }
    }

    return {
      ok: true,
      type: "image",
      structured,
    };

  } catch (err) {

    console.error("❌ analyzeImage:", err);

    return { ok: false, error: err.message };

  }

};