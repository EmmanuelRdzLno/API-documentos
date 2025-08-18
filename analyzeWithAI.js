// analyzeWithAI.js
require('dotenv').config({ path: __dirname + '/.env' });
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function analyzeWithAI(ocrText) {
  const prompt = `
Eres un experto en análisis de documentos. A partir del siguiente texto extraído de una imagen escaneada, extrae e interpreta las variables clave y devuélvelas en formato JSON estructurado. NO devuelvas explicaciones ni texto adicional, SOLO el JSON.

Texto:
"""
${ocrText}
"""

Ejemplo de salida esperada (ajústalo según el documento):
{
  "nombre": "Juan Pérez",
  "fecha": "12 de agosto de 2025",
  "empresa": "ACME Corp",
  "monto": "$1200",
  "concepto": "consultoría",
  "referencias": ["Factura 123", "Cliente 456"]
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });

    const content = response.choices[0].message.content;

    try {
      return JSON.parse(content);
    } catch {
      return { error: "No se pudo parsear la respuesta como JSON", respuesta: content };
    }
  } catch (error) {
    console.error("❌ Error al consultar OpenAI:", error);
    throw new Error('Error al analizar con ChatGPT');
  }
}

module.exports = analyzeWithAI;
