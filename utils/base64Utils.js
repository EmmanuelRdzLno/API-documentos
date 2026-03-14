function normalizeBase64(input) {

  if (!input) return null;

  let b64 = String(input).trim();

  const m = b64.match(/^data:([^;]+);base64,(.*)$/i);

  if (m) b64 = m[2];

  b64 = b64.replace(/\s+/g, "");

  return b64;

}

function ensureDataUrl(base64Clean, mime) {

  if (!base64Clean) return null;

  const b64 = String(base64Clean).trim();

  if (/^data:[^;]+;base64,/i.test(b64)) return b64;

  return `data:${mime};base64,${b64}`;

}

module.exports = {
  normalizeBase64,
  ensureDataUrl
};