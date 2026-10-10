#!/usr/bin/env node

/**
 * pacman-cleaner - clears the terminal by letting Pac-Man (and the four ghosts
 * chasing him) eat everything on screen, one band of rows at a time.
 */

import { readFileSync } from 'node:fs';

// package.json ships next to dist/, so this always matches the published version.
const { version: VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as { version: string };

// ---------------------------------------------------------------------------
// Terminal escape sequences
// ---------------------------------------------------------------------------

const ESC = '\x1B';
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;
const CLEAR_SCREEN = `${ESC}[2J${ESC}[1;1H`;
const RESET_COLOR = `${ESC}[0m`;
const QUERY_CURSOR_POSITION = `${ESC}[6n`;

const cursorTo = (row: number, col: number): string => `${ESC}[${row};${col}H`;
const rgb = (r: number, g: number, b: number): string => `${ESC}[38;2;${r};${g};${b}m`;
const hex = (color: number): string => rgb((color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff);

// ---------------------------------------------------------------------------
// Themes and speeds
// ---------------------------------------------------------------------------

// Eye colors are the same in every theme.
const COLOR_EYE_WHITE = rgb(255, 255, 255);
const COLOR_EYE_PUPIL = rgb(33, 33, 255);

/**
 * A solid color, or a function that colors a sprite column by column (given
 * the column within the sprite), which is how the rainbow theme works.
 */
type Paint = string | ((column: number) => string);

interface Theme {
  pacman: Paint;
  blinky: Paint;
  pinky: Paint;
  inky: Paint;
  clyde: Paint;
}

/** Current animation tick, so animated paints (rainbow) can shift over time. */
let animationTick = 0;

/** A color gradient across the sprite that slowly scrolls, starting at `offset` degrees of hue. */
const rainbow =
  (offset: number): Paint =>
  (column) =>
    hue(offset + column * 9 + animationTick * 6);

const THEMES: Record<string, Theme> = {
  classic: {
    pacman: rgb(255, 255, 0), // yellow
    blinky: rgb(255, 0, 0), // red
    pinky: rgb(255, 184, 255), // pink
    inky: rgb(0, 255, 255), // cyan
    clyde: rgb(255, 184, 82) // orange
  },
  neon: {
    pacman: rgb(255, 0, 127), // hot pink
    blinky: rgb(0, 255, 255), // neon cyan
    pinky: rgb(127, 0, 255), // electric purple
    inky: rgb(0, 255, 0), // neon green
    clyde: rgb(255, 127, 0) // neon orange
  },
  matrix: {
    pacman: rgb(0, 255, 100),
    blinky: rgb(0, 200, 60),
    pinky: rgb(0, 160, 40),
    inky: rgb(0, 255, 150),
    clyde: rgb(0, 110, 20)
  },
  pastel: {
    pacman: rgb(255, 223, 186),
    blinky: rgb(255, 179, 186),
    pinky: rgb(186, 225, 255),
    inky: rgb(204, 255, 204),
    clyde: rgb(255, 255, 186)
  },
  dracula: {
    pacman: hex(0xf1fa8c), // yellow
    blinky: hex(0xff5555), // red
    pinky: hex(0xff79c6), // pink
    inky: hex(0x8be9fd), // cyan
    clyde: hex(0xffb86c) // orange
  },
  monokai: {
    // Monokai Pro
    pacman: hex(0xffd866), // yellow
    blinky: hex(0xff6188), // red
    pinky: hex(0xab9df2), // purple
    inky: hex(0x78dce8), // cyan
    clyde: hex(0xfc9867) // orange
  },
  nord: {
    pacman: hex(0xebcb8b), // yellow
    blinky: hex(0xbf616a), // red
    pinky: hex(0xb48ead), // purple
    inky: hex(0x88c0d0), // frost
    clyde: hex(0xd08770) // orange
  },
  gruvbox: {
    pacman: hex(0xfabd2f), // yellow
    blinky: hex(0xfb4934), // red
    pinky: hex(0xd3869b), // pink
    inky: hex(0x83a598), // blue
    clyde: hex(0xfe8019) // orange
  },
  cupertino: {
    // Apple's system colors: clean and bright, and readable on light terminals.
    pacman: hex(0xffcc00), // yellow
    blinky: hex(0xff3b30), // red
    pinky: hex(0xff2d55), // pink
    inky: hex(0x5ac8fa), // teal
    clyde: hex(0xff9500) // orange
  },
  rainbow: {
    pacman: rainbow(0),
    blinky: rainbow(72),
    pinky: rainbow(144),
    inky: rainbow(216),
    clyde: rainbow(288)
  }
};

/** Not a palette: picks one of the themes above at random on each run. */
const RANDOM_THEME = 'random';

interface Speed {
  /** Delay between animation ticks. */
  speedMs: number;
  /** Columns travelled per tick. */
  moveStep: number;
  /** Ticks per Pac-Man mouth frame (lower = faster chomping). */
  mouthDivider: number;
}

const SPEEDS: Record<string, Speed> = {
  chill: { speedMs: 35, moveStep: 1, mouthDivider: 4 },
  arcade: { speedMs: 15, moveStep: 1, mouthDivider: 3 },
  fast: { speedMs: 8, moveStep: 2, mouthDivider: 2 },
  turbo: { speedMs: 4, moveStep: 3, mouthDivider: 1 }
};

const DEFAULT_SPEED = 'arcade';
const DEFAULT_THEME = 'classic';

/** Ticks per ghost "feet" frame. */
const GHOST_FRAME_TICKS = 4;
/** Distance between the leading edges of consecutive characters in the chase. */
const CHASE_SPACING = 38;
/** How long to wait for the terminal to report the cursor position. */
const CURSOR_QUERY_TIMEOUT_MS = 500;

// ---------------------------------------------------------------------------
// Sprites
// ---------------------------------------------------------------------------

const PACMAN_WIDTH = 32;
const GHOST_WIDTH = 28;

// Pac-Man facing right, from mouth closed (0) to wide open (4).
// Trailing spaces are omitted; every row is padded to PACMAN_WIDTH on load.
const PACMAN_FRAMES: string[][] = [
  [
    '          ████████████',
    '      ████████████████████',
    '    ████████████████████████',
    '  ████████████████████████████',
    '  ████████████████████████████',
    ' ██████████████████████████████',
    ' ██████████████████████████████',
    ' ██████████████████████████████',
    ' ██████████████████████████████',
    ' ██████████████████████████████',
    '  ████████████████████████████',
    '   ██████████████████████████',
    '     ██████████████████████',
    '       ██████████████████',
    '          ████████████'
  ],
  [
    '          ████████████',
    '      ████████████████████',
    '    ████████████████████████',
    '  ████████████████████████████',
    '  ████████████████████████████',
    ' ██████████████████████████████',
    ' ████████████████████████',
    ' ███████████████████',
    ' ████████████████████████',
    ' ██████████████████████████████',
    '  ████████████████████████████',
    '   ██████████████████████████',
    '     ██████████████████████',
    '       ██████████████████',
    '          ████████████'
  ],
  [
    '          ████████████',
    '      ████████████████████',
    '    ████████████████████████',
    '  ████████████████████████████',
    '  ██████████████████████████',
    ' ███████████████████████',
    ' ████████████████████',
    ' ████████████████',
    ' ████████████████████',
    ' ███████████████████████',
    '  ██████████████████████████',
    '   ██████████████████████████',
    '     ██████████████████████',
    '       ██████████████████',
    '          ████████████'
  ],
  [
    '          ████████████',
    '      ████████████████████',
    '    ████████████████████████',
    '  ████████████████████',
    '  ███████████████████',
    ' ██████████████████',
    ' ███████████████',
    ' ████████████',
    ' ███████████████',
    ' ██████████████████',
    '  ███████████████████',
    '   ███████████████████',
    '     ██████████████████████',
    '       ██████████████████',
    '          ████████████'
  ],
  [
    '          ████████████',
    '      ████████████████████',
    '    ████████████████',
    '  ████████████████',
    '  ████████████████',
    ' ██████████████',
    ' ████████████',
    ' ██████████',
    ' ████████████',
    ' ██████████████',
    '  ████████████████',
    '   ███████████████',
    '     ███████████████',
    '       ██████████████████',
    '          ████████████'
  ]
];

// Open the mouth, then close it again.
const PACMAN_FRAME_ORDER: number[] = [0, 1, 2, 3, 4, 3, 2, 1];

// Ghost facing right. █ = body, W = eye white, B = pupil.
const GHOST_FRAMES: string[][] = [
  [
    '                            ',
    '        ████████████        ',
    '      ████████████████      ',
    '    ████████████████████    ',
    '  ████████████████████████  ',
    '  ██████WWWW██████WWWW████  ',
    ' ██████WWWWWW████WWWWWW████ ',
    ' ██████WWWWBB████WWWWBB████ ',
    ' ██████WWWWBB████WWWWBB████ ',
    ' ██████████████████████████ ',
    ' ██████████████████████████ ',
    ' ██████████████████████████ ',
    ' ██████████████████████████ ',
    ' ██████  ████████  ████████ ',
    ' ████      ████      ████   '
  ],
  [
    '                            ',
    '        ████████████        ',
    '      ████████████████      ',
    '    ████████████████████    ',
    '  ████████████████████████  ',
    '  ██████WWWW██████WWWW████  ',
    ' ██████WWWWWW████WWWWWW████ ',
    ' ██████WWWWBB████WWWWBB████ ',
    ' ██████WWWWBB████WWWWBB████ ',
    ' ██████████████████████████ ',
    ' ██████████████████████████ ',
    ' ██████████████████████████ ',
    ' ██████████████████████████ ',
    ' ████████  ████████  ██████ ',
    '   ████      ████      ████ '
  ]
];

interface SpriteAnimation {
  frames: string[][];
  width: number;
  height: number;
  /**
   * Per row, the leftmost and rightmost column that is solid in *any* frame
   * (null if the row is always empty). Every tick repaints this whole span,
   * so pixels left behind by a previous frame (a closed mouth, the other
   * foot position) are erased rather than smeared across the screen.
   */
  hull: Array<[number, number] | null>;
}

function buildAnimation(rawFrames: string[][], width: number): SpriteAnimation {
  const height = rawFrames[0].length;

  const frames = rawFrames.map((frame, f) => {
    if (frame.length !== height) {
      throw new Error(`Sprite frame ${f} has ${frame.length} rows, expected ${height}`);
    }
    return frame.map((row, r) => {
      const trimmed = row.replace(/ +$/, '');
      if (trimmed.length > width) {
        throw new Error(`Sprite frame ${f}, row ${r} is wider than ${width} columns`);
      }
      return trimmed + ' '.repeat(width - trimmed.length);
    });
  });

  const hull: Array<[number, number] | null> = [];
  for (let r = 0; r < height; r++) {
    let first = -1;
    let last = -1;
    for (const frame of frames) {
      const row = frame[r];
      for (let c = 0; c < width; c++) {
        if (row[c] === ' ') continue;
        if (first === -1 || c < first) first = c;
        if (c > last) last = c;
      }
    }
    hull.push(first === -1 ? null : [first, last]);
  }

  return { frames, width, height, hull };
}

function mirror(animation: SpriteAnimation): SpriteAnimation {
  const flipped = animation.frames.map((frame) => frame.map((row) => row.split('').reverse().join('')));
  return buildAnimation(flipped, animation.width);
}

const PACMAN_RIGHT = buildAnimation(
  PACMAN_FRAME_ORDER.map((i) => PACMAN_FRAMES[i]),
  PACMAN_WIDTH
);
const PACMAN_LEFT = mirror(PACMAN_RIGHT);
const GHOST_RIGHT = buildAnimation(GHOST_FRAMES, GHOST_WIDTH);
const GHOST_LEFT = mirror(GHOST_RIGHT);

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Returns the escape sequence that paints one frame of a sprite with its
 * column 0 at screen column `x` and its row 0 at screen row `y` (1-based,
 * may be partly or fully off screen).
 *
 * Everything inside the sprite's hull is overwritten, which is what "eats"
 * the text underneath. `trail` extra columns behind the sprite are blanked
 * too, covering the gap left by moving more than one column per tick.
 */
function renderSprite(
  animation: SpriteAnimation,
  frameIndex: number,
  x: number,
  y: number,
  bodyColor: Paint,
  facingRight: boolean,
  trail: number,
  cols: number,
  rows: number,
  frontier?: Map<number, number>
): string {
  const frame = animation.frames[frameIndex % animation.frames.length];
  let buf = '';

  for (let r = 0; r < animation.height; r++) {
    const screenY = y + r;
    if (screenY < 1 || screenY > rows) continue;

    const span = animation.hull[r];
    if (!span) continue;

    let start = x + span[0];
    let end = x + span[1];
    if (facingRight) start -= trail;
    else end += trail;
    start = Math.max(1, start);
    end = Math.min(cols, end);
    if (start > end) continue;

    const row = frame[r];

    // With a frontier, only blank empty cells the sprite has already passed,
    // so text inside an open mouth stays until the mouth snaps shut on it.
    let rowFrontier = 0;
    if (frontier) {
      let edge = 0;
      for (let screenX = start; screenX <= end; screenX++) {
        const cell = row[screenX - x];
        if (cell === undefined || cell === ' ') continue;
        if (edge === 0 || (facingRight ? screenX > edge : screenX < edge)) edge = screenX;
      }
      rowFrontier = frontier.get(screenY) ?? (facingRight ? 0 : cols + 1);
      if (edge !== 0) {
        rowFrontier = facingRight ? Math.max(rowFrontier, edge) : Math.min(rowFrontier, edge);
      }
      frontier.set(screenY, rowFrontier);
    }

    if (!frontier) buf += cursorTo(screenY, start);

    let currentColor = '';
    let needMove = !!frontier;
    for (let screenX = start; screenX <= end; screenX++) {
      const cell = row[screenX - x]; // undefined in the trail region

      if (frontier && (cell === undefined || cell === ' ')) {
        const eaten = facingRight ? screenX <= rowFrontier : screenX >= rowFrontier;
        if (!eaten) {
          needMove = true;
          continue;
        }
      }
      if (needMove) {
        buf += cursorTo(screenY, screenX);
        needMove = false;
      }

      let color = RESET_COLOR;
      let out = ' ';
      if (cell === '█') {
        color = typeof bodyColor === 'function' ? bodyColor(screenX - x) : bodyColor;
        out = '█';
      } else if (cell === 'W') {
        color = COLOR_EYE_WHITE;
        out = '█';
      } else if (cell === 'B') {
        color = COLOR_EYE_PUPIL;
        out = '█';
      }

      if (color !== currentColor) {
        buf += color;
        currentColor = color;
      }
      buf += out;
    }

    if (currentColor !== RESET_COLOR) buf += RESET_COLOR;
  }

  return buf;
}

// ---------------------------------------------------------------------------
// Terminal helpers
// ---------------------------------------------------------------------------

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function terminalSize(): { cols: number; rows: number } {
  return { cols: process.stdout.columns || 80, rows: process.stdout.rows || 24 };
}

/**
 * Asks the terminal which row the cursor is on, so only the rows that
 * actually hold text get swept. Resolves with `fallback` if stdin is not a
 * terminal or the terminal does not answer in time.
 */
function queryCursorRow(fallback: number): Promise<number> {
  const stdin = process.stdin;
  if (!stdin.isTTY) return Promise.resolve(fallback);

  return new Promise((resolve) => {
    let pending = '';

    const finish = (row: number): void => {
      clearTimeout(timer);
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      resolve(row);
    };

    // The reply can arrive split across chunks or mixed with typed-ahead keys.
    const onData = (chunk: Buffer | string): void => {
      pending += chunk.toString();
      const match = /\x1B\[(\d+);\d+R/.exec(pending);
      if (match) finish(parseInt(match[1], 10));
    };

    const timer = setTimeout(() => finish(fallback), CURSOR_QUERY_TIMEOUT_MS);

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
    process.stdout.write(QUERY_CURSOR_POSITION);
  });
}

/** Hue 0-360 to a fully saturated color. */
function hue(degrees: number): string {
  const f = (n: number): number => {
    const k = (n + degrees / 60) % 6;
    return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return rgb(f(5), f(3), f(1));
}

type Segment = [text: string, color: string];

const GREEN = rgb(80, 250, 123);
const CYAN = rgb(139, 233, 253);
const YELLOW = rgb(241, 250, 140);
const ORANGE = rgb(255, 184, 108);
const RED = rgb(255, 85, 85);
const PURPLE = rgb(189, 147, 249);
const GRAY = rgb(130, 140, 160);
const WHITE = rgb(248, 248, 242);

/** A fake dev session, so the demo has plenty of colorful "mess" to clean up. */
const TEST_SESSION: Segment[][] = [
  [['$ ', GREEN], ['npm install left-pad', WHITE]],
  [['added 1337 packages, and audited 1338 packages in 4s', GRAY]],
  [['$ ', GREEN], ['git log --oneline', WHITE]],
  [['a1b2c3d ', YELLOW], ['fix everything (for real this time)', WHITE]],
  [['e4f5a6b ', YELLOW], ['it works on my machine', WHITE]],
  [['c7d8e9f ', YELLOW], ['TODO: write tests', WHITE]],
  [['$ ', GREEN], ['npm run build', WHITE]],
  [['✔ ', GREEN], ['compiled successfully in 1.2s', WHITE]],
  [['⚠ ', ORANGE], ['3 warnings: unused variable "ghost"', ORANGE]],
  [['✖ ', RED], ['0 errors, 99 problems', RED]],
  [['[INFO]  ', CYAN], ['server listening on http://localhost:3000', WHITE]],
  [['[DEBUG] ', PURPLE], ['wakka wakka wakka wakka wakka wakka', GRAY]],
  [['$ ', GREEN], ['echo "Hello, world!"', WHITE]],
  [['Hello, world!', CYAN]]
];

function rainbowBar(width: number): Segment[] {
  const cells: Segment[] = [];
  for (let i = 0; i < width; i++) cells.push(['█', hue((i / width) * 360)]);
  return cells;
}

/** Fills the screen with colorful fake terminal output for Pac-Man to eat. */
async function printTestText(cols: number, rows: number): Promise<void> {
  const lines = Math.max(1, Math.min(rows - 2, 40));
  const width = Math.max(1, cols - 1); // stay clear of the last column so nothing wraps
  let session = 0;

  for (let i = 0; i < lines; i++) {
    // A rainbow bar every sixth line, session output in between.
    const segments = i % 6 === 5 ? rainbowBar(width) : TEST_SESSION[session++ % TEST_SESSION.length];

    let buf = '';
    let left = width;
    for (const [text, color] of segments) {
      if (left <= 0) break;
      const part = text.slice(0, left);
      buf += color + part;
      left -= part.length;
    }
    process.stdout.write(buf + RESET_COLOR + '\n');
  }
  await delay(600);
}

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

interface Options {
  speed: string;
  theme: string;
  test: boolean;
  help: boolean;
  version: boolean;
}

const THEME_CHOICES = [...Object.keys(THEMES), RANDOM_THEME];

class UsageError extends Error {}

/** One help line per theme: its name, then Pac-Man and the four ghosts in its colors. */
function themeLines(): string[] {
  const width = Math.max(...THEME_CHOICES.map((name) => name.length));
  const solid = (paint: Paint): string => (typeof paint === 'function' ? paint(0) : paint);
  const swatch = (paints: Paint[], block: string): string =>
    paints.map((paint) => solid(paint) + block + RESET_COLOR).join(' ');

  return THEME_CHOICES.map((name) => {
    let sprites: string;
    let note = '';
    if (name === RANDOM_THEME) {
      // A Pac-Man from several different themes, since it could be any of them.
      const pool = Object.values(THEMES);
      sprites = swatch(Array.from({ length: 5 }, (_, i) => pool[(i * 2) % pool.length].pacman), '▒▒');
      note = '  a different theme every run';
    } else {
      const { pacman, blinky, pinky, inky, clyde } = THEMES[name];
      sprites = swatch([pacman, blinky, pinky, inky, clyde], '██');
      if (name === DEFAULT_THEME) note = '  (default)';
    }
    return `    ${name.padEnd(width)}  ${sprites}${note}`;
  });
}

// --test is deliberately left out of the help: it is for trying changes and recording demos.
function printHelp(): void {
  const rows: Array<[string, string]> = [
    ['--speed <name>', `Animation speed (default: ${DEFAULT_SPEED})`],
    ['--theme <name>', `Color theme (default: ${DEFAULT_THEME})`],
    ['-h, --help', 'Show this help'],
    ['-v, --version', 'Show the version']
  ];
  const width = Math.max(...rows.map(([flag]) => flag.length));
  const options = rows.map(([flag, text]) => `    ${flag.padEnd(width)}  ${text}`).join('\n');
  const speeds = Object.keys(SPEEDS)
    .map((name) => (name === DEFAULT_SPEED ? `${name} (default)` : name))
    .join(', ');

  console.log(`
  pacman-cleaner v${VERSION} - clear your terminal the fun way

  USAGE:
    pacclean [options]
    npx pacman-cleaner [options]

  OPTIONS:
${options}

  SPEEDS:
    ${speeds}

  THEMES:
${themeLines().join('\n')}
`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    speed: DEFAULT_SPEED,
    theme: DEFAULT_THEME,
    test: false,
    help: false,
    version: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const flag = eq === -1 ? arg : arg.slice(0, eq);

    const noValue = (): void => {
      if (eq !== -1) throw new UsageError(`${flag} does not take a value`);
    };

    // Accepts both "--flag value" and "--flag=value".
    const choice = (choices: string[]): string => {
      const raw = eq === -1 ? argv[++i] : arg.slice(eq + 1);
      if (raw === undefined || raw === '') {
        throw new UsageError(`${flag} requires a value (${choices.join(', ')})`);
      }
      const value = raw.toLowerCase();
      if (!choices.includes(value)) {
        throw new UsageError(`Unknown value "${raw}" for ${flag} (expected ${choices.join(', ')})`);
      }
      return value;
    };

    switch (flag) {
      case '--help':
      case '-h':
        noValue();
        options.help = true;
        break;
      case '--version':
      case '-v':
        noValue();
        options.version = true;
        break;
      case '--test':
        noValue();
        options.test = true;
        break;
      case '--speed':
        options.speed = choice(Object.keys(SPEEDS));
        break;
      case '--theme':
        options.theme = choice(THEME_CHOICES);
        break;
      default:
        throw new UsageError(`Unknown option: ${arg}`);
    }
  }

  return options;
}

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

/** Runs the whole chase once across the band of rows starting at `top`. */
async function sweepBand(top: number, facingRight: boolean, speed: Speed, theme: Theme): Promise<void> {
  const { speedMs, moveStep, mouthDivider } = speed;
  const pacman = facingRight ? PACMAN_RIGHT : PACMAN_LEFT;
  const ghost = facingRight ? GHOST_RIGHT : GHOST_LEFT;

  const ghostColors = [theme.blinky, theme.pinky, theme.inky, theme.clyde];
  const ghostOffsets = ghostColors.map((_, i) => (i + 1) * CHASE_SPACING);
  const lastOffset = ghostOffsets[ghostOffsets.length - 1];

  // Ghosts trail Pac-Man by the same gap in both directions.
  const ghostX = (pacmanX: number, offset: number): number =>
    facingRight ? pacmanX - offset : pacmanX + pacman.width - ghost.width + offset;

  // Per screen row, how far Pac-Man has already eaten (see renderSprite).
  const frontier = new Map<number, number>();

  // Start with Pac-Man just off screen.
  let x = facingRight ? 1 - pacman.width : terminalSize().cols + 1;

  for (let step = 0; ; step++) {
    // Re-read the size every tick so a resize mid-animation is harmless.
    const { cols, rows } = terminalSize();
    animationTick = step;

    // Done once the last ghost, and the trail it blanks, have left the screen.
    const tailX = ghostX(x, lastOffset);
    const finished = facingRight ? tailX - moveStep > cols : tailX + ghost.width - 1 + moveStep < 1;
    if (finished) break;

    let buf = '';
    const ghostFrame = Math.floor(step / GHOST_FRAME_TICKS);
    for (let i = 0; i < ghostColors.length; i++) {
      buf += renderSprite(
        ghost,
        ghostFrame,
        ghostX(x, ghostOffsets[i]),
        top,
        ghostColors[i],
        facingRight,
        moveStep,
        cols,
        rows
      );
    }
    const pacmanFrame = Math.floor(step / mouthDivider);
    buf += renderSprite(pacman, pacmanFrame, x, top, theme.pacman, facingRight, moveStep, cols, rows, frontier);

    if (buf) process.stdout.write(buf);

    await delay(speedMs);
    x += facingRight ? moveStep : -moveStep;
  }
}

async function run(options: Options): Promise<void> {
  if (!process.stdout.isTTY) {
    throw new UsageError('stdout is not a terminal, so there is nothing to clean');
  }

  const speed = SPEEDS[options.speed];
  const themeNames = Object.keys(THEMES);
  const themeName =
    options.theme === RANDOM_THEME ? themeNames[Math.floor(Math.random() * themeNames.length)] : options.theme;
  const theme = THEMES[themeName];

  if (options.test) {
    const { cols, rows } = terminalSize();
    await printTestText(cols, rows);
  }

  // Only sweep down to the row the cursor is on; everything below is empty.
  const screenRows = terminalSize().rows;
  const cursorRow = await queryCursorRow(screenRows);
  const lastTextRow = Math.max(1, Math.min(cursorRow, screenRows));

  let restored = false;
  const restore = (): void => {
    if (restored) return;
    restored = true;
    process.stdout.write(RESET_COLOR + CLEAR_SCREEN + SHOW_CURSOR);
  };
  const exitOn = (signal: NodeJS.Signals, code: number): void => {
    process.once(signal, () => {
      restore();
      process.exit(code);
    });
  };
  exitOn('SIGINT', 130);
  exitOn('SIGTERM', 143);

  process.stdout.write(HIDE_CURSOR);
  try {
    // Bands tile the text rows; the last one is pulled up so it ends on the
    // last text row instead of hanging below it.
    const height = PACMAN_RIGHT.height;
    const tops: number[] = [];
    for (let top = 1; top <= lastTextRow; top += height) tops.push(top);
    if (tops.length > 1) tops[tops.length - 1] = Math.max(1, lastTextRow - height + 1);

    for (let sweep = 0; sweep < tops.length; sweep++) {
      await sweepBand(tops[sweep], sweep % 2 === 0, speed, theme);
    }
  } finally {
    restore();
  }
}

async function main(): Promise<void> {
  let options: Options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    console.error(`pacman-cleaner: ${err.message}`);
    console.error('Run "pacclean --help" for usage.');
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }
  if (options.version) {
    console.log(`pacman-cleaner v${VERSION}`);
    return;
  }

  await run(options);
}

main().catch((err: unknown) => {
  const message = err instanceof UsageError ? err.message : err instanceof Error ? err.stack || err.message : String(err);
  console.error(`pacman-cleaner: ${message}`);
  process.exitCode = 1;
});