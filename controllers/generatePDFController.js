const pdfService = require("../services/pdfService");

exports.generate = async (req, res) => {
  try {

    const result = await pdfService.generate(req.body);

    res.json(result);

  } catch (error) {

    console.error("❌ Error generando prefactura:", error);

    res.status(500).json({
      error: "Error generando la prefactura"
    });

  }
};