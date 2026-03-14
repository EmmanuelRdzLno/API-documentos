const documentProcessor = require("../services/documentProcessor");

exports.processDocument = async (req, res) => {
  try {
    const { base64 } = req.body;

    if (!base64) {
      return res.status(400).json({
        error: "Se requiere base64",
      });
    }

    // Llamar a la función process de documentProcessor para procesar el archivo
    const result = await documentProcessor.process(base64);

    res.json(result); // Retornar el resultado procesado

  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({
      error: err.message, // Enviar el mensaje de error si ocurre
    });
  }
};