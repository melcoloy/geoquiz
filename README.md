# 🌍 GéoQuiz

Petit quiz de géographie dans le navigateur : drapeaux, pays et capitales du monde.
100 % HTML/CSS/JavaScript, sans dépendance ni étape de build.

## Fonctionnalités

- **5 modes** : Drapeau → Pays, Pays → Drapeau, Pays → Capitale, Drapeau → Écrire le pays (fautes de frappe tolérées), Pays → Carte (clique sur une carte du monde)
- **Contre-la-montre** : un maximum de bonnes réponses en 60 s
- **Révision** : les pays ratés sont mémorisés et peuvent être rejoués jusqu'à ce que tu les trouves
- **Enchaînement automatique** après une bonne réponse
- **Filtre par région** : Europe, Afrique, Asie, Amériques, Océanie ou monde entier
- **~195 pays**, avec leurres choisis sur le même continent pour corser les questions
- **Score avec bonus de série** 🔥
- **Défi du jour** : les mêmes 10 drapeaux pour tout le monde, résultat partageable façon Wordle (🟩🟥)
- **Meilleurs scores** sauvegardés localement (localStorage)
- **Récap des erreurs** en fin de partie
- Raccourcis clavier (1–4, Entrée), thème clair/sombre automatique, responsive mobile

## Lancer en local

Ouvre simplement `index.html` dans un navigateur, ou lance un petit serveur :

```bash
python -m http.server 8000
# puis http://localhost:8000
```

## Structure

```
geoquiz/
├── index.html      # structure des 3 écrans (menu, quiz, résultat)
├── css/style.css   # styles + thème sombre
├── js/
│   ├── data.js     # liste des pays (code ISO, nom, capitale, continent)
│   ├── map.js      # tracés SVG de la carte (généré par tools/build-map.js)
│   ├── game.js     # logique : questions, score, sauvegarde, défi du jour
│   └── ui.js       # affichage et événements
└── tools/
    └── build-map.js  # régénère js/map.js à partir des données Natural Earth
```

### Régénérer la carte (optionnel)

`js/map.js` est déjà fourni. Pour le reconstruire (par exemple après avoir ajouté un pays dans `data.js`) :

```bash
npm i --no-save world-atlas@2 topojson-client topojson-simplify d3-geo i18n-iso-countries
node tools/build-map.js
```

## Publier sur GitHub Pages

```bash
git init
git add .
git commit -m "GéoQuiz : première version"
git branch -M main
git remote add origin https://github.com/<ton-pseudo>/geoquiz.git
git push -u origin main
```

Puis sur GitHub : **Settings → Pages → Source : Deploy from a branch → `main` / root**.
Le site sera en ligne sur `https://<ton-pseudo>.github.io/geoquiz/`.

## Comment marche la saisie libre ?

Le texte est normalisé (minuscules, sans accents, sans espaces ni article), puis comparé au nom du pays et à ses alias (« USA », « RDC », « République tchèque »…) avec la **distance de Levenshtein**. Une petite faute est acceptée, sauf si le texte correspond mieux à un autre pays (« Irak » n'est pas accepté pour l'Iran).

## Crédits

Drapeaux : [flagcdn.com](https://flagcdn.com). Carte : [Natural Earth](https://www.naturalearthdata.com) via [world-atlas](https://github.com/topojson/world-atlas).