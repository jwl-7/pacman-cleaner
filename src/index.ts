#!/usr/bin/env node

const HIDE_CURSOR = '\x1B[?25l';
const SHOW_CURSOR = '\x1B[?25h';
const CLEAR_SCREEN = '\x1B[2J\x1B[1;1H';
const RESET_COLOR = '\x1B[0m';

// Arcade Accurate Truecolor (24-bit RGB) Escape Codes
const COLOR_PACMAN = '\x1B[38;2;255;255;0m';   // #FFFF00
const COLOR_BLINKY = '\x1B[38;2;255;0;0m';     // #FF0000
const COLOR_PINKY = '\x1B[38;2;255;184;255m';  // #FFB8FF
const COLOR_INKY = '\x1B[38;2;0;255;255m';     // #00FFFF
const COLOR_CLYDE = '\x1B[38;2;255;184;82m';   // #FFB852
const COLOR_WHITE = '\x1B[38;2;255;255;255m';  // Ghost Eyes (Sclera)
const COLOR_BLUE = '\x1B[38;2;33;33;255m';     // Ghost Eyes (Pupils)

// Classic Solid Pac-Man Frames (15x32)
const BASE_FRAMES: string[][] = [
  // Frame 0: Closed
  [
    '          ████████████          ',
    '      ████████████████████      ',
    '    ████████████████████████    ',
    '  ████████████████████████████  ',
    '  ████████████████████████████  ',
    ' ██████████████████████████████ ',
    ' ██████████████████████████████ ',
    ' ██████████████████████████████ ',
    ' ██████████████████████████████ ',
    ' ██████████████████████████████ ',
    '  ████████████████████████████  ',
    '   ██████████████████████████   ',
    '     ██████████████████████     ',
    '       ██████████████████       ',
    '          ████████████          '
  ],
  // Frame 1: Slight Open
  [
    '          ████████████          ',
    '      ████████████████████      ',
    '    ████████████████████████    ',
    '  ████████████████████████████  ',
    '  ████████████████████████████  ',
    ' ██████████████████████████████ ',
    ' ████████████████████████        ',
    ' ███████████████████              ',
    ' ██████████████████████████       ',
    ' ██████████████████████████████ ',
    '  ████████████████████████████  ',
    '   ██████████████████████████   ',
    '     ██████████████████████     ',
    '       ██████████████████       ',
    '          ████████████          '
  ],
  // Frame 2: Half Open
  [
    '          ████████████          ',
    '      ████████████████████      ',
    '    ████████████████████████    ',
    '  ████████████████████████████  ',
    '  ██████████████████████████      ',
    ' ███████████████████████          ',
    ' ████████████████████             ',
    ' ████████████████                 ',
    ' ████████████████████             ',
    ' ███████████████████████          ',
    '  ██████████████████████████      ',
    '   ██████████████████████████   ',
    '     ██████████████████████     ',
    '       ██████████████████       ',
    '          ████████████          '
  ],
  // Frame 3: Wide Open
  [
    '          ████████████          ',
    '      ████████████████████      ',
    '    ████████████████████████    ',
    '  ████████████████████          ',
    '  ███████████████████             ',
    ' ██████████████████               ',
    ' ███████████████                  ',
    ' ████████████                     ',
    ' ███████████████                  ',
    ' ██████████████████               ',
    '  ███████████████████             ',
    '   ██████████████████████       ',
    '     ████████████████████████   ',
    '       ██████████████████       ',
    '          ████████████          '
  ],
  // Frame 4: Max Open
  [
    '          ████████████          ',
    '      ████████████████████      ',
    '    ████████████████            ',
    '  ████████████████               ',
    '  ████████████████                ',
    ' ██████████████                   ',
    ' ████████████                     ',
    ' ██████████                       ',
    ' ████████████                     ',
    ' ██████████████                   ',
    '  ████████████████                ',
    '   ██████████████████             ',
    '     ████████████████████        ',
    '       ████████████████████      ',
    '          ████████████          '
  ]
];

// Multi-color Ghost Sprites (W=White, B=Blue Pupil, █=Body)
const GHOST_FRAMES: string[][] = [
  // Frame 0: Wave A
  [
    '                            ',
    '        ████████████        ',
    '      ████████████████      ',
    '    ████████████████████    ',
    '  ████████████████████████  ',
    '  ██████WWWW██████WWWW████  ', // Top of eyes
    ' ██████WWWWWW████WWWWWW████ ', // Middle of eyes
    ' ██████WWWWBB████WWWWBB████ ', // Pupils (Right side)
    ' ██████WWWWBB████WWWWBB████ ', // Pupils (Right side)
    ' ██████████████████████████ ',
    ' ██████████████████████████ ',
    ' ██████████████████████████ ',
    ' ██████████████████████████ ',
    ' ██████  ████████  ████████ ', // Feet A
    ' ████      ████      ████   '
  ],
  // Frame 1: Wave B
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
    ' ████████  ████████  ██████ ', // Feet B
    '   ████      ████      ████ '
  ]
];

