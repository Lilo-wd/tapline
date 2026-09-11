/* =============================================================
   Tapline — creation de la session de paiement Stripe
   -------------------------------------------------------------
   Le navigateur n'envoie QUE l'identifiant de variante et la
   quantite. Le prix, la remise et les frais de port sont
   recalcules ici : une valeur trafiquee cote client n'a aucun
   effet sur le montant reellement debite.

   Les constantes ci-dessous doivent rester alignees avec
   assets/js/config.js (l'affichage), ce fichier faisant foi.

   Variables d'environnement attendues (Netlify) :
     STRIPE_SECRET_KEY   cle secrete Stripe (sk_test_... / sk_live_...)
     SITE_URL            optionnel, sinon URL fournie par Netlify
   ============================================================= */

const Stripe = require('stripe');

/* ---------- Tarification (source de verite) ---------- */
const UNIT_PRICE_CENTS = 2990;
const QUOTE_THRESHOLD = 100;

const TIERS = [
  { min: 1,  max: 4,  discount: 0    },
  { min: 5,  max: 9,  discount: 0.10 },
  { min: 10, max: 24, discount: 0.15 },
  { min: 25, max: 49, discount: 0.25 },
  { min: 50, max: 99, discount: 0.30 }
];

const SHIPPING = { feeCents: 490, freeFromQty: 3 };

const VARIANTS = {
  'avis-google-noir':  { label: 'Carte NFC Tapline — Avis Google, noire' },
  'avis-google-bleu':  { label: 'Carte NFC Tapline — Avis Google, bleue' }
};

const SHIPPING_COUNTRIES = ['FR', 'BE', 'LU', 'MC', 'CH'];

/* ---------- Utilitaires ---------- */
function unitCentsFor(qty) {
  const tier = TIERS.find(t => qty >= t.min && qty <= t.max);
  const discount = tier ? tier.discount : 0;
  // Arrondi a l'inferieur, identique a l'affichage.
  return Math.floor(UNIT_PRICE_CENTS * (1 - discount));
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}

/* ---------- Handler ---------- */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Méthode non autorisée.' });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    console.error('STRIPE_SECRET_KEY absente de l environnement.');
    return json(500, { error: 'Le paiement n’est pas encore configuré sur ce site.' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Requête illisible.' });
  }

  const variant = VARIANTS[payload.variantId];
  if (!variant) {
    return json(400, { error: 'Variante inconnue.' });
  }

  const qty = Number(payload.quantity);
  if (!Number.isInteger(qty) || qty < 1) {
    return json(400, { error: 'Quantité invalide.' });
  }
  if (qty >= QUOTE_THRESHOLD) {
    return json(400, { error: `Au-delà de ${QUOTE_THRESHOLD - 1} cartes, la commande passe par un devis.` });
  }

  const unitAmount = unitCentsFor(qty);
  const shippingCents = qty >= SHIPPING.freeFromQty ? 0 : SHIPPING.feeCents;
  const siteUrl = (process.env.SITE_URL || process.env.URL || '').replace(/\/$/, '');

  if (!siteUrl) {
    console.error('Aucune URL de site disponible (SITE_URL / URL).');
    return json(500, { error: 'Configuration du site incomplète.' });
  }

  try {
    const stripe = Stripe(secret, { apiVersion: '2024-06-20' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'fr',
      line_items: [{
        quantity: qty,
        price_data: {
          currency: 'eur',
          unit_amount: unitAmount,
          product_data: {
            name: variant.label,
            description: 'Carte NFC et QR code Tapline — sans abonnement, destination modifiable, garantie à vie.'
          }
        }
      }],
      shipping_options: [{
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: shippingCents === 0 ? 'Livraison suivie offerte' : 'Livraison suivie',
          fixed_amount: { amount: shippingCents, currency: 'eur' },
          delivery_estimate: {
            minimum: { unit: "business_day", value: 7 },
            maximum: { unit: "business_day", value: 10 }
          }
        }
      }],
      shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
      billing_address_collection: 'required',
      // Franchise en base de TVA (art. 293 B du CGI) : aucun numero de TVA
      // a collecter, et la facture Stripe ne doit porter aucune taxe.
      tax_id_collection: { enabled: false },
      invoice_creation: { enabled: true },
      phone_number_collection: { enabled: false },
      allow_promotion_codes: false,
      metadata: {
        variant_id: payload.variantId,
        quantite: String(qty),
        prix_unitaire_centimes: String(unitAmount)
      },
      success_url: `${siteUrl}/merci.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/#commander`
    });

    return json(200, { url: session.url });

  } catch (err) {
    console.error('Echec de creation de la session Stripe :', err && err.message);
    return json(502, { error: 'Le service de paiement est momentanément indisponible.' });
  }
};
