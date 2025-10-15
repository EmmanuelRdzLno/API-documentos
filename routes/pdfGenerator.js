const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
const { Buffer } = require('buffer');

pdfMake.vfs = pdfFonts.vfs || pdfFonts.pdfMake?.vfs; // Soporte para pdfmake 0.1.x y 0.2.x

// Helpers de normalización (pegar arriba del handler POST)

function mapCfdiTypeToEfecto(cfdiType) {
  // Mapea Facturama-like a descripción legible
  switch ((cfdiType || '').toUpperCase()) {
    case 'I': return 'I - Ingreso';
    case 'E': return 'E - Egreso';
    case 'T': return 'T - Traslado';
    case 'N': return 'N - Nómina';
    case 'P': return 'P - Pago';
    default:  return cfdiType || 'I - Ingreso';
  }
}

function isOrquestadorPayload(data) {
  // Detecta payload con estructura del orquestador (Facturama-like)
  return data && Array.isArray(data.Items) && data.Receiver;
}

// Normaliza a estructura homogénea que usa el PDF
function normalizePayload(data) {
  // Datos del emisor: vienen por env o por el payload legacy
  const EMISOR_NOMBRE   = process.env.EMISOR_NOMBRE   || data.emisor || 'EMMANUEL DE JESUS RODRIGUEZ LUEVANO';
  const EMISOR_RFC      = process.env.EMISOR_RFC      || data.rfcEmisor || 'ROLE930613SC5';
  const EMISOR_DIR      = process.env.EMISOR_DIR      || data.direccionEmisor || 'CIRCUITO DE LAS PARRAS 402A, LAS VIÑAS, AGUASCALIENTES, CP: 20160';
  const EMISOR_REGIMEN  = process.env.EMISOR_REGIMEN  || data.regimenEmisor || '626 - Régimen Simplificado de Confianza';

  if (isOrquestadorPayload(data)) {
    // --- Formato del orquestador (Facturama-like) ---
    const rcv = data.Receiver || {};
    const items = Array.isArray(data.Items) ? data.Items : [];

    // Totales desde Items: prioriza Subtotal/Total de cada item si existen
    let subtotal = 0;
    let iva = 0;
    let total = 0;

    const tableItems = items.map((it) => {
      const qty = Number(it.Quantity || 0);
      const unitPrice = Number(it.UnitPrice || 0);
      const lineSubtotal = it.Subtotal != null ? Number(it.Subtotal) : qty * unitPrice;
      const lineTotal = it.Total != null ? Number(it.Total) : qty * unitPrice; // si Total no viene, aprox = qty*unitPrice

      subtotal += lineSubtotal;
      total    += lineTotal;

      // IVA por línea si viene en Taxes
      if (Array.isArray(it.Taxes)) {
        for (const tx of it.Taxes) {
          const isRetention = !!tx.IsRetention;
          const name = (tx.Name || '').toUpperCase();
          const taxTotal = Number(tx.Total || 0);
          if (!isRetention && name === 'IVA') {
            iva += taxTotal;
          }
        }
      }

      return {
        clave: it.ProductCode || '40141700',
        cantidad: qty,
        unidad: it.Unit || 'Pieza',
        descripcion: it.Description || '',
        precio_unitario: unitPrice,
        importe: lineTotal // mostrar importe total de la línea
      };
    });

    // Si no vino IVA por Taxes, calcúlalo (16%) como fallback sobre subtotal
    if (iva === 0 && subtotal > 0) {
      iva = +(subtotal * 0.16).toFixed(2);
    }
    // Si total no cuadra, ajusta (mejor tener un valor consistente)
    if (total === 0 && subtotal > 0) total = subtotal + iva;

    return {
      emisor: EMISOR_NOMBRE,
      rfcEmisor: EMISOR_RFC,
      direccionEmisor: EMISOR_DIR,
      regimenEmisor: EMISOR_REGIMEN,

      cliente: rcv.Name || 'CLIENTE',
      rfcReceptor: rcv.Rfc || 'XAXX010101000',
      regimenReceptor: rcv.FiscalRegime || '601',
      usoCfdi: rcv.CfdiUse || 'G03',
      cpReceptor: rcv.TaxZipCode || data.ExpeditionPlace || '00000',

      folio: data.Folio || data.FolioNumber || 'S/N',
      fecha: data.Date || new Date().toISOString().slice(0,10),
      lugarExpedicion: data.ExpeditionPlace || rcv.TaxZipCode || '00000',
      efecto: mapCfdiTypeToEfecto(data.CfdiType || 'I'),

      formaPago: data.PaymentForm || '01',
      metodoPago: data.PaymentMethod || 'PUE',

      items: tableItems,
      totales: { subtotal, iva, total }
    };
  }

  // --- Formato legacy (tu esquema en español) ---
  const itemsLegacy = Array.isArray(data.items) ? data.items : [];
  const tableItems = itemsLegacy.map((it) => ({
    clave: it.clave || '40141700',
    cantidad: Number(it.cantidad || 0),
    unidad: it.unidad || 'Pieza',
    descripcion: it.descripcion || '',
    precio_unitario: Number(it.precio_unitario || 0),
    importe: Number(it.cantidad || 0) * Number(it.precio_unitario || 0)
  }));

  const subtotal = tableItems.reduce((acc, i) => acc + i.importe, 0);
  const iva = +(subtotal * 0.16).toFixed(2);
  const total = subtotal + iva;

  return {
    emisor: EMISOR_NOMBRE,
    rfcEmisor: EMISOR_RFC,
    direccionEmisor: EMISOR_DIR,
    regimenEmisor: EMISOR_REGIMEN,

    cliente: data.cliente,
    rfcReceptor: data.rfcReceptor || 'XAXX010101000',
    regimenReceptor: data.regimenReceptor || '601 - General de Ley Personas Morales',
    usoCfdi: data.usoCfdi || 'G03 - Gastos en general',
    cpReceptor: data.cpReceptor || '00000',

    folio: data.folio || 'S/N',
    fecha: data.fecha || new Date().toISOString().slice(0,10),
    lugarExpedicion: data.lugarExpedicion || '00000',
    efecto: data.efecto || 'I - Ingreso',

    formaPago: data.formaPago || '01 - Efectivo',
    metodoPago: data.metodoPago || 'PUE - Pago en una sola exhibición',

    items: tableItems,
    totales: { subtotal, iva, total }
  };
}


