# Shop Inventory (FRC)

A phone-first web app that shows what parts the shop has, how many there are, and where they are.
No login, no build step: just static files.

## Run it

```
python server.py
```

Then open http://localhost:5317. `python server.py --lan` also lets phones on the same Wi-Fi open it
at your computer's IP. `server.py` serves the app and runs the web photo search (it needs curl, which
Windows 10+, macOS and Linux ship with).

The app also works from any static host (GitHub Pages, Netlify, Vercel) with "Add to Home Screen",
but web photo search is off there; uploading a photo still works.

## Admin mode and product photos

- Settings → Admin mode. No login yet, so it's a switch saved on that device.
- With admin mode on, tap a part's photo: search the web, upload/take a photo, or go back to the original.
- In "New part" / "Edit part", type the name and press **Find a photo**. Pick the result that matches
  the part in the shop and it becomes the cover, so every card looks the same way.
- Every photo you pick, upload or paste opens in a cropper first (drag the corners; "Whole photo" undoes).
  "Crop this photo" crops the current one, e.g. one breaker out of REV's 4-breaker family shot.
- Paste straight from Google Images: right-click → Copy image, then Ctrl+V (⌘V) while the photo editor,
  "Find a photo" or the part form is open. "Paste image" buttons do the same where the browser allows it.
- Picked photos are resized to 800px and saved with the part (`coverImg`, `coverBy` = where it came from).
- New photos and names in `data.js` now reach saved data on reload without a reset; counts and
  anything changed in the app are kept.

## Files

- `data.js`: the starting parts list, places and categories. Edit it to change the defaults.
- `app.js`: search, filters, part details, count updates, add/edit/delete.
- `styles.css`: light and dark themes.
- `img/`: shop photos (converted from the HEIC originals). `img/thumb/` holds the small versions.
- `img/cover/`: product photos from REV Robotics, AndyMark, WCP, Grapple Robotics and Wikimedia Commons.
  `img/cover/_sources.json` lists where each one came from (also shown in the slideshow).
  `gen-*.jpg` covers are AI-generated reference images (ChatGPT), labeled as such in the slideshow.
  The 8-32 screw covers follow the shop's painted-head color code (yellow 1/4" … brown 2-1/2").
- Each part has `cover` (product photo), `conf` (count accuracy: perfect / good / rough / bad), and its
  shop photos come from `img` plus `RELATED` in `data.js`, dated from `PHOTO_DATES`.

## Notes

- Counts in `data.js` are rough estimates read off the Nov 7 photos. Recount and update them in the app.
- Changes save in the browser on that device only (localStorage). Use Settings → Download data to back them up.
- Each part's card is a crop of the shop photo where it lives (`f: [x%, y%, zoom]` in `data.js`).

## Counting

Counts are entered by hand: tap the big number on a part's page and type, or use − / +.
The ×1 button between them switches the step to ×5, ×10 or ×25 for big bins.
Pick how accurate the count is (Perfect / Good / Rough / Way off) under it.

## Deleting parts

"Delete part" is at the bottom of a part's page and in Edit part. Tap it twice (the first tap
arms it for a few seconds). Deleted parts from `data.js` stay deleted on reload.

## Shared inventory (Supabase)

Without setup, every phone keeps its own copy. To share one inventory with everyone:

1. Make a free project at https://supabase.com (sign in with GitHub works).
2. In the project: **SQL Editor → New query**, paste all of `supabase.sql`, press **Run**.
3. **Project Settings → API**: copy the **Project URL** and the **publishable** key
   (older projects call it the **anon public** key). Never use the `service_role` / secret key.
4. Put both in `config.js` and push. That's it.

How it works: each part is one row. A change uploads just that part; other people's changes
are fetched every 6 seconds (and when the app comes back to the front), and cards someone
else changed flash green. Offline edits wait and upload later ("Offline · will sync" under
the title). If two people change the same part, the last save wins.
There's no login yet, so anyone with the link can edit. Rows can't be removed from the
website (deleting a part marks it deleted), so nobody can wipe the table from the app.

## Sets

`items` on a part (screwdrivers, crimpers, hex keys) lists each tool with its own photo from `img/items/`.
Items with a `group` and no photo (wrench sizes) show as a size list behind the + button.
