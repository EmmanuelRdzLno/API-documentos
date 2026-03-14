const imageProcessor = require("./imageProcessor");
const pdfProcessor = require("./pdfProcessor");
const csvProcessor = require("./csvProcessor");

module.exports = {

  "image/jpeg": imageProcessor,
  "image/png": imageProcessor,

  "application/pdf": pdfProcessor,

  "text/csv": csvProcessor

};