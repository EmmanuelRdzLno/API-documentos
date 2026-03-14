const Papa = require("papaparse");
const { chunkArray } = require("../utils/batcher");

exports.process = async (buffer) => {

  const csvString = buffer.toString("utf8");

  const parsed = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true
  });

  const items = parsed.data;

  // tamaño máximo por batch
  const MAX_BATCH_SIZE = 50;

  // dividir array
  const batchesArray = chunkArray(items, MAX_BATCH_SIZE);

  // convertir a batch1, batch2, batch3...
  const batches = {};

  batchesArray.forEach((batch, index) => {
    batches[`batch${index + 1}`] = batch;
  });

  return {
    ok: true,
    type: "csv",
    total_items: items.length,
    max_batch_size: MAX_BATCH_SIZE,
    total_batches: batchesArray.length,
    batches
  };

};