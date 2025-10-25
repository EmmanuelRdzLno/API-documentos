const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));

// Rutas
const processFileRoutes = require('./routes/processFile');
const processImageNotaRoutes = require('./routes/processImageNota'); // 🔹 agrega esta línea
const processImageMedicosRoutes = require('./routes/processImageMedicos'); // 🔹 agrega esta línea
const generatePDFRoute = require('./routes/pdfGenerator'); // 🔹 agrega esta línea
const swaggerRoutes = require('./swagger/swaggerConfig');

app.use('/process-file', processFileRoutes);
app.use('/process-image/Nota', processImageNotaRoutes); // 🔹 monta la nueva ruta
app.use('/process-image', processImageMedicosRoutes); // 🔹 monta la nueva ruta
app.use('/generate-pdf', generatePDFRoute);
app.use('/api-docs', swaggerRoutes);

// Servidor
const WEB_PORT = process.env.WEB_PORT;
const WEB_HOST = process.env.WEB_HOST;
app.listen(WEB_PORT, () => console.log(`🚀 Servidor corriendo en ${WEB_HOST}/api-docs`));
