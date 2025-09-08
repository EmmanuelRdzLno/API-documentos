require('dotenv').config({ path: __dirname + '/../.env' });
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Utilidad para parsear JSON seguro
 */
function tryParseJSON(content) {
  try {
    return JSON.parse(content);
  } catch {
    return { error: "No se pudo parsear la respuesta como JSON", raw: content };
  }
}

/**
 * 🔹 Analizar texto (ej: OCR de PDF o imagen ya procesada)
 */
async function analyzeText(ocrText) {
  const prompt = `
Eres un experto en análisis de documentos. 
A partir del siguiente texto extraído de una imagen o PDF, 
extrae e interpreta las variables clave y devuélvelas en formato JSON estructurado. 

⚠️ Importante:
- NO devuelvas explicaciones ni texto adicional
- SOLO el JSON válido

Texto:
"""
${ocrText}
"""

Ejemplo de salida esperada:
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
    return tryParseJSON(response.choices[0].message.content);
  } catch (error) {
    console.error("❌ Error en analyzeText:", error);
    throw error;
  }
}

/**
 * 🔹 Analizar imagen genérica (foto, captura, escaneo, etc.)
 */
async function analyzeImage(imageBase64) {
  const prompt = `
Extrae todo el texto de esta imagen y devuélvelo en formato JSON estructurado.
- Usa claves organizadas de acuerdo al contexto.
- Agrega una clave "Descripcion" donde expliques brevemente de qué trata la imagen.
- Responde únicamente con JSON válido.
`;
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } }
          ]
        }
      ]
    });
    return tryParseJSON(response.choices[0].message.content);
  } catch (error) {
    console.error("❌ Error en analyzeImage:", error);
    throw error;
  }
}

/**
 * 🔹 Analizar PDF (texto ya extraído previamente por pdf-parse o Tesseract)
 */
async function analyzePDF(pdfText) {
  const prompt = `
Eres un asistente experto en análisis de documentos.
Tu tarea:

1. Analizar el texto del PDF que te paso a continuación.
2. Extrae toda la información relevante y organízala en un JSON estructurado con claves que tengan sentido según el contenido.
3. Agrega una clave "Descripcion" que resuma brevemente de qué trata el documento.
4. Agrega una clave "TipoDocumento" indicando si es factura, contrato, informe, recibo, etc.
5. Responde únicamente con JSON válido, sin explicaciones ni texto adicional.

Texto del PDF:
"""${pdfText}"""
  `;

console.log('si entro a la funcion analize pdf');
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });
    return (response.choices[0].message.content);
  } catch (error) {
    console.error("❌ Error en analyzePDF:", error);
    throw error;
  }
}

/**
 * 🔹 Analizar imágenes médicas (ej: rayos X, TAC, resonancia, etc.)
 */
async function analyzeMedicalImage(imageBase64) {
  const prompt = `
Eres un experto en análisis de documentos a partir de imágenes. Tu tarea es analizar cualquier documento en la imagen que se te proporcione y devolver **un JSON completamente estructurado** con toda la información relevante que detectes, sin limitarte a campos predefinidos. 

Requisitos:

1. Analiza el documento completo: texto, tablas, números, fechas, nombres, direcciones, montos, códigos, sellos, logos o cualquier elemento visible.
2. Organiza la información en un JSON jerárquico, agrupando los datos relacionados de forma lógica.
3. Incluye automáticamente secciones, campos y valores según la información encontrada. No pongas null si no hay datos; simplemente omite los campos que no existan.
4. Incluye siempre:
   - descripcion: breve descripción del contenido del documento.
   - texto_detectado: todo el texto legible extraído de la imagen.
   - detalles: un objeto que contenga la información clave organizada en secciones según el tipo de datos que aparezcan.
   - otros_elementos: logos, sellos, firmas, códigos QR, códigos de barras u otros elementos visuales importantes.
5. Devuelve **solo un JSON válido**, sin explicaciones, sin texto adicional ni comentarios.

Ejemplo de salida (solo para referencia, el JSON real debe variar según la imagen):

{
  "descripcion": "Factura de supermercado con productos y total",
  "texto_detectado": "Factura No. 12345\nFecha: 01/09/2025\nProveedor: Super Tienda S.A.\nTotal: $1500\nProductos: 2x Lápiz, 3x Cuaderno",
  "detalles": {
    "factura": {
      "numero": "12345",
      "fecha": "01/09/2025",
      "proveedor": "Super Tienda S.A.",
      "total": "$1500"
    },
    "productos": [
      { "nombre": "Lápiz", "cantidad": 2 },
      { "nombre": "Cuaderno", "cantidad": 3 }
    ]
  },
  "otros_elementos": {
    "logo": "Super Tienda S.A.",
    "sello": null,
    "firma": null
  }
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } }
          ]
        }
      ]
    });
    return tryParseJSON(response.choices[0].message.content);
  } catch (error) {
    console.error("❌ Error en analyzeMedicalImage:", error);
    throw error;
  }
}

module.exports = { 
  analyzeText, 
  analyzeImage, 
  analyzePDF, 
  analyzeMedicalImage 
};
