const express = require("express");
const router = express.Router();
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
require("dotenv").config();

const WEB_HOST = process.env.WEB_HOST || "http://localhost:3030";

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API - Documentos",
      version: "1.0.0",
      description: "Procesa PDFs o imágenes en base64, extrae texto y genera JSON con IA. También genera prefacturas en PDF.",
    },
    servers: [{ url: WEB_HOST }],
  },
  apis: [
    "./routes/processFile.js",
    "./routes/processImageNota.js",
    "./routes/processImageMedicos.js",
    "./routes/pdfGenerator.js",
  ],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
router.use("/", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

module.exports = router;
