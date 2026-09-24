# Della's BIAB Nails: website & online booking

A small website for Della's nail business:

- **Price list**: grouped like the flyer (BIAB, Acrylic, Toes, Extras), including "£4 extra" / "£2 per nail" add-ons
- **Working days**: opening hours for each day
- **Online booking**: customers pick a treatment, then a date, a free time and their details. Times already booked, days off and closed days are never offered, and two people can't book the same slot
- **Admin page** at `/admin.html` (password protected) where Della can:
  - see upcoming bookings (with tap-to-call / WhatsApp links) and cancel or restore them
  - change prices, treatment lengths and names, and add or remove treatments
  - change working days and hours
  - block out holidays or part-days

## Running it

Needs [Node.js](https://nodejs.org) 22.13 or newer. Nothing else: the database is built in.

```bash
npm install
ADMIN_PASSWORD=choose-a-password npm start
# open http://localhost:3000   (admin: http://localhost:3000/admin.html)
```

| Setting          | What it does                                              | Default            |
| ---------------- | --------------------------------------------------------- | ------------------ |
| `ADMIN_PASSWORD` | Password for the admin page (**required**)                | none               |
| `PORT`           | Port to listen on                                         | `3000`             |
| `DATABASE_FILE`  | Where bookings, prices and hours are saved                | `data/bookings.db` |
| `TRUST_PROXY`    | Set to `1` when running behind a hosting provider's proxy | off                |

Run the tests with `npm test`.

## Changing the words on the site

Prices, hours and time off are all changed from the admin page. Everything else lives in
[`config.json`](config.json): business name, tagline, WhatsApp number, Facebook link, the
policies at the bottom, how much notice is needed (`minNoticeHours`), how far ahead people
can book (`bookingWindowDays`) and the gap between offered start times (`slotIntervalMinutes`).

The seasonal banner at the top of the page is `announcement`. Set `"show": false` to hide it,
or change the title and text for Christmas, Valentine's and so on. Restart the site after editing.

> The treatment **lengths** were guessed (they aren't on the flyer). Della should check
> them in Admin → Prices, because they decide which times are offered.

## Putting it online

**Easiest: Render.** The included [`render.yaml`](render.yaml) sets everything up. In Render choose
*New → Blueprint*, pick this repo and branch, and enter an admin password when asked.

**Other hosts.** It needs a host that runs Node.js and keeps a file between restarts (for the database), for example
[Render](https://render.com) (with a persistent disk), [Railway](https://railway.app) (with a volume) or
[Fly.io](https://fly.io) (with a volume). In each case:

1. Connect this GitHub repo and use `npm install` as the build command and `npm start` as the start command.
2. Set `ADMIN_PASSWORD`, `TRUST_PROXY=1` and `DATABASE_FILE` pointing inside the persistent disk/volume
   (e.g. `/data/bookings.db`).
3. Optionally point a domain such as `dellasnails.co.uk` at it.

Back up the database file now and then: it holds all the bookings.

## How it's built

- `src/server.js`: Express server and JSON API (public booking + admin)
- `src/availability.js`: works out free times from hours, bookings and time off
- `src/db.js`: SQLite tables (Node's built-in `node:sqlite`) and the starting price list
- `public/`: the website (`index.html`, `app.js`) and admin page (`admin.html`, `admin.js`), plain HTML/CSS/JS
