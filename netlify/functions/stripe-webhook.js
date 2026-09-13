// netlify/functions/stripe-webhook.js
//
// Déclenché par Stripe à chaque paiement réussi (event: checkout.session.completed).
// 1. Génère la facture PDF (via pdf-lib)
// 2. Envoie le mail de reçu + facture
// 3. Envoie le mail de notice d'activation (avec la fiche Canva en pièce jointe)
//
// Variables d'environnement à configurer dans Netlify (Site settings > Environment variables) :
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
//   RESEND_API_KEY
//   FROM_EMAIL              (ex: "Tapline <commandes@tapline.fr>")

const Stripe = require('stripe');
const { Resend } = require('resend');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook signature invalide: ${err.message}` };
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: 'Événement ignoré' };
  }

  const session = stripeEvent.data.object;

  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
    const customerEmail = session.customer_details.email;
    const customerName = session.customer_details.name || '';
    const firstName = customerName.split(' ')[0] || 'client';

    const items = lineItems.data.map((li) => ({
      name: li.description,
      qty: li.quantity,
      total: (li.amount_total / 100).toFixed(2),
    }));

    const subtotal = (session.amount_subtotal / 100).toFixed(2);
    const shipping = ((session.total_details?.amount_shipping || 0) / 100).toFixed(2);
    const total = (session.amount_total / 100).toFixed(2);

    const orderNumber = session.id.slice(-8).toUpperCase();
    const invoiceNumber = `TL-${new Date().getFullYear()}-${orderNumber}`;
    const orderDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    // 1. Génération de la facture PDF
    const invoicePdfBytes = await buildInvoicePdf({
      invoiceNumber,
      orderDate,
      customerName,
      customerEmail,
      items,
      subtotal,
      shipping,
      total,
    });

    // 2. Préparation de l'e-mail 1 : reçu + facture
    const receiptTemplate = fs.readFileSync(
      path.join(__dirname, 'templates', '1-email-recu-paiement.html'),
      'utf8'
    );

    const rowsHtml = items
      .map(
        (i) => `
        <tr>
          <td style="padding:10px 0;font-size:14px;color:#111111;border-bottom:1px solid #f0f0f0;">${i.name}</td>
          <td style="padding:10px 0;font-size:14px;color:#111111;text-align:center;border-bottom:1px solid #f0f0f0;">${i.qty}</td>
          <td style="padding:10px 0;font-size:14px;color:#111111;text-align:right;border-bottom:1px solid #f0f0f0;">${i.total} €</td>
        </tr>`
      )
      .join('');

    const receiptHtml = receiptTemplate
      .replaceAll('{{prenom}}', firstName)
      .replaceAll('{{numero_commande}}', orderNumber)
      .replaceAll('{{date_commande}}', orderDate)
      .replaceAll('{{lignes_articles}}', rowsHtml)
      .replaceAll('{{sous_total}}', subtotal)
      .replaceAll('{{frais_livraison}}', shipping)
      .replaceAll('{{total}}', total)
      .replaceAll('{{numero_facture}}', invoiceNumber);

    await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: customerEmail,
      subject: `Votre reçu Tapline — commande ${orderNumber}`,
      html: receiptHtml,
      attachments: [
        {
          filename: `facture-${invoiceNumber}.pdf`,
          content: Buffer.from(invoicePdfBytes).toString('base64'),
        },
      ],
    });

    // 3. Préparation de l'e-mail 2 : notice d'activation
    // Les 9 images du guide sont hébergées dans /assets/img/guide/ du site
    // (ex: https://tapline.fr/assets/img/guide/etape-1-2.jpg) et affichées directement
    // dans le corps du mail — pas de pièce jointe nécessaire.
    const ficheTemplate = fs.readFileSync(
      path.join(__dirname, 'templates', '2-email-notice-activation.html'),
      'utf8'
    );

    const ficheHtml = ficheTemplate
      .replaceAll('{{prenom}}', firstName)
      .replaceAll('{{base_url}}', 'https://tapline.fr');

    await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: customerEmail,
      subject: 'Mettez votre carte Tapline en service',
      html: ficheHtml,
    });

    return { statusCode: 200, body: 'Mails envoyés' };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: `Erreur: ${err.message}` };
  }
};

async function buildInvoicePdf({ invoiceNumber, orderDate, customerName, customerEmail, items, subtotal, shipping, total }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const left = 50;

  page.drawText('TAPLINE', { x: left, y, size: 22, font: fontBold, color: rgb(0.07, 0.07, 0.07) });
  y -= 40;
  page.drawText(`Facture n° ${invoiceNumber}`, { x: left, y, size: 13, font: fontBold });
  y -= 18;
  page.drawText(`Date : ${orderDate}`, { x: left, y, size: 11, font });
  y -= 30;

  page.drawText('Vendeur :', { x: left, y, size: 11, font: fontBold });
  y -= 16;
  page.drawText('Lilo Serafin (EI) — SIRET 109 022 988 00017', { x: left, y, size: 10, font });
  y -= 14;
  page.drawText('5 rue Achille Mir, 31100 Toulouse, France', { x: left, y, size: 10, font });
  y -= 14;
  page.drawText('TVA non applicable, art. 293 B du CGI', { x: left, y, size: 10, font });
  y -= 30;

  page.drawText('Client :', { x: left, y, size: 11, font: fontBold });
  y -= 16;
  page.drawText(customerName || '-', { x: left, y, size: 10, font });
  y -= 14;
  page.drawText(customerEmail || '-', { x: left, y, size: 10, font });
  y -= 30;

  page.drawText('Désignation', { x: left, y, size: 10, font: fontBold });
  page.drawText('Qté', { x: 380, y, size: 10, font: fontBold });
  page.drawText('Total', { x: 470, y, size: 10, font: fontBold });
  y -= 10;
  page.drawLine({ start: { x: left, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.1, 0.1, 0.1) });
  y -= 16;

  items.forEach((item) => {
    page.drawText(item.name.slice(0, 45), { x: left, y, size: 10, font });
    page.drawText(String(item.qty), { x: 380, y, size: 10, font });
    page.drawText(`${item.total} €`, { x: 470, y, size: 10, font });
    y -= 18;
  });

  y -= 10;
  page.drawLine({ start: { x: 350, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  y -= 16;
  page.drawText('Sous-total', { x: 380, y, size: 10, font });
  page.drawText(`${subtotal} €`, { x: 470, y, size: 10, font });
  y -= 16;
  page.drawText('Livraison', { x: 380, y, size: 10, font });
  page.drawText(`${shipping} €`, { x: 470, y, size: 10, font });
  y -= 20;
  page.drawText('Total payé', { x: 380, y, size: 12, font: fontBold });
  page.drawText(`${total} €`, { x: 470, y, size: 12, font: fontBold });

  return pdfDoc.save();
}
