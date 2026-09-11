/* =============================================================
   Tapline — configuration commerciale
   Source unique de vérité côté client.
   Les mêmes valeurs sont dupliquées dans
   netlify/functions/create-checkout-session.js, qui fait seul
   autorité sur le prix réellement facturé.
   Toute modification doit être reportée dans LES DEUX fichiers.
   ============================================================= */

window.TAPLINE = {

  /* Marque et contact -------------------------------------- */
  brand: 'Tapline',
  contactEmail: 'tapline.nfc@gmail.com',
  contactPhone: '06 95 25 77 81',
  contactPhoneLink: '+33695257781',

  /* Prix ----------------------------------------------------
     Lilo Serafin est en franchise en base de TVA : le prix
     affiché est le prix payé, sans taxe applicable. La mention
     « TVA non applicable, art. 293 B du CGI » figure sur la
     fiche produit, les CGV et les factures.
     -------------------------------------------------------- */
  currency: 'EUR',
  unitPriceCents: 2990,                    // 29,90 € l'unité

  /* Bandeau haut de page -----------------------------------
     Deux faits permanents, pas une promotion : ni compte à
     rebours, ni prix barré. Mettre enabled à false pour le
     masquer.
     -------------------------------------------------------- */
  announce: {
    enabled: true,
    text: 'Livraison offerte dès 3 cartes · Garantie à vie contre les défauts de fabrication'
  },

  /* Garantie ----------------------------------------------- */
  warranty: 'Garantie à vie',

  /* Note et avis -------------------------------------------
     Reste à null tant qu'il n'y a pas d'avis réels et
     vérifiables. Renseigner { value: 4.8, count: 12 } le jour
     où c'est le cas : la note apparaît alors dans la fiche
     produit et la section Avis se démasque.
     -------------------------------------------------------- */
  rating: null,

  /* Paliers de remise par quantité ------------------------- */
  tiers: [
    { min: 1,   max: 4,    discount: 0    },
    { min: 5,   max: 9,    discount: 0.10 },
    { min: 10,  max: 24,   discount: 0.15 },
    { min: 25,  max: 49,   discount: 0.25 },
    { min: 50,  max: 99,   discount: 0.30 }
  ],

  /* Au-delà : bascule sur demande de devis ----------------- */
  quoteThreshold: 100,

  /* Livraison ----------------------------------------------
     Les cartes partent de chez le fournisseur : 7 à 10 jours
     ouvrés au total, expédition comprise. Les valeurs
     ci-dessous produisent exactement cette fourchette.
     -------------------------------------------------------- */
  shipping: {
    feeCents: 490,                         // 4,90 €
    freeFromQty: 3,                        // offerte à partir de 3 cartes
    dispatchBusinessDays: 2,               // expédition sous 48 h ouvrées
    deliveryMinBusinessDays: 5,            // + 5 à 8 jours = 7 à 10 au total
    deliveryMaxBusinessDays: 8
  },

  /* Les 2 variantes ----------------------------------------
     L'ordre du tableau est celui de la page : la première est
     celle affichée à l'arrivée.

     `img`    : visuel 1024 px, `thumb` : vignette 192 px. Les
                deux sont produits par normaliser-images.ps1 à
                partir de assets/img/_sources/.
     `finish` : ce qui distingue les deux cartes, le fond bleu ou
                le fond noir.

     Les visuels sont en JPEG, environ neuf fois plus légers que
     le PNG à résolution égale, et rognés au ras de la carte. Les
     coins arrondis sont donc recréés en CSS, variable --carte-r
     dans style.css, plutôt que découpés en transparence dans le
     fichier.
     -------------------------------------------------------- */
  variants: [
    {
      id: 'avis-google-bleu',
      name: 'Avis Google',
      finish: 'Bleue',
      short: 'Google bleu',
      img: 'assets/img/carte-google-bleu.jpg',
      thumb: 'assets/img/thumbs/carte-google-bleu.jpg',
      alt: 'Carte NFC Tapline avis Google, fond bleu, avec QR code',
      face: 'google-blanc',
      glyph: 'google',
      caption: 'Ouvre votre fiche d’avis Google.'
    },
    {
      id: 'avis-google-noir',
      name: 'Avis Google',
      finish: 'Noire',
      short: 'Google noir',
      img: 'assets/img/carte-google-noir.jpg',
      thumb: 'assets/img/thumbs/carte-google-noir.jpg',
      alt: 'Carte NFC Tapline avis Google, fond noir, avec QR code',
      face: 'google-noir',
      glyph: 'google',
      caption: 'Ouvre votre fiche d’avis Google.'
    }
  ],

  /* Preuve sociale ------------------------------------------
     Vides au lancement : les sections Avis et logos clients
     restent masquées tant qu'ils le sont. Aucun faux avis,
     aucun faux logo n'est affiché.

     Exemple :
     { text: 'Posée à l’accueil, elle a doublé nos avis.',
       author: 'Prénom N.', role: 'Responsable boutique' }
     -------------------------------------------------------- */
  reviews: [],
  clientLogos: []
};
