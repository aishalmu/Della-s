# Aisha’s Bible

A personal life planner for 1 September 2026 – 31 December 2027, built from the
`design_handoff_aishas_bible` design. It runs in the browser, works offline and
can be installed on an iPad home screen.

Built with Vite, React and TypeScript, and installable as a PWA (via `vite-plugin-pwa`).

## Pages

- **Planner:** Home, Year, Month, Week, Daily page
- **Life:** Goals & vision, Habits, Budget, Meals, Cleaning, Self-care
- **Loves:** Reading, Crochet, Create, Pilates, Travel

The Cleaning page was not in the design. It has a daily routine grid (Mon–Sun), this
week’s jobs, a monthly deep clean and a supplies list. Every job name can be edited.

## Where data is kept

- Everything you type is saved on the device in `localStorage['aisha-bible-v1']`,
  using the key schema from the handoff README. Cleaning uses `cl:` keys.
- Photos (vision board and crochet) are shrunk to at most 1200px and stored in IndexedDB
  (`aisha-bible-images`).
- Nothing is sent anywhere. There is no account and no server.

### Backup & restore

The **Backup & restore** button at the bottom of the sidebar:

- **Export backup** saves one `.json` file with all your entries and photos. On iPad it
  opens the share sheet; choose **Save to Files** and pick iCloud Drive.
- **Import a backup** reads a file you exported and shows its date before replacing
  anything.

Under the button you can see when you last backed up. It turns rose once it has been
more than two weeks.

## Develop

```sh
npm install
npm run dev       # local dev server
npm test          # unit tests
npm run build     # production build in dist/
npm run preview   # serve the build locally
```

`npm run icons` redraws the home-screen icons with Playwright:
`NODE_PATH="$(npm root -g)" npm run icons`.

## Put it online and install it on the iPad

An iPad can only install the app from an `https://` address, so `dist/` has to be hosted
somewhere. It is a static site with no server code, and it uses relative paths, so any
static host works:

- **Netlify Drop:** run `npm run build`, then drag the `dist` folder onto
  <https://app.netlify.com/drop>.
- **Render / Netlify / Vercel / Cloudflare Pages from this repo:** root directory
  `aishas-bible`, build command `npm install && npm run build`, publish directory `dist`.

Then on the iPad:

1. Open the address in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Open it from the home screen. It now runs full screen and works without internet.

Updates install themselves the next time the app is opened while online.

Data belongs to the browser the app was installed from. Safari and the home-screen app
keep separate storage, so always use the home-screen icon. To move to a new device,
export a backup on the old one and import it on the new one.
