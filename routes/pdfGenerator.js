const express = require("express");
const router = express.Router();
const pdfMake = require("pdfmake/build/pdfmake");
const pdfFonts = require("pdfmake/build/vfs_fonts");

pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts.vfs;

// Helpers
const money = (n) =>
  Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function isoDateToday() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * @swagger
 * /generate-pdf:
 *   post:
 *     tags:
 *       - Prefacturas
 *     summary: "Genera una prefactura PDF (formato CFDI clásico) y devuelve base64"
 *     description: "Genera un PDF de prefactura con datos fiscales completos (incluye Clave ProdServ y Clave Unidad)."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Folio:
 *                 type: string
 *                 example: "S/N"
 *               Date:
 *                 type: string
 *                 example: "2026-01-11"
 *               CfdiType:
 *                 type: string
 *                 example: "I"
 *               ExpeditionPlace:
 *                 type: string
 *                 example: "20160"
 *               PaymentForm:
 *                 type: string
 *                 example: "01"
 *               PaymentMethod:
 *                 type: string
 *                 example: "PUE"
 *               Emisor:
 *                 type: object
 *                 properties:
 *                   Name:
 *                     type: string
 *                     example: "EMMANUEL DE JESUS RODRIGUEZ LUEVANO"
 *                   Rfc:
 *                     type: string
 *                     example: "ROLE930613SC5"
 *                   Address:
 *                     type: string
 *                     example: "CIRCUITO DE LAS PARRAS 402A, LAS VIÑAS, AGUASCALIENTES, CP: 20160"
 *                   FiscalRegime:
 *                     type: string
 *                     example: "626 - Régimen Simplificado de Confianza"
 *               Receiver:
 *                 type: object
 *                 properties:
 *                   Name:
 *                     type: string
 *                     example: "PUBLICO EN GENERAL"
 *                   Rfc:
 *                     type: string
 *                     example: "XAXX010101000"
 *                   CfdiUse:
 *                     type: string
 *                     example: "S01"
 *                   FiscalRegime:
 *                     type: string
 *                     example: "616"
 *                   TaxZipCode:
 *                     type: string
 *                     example: "20160"
 *               Items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     ProductCode:
 *                       type: string
 *                       description: "Clave ProdServ (obligatoria para estructura fiscal)."
 *                       example: "31162800"
 *                     UnitCode:
 *                       type: string
 *                       description: "Clave Unidad SAT (ej: H87)."
 *                       example: "H87"
 *                     Quantity:
 *                       type: number
 *                       example: 1
 *                     UnitPrice:
 *                       type: number
 *                       example: 3017.24
 *                     Subtotal:
 *                       type: number
 *                       example: 3017.24
 *                     Description:
 *                       type: string
 *                       example: "Bomba centrífuga 1/2 hp"
 *                     Taxes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           Total:
 *                             type: number
 *                             example: 482.76
 *     responses:
 *       200:
 *         description: "PDF generado en base64"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 nombreArchivo:
 *                   type: string
 *                 pdfBase64:
 *                   type: string
 *       500:
 *         description: "Error interno"
 */
router.post("/", async (req, res) => {
  try {
    const data = req.body || {};

    const emisor = data.Emisor || {};
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
    const cfdiType = (data.CfdiType || "I").toUpperCase();
    const expeditionPlace = data.ExpeditionPlace || "N/A";
    const paymentForm = data.PaymentForm || "01";
    const paymentMethod = data.PaymentMethod || "PUE";

    const efecto = cfdiType === "I" ? "I - Ingreso" : `${cfdiType}`;

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
              { text: emisor.Address || "" },
              { text: `Régimen Fiscal: ${emisor.FiscalRegime || "N/A"}` },
            ],
            [
              { text: `Folio: ${folio}`, alignment: "right" },
              { text: `Fecha: ${fecha}`, alignment: "right" },
              { text: `Lugar de Expedición: ${expeditionPlace}`, alignment: "right" },
              { text: `Efecto del comprobante: ${efecto}`, alignment: "right" },
            ],
          ],
        },

        { canvas: [{ type: "line", x1: 0, y1: 10, x2: 515, y2: 10 }] },
        { text: "\n" },

        { text: "Receptor:", style: "label" },
        { text: receptor.Name || "PUBLICO EN GENERAL" },
        { text: receptor.Rfc || "XAXX010101000" },
        { text: `Uso del CFDI: ${receptor.CfdiUse || "S01"}` },
        { text: `Régimen Fiscal: ${receptor.FiscalRegime || "616"}` },
        { text: `Código Postal: ${receptor.TaxZipCode || "N/A"}` },

        { text: "\n" },

        {
          table: {
            headerRows: 1,
            widths: [80, 45, 55, "*", 90, 80],
            body: [
              ["Clave ProdServ", "Cantidad", "Unidad", "Descripción", "Precio Unitario", "Importe"],
              ...items.map((it) => {
                const prodServ = it.ProductCode || "01010101"; // default SAT genérico
                const qty = Number(it.Quantity || 1);
                const unitCode = it.UnitCode || "H87"; // default Pieza
                const desc = it.Description || "N/A";
                const unitPrice = Number(it.UnitPrice || 0);
                const sub = Number(it.Subtotal || (qty * unitPrice) || 0);

                return [
                  prodServ,
                  String(qty),
                  unitCode,
                  desc,
                  money(unitPrice),
                  money(sub),
                ];
              }),
            ],
          },
          layout: "lightHorizontalLines",
        },

        { text: "\n" },

        {
          columns: [
            [
              { text: `Forma de Pago: ${paymentForm}` },
              { text: `Método de Pago: ${paymentMethod}` },
            ],
            [
              { text: `Subtotal: ${money(subtotal)}`, alignment: "right" },
              { text: `IVA (16%): ${money(iva)}`, alignment: "right" },
              { text: `Total: ${money(total)}`, alignment: "right", bold: true },
            ],
          ],
        },

        { text: "\n\n" },
        {
          text: "Este documento es una representación impresa de un CFDI.",
          italics: true,
          alignment: "center",
          fontSize: 9,
        },
      ],
      styles: {
        title: { fontSize: 16, bold: true },
        label: { bold: true },
      },
      defaultStyle: { fontSize: 10 },
    };

    pdfMake.createPdf(docDefinition).getBase64((base64) => {
      res.json({
        nombreArchivo: `prefactura_${Date.now()}.pdf`,
        pdfBase64: base64,
      });
    });
  } catch (err) {
    console.error("❌ Error generando prefactura:", err);
    res.status(500).json({ error: "Error generando la prefactura" });
  }
});

module.exports = router;
