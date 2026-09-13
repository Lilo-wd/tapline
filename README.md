# Tapline — site e-commerce mono-produit

Page produit unique pour la vente de la carte NFC « avis Google », en deux finitions (fond noir,
fond bleu), avec remise dégressive par quantité et parcours devis au-delà de 100 cartes.
Statique (HTML/CSS/JS sans framework) + une fonction Netlify pour créer la session de paiement Stripe.

Éditeur : Lilo Serafin (EI), micro-entreprise — SIRET 109 022 988 00017, Toulouse.
**Franchise en base de TVA** (art. 293 B du CGI) : aucun prix TTC/HT affiché, aucune TVA collectée
ni récupérable, aucun numéro de TVA demandé au paiement.

---

## Structure

```
index.html                                 la page produit, en une seule page
contact/index.html                         formulaire de contact + coordonnées      → /contact/
merci/index.html                           confirmation (commande, devis, message)  → /merci/
mentions-legales/ / cgv/ / confidentialite/                                          → URLs propres
assets/css/style.css                       toute la feuille de style
assets/js/config.js                        prix, paliers, variantes, livraison   ← à éditer
assets/js/main.js                          galerie, sélecteurs, prix, dates, barre collante
assets/js/merci.js                         message de la page de confirmation
assets/img/                                favicon, visuels de carte (.jpg) et photos de rubrique
netlify/functions/create-checkout-session.js   calcul du prix côté serveur + Stripe
netlify.toml                               en-têtes de sécurité, cache, build
normaliser-images.ps1                      remet les visuels de carte au même canevas carré
convertir-photos.ps1                       convertit les photos de rubrique en JPEG web
serve.ps1                                  serveur local de prévisualisation
```

Déroulé de la page : bandeau → accroche → fiche produit → bande de points forts →
« Configurez. Posez. Récoltez. » → bénéfices → chiffres clés → comparatif → tarifs dégressifs →
avis (masqué) → FAQ → devis → dernier appel.

---

## Le site est en préproduction

Il n'est pas indexable, volontairement, le temps des tests. Deux choses à faire le jour du
lancement public :

1. supprimer `<meta name="robots" content="noindex, nofollow">` dans `index.html` ;
2. remplacer le contenu de `robots.txt` par la version indexable laissée en commentaire dedans.

Les pages secondaires (mentions légales, CGV, confidentialité, contact, merci) restent en
`noindex` en permanence — c'est voulu, elles n'ont pas vocation à remonter dans les résultats.

---

## Prix et paliers

| Quantité | Remise | Prix unitaire |
|---|---|---|
| 1 à 4 | — | 29,90 € |
| 5 à 9 | −10 % | 26,91 € |
| 10 à 24 | −15 % | 25,41 € |
| 25 à 49 | −25 % | 22,42 € |
| 50 à 99 | −30 % | 20,93 € |
| 100 et plus | sur devis (jusqu'à −40 %) | — |

Prix de revient unitaire : 3,88 €. Même au palier le plus bas, la marge unitaire reste de 17 €.

Deux fichiers à garder synchronisés :

- `assets/js/config.js` — ce que voit le client ;
- `netlify/functions/create-checkout-session.js` — **ce qui est réellement facturé**, seul à faire foi.

Le navigateur n'envoie que l'identifiant de variante et la quantité : modifier le prix dans la
console n'a aucun effet sur le montant débité.

**Livraison** : 4,90 € pour 1 ou 2 cartes, offerte à partir de 3. Expédition sous 48 h ouvrées,
livraison en 7 à 10 jours ouvrés. Les dates affichées sur la fiche produit sont calculées en
jours ouvrés à partir du jour de la visite, week-ends exclus.
**Pays livrés** : France, Belgique, Luxembourg, Monaco, Suisse.

---

## Les visuels produit

```
assets/img/_sources/carte-*.png          tes fichiers d'origine, jamais modifiés
assets/img/_sources/_retires/carte-*.png les cartes Instagram et TikTok, plus vendues
assets/img/carte-*.jpg                   1024 px, générés   (grand visuel)
assets/img/thumbs/carte-*.jpg            192 px, générés    (vignettes et pastilles)
```

Les fichiers d'origine sont des cartes à coins arrondis posées sur un fond blanc opaque, avec une
marge différente sur chacun et un léger halo d'ombre en bas à droite. Posé tel quel sur la page,
ce blanc formait un cadre visible. `normaliser-images.ps1` détecte la carte, mesure le rayon de
ses coins et l'épaisseur du halo, puis rogne au ras — la carte remplit tout le cadre.

**Les coins arrondis sont recréés en CSS**, pas découpés en transparence dans le fichier. C'est ce
qui permet d'utiliser du JPEG : à 1024 px, 160 Ko au lieu de 1,5 Mo en PNG, pour un rendu
identique. Le rayon se règle d'un seul endroit, la variable `--carte-r` de `style.css` (4,5 % de
la largeur). L'ombre est en `box-shadow` et non en `filter: drop-shadow`, pour qu'elle épouse
l'arrondi plutôt que de dessiner un rectangle.

