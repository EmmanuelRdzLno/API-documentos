const pdfProcessor = require("../processors/pdfProcessor");
const imageProcessor = require("../processors/imageProcessor");
const csvProcessor = require("../processors/csvProcessor");
const mimeDetector = require("../utils/mimeDetector");

exports.process = async (base64) => {

  const cleanBase64 = base64.includes(",")
    ? base64.split(",")[1]
    : base64;

  const buffer = Buffer.from(cleanBase64, "base64");

  const mimeType = mimeDetector.detectMimeFromBuffer(buffer);

  console.log("MIME detectado:", mimeType);

  if (mimeType === "application/pdf") {
    return await pdfProcessor.process(buffer);
  }

  if (mimeType === "image/jpeg" || mimeType === "image/png") {
    return await imageProcessor.process(buffer);
  }

  if (mimeType === "text/csv") {
    return await csvProcessor.process(buffer);
  }

  throw new Error("Tipo de archivo no soportado");
};