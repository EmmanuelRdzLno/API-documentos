const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));

// Rutas
const processFileRoutes = require('./routes/processFile');
const processImageNotaRoutes = require('./routes/processImageNota'); // 🔹 agrega esta línea
const processImageMedicosRoutes = require('./routes/processImageMedicos'); // 🔹 agrega esta línea
const swaggerRoutes = require('./swagger/swaggerConfig');

app.use('/process-file', processFileRoutes);
app.use('/process-image/Nota', processImageNotaRoutes); // 🔹 monta la nueva ruta
app.use('/process-image', processImageMedicosRoutes); // 🔹 monta la nueva ruta
app.use('/api-docs', swaggerRoutes);

// Servidor
const PORT = process.env.PORT || 3030;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}/api-docs`));
