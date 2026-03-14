const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();

// Rutas
const processDocumentRoute = require("./routes/processDocument");

// Swagger
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const prefacturaRoutes = require("./routes/prefacturaRoutes");

const app = express();

app.use(bodyParser.json({ limit: "80mb" }));
app.use(bodyParser.urlencoded({ limit: "80mb", extended: true }));

// ===== Configuración Swagger =====
const swaggerOptions = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "API de Documentos",
      version: "1.0.0",
      description: "API para procesar documentos (imagen, PDF, CSV) con IA",
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3030}`,
      },
    ],
  },
  apis: ["./routes/*.js"], // toma las rutas con los comentarios Swagger
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/generate-pdf", prefacturaRoutes);
// ===== Rutas =====
app.use("/process-document", processDocumentRoute);

const PORT = process.env.PORT || 3030;

app.listen(PORT, () => {
  console.log(`🚀 API corriendo en http://localhost:${PORT}`);
  console.log(`📄 Documentación Swagger disponible en http://localhost:${PORT}/api-docs`);
});