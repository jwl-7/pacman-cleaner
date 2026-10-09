<div align="center">

# 🟡 pacman-cleaner

**Clear your terminal the fun way!**
Pac-Man and the four ghosts chomp through everything on screen, then leave you a clean slate.

[![npm version](https://img.shields.io/npm/v/pacman-cleaner.svg)](https://www.npmjs.com/package/pacman-cleaner)
[![license](https://img.shields.io/npm/l/pacman-cleaner.svg)](LICENSE)
[![node](https://img.shields.io/node/v/pacman-cleaner.svg)](package.json)

<!-- Record with `vhs demo.tape` (see demo.tape), or any screen recorder, and save to assets/demo.gif -->
<img src="assets/demo.gif" alt="pacman-cleaner demo" width="720">

</div>

## Install

Try it without installing:

```sh
npx pacman-cleaner
```

Or install it globally:

```sh
npm install -g pacman-cleaner
```

This gives you two commands: `pacclean` (short) and `pacman-cleaner`.

## Usage

```sh
pacclean [options]
```

| Option            | Description                             | Default   |
| ----------------- | --------------------------------------- | --------- |
| `--speed <name>`  | Animation speed (see below)             | `arcade`  |
| `--theme <name>`  | Color theme (see below)                 | `classic` |
| `--test`          | Print sample text first, to see it work |           |
| `--themes`        | Preview every color theme               |           |
| `-h`, `--help`    | Show help                               |           |
| `-v`, `--version` | Show the version                        |           |

Both `--speed fast` and `--speed=fast` work.

**Speeds:** `chill`, `arcade` (default), `fast`, `turbo`

**Themes:** run `pacclean --themes` to preview them all.

- `classic` (default): the arcade-accurate colors
- `neon`, `matrix`, `pastel`
- `dracula`, `monokai` (Monokai Pro), `nord`, `gruvbox`: popular editor palettes
- `cupertino`: bright Apple-style system colors, good on light terminals
- `rainbow`: animated gradient that scrolls as everyone runs
- `random`: a different theme every run

### Examples

```sh
pacclean                          # classic colors, arcade speed
pacclean --theme monokai --speed fast
pacclean --theme random           # surprise me
pacclean --test --theme matrix    # fill the screen with test text, then clean it
```

## Requirements

- Node.js 18 or newer
- A truecolor (24-bit) terminal, such as Windows Terminal, iTerm2, or most modern Linux terminals

## Contributing

```sh
git clone https://github.com/jwl-7/pacman-cleaner.git
cd pacman-cleaner
npm install
npm start        # builds, then runs the animation with test text
```

## License

[MIT](LICENSE) © jwl-7
