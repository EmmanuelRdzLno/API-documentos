const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();

// Importante: base64 de PDFs crece ~33%.
// 50mb suele ser suficiente, pero si mandas PDFs grandes súbelo.
app.use(bodyParser.json({ limit: process.env.JSON_LIMIT || "80mb" }));

// Rutas
const processFileRoutes = require("./routes/processFile");
const processImageNotaRoutes = require("./routes/processImageNota");
const processImageMedicosRoutes = require("./routes/processImageMedicos");
const generatePDFRoute = require("./routes/pdfGenerator");
const swaggerRoutes = require("./swagger/swaggerConfig");

app.use("/process-file", processFileRoutes);
app.use("/process-image/Nota", processImageNotaRoutes);
app.use("/process-image", processImageMedicosRoutes);
app.use("/generate-pdf", generatePDFRoute);
app.use("/api-docs", swaggerRoutes);

const WEB_PORT = process.env.WEB_PORT || 3030;
const WEB_HOST = process.env.WEB_HOST || `http://localhost:${WEB_PORT}`;

app.listen(WEB_PORT, () => console.log(`🚀 Servidor corriendo en ${WEB_HOST}/api-docs`));
