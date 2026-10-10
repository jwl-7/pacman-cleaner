<div align="center">

# pacman-cleaner

Wakka that terminal clean!

<img src="https://github.com/user-attachments/assets/c4534f67-7df8-4cab-9027-a4810b79fa58" alt="pacman-cleaner demo" width="720">

</div>

## Install

Try it without installing:

```sh
npx github:jwl-7/pacman-cleaner
```

Or install it globally:

```sh
npm install -g github:jwl-7/pacman-cleaner
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

### Example

```sh
pacclean
pacclean --theme random
pacclean --speed fast
```

## Requirements

- Node.js 18+
- Truecolor (24-bit) terminal (Windows Terminal, iTerm2, Alacritty)
