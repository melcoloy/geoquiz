# 🌍 GéoQuiz

Petit quiz de géographie dans le navigateur : drapeaux, pays et capitales du monde.
100 % HTML/CSS/JavaScript, sans dépendance ni étape de build.

## Fonctionnalités

- **3 modes** : Drapeau → Pays, Pays → Drapeau, Pays → Capitale
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
└── js/
    ├── data.js     # liste des pays (code ISO, nom, capitale, continent)
    ├── game.js     # logique : questions, score, sauvegarde, défi du jour
    └── ui.js       # affichage et événements
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

## Idées d'évolution

- Mode « saisie libre » avec tolérance aux fautes (distance de Levenshtein)
- Mode contre-la-montre (60 s)
- Carte du monde cliquable (SVG)
- Mode « révision » qui repropose les pays ratés

## Crédits

Drapeaux : [flagcdn.com](https://flagcdn.com).
