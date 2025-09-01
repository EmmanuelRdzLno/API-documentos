const express = require('express');
const bodyParser = require('body-parser');
const Tesseract = require('tesseract.js');
const { fromBuffer } = require("pdf2pic");
const pdfParse = require("pdf-parse");
const fs = require('fs');
const path = require('path');
const { OpenAI } = require("openai");

const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

require('dotenv').config({ path: __dirname + '/.env' });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API- Documento a Texto",
      version: "1.0.0",
      description: "Procesa PDF o imágenes en base64, extrae texto y genera JSON con GPT",
    },
    servers: [{ url: "http://localhost:3030" }],
  },
  apis: [__filename],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Funciones auxiliares
function saveBase64File(base64, filename) {
  // Carpeta uploads dentro del proyecto
  const uploadsDir = path.join(__dirname, 'uploads');

  // Crear la carpeta si no existe
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }

  // Ruta final del archivo
  const filePath = path.join(uploadsDir, filename);

  // Guardar el archivo
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));

  return filePath; // Devuelve la ruta completa
}


async function analyzeWithAI_GPT_4o(text, model = "gpt-4o-mini") {
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "Eres un analista de documentos y OCR. Tendrás que procesar documentos entender el contexto y devolver su contenido en un formato json bien estructurado." },
      { role: "user", content: text }
    ],
    temperature: 0.7
  });
  return response.choices[0].message.content;
}

async function analyzeWithAI_GPT_5(text, model = "gpt-5") { 
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "Eres un experto OCR. Analizas imagenes y tienes la capacidad de entender a la perfeccion el contexto de las imagenes antes de convertirlo a texto." },
      { role: "user", content: text }
    ]
    // No se incluye 'temperature' porque GPT-5 solo acepta el valor por defecto
  });

  return response.choices[0].message.content;
}

/**
 * @swagger
 * /process-file:
 *   post:
 *     summary: Procesa un PDF o imagen en base64 y devuelve texto extraído y JSON estructurado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               base64:
 *                 type: string
 *                 description: Archivo en base64 (PDF o imagen)
 *     responses:
 *       200:
 *         description: Texto extraído y análisis AI
 */
app.post('/process-file', async (req, res) => {
  try {
    let { base64 } = req.body;
    if (!base64) return res.status(400).json({ error: 'No se recibió base64' });
    if (base64.includes(',')) base64 = base64.split(',')[1];

    const buffer = Buffer.from(base64, 'base64');
    const fileName = `file_${Date.now()}`;
    let extractedText = "";
    let aiModel = "gpt-4o-mini"; // Por defecto para PDF
    let aiPrompt = ""; // Prompt por defecto
    let aiResult = "";
    
    
    if (buffer.slice(0, 4).toString() === '%PDF') {
  // PDF
  const pdfData = await pdfParse(buffer);
  extractedText = pdfData.text.trim();

    if (!extractedText) {
        // OCR PDF
        const options = { density: 300, format: "png", width: 1200, height: 1600 };
        const convert = fromBuffer(buffer, options);
        let pageNum = 1;
        let ocrText = "";
        while (true) {
          try {
            const page = await convert(pageNum);
            const { data: { text } } = await Tesseract.recognize(page.path, 'spa');
            ocrText += text + "\n";
            pageNum++;
          } catch {
            break;
          }
        }
        extractedText = ocrText.trim();
      }

      // Guardar PDF temporalmente
      const pdfPath = saveBase64File(base64, `${fileName}.pdf`);

      // Prompt para GPT sin incluir el texto en la respuesta final
      aiPrompt = `Analiza el siguiente la informacion del documento PDF y solo devuelve un JSON estructurado por claves con la información.
                  Agrega una clave llamada 'Descripcion' donde describas de manera breve el contexto del documento.
                  Si algún valor es desconocido, deja la clave con valor vacío ("").

                  Texto:
                """${extractedText}"""
                `;

      aiResult = await analyzeWithAI_GPT_4o(aiPrompt, aiModel);

      // Eliminar el PDF temporal
      try {
        fs.unlinkSync(pdfPath);
        console.log(`PDF temporal eliminado: ${pdfPath}`);
      } catch (err) {
        console.error(`Error eliminando PDF: ${err}`);
      }
    }
    else {
      const imagePath = `uploads/${fileName}.png`;

      // Guardar imagen en disco
      const fs = require('fs');
      fs.writeFileSync(imagePath, buffer);

      // Aquí NO usamos Tesseract, GPT-5 analizará la imagen directamente
      aiModel = "gpt-5";
      aiPrompt = `Extrae todo el texto de esta imagen y devuélvelo en formato JSON organizando las claves de acuerdo al contexto de la imagen. 
                  Adicionalmente, agrega una clave llamada 'Descripcion' donde devuelvas el contexto que entendiste de la imagen.
                  Responde solo con JSON válido y formateado.
                  `;

      // Convertir imagen a base64 para enviarla a GPT-5
      const imageBase64 = buffer.toString('base64');

      // Llamada multimodal a GPT-5
      const response = await openai.chat.completions.create({
        model: aiModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: aiPrompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`
                }
              }
            ]
          }
        ]
      });
      aiResult = response.choices[0].message.content;

      // Borrar la imagen después de procesarla
      try {
        fs.unlinkSync(imagePath);
        console.log(`Imagen temporal eliminada: ${imagePath}`);
      } catch (err) {
        console.error(`Error eliminando imagen: ${err}`);
      }
    }

    
    const cleanedResult = aiResult.replace(/```json\s*/g, '').replace(/```/g, '').trim();

    let structuredJSON;
    try { structuredJSON = JSON.parse(cleanedResult); } 
    catch { structuredJSON = {}; }

    res.json({ structuredJSON, file: fileName });
  } catch (error) {
    console.error('❌ Error procesando archivo:', error);
    res.status(500).json({ error: error.message });
  }
});


// Servidor
const PORT = process.env.PORT || 3030;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}/api-docs`));
