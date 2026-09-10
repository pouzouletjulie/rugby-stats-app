# RugbyStats Hub

Créer une application web responsive de collecte et de consultation des statistiques de matchs de rugby pour le club AS Meudon.

Chaque utilisateur se connecte avec son adresse email. À l’inscription, il reçoit le rôle Lecteur. Un administrateur peut le promouvoir en Éditeur ou Administrateur. Les lecteurs consultent les données, les éditeurs créent et modifient les matchs et événements, et les administrateurs gèrent également les utilisateurs, les rôles et la réouverture des matchs finalisés. Toutes les modifications importantes doivent être historisées.

Lors de la création d’un match, sélectionner une équipe d’AS Meudon parmi Junior, Cadet, Féminine, Senior 1 et Senior Réserve, puis renseigner : date, adversaire, type de rencontre, localisation, terrain, météo, vent et format 15/12/10/7. Une feuille de match optionnelle permet d’associer jusqu’à 22 numéros à un nom, prénom et surnom.

Les statistiques reposent sur des événements unitaires modifiables et supprimables logiquement. La période est activée une seule fois par un événement « début de première mi-temps », « début de deuxième mi-temps » ou « début du temps additionnel ». Les événements suivants héritent automatiquement de la période active. Aucun minutage précis ni aucune donnée ou référence vidéo ne doit être enregistré.

Événements collectifs à gérer :

mêlées : zone, possession, gain, sortie du 8 ou du 9 ;

touches : zone, possession, gain, suite de jeu et bloc ;

turnovers : grattage, en-avant, arrachage, interception ou autre, avec équipe et joueur éventuel ;

pénalités sifflées : équipe sanctionnée, joueur éventuel et motif mêlée, plaquage, hors-jeu ou autre ;

cartons : couleur, équipe et joueur ;

points : essai, transformation, pénalité au but ou essai de pénalité ;

entrées dans les 22 ;

50/22 : équipe et joueur à l’origine du jeu au pied si identifiable.

Statistiques individuelles :

passes normales et offloads ;

ballons touchés ;

plaquages offensifs, défensifs ou neutres ;

jeux au pied : drop, pénaltouche, touche, chandelle ou rasant, avec résultat gain ou perte de terrain ;

points, cartons, turnovers, pénalités concédées et 50/22 attribués au joueur.

Les scores et statistiques doivent être calculés automatiquement depuis les événements actifs. Prévoir la consultation, les filtres, la correction, la finalisation et l’audit des matchs. L’interface doit être rapide et adaptée à une saisie après-match depuis une vidéo externe, tout en restant utilisable ultérieurement pour une saisie en direct.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/51b829e0-a3c3-457c-9244-92b4fd3cb40b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
