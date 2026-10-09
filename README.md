<div align="center">

# 🟡 pacman-cleaner

**Clear your terminal the fun way.**
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

| Option                                    | Description                              | Default   |
| ----------------------------------------- | ---------------------------------------- | --------- |
| `--speed <snail\|normal\|fast\|turbo>`    | Animation speed                          | `normal`  |
| `--theme <classic\|neon\|matrix\|pastel>` | Color theme                              | `classic` |
| `--test`                                  | Print sample text first, to see it work  |           |
| `-h`, `--help`                            | Show help                                |           |
| `-v`, `--version`                         | Show the version                         |           |

Both `--speed fast` and `--speed=fast` work.

### Examples

```sh
pacclean                          # classic colors, normal speed
pacclean --theme neon --speed fast
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
