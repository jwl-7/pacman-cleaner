<div align="center">

# pacman-cleaner

**Wakka that terminal clean!**
Pac-Man and the four ghosts chomp through everything on screen, then leave you a clean slate.

[![npm version](https://img.shields.io/npm/v/pacman-cleaner.svg)](https://www.npmjs.com/package/pacman-cleaner)
[![license](https://img.shields.io/npm/l/pacman-cleaner.svg)](LICENSE)
[![node](https://img.shields.io/node/v/pacman-cleaner.svg)](package.json)

<img src="https://github.com/user-attachments/assets/c4534f67-7df8-4cab-9027-a4810b79fa58" alt="pacman-cleaner demo" width="720">

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

## Usage

```sh
pacman-cleaner [options]
pacclean [options]
```

| Option            | Description                             | Default   |
| ----------------- | --------------------------------------- | --------- |
| `--speed <name>`  | Animation speed              | `arcade`  |
| `--theme <name>`  | Color theme                 | `classic` |
| `-h`, `--help`    | Show help |         |
| `-v`, `--version` | Show version                        |           |

**Speeds**
- `arcade` (default)
- `chill`
- `fast`
- `turbo`

**Themes**
- `classic` (default)
- `neon`
- `matrix`
- `pastel`
- `dracula`
- `monokai`
- `nord`
- `gruvbox`
- `cupertino`
- `rainbow`
- `random`

### Examples

```sh
pacclean
pacclean --theme random
pacclean --speed fast
```

## Requirements

- Node.js 18+
- Truecolor (24-bit) terminal (Windows Terminal, iTerm2, Alacritty)