const ANIMATION_ORDER: number[] = [0, 1, 2, 3, 4, 3, 2, 1];
const FRAMES_RIGHT: string[][] = ANIMATION_ORDER.map((i) => BASE_FRAMES[i]);
const FRAMES_LEFT: string[][] = FRAMES_RIGHT.map((frame) =>
  frame.map((row) => row.split('').reverse().join(''))
);

const GHOST_FRAMES_RIGHT = GHOST_FRAMES;
// Reversing inherently shifts the pupil ('B') to the LEFT side of the eye!
const GHOST_FRAMES_LEFT = GHOST_FRAMES.map((frame) =>
  frame.map((row) => row.split('').reverse().join(''))
);

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function getCursorPos(): Promise<{ rows: number; cols: number }> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let resolved = false;

    const cleanup = () => {
      if (!stdin.isTTY) return;
      stdin.setRawMode(false);
      stdin.pause();
    };

    if (!stdin.isTTY) {
      resolve({ rows: stdout.rows || 24, cols: stdout.columns || 80 });
      return;
    }

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve({ rows: stdout.rows || 24, cols: stdout.columns || 80 });
      }
    }, 500);

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    stdin.once('data', (data: Buffer | string) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      const match = /\[(\d+);(\d+)R/.exec(data.toString());
      cleanup();
      if (match) {
        resolve({ rows: parseInt(match[1], 10), cols: parseInt(match[2], 10) });
      } else {
        resolve({ rows: stdout.rows || 24, cols: stdout.columns || 80 });
      }
    });

    stdout.write('\x1B[6n');
  });
}

async function printTestText(rows: number): Promise<void> {
  const testRows = Math.min(rows - 2, 25);
  for (let i = 1; i <= testRows; i++) {
    process.stdout.write(`>>> Pac-Man Wipe Test Line ${i} - ${'█'.repeat(15)} <<<\n`);
  }
  await delay(150);
}

function drawBigSprite(
  x: number,
  y: number,
  sprite: string[],
  cols: number,
  totalRows: number,
  facingRight: boolean,
  clearLen: number,
  color: string
): void {
  let buf = '';
  const spriteWidth = sprite[0].length;

  for (let i = 0; i < sprite.length; i++) {
    const screenY = y + i;
    if (screenY < 1 || screenY > totalRows) continue;

    const rowStr = sprite[i];

    // Find the exact left/right boundary of this specific row
    let firstSolid = -1;
    let lastSolid = -1;
    for (let j = 0; j < spriteWidth; j++) {
      if (rowStr[j] !== ' ') {
        if (firstSolid === -1) firstSolid = j;
        lastSolid = j;
      }
    }

    if (firstSolid === -1) continue; // Empty row

    // Edge-sweep clearing ensures no jittered pixels are left behind
    if (facingRight) {
      // Clear trail behind
      const clearStart = x + firstSolid - clearLen;
      const clearEnd = Math.min(cols, x + firstSolid - 1);
      const validClearStart = Math.max(1, clearStart);
      if (clearEnd >= validClearStart && validClearStart <= cols) {
        buf += `\x1B[${screenY};${validClearStart}H` + ' '.repeat(clearEnd - validClearStart + 1);
      }

      // Clear leading edge orphaned artifacts (fixes the "weird animation" up front)
      const leadStart = x + lastSolid + 1;
      const leadEnd = Math.min(cols, x + spriteWidth + 4);
      const validLeadStart = Math.max(1, leadStart);
      if (leadEnd >= validLeadStart && validLeadStart <= cols) {
        buf += `\x1B[${screenY};${validLeadStart}H` + ' '.repeat(leadEnd - validLeadStart + 1);
      }
    } else {
      // Clear trail behind (on the right)
      const clearStart = x + lastSolid + 1;
      const clearEnd = Math.min(cols, x + lastSolid + clearLen);
      const validClearStart = Math.max(1, clearStart);
      if (clearEnd >= validClearStart && validClearStart <= cols) {
        buf += `\x1B[${screenY};${validClearStart}H` + ' '.repeat(clearEnd - validClearStart + 1);
      }

      // Clear leading edge orphaned artifacts (on the left)
      const leadStart = x - 4;
      const leadEnd = Math.min(cols, x + firstSolid - 1);
      const validLeadStart = Math.max(1, leadStart);
      if (leadEnd >= validLeadStart && validLeadStart <= cols) {
        buf += `\x1B[${screenY};${validLeadStart}H` + ' '.repeat(leadEnd - validLeadStart + 1);
      }
    }

    // Draw sprite body
    let currentColor = RESET_COLOR;
    let cursorSet = false;

    // Draw only within the bounding box of solid pixels, rendering interior spaces accurately
    for (let j = firstSolid; j <= lastSolid; j++) {
      const screenX = x + j;
      if (screenX < 1) continue;
      if (screenX > cols) break;

      if (!cursorSet) {
        buf += `\x1B[${screenY};${screenX}H`;
        cursorSet = true;
      }

      const char = rowStr[j];
      let targetColor = RESET_COLOR;
      let outChar = ' ';

      if (char === '█') {
        targetColor = color;
        outChar = '█';
      } else if (char === 'W') {
        targetColor = COLOR_WHITE;
        outChar = '█';
      } else if (char === 'B') {
        targetColor = COLOR_BLUE;
        outChar = '█';
      }

      // Optimize ANSI codes
      if (currentColor !== targetColor) {
        buf += targetColor;
        currentColor = targetColor;
      }
      buf += outChar;
    }

    if (currentColor !== RESET_COLOR) {
      buf += RESET_COLOR;
    }
  }

  if (buf.length > 0) {
    process.stdout.write(buf);
  }
}

