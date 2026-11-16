# Fivefold Studio Bot

Bot Discord (en anglais) pour le serveur Fivefold Studio + panel web pour envoyer des messages.

## Installation

1. Va sur https://discord.com/developers/applications → **New Application**
2. Onglet **Bot** → *Reset Token* → copie le token
3. Toujours dans **Bot**, active **Server Members Intent** (obligatoire pour le message de bienvenue / autorole)
4. Onglet **OAuth2 → URL Generator** : coche `bot` + `applications.commands`, puis la permission **Administrator** (ou au minimum : Manage Roles, Manage Channels, Kick, Ban, Moderate Members, Manage Messages, Send Messages, Add Reactions, Create Public Threads). Ouvre le lien et invite le bot.
5. Copie `.env.example` en `.env` et remplis les IDs (Discord → Paramètres → Avancés → Mode développeur, puis clic droit → *Copier l'identifiant*)
6. Dans les paramètres du serveur → Rôles, place le rôle du bot **au-dessus** du rôle autorole et des membres à modérer.

```bash
npm install
npm start
```

Les commandes slash sont enregistrées automatiquement à chaque démarrage.

## Hébergement sur Railway

1. Sur https://railway.com → **New Project → Deploy from GitHub repo** → choisis `FiveFold-Support`.
2. Dans le service → onglet **Variables** → **Raw Editor**, colle tes variables (même format que `.env.example`) :
   `DISCORD_TOKEN`, `GUILD_ID`, `WELCOME_CHANNEL_ID`, `AUTOROLE_ID`, `MOD_LOG_CHANNEL_ID`, `STAFF_ROLE_ID`,
   `TICKET_CATEGORY_ID`, `ANNOUNCE_CHANNEL_ID`, `SUGGESTION_CHANNEL_ID`, `PANEL_PASSWORD`.
   Ne mets **pas** `PANEL_HOST` ni `PANEL_PORT` : Railway fournit `PORT` tout seul.
3. Onglet **Settings → Networking → Generate Domain** : ça te donne l'adresse HTTPS du panel.
4. (Recommandé) Clic droit sur le service → **Attach Volume**, monté sur `/data`, puis ajoute la variable `DATA_DIR=/data`.
   Sans ça, les warnings sont effacés à chaque redéploiement.

Chaque `git push` sur `main` redéploie le bot automatiquement.
Le panel est alors public sur Internet : mets un `PANEL_PASSWORD` long (20+ caractères).

## Panel web

Mets un vrai mot de passe dans `PANEL_PASSWORD`, lance le bot, puis ouvre http://127.0.0.1:3000.
Choisis le salon, écris le message (texte et/ou embed avec titre, couleur, image), aperçu en direct, et **Send**.

Par défaut le panel n'est accessible que depuis ton PC. Pour y accéder ailleurs, mets `PANEL_HOST=0.0.0.0`
— mais alors utilise un mot de passe long, et idéalement passe par HTTPS (ex. Cloudflare Tunnel).

## Commandes

| Commande | Qui | Description |
|---|---|---|
| `/ban` `/kick` `/timeout` | Staff | Sanctions, loggées dans `MOD_LOG_CHANNEL_ID` |
| `/warn` `/warnings` | Staff | Avertissements (stockés dans `data/warns.json`) |
| `/clear` | Staff | Supprime 1 à 100 messages |
| `/announce` | Admin | Annonce en embed dans `ANNOUNCE_CHANNEL_ID` (ping @everyone et bouton "Play now" optionnels) |
| `/ticket-panel` | Admin | Menu de tickets par catégorie (bug, report, partenariat, autre), avec Claim, Close et transcript envoyé dans les logs |
| `/add` `/delete` | Staff ou créateur du ticket | Ajoute ou retire quelqu'un d'un ticket (dans le salon du ticket) |
| `/suggest` | Tout le monde | Suggestion avec votes ✅ ❌, fil de discussion, et boutons Approve/Deny pour le staff |
| `/roblox` | Tout le monde | Profil Roblox (avatar, amis, followers, date de création) |
| `/help` `/ping` | Tout le monde | Liste des commandes cliquables, latence |
| `/userinfo` `/serverinfo` | Tout le monde | Infos d'un membre (avec nb de warns) ou du serveur |

Les permissions des commandes peuvent être ajustées dans Paramètres du serveur → Intégrations → le bot.