/**
 * @swagger
 * /generate-pdf:
 *   post:
 *     tags:
 *       - Generación de Facturas PDF
 *     summary: Genera una prefactura (CFDI sin timbrar) en PDF
 *     description: Acepta el JSON del orquestador (Facturama-like) **o** el formato legacy en español.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 title: Formato Orquestador (Facturama-like)
 *                 properties:
 *                   CfdiType: { type: string, example: "I" }
 *                   ExpeditionPlace: { type: string, example: "20160" }
 *                   PaymentForm: { type: string, example: "01" }
 *                   PaymentMethod: { type: string, example: "PUE" }
 *                   Receiver:
 *                     type: object
 *                     properties:
 *                       Name: { type: string, example: "TALLER SEÑARQ SA DE CV" }
 *                       Rfc: { type: string, example: "TSE170616TK2" }
 *                       FiscalRegime: { type: string, example: "601" }
 *                       CfdiUse: { type: string, example: "G03" }
 *                       TaxZipCode: { type: string, example: "09060" }
 *                   Items:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         Description: { type: string, example: "Fotocelda 120 voltios" }
 *                         ProductCode: { type: string, example: "39122200" }
 *                         Quantity: { type: number, example: 1 }
 *                         Unit: { type: string, example: "Pieza" }
 *                         UnitCode: { type: string, example: "H87" }
 *                         UnitPrice: { type: number, example: 110.344 }
 *                         Subtotal: { type: number, example: 110.344 }
 *                         Total: { type: number, example: 127.99904 }
 *                         TaxObject: { type: string, example: "02" }
 *                         Taxes:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               Base: { type: number, example: 110.344 }
 *                               IsFederalTax: { type: boolean, example: true }
 *                               IsRetention: { type: boolean, example: false }
 *                               Name: { type: string, example: "IVA" }
 *                               Rate: { type: number, example: 0.16 }
 *                               Total: { type: number, example: 17.65504 }
 *               - type: object
 *                 title: Formato Legacy (en español)
 *                 properties:
 *                   emisor: { type: string, example: "EMMANUEL DE JESUS R..." }
 *                   rfcEmisor: { type: string, example: "ROLE930613SC5" }
 *                   direccionEmisor: { type: string, example: "CIRCUITO..." }
 *                   regimenEmisor: { type: string, example: "626 - Régimen..." }
 *                   cliente: { type: string, example: "MULTISERVICIOS..." }
 *                   rfcReceptor: { type: string, example: "MIR191015553" }
 *                   regimenReceptor: { type: string, example: "601 - General..." }
 *                   usoCfdi: { type: string, example: "G03 - Gastos..." }
 *                   cpReceptor: { type: string, example: "20160" }
 *                   folio: { type: string, example: "2" }
 *                   fecha: { type: string, example: "2025-10-12" }
 *                   lugarExpedicion: { type: string, example: "20160 AGUASCALIENTES" }
 *                   efecto: { type: string, example: "I - Ingreso" }
 *                   formaPago: { type: string, example: "01 - Efectivo" }
 *                   metodoPago: { type: string, example: "PUE - Pago..." }
 *                   items:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         clave: { type: string, example: "40141700" }
 *                         cantidad: { type: number, example: 2 }
 *                         unidad: { type: string, example: "Pieza" }
 *                         descripcion: { type: string, example: "Codo PPR 1/2*90" }
 *                         precio_unitario: { type: number, example: 12.93 }
 *     responses:
 *       200:
 *         description: Prefactura generada correctamente (Base64)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 nombreArchivo: { type: string, example: "factura_1760410808702.pdf" }
 *                 pdfBase64: { type: string }
 *       400:
 *         description: Error de validación de datos
 *       500:
 *         description: Error interno al generar el PDF
 */
