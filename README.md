# Melova

Aplikasi musik pribadi buat HP dan laptop. Lagu dari file lo sendiri (MP3, M4A, FLAC, OGG, Opus, WAV),
disimpen di dalam app, bisa diputer offline, dan bisa di-install kayak app biasa (PWA).

Dibangun pakai metode [replica-skill](https://github.com/Jakeschincariol/replica-skill): fitur dan alur
pemutar musik streaming di-rebuild dari nol, dengan nama, logo, warna, dan teks sendiri.

## Fitur

- Import lagu (pilih file, pilih satu folder, atau drag & drop ke jendela)
- Baca tag otomatis: judul, artis, album, nomor track, cover art (ID3, FLAC, M4A)
- Home: sapaan, akses cepat, "Jump back in", baru ditambah, artis, playlist
- Search: lagu, artis, album, playlist
- Library: filter Playlists / Artists / Albums, Liked Songs, All songs (bisa di-sort)
- Halaman album, artis, playlist dengan warna header dari cover
- Playlist: bikin, rename, hapus, tambah/hapus lagu, cari lagu buat ditambah
- Player: play/pause, next/prev, seek, shuffle, repeat (all/one), volume, queue, play next
- Layar Now Playing full screen, mini player di HP
- Sleep timer (15/30/45/60 menit)
- Kontrol di lock screen, earphone, dan tombol media keyboard (Media Session)
- Inget lagu terakhir & posisinya setelah app ditutup
- Shortcut laptop: Space play/pause, Shift+←/→ prev/next, Alt+←/→ mundur/maju 10 detik, Shift+↑/↓ volume

## Jalanin di laptop

```bash
npm install
npm run dev
```

Buka http://localhost:5173. Versi produksi: `npm run build` lalu `npm run preview` (port 4173).

## Pakai di HP

Biar bisa di-install dan jalan offline di HP, app-nya harus dibuka lewat HTTPS. Caranya: upload folder
`dist/` (hasil `npm run build`) ke hosting statis gratis, misalnya Netlify, Vercel, Cloudflare Pages,
atau GitHub Pages. Abis itu:

- **Android (Chrome):** buka link-nya → menu ⋮ → *Install app* / *Add to Home screen*
- **iPhone (Safari):** buka link-nya → tombol Share → *Add to Home Screen*
- **Laptop (Chrome/Edge):** klik ikon install di address bar

Hosting cuma nyimpen kode app-nya. Lagu lo nggak pernah di-upload ke mana-mana.

## Penting: library per perangkat

Lagu disimpen di storage browser (IndexedDB) di masing-masing perangkat. Jadi lagu yang di-import di
laptop nggak otomatis muncul di HP. Import di tiap perangkat. Kalau clear data browser / uninstall app,
library di perangkat itu ikut kehapus (file asli lo tetap aman).

## Struktur

```
src/lib/db.ts        IndexedDB (tracks, audio, covers, playlists)
src/lib/tags.ts      pembaca tag ID3 / FLAC / MP4
src/lib/library.ts   import, like, playlist, grouping album/artis
src/lib/player.ts    mesin audio, queue, shuffle, repeat, sleep timer, Media Session
src/components/      shell, player bar, now playing, track list, menu, dialog
src/views/           Home, Search, Library, Collection (album/artis/playlist)
public/              manifest, service worker, ikon
scripts/make-icons.mjs  generate ikon PNG dari logo
test-music/          lagu dummy buat ngetes (MP3 senyap bertag + nada WAV)
replica/             catatan fitur & brand (format replica-skill)
```
