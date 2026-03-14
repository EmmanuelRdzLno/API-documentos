module.exports = function getPdfPrompt() {

  return `
Analiza el siguiente documento PDF.

Extrae la información relevante del documento y devuelve los datos en formato JSON estructurado.

Responde únicamente con JSON válido.

necesito que me ponga una variable la cual sera Descripcion y contendra una descripcion del archivo que esta leyendo.
`;

};