const fs = require("fs");
const path = require("path");

function loadReferenceImages() {

  try {

    const folder = path.join(__dirname, "../references");

    if (!fs.existsSync(folder)) return [];

    const files = fs.readdirSync(folder).filter(f =>
      f.endsWith(".jpg") ||
      f.endsWith(".jpeg") ||
      f.endsWith(".png")
    );

    const images = [];

    for (const file of files) {

      const filePath = path.join(folder, file);

      const buffer = fs.readFileSync(filePath);

      const base64 = buffer.toString("base64");

      const mime = file.endsWith(".png")
        ? "image/png"
        : "image/jpeg";

      images.push({
        type: "input_image",
        image_url: `data:${mime};base64,${base64}`
      });

    }

    return images;

  } catch (err) {

    console.error("❌ Error loading reference images:", err);

    return [];

  }

}

module.exports = { loadReferenceImages };