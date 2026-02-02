# don't touch my ball

Mouse-dodge game: your cursor is the ball. Random junk flies in—don’t touch it.

## Play

```bash
npm install
npm run serve
```

Then open `http://127.0.0.1:5173`.

### Controls

- Mouse: move
- `F`: fullscreen toggle
- `R`: restart

## Playwright validation loop

In one terminal:

```bash
npm run serve
```

In another terminal:

```bash
npm run pw:loop
```

Screenshots/state dumps land in `output/web-game/`.