Pour remplacer une carte : déposer le nouveau fichier dans `_sources/` sous le même nom, puis

```bash
powershell -File normaliser-images.ps1
```

Le script affiche la carte détectée, le rayon et le halo mesurés. Si l'arrondi ne tombe pas juste
après un changement de visuel, ajuster `--carte-r`.

### Les photos de rubrique

Cinq photos illustrent la page : les trois étapes « Configurez / Posez / Récoltez » et les deux
blocs de bénéfices.

```
assets/img/section-configurez.jpg     étape 1
assets/img/section-posez.jpg          étape 2
assets/img/section-recoltez.jpg       étape 3
assets/img/section-cinq-etapes.jpg    bloc « Cinq étapes deviennent une »
assets/img/section-carte-reste.jpg    bloc « La carte reste, le lien peut changer »
```

Elles sont affichées dans des cadres **carrés**, sans recadrage : les fichiers sont carrés à la
source, donc rien n'est rogné. Les originaux `.jfif` sont conservés dans `assets/img/_sources/`.

Pour en ajouter ou en remplacer une : déposer le `.jfif` à la racine du projet sous le nom attendu
(voir la table `$noms` du script), puis

```bash
powershell -File convertir-photos.ps1
```

Le script redimensionne à 1000 px, recompresse en JPEG qualité 82 — les originaux pesaient 600 à
800 Ko chacun, ils tombent à 100-210 Ko — et déplace le fichier d'origine dans `_sources/`.

---

## Preuve sociale : rien ne s'affiche sans contenu réel

Les tableaux `reviews` et `clientLogos` de `config.js` sont vides, et `rating` vaut `null` : la
section Avis et la note en étoiles restent masquées. Il suffit d'ajouter une entrée pour qu'elles
apparaissent. Aucun faux avis n'est affiché — publier de faux avis est sanctionné par la DGCCRF.

Le mécanisme de prix barré et le bandeau à compte à rebours ont été **retirés** du code : pas de
fausse promotion. Le seul prix barré qui s'affiche est 29,90 € à côté du prix remisé dès 5 cartes,
ce qui est le tarif unitaire réellement pratiqué.

Le bandeau du haut affiche deux faits permanents (livraison offerte dès 3 cartes, garantie à vie) ;
son texte se modifie dans `config.js`, clé `announce`.

---

## Prévisualiser en local

Node n'est pas installé sur cette machine, donc `netlify dev` n'est pas disponible. Pour voir la
page (tout fonctionne sauf le bouton de paiement, qui a besoin de la fonction) :

```bash
powershell -File serve.ps1
```

Puis ouvrir `http://localhost:8099`.

---

## Mise en ligne sur Netlify

1. `git init`, `git add -A`, `git commit`, puis pousser sur le compte GitHub existant.
2. Sur Netlify : **Add new site → Import an existing project**. Le build est décrit dans
   `netlify.toml`, aucune commande à saisir.
3. Variables d'environnement (**Site settings → Environment variables**) :

   | Variable | Valeur |
   |---|---|
   | `STRIPE_SECRET_KEY` | clé **secrète** Stripe — `sk_test_…` d'abord, `sk_live_…` ensuite |
   | `SITE_URL` | facultatif, Netlify fournit `URL` automatiquement |

4. Redéployer après avoir ajouté les variables.
5. Brancher le domaine `tapline.fr` (acheté chez IONOS) sur Netlify, puis pointer les DNS.

Les formulaires **devis** et **contact** passent par Netlify Forms, détectés automatiquement au
déploiement. Ajouter une notification e-mail vers `tapline.nfc@gmail.com` dans
*Forms → Form notifications*.

---

## Côté Stripe

Le compte est créé, validé, et le compte bancaire renseigné.

- **Tester d'abord en mode test** avec `sk_test_…`, passer en `sk_live_…` ensuite.
- Apple Pay et Google Pay s'affichent automatiquement dans Checkout une fois activés dans
  **Settings → Payment methods**. Même chose pour PayPal et le virement SEPA : la fonction ne
  restreint aucun moyen de paiement, tout ce qui est activé côté Stripe apparaît.
- `tax_id_collection` est **désactivé** (franchise en base) et `allow_promotion_codes` aussi
  (pas de codes promo).
- La facture est émise automatiquement, sans TVA.

---

## Ce qui reste à faire

- [ ] **Notice de mise en service** — à rédiger, puis à envoyer automatiquement après chaque
      commande. L'automatisation demande un service d'e-mail transactionnel (Brevo, Resend…) et un
      webhook Stripe : à brancher quand la notice existe.
- [ ] **Collecte d'avis après achat** — repose sur la même plomberie e-mail.
- [ ] **Mesure d'audience** — à décider. Netlify Analytics (9 $/mois) ne demande aucun code, ne
      dépose aucun cookie et évite donc tout bandeau de consentement. Une solution en JavaScript
      type Plausible ou Umami impose d'ouvrir la CSP à son domaine.
