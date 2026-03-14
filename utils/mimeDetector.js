exports.detectMimeFromBuffer = (buf) => {

  // PDF
  if (buf.slice(0,4).toString() === "%PDF") {
    return "application/pdf";
  }

  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    return "image/jpeg";
  }

  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4E &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }

  // CSV
  let fileContent = buf.toString("utf8", 0, 200);

  // eliminar BOM
  fileContent = fileContent.replace(/^\uFEFF/, '');

  if (fileContent.includes(",") && fileContent.includes("\n")) {
    return "text/csv";
  }

  return "application/octet-stream";
};