/* Message de confirmation adapté au parcours d'origine. */
(function () {
  'use strict';
  var type = new URLSearchParams(window.location.search).get('type');
  var titleEl = document.getElementById('thanksTitle');
  var textEl = document.getElementById('thanksText');
  if (!titleEl || !textEl) return;

  var messages = {
    devis: {
      title: 'Votre demande est bien arrivée.',
      text: 'Nous revenons vers vous sous 24 h ouvrées avec une proposition chiffrée et les modalités de règlement sur facture.'
    },
    contact: {
      title: 'Message bien reçu.',
      text: 'Nous vous répondons sous 24 h ouvrées à l’adresse que vous avez indiquée.'
    },
    commande: {
      title: 'Merci, votre commande est confirmée.',
      text: 'Vous recevez dans quelques instants deux e-mails : le reçu de paiement avec votre facture, et la notice détaillée pour mettre vos cartes en service.'
    }
  };

  var m = messages[type] || messages.commande;
  titleEl.textContent = m.title;
  textEl.textContent = m.text;
})();
