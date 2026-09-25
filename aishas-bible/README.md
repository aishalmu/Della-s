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

## Put it online (password protected)

`npm start` runs a small server (`server/`) that shows a sign-in page and only
serves the planner after the right password. The password comes from the
`APP_PASSWORD` environment variable and is never stored in the repo. Signing in
keeps a device unlocked for about a year; changing `APP_PASSWORD` signs every
device out. After 10 wrong tries from one address, sign-in pauses for 15 minutes.
Search engines are told not to index the site.

The planner's entries never reach the server. They stay on the device.

### Render

Dashboard → **New → Web Service** → the `aishas-bible` repository, then:

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Runtime | Node |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |
| Instance type | Free works. It sleeps when unused, so the first sign-in can take up to a minute. Starter keeps it awake. |

Environment variables:

| Key | Value |
| --- | --- |
| `APP_PASSWORD` | the password you want (long is better) |
| `TRUST_PROXY` | `1` |
| `NODE_VERSION` | `22` |

To try the server locally: `npm run build && APP_PASSWORD=something npm start`, then open <http://localhost:3000>.

## Install it on the iPad

1. Open the Render address (`https://….onrender.com`) in **Safari** and sign in.
2. Tap **Share → Add to Home Screen**.
3. Open it from the home screen. If it asks for the password again, sign in once more. The home-screen app keeps its own sign-in.
4. From then on it opens straight away and works without internet.

Updates install themselves the next time the app is opened while online.

Data belongs to the browser the app was installed from. Safari and the home-screen app
keep separate storage, so always use the home-screen icon. To move to a new device,
export a backup on the old one and import it on the new one.
