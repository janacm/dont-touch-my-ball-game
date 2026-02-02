Original prompt: Build and iterate a playable web game in this workspace, validating changes with a Playwright loop. The game should be mouse-based where your cursor is a ball and random items come flying at you and you have to move the cursor out of the way. Name of the game is "don't touch my ball".

## Notes
- Single-canvas HTML/JS game (no build step).
- Playwright integration hooks: `window.render_game_to_text()` and `window.advanceTime(ms)`.
- Playwright loop client is copied to `tools/web_game_playwright_client.js` so it can resolve local `playwright` (the skill script lives outside this repo and can’t see `node_modules`).
- On this machine, Playwright needs `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac15-arm64` because `os.cpus()` returns empty, causing Playwright to default to `mac-x64`.

## Test runs
- 2026-02-02: Ran Playwright loop against `http://127.0.0.1:5173` with `tools/actions_dodge.json`; screenshots + state dumps saved to `output/web-game/`.

## TODO
- Add more obstacle variety (shapes/behaviors).
- Add audio toggle + simple SFX.
- Tune difficulty curve (spawn rate + speeds).
