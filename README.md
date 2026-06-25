# 🌿 My Garden — plant care app

A self-contained phone app for your 25 plants. No account, no server — your data lives on your device.

## What it does
- **Today** — who needs water now (watering tasks only), plus a *needs attention* section for soggy / low-light / unwell plants, and *thriving*.
- **Garden** — a grid of all your plant-creatures, each with a mood face, rarity meter, and status.
- **Plant detail** — tap any creature: big portrait, rarity, light + watering needs, a one-tap **"I watered today"**, an editable last-watered date, care tip, **mood check-in**, **watering history**, **notes**, and a **photo journal** (camera/upload).
- **Monthly check-in** — tap *tools* (under the greeting) → quick tap-through to flag soggy/light/pest issues.
- **Reminders** — *tools → Export watering reminders (.ics)* → import once into your phone calendar for real notifications, one recurring event per plant on its own schedule.
- **Add plant** — for anything not yet in the cast.

## Run it on your computer
```
cd "Plants/PlantApp"
python3 -m http.server 8137
```
Open http://localhost:8137 in a browser.

## Put it on your phone (install to home screen)
The app needs to be served over **https** for full install + offline. Easiest free options:
1. Drag the `PlantApp` folder onto **netlify.com/drop** (or deploy to Vercel/GitHub Pages). You get a https link.
2. Open that link on your phone → **Share → Add to Home Screen**. It now has its own icon and runs full-screen, offline.
3. In the app, tap **tools → Export reminders**, open the downloaded `.ics`, and add to your calendar for notifications.

## Notes
- **Art is placeholder** — friendly generated creatures. Swap in real illustrations later by replacing the `creature()` renderer or dropping in image files per plant.
- First launch: every plant shows *"tap to set last watered"* — set each one's real date (or just tap *water ✓* when you next water it) and the schedule starts.
- Data is saved in your browser's local storage on that device. Same-species plants are tracked individually.

See `../Plant-Cast-List.md` for the full plant blueprint.
