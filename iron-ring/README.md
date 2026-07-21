# 🤖 IRON RING — prototype

Prototype jouable d'un jeu de **combat de robots 1v1 dans un ring**, inspiré de
*Real Steel*. Vue 3D top-down (façon Brawl Stars), pilotage temps réel, et une
boucle **combat → ferraille → amélioration des pièces → plus fort**.

> Nom de code provisoire. À changer quand tu veux.

---

## 🎯 La vision verrouillée (v0.1)

| Décision | Choix |
|---|---|
| **Où vit le skill** | Pilotage temps réel — tes réflexes comptent |
| **Format** | Duel 1v1 dans un ring |
| **Adversaire** | Solo vs IA (vagues de difficulté croissante) |
| **Techno** | Web / HTML5 + Three.js (jouable au navigateur, mobile inclus) |
| **Contrôles** | Joystick gauche + boutons (frappe / garde / esquive) |
| **Pièces** | 3 pièces = 3 stats : Bras, Jambes, Châssis |
| **Robot** | Un seul robot qu'on fait évoluer |

**Règle d'or du design :** une amélioration doit se **sentir** manette en main,
pas juste être un chiffre.
- 🦾 **Bras** → dégâts par coup (l'ennemi tombe plus vite)
- 🦿 **Jambes** → vitesse de déplacement + esquive (tu es plus agile)
- 🛡️ **Châssis** → points de vie (tu encaisses plus)

---

## ▶️ Lancer le proto

Le jeu utilise des modules ES, donc il faut le **servir** (pas juste ouvrir le
fichier). Depuis ce dossier :

```bash
cd iron-ring
python3 -m http.server 8123
```

Puis ouvre **http://localhost:8123** dans un navigateur.

### 📱 Le tester sur ton téléphone
- **Sur le même Wi-Fi :** remplace `localhost` par l'IP de ton PC
  (ex. `http://192.168.1.20:8123`).
- **Via GitHub Pages :** active Pages sur la branche → tu obtiens une URL
  publique ouvrable directement sur mobile.

Aucune connexion internet n'est requise au lancement : Three.js est **embarqué**
dans `vendor/` (rien à télécharger).

---

## 🎮 Contrôles

| | Tactile | Clavier |
|---|---|---|
| Se déplacer | joystick (moitié gauche de l'écran) | `WASD` / flèches |
| Frapper | bouton **FRAPPE** | `J` |
| Garder | bouton **GARDE** (maintenu) | `Maj` |
| Esquiver | bouton **ESQUIVE** | `Espace` |

La garde bloque 75 % des dégâts. L'esquive donne de brèves i-frames (tu passes
à travers le coup) — c'est le cœur du timing.

---

## 🗂️ Structure

```
iron-ring/
├── index.html         UI + styles + import map Three.js
├── vendor/
│   └── three.module.min.js   Three.js embarqué (MIT)
└── src/
    ├── config.js      ⚖️ tout l'équilibrage / game feel (à trifouiller)
    ├── state.js       progression + sauvegarde (localStorage)
    ├── input.js       joystick tactile + boutons + clavier
    ├── combat.js      scène 3D, robots, IA, boucle de combat
    └── main.js        enchaînement garage ↔ combat ↔ résultat
```

**Envie de régler le feel ?** Tout est dans `src/config.js` : dégâts, vitesse,
PV, portée, timing des coups, agressivité de l'IA, économie de la ferraille.

---

## 🧭 Ce que le proto prouve (et ce qu'il ne fait pas encore)

✅ La boucle complète : se battre, gagner de la ferraille, améliorer une pièce,
sentir la différence, affronter un adversaire plus dur.
✅ Combat temps réel lisible : approcher / frapper / garder / esquiver.
✅ IA qui monte en puissance à chaque vague.

🚧 **Pas encore :** vrais modèles 3D (tout est en greybox), combos, coups
spéciaux, armes/modules, PvP, sons soignés, écran-titre, feedback juteux poussé.

---

## 🛣️ Pistes pour la suite (à prioriser ensemble)

1. **Rendre le combat plus juteux** : hit-stop, particules, meilleurs sons,
   caméra plus vivante. (le plus rentable pour "est-ce que c'est fun ?")
2. **Un coup spécial** chargé (barre d'énergie qui se remplit).
3. **Armes / modules** : la 2e profondeur du système de pièces.
4. **Vrais robots** : remplacer les boîtes par des modèles.
5. Plus tard : PvP, collection de robots, méta plus riche.

---

## ❓ Décisions encore ouvertes

Ces choix ont été fixés par défaut pour aller vite — à rediscuter après avoir
joué :
- Contrôles : joystick+boutons vs gestes (swipe) ?
- Profondeur des pièces : rester à 3 stats, ou ajouter armes/modules ?
- Un seul robot, ou une collection à débloquer ?
