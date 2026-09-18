# Sound Passport

Sound Passport is a personal music catalog for choosing one definitive track for every genre. It can search Spotify, index local audio files, and keep the resulting passport in the browser.

## What it does

- Browses a curated catalog of genres and representative tracks.
- Imports Liked Songs and readable playlists from Spotify.
- Reads metadata from a local music folder without uploading the audio.
- Stores library data and genre selections on the current device.
- Exports selected Spotify tracks to a private playlist.

## Run it locally

Requires Node.js 22.13 or newer and a Spotify developer application.

Set these values in your local environment:

```dotenv
SPOTIPY_CLIENT_ID=your_client_id
SPOTIPY_CLIENT_SECRET=your_client_secret
SPOTIPY_REDIRECT_URI=http://127.0.0.1:3000/api/spotify/callback
```

Add the same redirect URI to the Spotify application, then run:

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

Spotify access covers library reading and private-playlist creation. Credentials stay on the server. Imported library data and passport selections stay in the browser.

The public source contains empty library and review fixtures. Local development can restore private data from the ignored `.private-data/data` directory, including the assignments mirror at `.private-data/data/assignments.json`.

## Checks

```bash
npm run lint
npm run typecheck
npm test
```

`npm run deploy` builds and deploys the Cloudflare Worker. Configure the three `SPOTIPY_*` values as Cloudflare secrets before deploying.
