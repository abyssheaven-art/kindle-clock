# Kindle Clock

Large always-on clock page for Kindle's built-in browser.

## Deploy to GitHub Pages

This is a static site. GitHub Pages serves the repository's `main` branch directly,
with no build step or server process.

After GitHub Pages is enabled, open the generated `https://<account>.github.io/kindle-clock/`
URL in the Kindle browser.

## Local Preview

```sh
python3 -m http.server 8765 --directory kindle-clock
```

Then open:

```text
http://127.0.0.1:8765/
```

For Kindle access on the same Wi-Fi, replace `127.0.0.1` with this Mac's LAN IP address.
