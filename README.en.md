# VALORANT Player Analysis (unofficial)

[日本語](README.md) · **English**

A static site that reads the VALORANT disclosure ZIP you receive from Riot Games — without extracting it — and shows your match history, reports, payments, and store purchases. Data is processed on your device and is never sent anywhere. Display data is saved inside your browser so it survives a reload; clear it after use on shared devices. This is not an official Riot Games service.

## Run locally

There are no dependencies. Serve the site with an HTTP server and open it (ZIP extraction and aggregation happen in the browser and are never sent to the server).

```bash
npm run preview     # serves site/ with Python 3's http.server
```

Open <http://127.0.0.1:4173/> in your browser. Stop with `Ctrl+C`.

1. **How to Use** walks you from [Riot's official data request](https://support.riotgames.com/riot/data-request) through loading.
2. **Upload data**: choose the [fictional sample ZIP](<samples/valorant-sample.zip>), a ZIP you received from Riot, or a target JSON. No extraction is needed. Do not copy real data into this repository — select it from its original location.
3. **View demo**: explore the home and detail screens with fictional data. Clear it with **More → Data management → Clear data** on PC (or **More → Clear data** on mobile). Your original file is not deleted.

On Windows under WSL, `npm run preview:windows` lets you open it in a Windows-side browser.

[Device review guide](<aidlc-docs/construction/review.md>) · [Technical design](<aidlc-docs/construction/technical-design.md>) · [Screen design](<aidlc-docs/inception/screen-design.md>)

## Development and testing

Node.js 22 or later. No npm dependencies, external CDNs, environment variables, or API keys are required. Python 3 is needed for the local preview, and a Chromium-based browser for the browser tests.

```bash
npm run build      # bundle the worker for distribution
npm run fixtures   # regenerate the fictional ZIPs (never run on real data)
npm test           # normalization, ZIP, and worker tests
npm run test:browser  # browser test (set VALORANT_CHROME if needed)
```

## In-game name dictionary

Japanese/English names for skins, levels, variants, cards, buddies, and sprays use public metadata from [Valorant-API](https://valorant-api.com/) (unofficial). In-game names are the property of Riot Games. The dictionary ships with the site, which makes no external API calls while you browse. Unknown names are shown with their original text. Run `node scripts/update-item-catalog.mjs` only when you want to refresh the public dictionary — it never reads a personal ZIP.

GitHub Pages serves only [`site/`](<site/>). Before publishing, verify on a real device and with a real ZIP, then decide the public URL, display name, and Riot Developer Portal product registration. Never commit, publish, or share real data.
