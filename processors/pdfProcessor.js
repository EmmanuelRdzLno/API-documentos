const client = require("../services/openaiClient");

const { normalizeBase64 } = require("../utils/base64Utils");
const safeJsonParse = require("../utils/safeJsonParse");

const getPdfPrompt = require("../prompts/pdfPrompt");

exports.process = async (buffer) => {

  try {

    // convertir buffer a base64
    const base64 = buffer.toString("base64");

    // limpiar base64 si viene con caracteres extra
    const clean = normalizeBase64(base64);

    // crear dataURL del pdf
    const dataUrl = `data:application/pdf;base64,${clean}`;

    const resp = await client.responses.create({

      model: process.env.OPENAI_VISION_MODEL || "gpt-5.2",

      temperature: 0,

      max_output_tokens: 2000,

      text: { format: { type: "json_object" } },

      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: getPdfPrompt()
            },
            {
              type: "input_file",
              filename: "document.pdf",
              file_data: dataUrl
            }
          ]
        }
      ]

    });

    const text = resp.output_text;

    return {
      ok: true,
      type: "pdf",
      structured: safeJsonParse(text)
    };

  } catch (err) {

    console.error("❌ analyzePDF:", err);

    return {
      ok: false,
      error: err.message
    };

  }

};