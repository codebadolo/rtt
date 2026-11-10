# Conception : un client qui a aussi sa boutique

Statut : **conception uniquement, non activé.** Aucun comportement actuel ne change.
Origine : « Propositions d'amélioration de la plateforme », point 2.

## Objectif

Un même compte peut commander (client) **et** vendre (boutique), sans créer un
second compte ni changer de numéro de téléphone.

## Situation actuelle

- Un compte a **un seul rôle** : `ETUDIANT` (affiché « Client ») ou `VENDEUR`.
- Quand un client crée une boutique (`POST /api/profil/vendeur/`), son rôle
  passe de `ETUDIANT` à `VENDEUR` (`apps/administration/views.py`). Il perd
  alors l'accès au parcours de commande.
- La boutique est déjà un objet séparé du compte : `ProfilVendeur`, relié en
  1–1 à `Utilisateur`. **C'est ce qui rend l'évolution possible sans
  migration de données lourde.**

## Principe retenu

Le rôle décrit ce que le compte **est** ; la boutique décrit ce qu'il **a**.

- Le rôle reste `ETUDIANT` (client). La capacité de vendre vient de la présence
  d'un `ProfilVendeur` validé, et non plus du rôle.
- Les comptes `VENDEUR` existants (vendeurs « purs ») ne changent pas.
- Activation par un réglage `BOUTIQUE_CLIENT_ACTIVE` (désactivé par défaut),
  pour pouvoir l'ouvrir puis la refermer sans redéploiement de code.

Deux propriétés à ajouter sur `Utilisateur`, utilisées partout à la place des
tests de rôle :

| Propriété        | Vrai si                                                                 |
|------------------|-------------------------------------------------------------------------|
| `peut_commander` | rôle `ETUDIANT`, ou (réglage actif et rôle `VENDEUR`)                    |
| `peut_vendre`    | rôle `VENDEUR`, ou (réglage actif et `ProfilVendeur` existant)           |

## Changements à prévoir

### Backend

1. **Création de boutique** : si le réglage est actif, ne plus changer le rôle
   du client en `VENDEUR`.
2. **Permissions** : remplacer `est_vendeur` par `peut_vendre` dans les vues
   vendeur (commandes reçues, produits, wallet), et `est_etudiant` par
   `peut_commander` dans la création de commande et le profil client.
3. **Visibilité des commandes** (`apps/commandes/views.py`, `get_queryset`) :
   aujourd'hui c'est « soit mes achats, soit mes ventes ». Il faudra séparer
   explicitement les deux listes (`?vue=achats` / `?vue=ventes`) pour un
   compte qui a les deux.
4. **Interdire d'acheter dans sa propre boutique** (règle métier à confirmer).
5. **Wallet** : rattaché à la boutique (`ProfilVendeur`), pas au compte, donc
   rien ne change pour les paiements reçus.
6. Exposer `peut_commander`, `peut_vendre` et l'état du réglage dans
   `etat_parcours` pour le frontend.

### Frontend

1. Le menu du tableau de bord se construit selon `peut_commander` /
   `peut_vendre`, et non plus selon le rôle : un compte mixte voit
   « Mes commandes » et « Ma boutique ».
2. Un sélecteur « Espace client / Espace vendeur » dans l'en-tête.
3. Les routes `/vendeur/*` acceptent un client qui a une boutique validée.
4. Dans le profil client : bouton « Ouvrir ma boutique » qui mène au parcours
   d'inscription vendeur existant, sans redemander le téléphone (déjà vérifié).

### Administration

- La validation d'une boutique reste identique (statut `ProfilVendeur`).
- La liste des utilisateurs affiche un badge « a une boutique » pour les
  clients concernés.

## Ordre de mise en œuvre proposé

1. Ajouter les propriétés et le réglage, **sans les utiliser** (aucun effet).
2. Basculer les permissions backend sur les propriétés, avec des tests pour les
   trois cas : client seul, vendeur seul, compte mixte.
3. Adapter le frontend (menu, sélecteur d'espace, routes).
4. Activer le réglage sur un petit groupe de comptes pilotes.

## Questions à trancher avant développement

- Un client peut-il acheter dans sa propre boutique ? (proposé : non)
- Un vendeur « pur » existant peut-il aussi commander ? (proposé : oui une fois
  le réglage actif)
- Faut-il une validation administrateur différente pour un client qui ouvre
  une boutique, ou la même que pour un vendeur ?
