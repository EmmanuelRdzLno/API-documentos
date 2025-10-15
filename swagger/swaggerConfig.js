// swagger/swaggerConfig.js
const express = require('express');
const router = express.Router();
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API - Documento a Texto",
      version: "1.0.0",
      description: "Procesa PDFs o imágenes en base64, extrae texto y genera JSON con GPT",
    },
    servers: [
      { url: "http://localhost:3030" },
    ],
  },
  apis: [
    './routes/processFile.js',       // documentación de la ruta /process-file
    './routes/processImageNota.js',  // documentación de la ruta /process-image-nota
    './routes/processImageMedicos.js',  // documentación de la ruta /process-image-nota
    './routes/pdfGenerator.js',  // documentación de la ruta /process-image-nota
  ],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

// Montar Swagger en la ruta /api-docs
router.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

module.exports = router;
