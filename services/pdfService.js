const pdfMake = require("pdfmake/build/pdfmake");
const pdfFonts = require("pdfmake/build/vfs_fonts");

pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts.vfs;

const money = (n) =>
  Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function isoDateToday() {
  return new Date().toISOString().slice(0, 10);
}

exports.generate = async (data) => {

  const emisor = data.Issuer || {};
  const receptor = data.Receiver || {};
  const items = Array.isArray(data.Items) ? data.Items : [];

  const subtotal = items.reduce((acc, it) => acc + Number(it.Subtotal || 0), 0);

  const iva = items.reduce((acc, it) => {
    const taxes = Array.isArray(it.Taxes) ? it.Taxes : [];
    return acc + taxes.reduce((a, t) => a + Number(t.Total || 0), 0);
  }, 0);

  const total = subtotal + iva;

  const folio = data.Folio || "S/N";
  const fecha = data.Date || isoDateToday();

  const docDefinition = {
    pageMargins: [40, 40, 40, 40],
    content: [
      { text: "PREFACTURA", style: "title", alignment: "center" },
      { text: "\n" },

      {
        columns: [
          [
            { text: "Emisor:", style: "label" },
            { text: emisor.Name || "N/A" },
            { text: emisor.Rfc || "N/A" },
            { text: emisor.Address || "" }
          ],
          [
            { text: `Folio: ${folio}`, alignment: "right" },
            { text: `Fecha: ${fecha}`, alignment: "right" }
          ]
        ]
      },

      { text: "\n" },

      {
        table: {
          headerRows: 1,
          widths: [80, 45, "*", 90, 80],
          body: [
            ["Clave", "Cantidad", "Descripción", "Precio", "Importe"],
            ...items.map((it) => {
              const qty = Number(it.Quantity || 1);
              const unitPrice = Number(it.UnitPrice || 0);
              const sub = Number(it.Subtotal || (qty * unitPrice));

              return [
                it.ProductCode || "01010101",
                String(qty),
                it.Description || "N/A",
                money(unitPrice),
                money(sub)
              ];
            })
          ]
        }
      },

      { text: "\n" },

      {
        columns: [
          {},
          [
            { text: `Subtotal: ${money(subtotal)}`, alignment: "right" },
            { text: `IVA: ${money(iva)}`, alignment: "right" },
            { text: `Total: ${money(total)}`, alignment: "right", bold: true }
          ]
        ]
      }
    ],
    styles: {
      title: { fontSize: 16, bold: true },
      label: { bold: true }
    },
    defaultStyle: { fontSize: 10 }
  };

  return new Promise((resolve) => {

    pdfMake.createPdf(docDefinition).getBase64((base64) => {

      resolve({
        nombreArchivo: `prefactura_${Date.now()}.pdf`,
        pdfBase64: base64
      });

    });

  });

};