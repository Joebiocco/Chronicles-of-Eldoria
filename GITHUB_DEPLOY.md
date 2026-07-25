# Deploy or replace the live GitHub Pages game

Repository:

```text
https://github.com/joebiocco/Chronicles-of-Eldoria
```

Expected live URL:

```text
https://joebiocco.github.io/Chronicles-of-Eldoria/
```

## Replace the current repository through GitHub’s website

The safest browser-only method is to delete the old repository and recreate it, or remove its old contents first. Then:

1. Extract `chronicles-of-eldoria-memory-beneath-1.1.1-mobile-fix.zip`.
2. Open the extracted folder.
3. Confirm that `index.html`, `src`, `assets`, and `sw.js` are directly visible.
4. Create the public repository `Chronicles-of-Eldoria` without a generated README.
5. Choose **uploading an existing file**.
6. Press `Ctrl+A` inside the extracted folder and drag all selected contents into GitHub.
7. Wait until every upload finishes.
8. Confirm GitHub shows paths such as:

```text
index.html
src/main.js
src/memory-ui.js
assets/eldoria-map.png
assets/icons/ui/sprite.svg
```

9. Commit directly to `main`.
10. Open **Settings → Pages**.
11. Select **Deploy from a branch → main → / (root)**.
12. Wait for the green Pages deployment in **Actions**.

Do not upload only the ZIP. Do not create an extra outer folder in the repository.

## Verify the deployment

These URLs should load real files rather than 404 pages:

```text
https://joebiocco.github.io/Chronicles-of-Eldoria/index.html
https://joebiocco.github.io/Chronicles-of-Eldoria/src/main.js
https://joebiocco.github.io/Chronicles-of-Eldoria/src/memory-content.js
https://joebiocco.github.io/Chronicles-of-Eldoria/assets/eldoria-map.png
https://joebiocco.github.io/Chronicles-of-Eldoria/assets/icons/ui/sprite.svg
```

## Clear the previous PWA once

Because the same URL previously hosted an older service worker:

1. Open the live site in Chrome or Edge.
2. Press `F12`.
3. Open **Application → Storage**.
4. Choose **Clear site data**.
5. Open **Application → Service Workers**.
6. Unregister the old worker if one remains.
7. Close the tab.
8. Reopen the live URL and press `Ctrl+Shift+R`.

After 1.1.1 controls the page, future releases can use the game’s built-in update prompt.

## Preserve a current live save

Before replacing the site, export the account from the old game. Version 1.1.1 includes migrations and legacy import, but an exported JSON file is still the safest backup.
