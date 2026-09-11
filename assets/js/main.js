/* =============================================================
   Tapline — page produit
   - rendu des 4 cartes (aucune image externe)
   - galerie + sélecteur de variante
   - quantité, remise par palier, total en direct
   - dates de livraison calculées en jours ouvrés
   - barre d'achat collante sur mobile
   Le prix affiché ici est indicatif : la fonction Netlify
   recalcule tout avant de créer la session Stripe.
   ============================================================= */
(function () {
  'use strict';

  var C = window.TAPLINE;
  if (!C) return;

  var euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  var money = function (cents) { return euro.format(cents / 100); };
  var dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  var shortFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

  /* =========================================================
     Prix
     ========================================================= */
  function tierFor(qty) {
    for (var i = 0; i < C.tiers.length; i++) {
      if (qty >= C.tiers[i].min && qty <= C.tiers[i].max) return C.tiers[i];
    }
    return C.tiers[C.tiers.length - 1];
  }

  function unitCentsFor(qty) {
    // Arrondi à l'inférieur : le client ne paie jamais plus que la remise annoncée.
    return Math.floor(C.unitPriceCents * (1 - tierFor(qty).discount));
  }

  function shippingCentsFor(qty) {
    return qty >= C.shipping.freeFromQty ? 0 : C.shipping.feeCents;
  }

  function nextTierFor(qty) {
    for (var i = 0; i < C.tiers.length; i++) {
      if (C.tiers[i].min > qty) return C.tiers[i];
    }
    return null;
  }

  /* =========================================================
     Jours ouvrés
     ========================================================= */
  function addBusinessDays(from, n) {
    var d = new Date(from.getTime());
    var added = 0;
    while (added < n) {
      d.setDate(d.getDate() + 1);
      var wd = d.getDay();
      if (wd !== 0 && wd !== 6) added++;
    }
    return d;
  }

  function deliveryWindow() {
    var today = new Date();
    var dispatch = addBusinessDays(today, C.shipping.dispatchBusinessDays);
    return {
      today: today,
      dispatch: dispatch,
      min: addBusinessDays(dispatch, C.shipping.deliveryMinBusinessDays),
      max: addBusinessDays(dispatch, C.shipping.deliveryMaxBusinessDays)
    };
  }

  /* =========================================================
     Fragments SVG
     ========================================================= */
  var ICON = {
    nfc: '<svg class="card-nfc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">' +
         '<path d="M7 5.5a9 9 0 0 1 0 13"/><path d="M11.5 8a5 5 0 0 1 0 8"/><path d="M16 10.6a1.7 1.7 0 0 1 0 2.8"/></svg>',
    mark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true">' +
          '<path d="M8 4.5a11 11 0 0 1 0 15"/><path d="M13.5 8a5.5 5.5 0 0 1 0 8"/></svg>'
  };

  function starPath(x) {
    return '<path transform="translate(' + x + ',0)" d="M6 .7l1.57 3.67L11.5 4.7 8.5 7.32l.92 3.9L6 9.14 2.58 11.2l.92-3.88L.5 4.7l3.93-.33z"/>';
  }

  function starRow(n, cls) {
    var out = '<svg class="' + cls + '" viewBox="0 0 68 12" aria-hidden="true">';
    for (var i = 0; i < (n || 5); i++) out += starPath(i * 14);
    return out + '</svg>';
  }

  var GLYPH = {
    google: '<svg class="card-glyph wide" viewBox="0 0 68 12" aria-hidden="true">' +
            starPath(0) + starPath(14) + starPath(28) + starPath(42) + starPath(56) + '</svg>'
  };

  /* Le glyphe est une rangée d'étoiles générique, pas une
     reproduction du logo de la marque citée. */

  function variantLabel(v) {
    return v.finish ? v.name + ' — ' + v.finish : v.name;
  }

  /* Visuel produit. Si la variante a une photo, c'est elle qui
     s'affiche ; sinon on retombe sur la carte dessinée, ce qui
     évite une page vide si un fichier manque. */
  function cardMarkup(v) {
    if (v.img) {
      return '<figure class="product-photo">' +
               '<img src="' + v.img + '" alt="' + (v.alt || v.name) + '" ' +
                    'width="512" height="512" fetchpriority="high" decoding="async">' +
             '</figure>';
    }
    return drawnCard(v);
  }

  function thumbMarkup(v) {
    return v.img
      ? '<span class="mini"><img src="' + (v.thumb || v.img) + '" alt="" data-face="' + v.face + '" width="192" height="192" decoding="async"></span>'
      : '<span class="mini face-' + v.face + '"></span>';
  }

  function swatchMarkup(v) {
    return v.img
      ? '<span class="swatch"><img src="' + (v.thumb || v.img) + '" alt="" data-face="' + v.face + '" width="192" height="192" decoding="async"></span>'
      : '<span class="swatch face-' + v.face + '"></span>';
  }


  /* Repli si un fichier image manque : on retombe sur la carte
     dessinee plutot que d'afficher une icone cassee.
     (Un attribut onerror inline serait bloque par la CSP.) */
  function bindImageFallback(root) {
    if (!root) return;
    root.querySelectorAll('img[data-face]').forEach(function (im) {
      im.addEventListener('error', function () {
        var holder = im.parentNode;
        if (holder) { holder.classList.add('face-' + im.dataset.face); im.remove(); }
      });
    });
    var big = root.querySelector('.product-photo img');
    if (big) {
      big.addEventListener('error', function () {
        root.innerHTML = drawnCard(state.variant);
      });
    }
  }
  function drawnCard(v) {
    return (
      '<div class="card3d">' +
        '<div class="card-face face-' + v.face + '">' +
          '<div class="card-top">' +
            '<span class="card-brand">' + ICON.mark + C.brand + '</span>' +
            ICON.nfc +
          '</div>' +
          '<div class="card-center">' + GLYPH[v.glyph] + '</div>' +
          '<div class="card-bottom">' +
            '<span class="card-label">' + v.name + '</span>' +
            '<span class="card-label">Sans contact</span>' +
          '</div>' +
          '<span class="accent-edge"></span>' +
        '</div>' +
      '</div>'
    );
  }

  /* =========================================================
     État + références
     ========================================================= */
  var state = { variant: C.variants[0], qty: 1 };

  var el = {};
  ['announce','announceText','stage','stageCard','thumbs','buyRating','ratingStars','ratingValue','ratingCount',
   'priceNow','priceWas','priceBadge','priceNote','variants','qtyInput','qtyMinus','qtyPlus','qtyJump',
   'tierNudge','savedNote','availStock','availDelivery','availShipping','buyBtn','buyBtnLabel','buyError',
   'buyActions','quotePanel','timeline','tierCards','reviewList','reviewsSection','clientLogos',
   'stickyBar','stickyName','stickyPrice','stickyBtn'
  ].forEach(function (id) { el[id] = document.getElementById(id); });

  /* =========================================================
     Galerie et variantes
     ========================================================= */
  function renderStage() {
    if (!el.stageCard) return;
    el.stageCard.innerHTML = cardMarkup(state.variant);
    bindImageFallback(el.stageCard);
  }

  function renderThumbs() {
    if (!el.thumbs) return;
    el.thumbs.innerHTML = C.variants.map(function (v) {
      return (
        '<button type="button" class="thumb" data-id="' + v.id + '" ' +
                'aria-current="' + (v.id === state.variant.id) + '">' +
          thumbMarkup(v) +
          '<span class="t-label">' + v.short + '</span>' +
        '</button>'
      );
    }).join('');
    bindImageFallback(el.thumbs);
    el.thumbs.querySelectorAll('.thumb').forEach(function (b) {
      b.addEventListener('click', function () { selectVariant(b.dataset.id); });
    });
  }

  function renderVariants() {
    if (!el.variants) return;
    el.variants.innerHTML = C.variants.map(function (v) {
      return (
        '<li>' +
          '<button type="button" class="variant" role="radio" data-id="' + v.id + '" ' +
                  'aria-checked="' + (v.id === state.variant.id) + '">' +
            swatchMarkup(v) +
            '<span>' +
              '<span class="v-name">' + v.name + '</span>' +
              // Pas de ligne « couleur » quand il n'existe qu'une version du modèle.
              (v.finish ? '<br><span class="v-finish">' + v.finish + '</span>' : '') +
            '</span>' +
          '</button>' +
        '</li>'
      );
    }).join('');
    bindImageFallback(el.variants);
    el.variants.querySelectorAll('.variant').forEach(function (b) {
      b.addEventListener('click', function () { selectVariant(b.dataset.id); });
    });
  }

  function selectVariant(id) {
    var found = C.variants.filter(function (v) { return v.id === id; })[0];
    if (!found) return;
    state.variant = found;
    if (el.variants) el.variants.querySelectorAll('.variant').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.id === id));
    });
    if (el.thumbs) el.thumbs.querySelectorAll('.thumb').forEach(function (b) {
      b.setAttribute('aria-current', String(b.dataset.id === id));
    });
    renderStage();
    renderPrice();
  }

  /* =========================================================
     Note et avis (rien ne s'affiche sans contenu réel)
     ========================================================= */
  function renderRating() {
    if (!C.rating || !el.buyRating) return;
    if (el.ratingStars) el.ratingStars.innerHTML = starRow(5, 'stars');
    if (el.ratingValue) el.ratingValue.textContent = String(C.rating.value).replace('.', ',') + '/5';
    if (el.ratingCount) el.ratingCount.textContent = '· ' + C.rating.count + ' avis clients';
    el.buyRating.hidden = false;
  }

  function renderReviews() {
    if (el.reviewsSection && el.reviewList && C.reviews && C.reviews.length) {
      el.reviewList.innerHTML = C.reviews.map(function (r) {
        return (
          '<figure class="review">' +
            starRow(5, 'stars') +
            '<p>« ' + r.text + ' »</p>' +
            '<footer>' + r.author + (r.role ? ' · ' + r.role : '') + '</footer>' +
          '</figure>'
        );
      }).join('');
      el.reviewsSection.hidden = false;
    }
    if (el.clientLogos && C.clientLogos && C.clientLogos.length) {
      el.clientLogos.innerHTML = C.clientLogos.map(function (l) {
        return '<img src="' + l.src + '" alt="' + l.name + '" loading="lazy">';
      }).join('');
      el.clientLogos.hidden = false;
    }
  }

  /* =========================================================
     Bandeau haut de page
     Deux faits permanents, pas une promotion : ni compte a
     rebours, ni prix barre, rien qui se rearme tout seul.
     ========================================================= */
  function renderAnnounce() {
    if (!el.announce || !C.announce || !C.announce.enabled || !C.announce.text) return;
    if (el.announceText) el.announceText.textContent = C.announce.text;
    el.announce.hidden = false;
  }

  /* =========================================================
     Paliers affichés en section Tarifs
     ========================================================= */
  function renderTierCards() {
    if (!el.tierCards) return;
    var cards = C.tiers.map(function (t) {
      var unit = Math.floor(C.unitPriceCents * (1 - t.discount));
      return (
        '<div class="tier-card" data-min="' + t.min + '" data-max="' + t.max + '">' +
          '<span class="q">' + (t.min === t.max ? t.min : t.min + ' à ' + t.max) + ' cartes</span>' +
          '<div class="p">' + money(unit) + '</div>' +
          '<span class="d' + (t.discount ? '' : ' flat') + '">' +
            (t.discount ? '−' + Math.round(t.discount * 100) + ' %' : 'Prix de base') +
          '</span>' +
        '</div>'
      );
    });
    cards.push(
      '<div class="tier-card" data-min="' + C.quoteThreshold + '" data-max="999999">' +
        '<span class="q">' + C.quoteThreshold + ' cartes et plus</span>' +
        '<div class="p">Sur devis</div>' +
        '<span class="d">Tarif dédié</span>' +
      '</div>'
    );
    el.tierCards.innerHTML = cards.join('');
  }

  function highlightTier(qty) {
    if (!el.tierCards) return;
    el.tierCards.querySelectorAll('.tier-card').forEach(function (c) {
      var min = Number(c.dataset.min), max = Number(c.dataset.max);
      c.classList.toggle('is-active', qty >= min && qty <= max);
    });
  }

  /* =========================================================
     Frise de commande
     ========================================================= */
  function renderTimeline() {
    if (!el.timeline) return;
    var w = deliveryWindow();
    el.timeline.innerHTML =
      '<div class="tl"><i></i><span class="k">Commande</span><span class="v">aujourd’hui</span></div>' +
      '<div class="tl"><i></i><span class="k">Expédition</span><span class="v">' + shortFmt.format(w.dispatch) + '</span></div>' +
      '<div class="tl"><i></i><span class="k">Livraison estimée</span><span class="v">' +
        shortFmt.format(w.min) + ' – ' + shortFmt.format(w.max) + '</span></div>';
  }

  /* =========================================================
     Prix affiché
     ========================================================= */
  function renderPrice() {
    var qty = state.qty;
    var isQuote = qty >= C.quoteThreshold;
    var tier = tierFor(qty);
    var unit = unitCentsFor(qty);
    var subtotal = unit * qty;
    var ship = shippingCentsFor(qty);
    var total = subtotal + ship;

    highlightTier(qty);
    if (el.quotePanel) el.quotePanel.hidden = !isQuote;
    if (el.buyActions) el.buyActions.hidden = isQuote;
    if (el.stickyBar) el.stickyBar.classList.toggle('is-quote', isQuote);

    /* Prix unitaire, prix barré, badge */
    if (el.priceNow) el.priceNow.textContent = isQuote ? 'Sur devis' : money(unit);

    // Le seul prix barre affiche est le tarif unitaire courant (29,90 EUR)
    // quand une remise par quantite s'applique : c'est un prix reellement
    // pratique. Aucun prix de reference fictif.
    var wasCents = null, badge = null;
    if (!isQuote && tier.discount > 0) {
      wasCents = C.unitPriceCents;
      badge = '−' + Math.round(tier.discount * 100) + ' %';
    }
    if (el.priceWas) {
      el.priceWas.hidden = !wasCents;
      if (wasCents) el.priceWas.textContent = money(wasCents);
    }
    if (el.priceBadge) {
      el.priceBadge.hidden = !badge;
      if (badge) el.priceBadge.textContent = badge;
    }
    if (el.priceNote) {
      el.priceNote.innerHTML = isQuote
        ? 'Proposition chiffrée sous 24 h ouvrées.'
        : 'l’unité · <b>Paiement unique</b>, 0 € par mois';
    }

    /* Palier suivant / économie réalisée */
    if (el.tierNudge) {
      var nxt = nextTierFor(qty);
      if (!isQuote && nxt && nxt.min < C.quoteThreshold) {
        var need = nxt.min - qty;
        el.tierNudge.hidden = false;
        el.tierNudge.innerHTML = 'Encore ' + need + ' carte' + (need > 1 ? 's' : '') +
          ' et le prix tombe à <b>' + money(Math.floor(C.unitPriceCents * (1 - nxt.discount))) +
          '</b> l’unité (−' + Math.round(nxt.discount * 100) + ' %).';
      } else {
        el.tierNudge.hidden = true;
      }
    }
    if (el.savedNote) {
      var saved = C.unitPriceCents * qty - subtotal;
      el.savedNote.hidden = isQuote || saved <= 0;
      if (saved > 0) el.savedNote.textContent = 'Vous économisez ' + money(saved) + ' sur cette commande.';
    }

    /* Disponibilité et livraison */
    var w = deliveryWindow();
    if (el.availDelivery) {
      el.availDelivery.innerHTML = 'Livraison estimée entre le <b>' + dayFmt.format(w.min) +
        '</b> et le <b>' + dayFmt.format(w.max) + '</b>';
    }
    if (el.availShipping) {
      el.availShipping.innerHTML = ship === 0
        ? '<b>Livraison offerte</b> à partir de ' + C.shipping.freeFromQty + ' cartes'
        : 'Frais de livraison <b>' + money(ship) + '</b> · offerte dès ' + C.shipping.freeFromQty + ' cartes';
    }

    /* Boutons */
    if (el.buyBtnLabel) el.buyBtnLabel.textContent = isQuote ? 'Demander un devis' : 'Commander — ' + money(total);
    if (el.stickyBtn) el.stickyBtn.textContent = isQuote ? 'Demander un devis' : 'Commander';
    if (el.stickyPrice) el.stickyPrice.textContent = isQuote ? 'Sur devis' : money(total);
    if (el.stickyName) {
      el.stickyName.textContent = qty + ' × ' + variantLabel(state.variant);
    }
  }

  /* =========================================================
     Quantité
     ========================================================= */
  function setQty(n) {
    n = Math.max(1, Math.min(9999, Math.round(Number(n) || 1)));
    state.qty = n;
    if (el.qtyInput && Number(el.qtyInput.value) !== n) el.qtyInput.value = n;
    renderPrice();
  }

  function bindQty() {
    if (el.qtyMinus) el.qtyMinus.addEventListener('click', function () { setQty(state.qty - 1); });
    if (el.qtyPlus) el.qtyPlus.addEventListener('click', function () { setQty(state.qty + 1); });
    if (el.qtyInput) {
      el.qtyInput.addEventListener('input', function () {
        if (el.qtyInput.value === '') return;   // champ vide pendant la saisie
        setQty(el.qtyInput.value);
      });
      el.qtyInput.addEventListener('blur', function () { setQty(el.qtyInput.value); });
    }
    if (el.qtyJump) {
      el.qtyJump.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () { setQty(b.dataset.qty); });
      });
    }
  }

  /* =========================================================
     Paiement
     ========================================================= */
  function startCheckout() {
    if (!el.buyBtn) return;
    if (el.buyError) el.buyError.hidden = true;
    el.buyBtn.disabled = true;
    var previous = el.buyBtnLabel ? el.buyBtnLabel.textContent : '';
    if (el.buyBtnLabel) el.buyBtnLabel.textContent = 'Redirection vers le paiement…';

    fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variantId: state.variant.id, quantity: state.qty })
    })
      .then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw new Error(data && data.error ? data.error : 'Erreur ' + r.status);
          return data;
        });
      })
      .then(function (data) {
        if (!data.url) throw new Error('Réponse inattendue du serveur de paiement.');
        window.location.href = data.url;
      })
      .catch(function (err) {
        el.buyBtn.disabled = false;
        if (el.buyBtnLabel) el.buyBtnLabel.textContent = previous;
        if (el.buyError) {
          el.buyError.hidden = false;
          el.buyError.textContent = 'Le paiement n’a pas pu démarrer : ' + err.message +
            ' Réessayez, ou écrivez-nous à ' + C.contactEmail + '.';
        }
      });
  }

  /* =========================================================
     Barre d'achat collante
     ========================================================= */
  function bindStickyBar() {
    if (!el.stickyBar || !el.buyBtn || !('IntersectionObserver' in window)) return;
    var obs = new IntersectionObserver(function (entries) {
      var visible = entries[0].isIntersecting;
      el.stickyBar.classList.toggle('is-shown', !visible);
    }, { rootMargin: '-70px 0px 0px 0px' });
    obs.observe(el.buyBtn);

    if (el.stickyBtn) {
      el.stickyBtn.addEventListener('click', function () {
        if (state.qty >= C.quoteThreshold) {
          document.getElementById('devis').scrollIntoView({ behavior: 'smooth' });
          prefillQuote();
        } else {
          startCheckout();
        }
      });
    }
  }

  /* =========================================================
     Devis : transmettre le contexte au formulaire
     ========================================================= */
  function prefillQuote() {
    var q = document.getElementById('devisQuantite');
    var v = document.getElementById('devisVariante');
    if (q && !q.value) q.value = state.qty;
    if (v) v.value = variantLabel(state.variant);
  }

  function bindQuoteLinks() {
    document.querySelectorAll('[data-quote-link]').forEach(function (a) {
      a.addEventListener('click', prefillQuote);
    });
  }

  /* =========================================================
     Divers (police non bloquante, année) — hors script inline
     pour rester compatible avec la CSP
     ========================================================= */
  function finishPage() {
    document.querySelectorAll('link[data-font]').forEach(function (l) { l.media = 'all'; });
    document.querySelectorAll('[data-year]').forEach(function (n) {
      n.textContent = String(new Date().getFullYear());
    });
    document.querySelectorAll('[data-stars]').forEach(function (n) {
      n.innerHTML = starRow(5, 'stars');
    });
  }

  /* =========================================================
     Init
     ========================================================= */
  finishPage();
  renderAnnounce();
  renderThumbs();
  renderVariants();
  renderStage();
  renderRating();
  renderReviews();
  renderTierCards();
  renderTimeline();
  bindQty();
  bindQuoteLinks();
  bindStickyBar();
  if (el.buyBtn) el.buyBtn.addEventListener('click', startCheckout);
  setQty(1);
})();
