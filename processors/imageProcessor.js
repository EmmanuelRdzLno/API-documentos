const sharp = require("sharp");
const client = require("../services/openaiClient");

const { loadReferenceImages } = require("../utils/referenceLoader");
const { normalizeBase64, ensureDataUrl } = require("../utils/base64Utils");
const safeJsonParse = require("../utils/safeJsonParse");

const getImagePrompt = require("../prompts/imagePrompt");

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

    const resp = await client.responses.create({

      model: process.env.OPENAI_VISION_MODEL || "gpt-5.2",

      temperature: 0,

      max_output_tokens: 2000,

      text: { format: { type: "json_object" } },

      input: [
        {
            role: "user",
            content: [
            { type: "input_text", text: getImagePrompt() }, // aquí se usa tu prompt completo
            { type: "input_image", image_url: dataUrl },
            ...referenceImages
            ]
        }
        ]

    });

    const text = resp.output_text;

    return {
      ok: true,
      type: "image",
      structured: safeJsonParse(text)
    };

  } catch (err) {

    console.error("❌ analyzeImage:", err);

    return { ok: false, error: err.message };

  }

};