async function main(): Promise<void> {
  const totalRows = process.stdout.rows || 24;
  const args = process.argv.slice(2);

  // Settings
  let speedMs = 12;
  let moveStep = 1;
  let mouthDivider = 3;
  let clearLen = 14;

  if (args.includes('--fast')) {
    speedMs = 8;
    moveStep = 2;
    mouthDivider = 2;
  }

  if (args.includes('--test')) {
    await printTestText(totalRows);
  }

  const cursorPos = await getCursorPos();
  const maxTextRow = cursorPos.rows || totalRows;

  process.stdout.write(HIDE_CURSOR);

  const cleanup = () => {
    process.stdout.write(SHOW_CURSOR);
    process.stdout.write(CLEAR_SCREEN);
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });

  try {
    const spriteHeight = BASE_FRAMES[0].length;
    const spriteWidth = BASE_FRAMES[0][0].length;
    let sweepCount = 0;

    // Line up the parade!
    const ghostConfigs = [
      { color: COLOR_BLINKY, offset: 44 },     // Blinky (Red)
      { color: COLOR_PINKY, offset: 88 },      // Pinky (Pink)
      { color: COLOR_INKY, offset: 132 },      // Inky (Cyan)
      { color: COLOR_CLYDE, offset: 176 }      // Clyde (Orange)
    ];
    const maxOffset = ghostConfigs[ghostConfigs.length - 1].offset;

    for (let y = 1; y <= maxTextRow; y += spriteHeight) {
      const facingRight = sweepCount % 2 === 0;
      let step = 0;

      if (facingRight) {
        for (let x = -spriteWidth - 2; x <= (process.stdout.columns || 80) + maxOffset + 5; x += moveStep) {
          const cols = process.stdout.columns || 80;

          for (let i = ghostConfigs.length - 1; i >= 0; i--) {
            const g = ghostConfigs[i];
            const gFrameIdx = Math.floor(step / 4) % GHOST_FRAMES_RIGHT.length;
            drawBigSprite(x - g.offset, y, GHOST_FRAMES_RIGHT[gFrameIdx], cols, totalRows, true, clearLen, g.color);
          }

          const pFrameIdx = Math.floor(step / mouthDivider) % FRAMES_RIGHT.length;
          drawBigSprite(x, y, FRAMES_RIGHT[pFrameIdx], cols, totalRows, true, clearLen, COLOR_PACMAN);

          await delay(speedMs);
          step++;
        }
      } else {
        for (let x = (process.stdout.columns || 80) + 5; x >= -spriteWidth - maxOffset - 2; x -= moveStep) {
          const cols = process.stdout.columns || 80;

          for (let i = ghostConfigs.length - 1; i >= 0; i--) {
            const g = ghostConfigs[i];
            const gFrameIdx = Math.floor(step / 4) % GHOST_FRAMES_LEFT.length;
            drawBigSprite(x + g.offset, y, GHOST_FRAMES_LEFT[gFrameIdx], cols, totalRows, false, clearLen, g.color);
          }

          const pFrameIdx = Math.floor(step / mouthDivider) % FRAMES_LEFT.length;
          drawBigSprite(x, y, FRAMES_LEFT[pFrameIdx], cols, totalRows, false, clearLen, COLOR_PACMAN);

          await delay(speedMs);
          step++;
        }
      }
      sweepCount++;
    }
  } finally {
    cleanup();
  }
}

main();