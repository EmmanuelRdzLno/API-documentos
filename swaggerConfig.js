// swaggerConfig.js
const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Document Reader API',
    version: '1.0.0',
    description: 'Servicio para extraer texto de archivos en base64',
  },
  servers: [
    {
      url: 'http://localhost:3030',
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./server.js'], // Aquí se generan los docs con los comentarios de server.js
};

module.exports = swaggerJSDoc(options);