router.post('/', async (req, res) => {
  try {
    const raw = req.body;
    const data = normalizePayload(raw);

    // 🔸 Validación mínima
    if (!data.cliente || !Array.isArray(data.items) || data.items.length === 0) {
      return res.status(400).json({ error: 'Datos de entrada inválidos' });
    }

    // 🔸 Construcción de tabla de conceptos (ya normalizada)
    const body = [
      [
        { text: 'Clave ProdServ', bold: true },
        { text: 'Cantidad', bold: true },
        { text: 'Unidad', bold: true },
        { text: 'Descripción', bold: true },
        { text: 'Precio Unitario', bold: true },
        { text: 'Importe', bold: true }
      ],
      ...data.items.map(item => [
        item.clave,
        item.cantidad.toString(),
        item.unidad,
        item.descripcion,
        `$${(Number(item.precio_unitario) || 0).toFixed(2)}`,
        `$${(Number(item.importe) || 0).toFixed(2)}`
      ])
    ];

    const subtotal = Number(data.totales?.subtotal ?? 0);
    const iva = Number(data.totales?.iva ?? 0);
    const total = Number(data.totales?.total ?? (subtotal + iva));

    // 🔸 Definición del documento PDF
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      content: [
        { text: 'PREFACTURA', style: 'title' },
        {
          columns: [
            [
              { text: 'Emisor:', bold: true },
              { text: data.emisor },
              { text: data.rfcEmisor },
              { text: data.direccionEmisor },
              { text: `Régimen Fiscal: ${data.regimenEmisor}` },
            ],
            [
              { text: `Folio: ${data.folio}`, alignment: 'right', bold: true },
              { text: `Fecha: ${data.fecha}`, alignment: 'right' },
              { text: `Lugar de Expedición: ${data.lugarExpedicion}`, alignment: 'right' },
              { text: `Efecto del comprobante: ${data.efecto}`, alignment: 'right' }
            ]
          ],
          columnGap: 20,
          margin: [0, 10, 0, 10]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }] },
        {
          columns: [
            [
              { text: 'Receptor:', bold: true },
              { text: data.cliente },
              { text: data.rfcReceptor },
              { text: `Uso del CFDI: ${data.usoCfdi}` },
              { text: `Régimen Fiscal: ${data.regimenReceptor}` },
              { text: `Código Postal: ${data.cpReceptor}` },
            ]
          ],
          margin: [0, 10, 0, 10]
        },
        {
          table: {
            widths: ['auto', 'auto', 'auto', '*', 'auto', 'auto'],
            body
          },
          layout: 'lightHorizontalLines'
        },
        {
          columns: [
            { width: '*', text: '' },
            {
              width: 'auto',
              table: {
                body: [
                  ['Subtotal:', `$${subtotal.toFixed(2)}`],
                  ['IVA (16%):', `$${iva.toFixed(2)}`],
                  [{ text: 'Total:', bold: true }, { text: `$${total.toFixed(2)}`, bold: true }]
                ]
              },
              layout: 'lightHorizontalLines'
            }
          ],
          margin: [0, 15, 0, 0]
        },
        { text: `Forma de Pago: ${data.formaPago}`, margin: [0, 10, 0, 0] },
        { text: `Método de Pago: ${data.metodoPago}`, margin: [0, 2, 0, 20] },
        {
          text: 'Este documento es una representación impresa de un CFDI.',
          style: 'footer',
          alignment: 'center'
        }
      ],
      styles: {
        title: { fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 10] },
        footer: { fontSize: 10, italics: true },
      }
    };

    // 🔸 Generar PDF
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    pdfDocGenerator.getBuffer((buffer) => {
      const pdfBuffer = Buffer.from(buffer);
      const base64 = pdfBuffer.toString('base64');
      const filename = `factura_${Date.now()}.pdf`;

      //saveTempPDF(pdfBuffer, filename);

      res.json({
        nombreArchivo: filename,
        pdfBase64: base64
      });
    });

  } catch (error) {
    console.error('❌ Error generando PDF:', error);
    res.status(500).json({ error: 'Error interno al generar el PDF' });
  }
});

module.exports = router;
