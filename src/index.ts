#!/usr/bin/env node

// pacman-cleaner: Pac-Man and the four ghosts wakka the terminal clean.

import { readFileSync } from 'node:fs'

const packageUrl = new URL('../package.json', import.meta.url)
const { version: VERSION }: { version: string } = JSON.parse(readFileSync(packageUrl, 'utf8'))

// Terminal escape sequences
const ESC = '\x1B'
const HIDE_CURSOR = `${ESC}[?25l`
const SHOW_CURSOR = `${ESC}[?25h`
const CLEAR_SCREEN = `${ESC}[2J${ESC}[1;1H`
const RESET_COLOR = `${ESC}[0m`
const QUERY_CURSOR_POSITION = `${ESC}[6n`

const cursorTo = (row: number, col: number): string => `${ESC}[${row};${col}H`
const rgb = (r: number, g: number, b: number): string => `${ESC}[38;2;${r};${g};${b}m`
const hex = (color: number): string => rgb((color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff)

function hue(degrees: number): string {
    const f = (n: number): number => {
        const k = (n + degrees / 60) % 6
        return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1))))
    }
    return rgb(f(5), f(3), f(1))
}

// Themes and speeds

// Eye colors are the same in every theme
const COLOR_EYE_WHITE = rgb(255, 255, 255)
const COLOR_EYE_PUPIL = rgb(33, 33, 255)

// A solid color, or a function of the column within the sprite (used by rainbow)
type Paint = string | ((column: number) => string)

interface Theme {
    pacman: Paint
    blinky: Paint
    pinky: Paint
    inky: Paint
    clyde: Paint
}

// Lets animated paints shift over time
let animationTick = 0

// A gradient across the sprite that scrolls as the animation runs
const rainbow =
    (offset: number): Paint =>
    (column) =>
        hue(offset + column * 9 + animationTick * 6)

const THEMES: Record<string, Theme> = {
    classic: {
        pacman: rgb(255, 255, 0),
        blinky: rgb(255, 0, 0),
        pinky: rgb(255, 184, 255),
        inky: rgb(0, 255, 255),
        clyde: rgb(255, 184, 82)
    },
    neon: {
        pacman: rgb(255, 0, 127),
        blinky: rgb(0, 255, 255),
        pinky: rgb(127, 0, 255),
        inky: rgb(0, 255, 0),
        clyde: rgb(255, 127, 0)
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
        pacman: hex(0xf1fa8c),
        blinky: hex(0xff5555),
        pinky: hex(0xff79c6),
        inky: hex(0x8be9fd),
        clyde: hex(0xffb86c)
    },
    monokai: {
        pacman: hex(0xffd866),
        blinky: hex(0xff6188),
        pinky: hex(0xab9df2),
        inky: hex(0x78dce8),
        clyde: hex(0xfc9867)
    },
    nord: {
        pacman: hex(0xebcb8b),
        blinky: hex(0xbf616a),
        pinky: hex(0xb48ead),
        inky: hex(0x88c0d0),
        clyde: hex(0xd08770)
    },
    gruvbox: {
        pacman: hex(0xfabd2f),
        blinky: hex(0xfb4934),
        pinky: hex(0xd3869b),
        inky: hex(0x83a598),
        clyde: hex(0xfe8019)
    },
    cupertino: {
        pacman: hex(0xffcc00),
        blinky: hex(0xff3b30),
        pinky: hex(0xff2d55),
        inky: hex(0x5ac8fa),
        clyde: hex(0xff9500)
    },
    rainbow: {
        pacman: rainbow(0),
        blinky: rainbow(72),
        pinky: rainbow(144),
        inky: rainbow(216),
        clyde: rainbow(288)
    }
}

// Not a palette: picks one of the themes at random
const RANDOM_THEME = 'random'

const THEME_CHOICES = [...Object.keys(THEMES), RANDOM_THEME]

function pickTheme(name: string): Theme {
    if (name !== RANDOM_THEME) return THEMES[name]
    const names = Object.keys(THEMES)
    return THEMES[names[Math.floor(Math.random() * names.length)]]
}

interface Speed {
    // Delay between ticks
    speedMs: number
    // Columns moved per tick
    moveStep: number
    // Ticks per mouth frame (lower chomps faster)
    mouthDivider: number
}

const SPEEDS: Record<string, Speed> = {
    chill: { speedMs: 35, moveStep: 1, mouthDivider: 4 },
    arcade: { speedMs: 15, moveStep: 1, mouthDivider: 3 },
    fast: { speedMs: 8, moveStep: 2, mouthDivider: 2 },
    turbo: { speedMs: 4, moveStep: 3, mouthDivider: 1 }
}

const DEFAULT_SPEED = 'arcade'
const DEFAULT_THEME = 'classic'

const GHOST_FRAME_TICKS = 4
// Columns between consecutive characters in the chase
const CHASE_SPACING = 38
const CURSOR_QUERY_TIMEOUT_MS = 500

// Sprites

const PACMAN_WIDTH = 32
const GHOST_WIDTH = 28

// Pac-Man facing right, mouth closed (0) to wide open (4). Rows are padded to PACMAN_WIDTH on load.
const PACMAN_FRAMES = [
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
]

// Open the mouth, then close it again
const PACMAN_FRAME_ORDER = [0, 1, 2, 3, 4, 3, 2, 1]

// Ghost facing right. █ = body, W = eye white, B = pupil
const GHOST_FRAMES = [
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
]

interface SpriteAnimation {
    frames: string[][]
    width: number
    height: number
    // Per row, the leftmost and rightmost column solid in any frame (null if always empty).
    // Repainting this whole span each tick erases pixels left by earlier frames.
    hull: Array<[number, number] | null>
}

function buildAnimation(rawFrames: string[][], width: number): SpriteAnimation {
    const height = rawFrames[0].length

    const frames = rawFrames.map((frame, f) => {
        if (frame.length !== height) {
            throw new Error(`Sprite frame ${f} has ${frame.length} rows, expected ${height}`)
        }
        return frame.map((row, r) => {
            const trimmed = row.replace(/ +$/, '')
            if (trimmed.length > width) {
                throw new Error(`Sprite frame ${f}, row ${r} is wider than ${width} columns`)
            }
            return trimmed + ' '.repeat(width - trimmed.length)
        })
    })

    const hull: Array<[number, number] | null> = []
    for (let r = 0; r < height; r++) {
        let first = -1
        let last = -1
        for (const frame of frames) {
            const row = frame[r]
            for (let c = 0; c < width; c++) {
                if (row[c] === ' ') continue
                if (first === -1 || c < first) first = c
                if (c > last) last = c
            }
        }
        hull.push(first === -1 ? null : [first, last])
    }

    return { frames, width, height, hull }
}

function mirror(animation: SpriteAnimation): SpriteAnimation {
    const flipped = animation.frames.map((frame) => frame.map((row) => row.split('').reverse().join('')))
    return buildAnimation(flipped, animation.width)
}

const PACMAN_RIGHT = buildAnimation(
    PACMAN_FRAME_ORDER.map((i) => PACMAN_FRAMES[i]),
    PACMAN_WIDTH
)
const PACMAN_LEFT = mirror(PACMAN_RIGHT)
const GHOST_RIGHT = buildAnimation(GHOST_FRAMES, GHOST_WIDTH)
const GHOST_LEFT = mirror(GHOST_RIGHT)

// Rendering

interface SpriteDraw {
    animation: SpriteAnimation
    frameIndex: number
    // Screen position (1-based) of the sprite's top-left cell; may be off screen
    x: number
    y: number
    paint: Paint
    facingRight: boolean
    // Columns behind the sprite to blank, covering the gap left by multi-column steps
    trail: number
    cols: number
    rows: number
    // How far Pac-Man has eaten in each screen row. Only Pac-Man passes one.
    frontier?: Map<number, number>
}

// Returns the escape sequence that paints one sprite frame. Everything inside
// the sprite's hull is overwritten, which is what eats the text underneath.
function renderSprite({
    animation,
    frameIndex,
    x,
    y,
    paint,
    facingRight,
    trail,
    cols,
    rows,
    frontier
}: SpriteDraw): string {
    const frame = animation.frames[frameIndex % animation.frames.length]
    let buf = ''

    for (let r = 0; r < animation.height; r++) {
        const screenY = y + r
        if (screenY < 1 || screenY > rows) continue

        const span = animation.hull[r]
        if (!span) continue

        let start = x + span[0]
        let end = x + span[1]
        if (facingRight) start -= trail
        else end += trail
        start = Math.max(1, start)
        end = Math.min(cols, end)
        if (start > end) continue

        const row = frame[r]

        // With a frontier, only blank empty cells the sprite has already passed,
        // so text inside an open mouth stays until the mouth snaps shut on it
        let rowFrontier = 0
        if (frontier) {
            let edge = 0
            for (let screenX = start; screenX <= end; screenX++) {
                const cell = row[screenX - x]
                if (cell === undefined || cell === ' ') continue
                if (edge === 0 || (facingRight ? screenX > edge : screenX < edge)) edge = screenX
            }
            rowFrontier = frontier.get(screenY) ?? (facingRight ? 0 : cols + 1)
            if (edge !== 0) {
                rowFrontier = facingRight ? Math.max(rowFrontier, edge) : Math.min(rowFrontier, edge)
            }
            frontier.set(screenY, rowFrontier)
        }

        if (!frontier) buf += cursorTo(screenY, start)

        let currentColor = ''
        let needMove = !!frontier
        for (let screenX = start; screenX <= end; screenX++) {
            const cell = row[screenX - x] // undefined in the trail region

            if (frontier && (cell === undefined || cell === ' ')) {
                const eaten = facingRight ? screenX <= rowFrontier : screenX >= rowFrontier
                if (!eaten) {
                    needMove = true
                    continue
                }
            }
            if (needMove) {
                buf += cursorTo(screenY, screenX)
                needMove = false
            }

            let color = RESET_COLOR
            let out = ' '
            if (cell === '█') {
                color = typeof paint === 'function' ? paint(screenX - x) : paint
                out = '█'
            } else if (cell === 'W') {
                color = COLOR_EYE_WHITE
                out = '█'
            } else if (cell === 'B') {
                color = COLOR_EYE_PUPIL
                out = '█'
            }

            if (color !== currentColor) {
                buf += color
                currentColor = color
            }
            buf += out
        }

        if (currentColor !== RESET_COLOR) buf += RESET_COLOR
    }

    return buf
}

// Terminal helpers

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

function terminalSize(): { cols: number; rows: number } {
    return { cols: process.stdout.columns || 80, rows: process.stdout.rows || 24 }
}

// Asks the terminal for the cursor row, so only rows holding text get swept.
// Resolves with `fallback` if stdin isn't a terminal or the terminal doesn't answer in time.
function queryCursorRow(fallback: number): Promise<number> {
    const stdin = process.stdin
    if (!stdin.isTTY) return Promise.resolve(fallback)

    return new Promise((resolve) => {
        let pending = ''

        const finish = (row: number): void => {
            clearTimeout(timer)
            stdin.off('data', onData)
            stdin.setRawMode(false)
            stdin.pause()
            resolve(row)
        }

        // The reply may be split across chunks or mixed with typed-ahead keys
        const onData = (chunk: Buffer | string): void => {
            pending += chunk.toString()
            const match = /\x1B\[(\d+);\d+R/.exec(pending)
            if (match) finish(parseInt(match[1], 10))
        }

        const timer = setTimeout(() => finish(fallback), CURSOR_QUERY_TIMEOUT_MS)

        stdin.setRawMode(true)
        stdin.resume()
        stdin.on('data', onData)
        process.stdout.write(QUERY_CURSOR_POSITION)
    })
}

type Segment = [text: string, color: string]

const GREEN = rgb(80, 250, 123)
const CYAN = rgb(139, 233, 253)
const YELLOW = rgb(241, 250, 140)
const ORANGE = rgb(255, 184, 108)
const RED = rgb(255, 85, 85)
const PURPLE = rgb(189, 147, 249)
const GRAY = rgb(130, 140, 160)
const WHITE = rgb(248, 248, 242)

function line(prefix: string, prefixColor: string, text: string, textColor = WHITE): Segment[] {
    const segments: Segment[] = [[text, textColor]]
    if (prefix) segments.unshift([prefix, prefixColor])
    return segments
}

// Fake dev session for --test
const TEST_SESSION = [
    line('$ ', GREEN, 'npm install left-pad'),
    line('', GRAY, 'added 1337 packages, and audited 1338 packages in 4s', GRAY),
    line('$ ', GREEN, 'git log --oneline'),
    line('a1b2c3d ', YELLOW, 'fix everything (for real this time)'),
    line('e4f5a6b ', YELLOW, 'it works on my machine'),
    line('c7d8e9f ', YELLOW, 'TODO: write tests'),
    line('$ ', GREEN, 'npm run build'),
    line('✔ ', GREEN, 'compiled successfully in 1.2s'),
    line('⚠ ', ORANGE, '3 warnings: unused variable "ghost"', ORANGE),
    line('✖ ', RED, '0 errors, 99 problems', RED),
    line('[INFO]  ', CYAN, 'server listening on http://localhost:3000'),
    line('[DEBUG] ', PURPLE, 'wakka wakka wakka wakka wakka wakka', GRAY),
    line('$ ', GREEN, 'echo "Hello, world!"'),
    line('', CYAN, 'Hello, world!', CYAN)
]

function rainbowBar(width: number): Segment[] {
    return Array.from({ length: width }, (_, i) => ['█', hue((i / width) * 360)])
}

async function printTestText(cols: number, rows: number): Promise<void> {
    const lines = Math.max(1, Math.min(rows - 2, 40))
    const width = Math.max(1, cols - 1) // avoid the last column so lines never wrap
    let session = 0

    for (let i = 0; i < lines; i++) {
        // Every sixth line is a rainbow bar
        const segments = i % 6 === 5 ? rainbowBar(width) : TEST_SESSION[session++ % TEST_SESSION.length]

        let buf = ''
        let left = width
        for (const [text, color] of segments) {
            if (left <= 0) break
            const part = text.slice(0, left)
            buf += color + part
            left -= part.length
        }
        process.stdout.write(buf + RESET_COLOR + '\n')
    }
    await delay(600)
}

// Command line

interface Options {
    speed: string
    theme: string
    test: boolean
    help: boolean
    version: boolean
}

class UsageError extends Error {}

// One help line per theme: its name, then Pac-Man and the four ghosts in its colors
function themeLines(): string[] {
    const width = Math.max(...THEME_CHOICES.map((name) => name.length))
    const solid = (paint: Paint): string => (typeof paint === 'function' ? paint(0) : paint)
    const swatch = (paints: Paint[], block: string): string =>
        paints.map((paint) => solid(paint) + block + RESET_COLOR).join(' ')

    return THEME_CHOICES.map((name) => {
        if (name === RANDOM_THEME) {
            // One Pac-Man from several themes, since it could be any of them
            const pool = Object.values(THEMES)
            const pacmen = Array.from({ length: 5 }, (_, i) => pool[(i * 2) % pool.length].pacman)
            return `    ${name.padEnd(width)}  ${swatch(pacmen, '▒▒')}`
        }
        const { pacman, blinky, pinky, inky, clyde } = THEMES[name]
        const note = name === DEFAULT_THEME ? '  (default)' : ''
        return `    ${name.padEnd(width)}  ${swatch([pacman, blinky, pinky, inky, clyde], '██')}${note}`
    })
}

// --test is left out of the help on purpose: it's for trying changes and recording demos
function printHelp(): void {
    const rows: Array<[string, string]> = [
        ['--speed <name>', `Animation speed (default: ${DEFAULT_SPEED})`],
        ['--theme <name>', `Color theme (default: ${DEFAULT_THEME})`],
        ['-h, --help', 'Show this help'],
        ['-v, --version', 'Show the version']
    ]
    const width = Math.max(...rows.map(([flag]) => flag.length))
    const options = rows.map(([flag, text]) => `    ${flag.padEnd(width)}  ${text}`).join('\n')
    // Default first, like classic for themes
    const speeds = [DEFAULT_SPEED, ...Object.keys(SPEEDS).filter((name) => name !== DEFAULT_SPEED)]
        .map((name) => `    ${name}${name === DEFAULT_SPEED ? ' (default)' : ''}`)
        .join('\n')

    console.log(`
  pacman-cleaner v${VERSION} - wakka that terminal clean

  USAGE:
    pacclean [options]
    npx pacman-cleaner [options]

  OPTIONS:
${options}

  SPEEDS:
${speeds}

  THEMES:
${themeLines().join('\n')}
`)
}

function parseArgs(argv: string[]): Options {
    const options: Options = {
        speed: DEFAULT_SPEED,
        theme: DEFAULT_THEME,
        test: false,
        help: false,
        version: false
    }

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        const eq = arg.startsWith('--') ? arg.indexOf('=') : -1
        const flag = eq === -1 ? arg : arg.slice(0, eq)

        const noValue = (): void => {
            if (eq !== -1) throw new UsageError(`${flag} does not take a value`)
        }

        // Accepts "--flag value" and "--flag=value"
        const choice = (choices: string[]): string => {
            const raw = eq === -1 ? argv[++i] : arg.slice(eq + 1)
            if (raw === undefined || raw === '') {
                throw new UsageError(`${flag} requires a value (${choices.join(', ')})`)
            }
            const value = raw.toLowerCase()
            if (!choices.includes(value)) {
                throw new UsageError(`Unknown value "${raw}" for ${flag} (expected ${choices.join(', ')})`)
            }
            return value
        }

        switch (flag) {
            case '--help':
            case '-h':
                noValue()
                options.help = true
                break
            case '--version':
            case '-v':
                noValue()
                options.version = true
                break
            case '--test':
                noValue()
                options.test = true
                break
            case '--speed':
                options.speed = choice(Object.keys(SPEEDS))
                break
            case '--theme':
                options.theme = choice(THEME_CHOICES)
                break
            default:
                throw new UsageError(`Unknown option: ${arg}`)
        }
    }

    return options
}

// Animation

// Runs one chase across the band of rows starting at `top`
async function sweepBand(top: number, facingRight: boolean, speed: Speed, theme: Theme): Promise<void> {
    const { speedMs, moveStep, mouthDivider } = speed
    const pacman = facingRight ? PACMAN_RIGHT : PACMAN_LEFT
    const ghost = facingRight ? GHOST_RIGHT : GHOST_LEFT

    const ghostPaints = [theme.blinky, theme.pinky, theme.inky, theme.clyde]
    const ghostOffsets = ghostPaints.map((_, i) => (i + 1) * CHASE_SPACING)
    const lastOffset = ghostOffsets[ghostOffsets.length - 1]

    // Ghosts trail Pac-Man by the same gap in both directions
    const ghostX = (pacmanX: number, offset: number): number =>
        facingRight ? pacmanX - offset : pacmanX + pacman.width - ghost.width + offset

    const frontier = new Map<number, number>()

    // Start just off screen
    let x = facingRight ? 1 - pacman.width : terminalSize().cols + 1

    for (let step = 0; ; step++) {
        // Re-read the size each tick so resizing mid-animation is harmless
        const { cols, rows } = terminalSize()
        animationTick = step

        // Done once the last ghost and its trail have left the screen
        const tailX = ghostX(x, lastOffset)
        const finished = facingRight ? tailX - moveStep > cols : tailX + ghost.width - 1 + moveStep < 1
        if (finished) break

        let buf = ''
        const ghostFrame = Math.floor(step / GHOST_FRAME_TICKS)
        ghostPaints.forEach((paint, i) => {
            buf += renderSprite({
                animation: ghost,
                frameIndex: ghostFrame,
                x: ghostX(x, ghostOffsets[i]),
                y: top,
                paint,
                facingRight,
                trail: moveStep,
                cols,
                rows
            })
        })
        buf += renderSprite({
            animation: pacman,
            frameIndex: Math.floor(step / mouthDivider),
            x,
            y: top,
            paint: theme.pacman,
            facingRight,
            trail: moveStep,
            cols,
            rows,
            frontier
        })

        if (buf) process.stdout.write(buf)

        await delay(speedMs)
        x += facingRight ? moveStep : -moveStep
    }
}

async function run(options: Options): Promise<void> {
    if (!process.stdout.isTTY) {
        throw new UsageError('stdout is not a terminal, so there is nothing to clean')
    }

    const speed = SPEEDS[options.speed]
    const theme = pickTheme(options.theme)
    const { cols, rows: screenRows } = terminalSize()

    if (options.test) await printTestText(cols, screenRows)

    // Only sweep down to the cursor row; everything below is empty
    const cursorRow = await queryCursorRow(screenRows)
    const lastTextRow = Math.max(1, Math.min(cursorRow, screenRows))

    const restore = (): void => {
        process.stdout.write(RESET_COLOR + CLEAR_SCREEN + SHOW_CURSOR)
    }
    for (const [signal, code] of [
        ['SIGINT', 130],
        ['SIGTERM', 143]
    ] as const) {
        process.once(signal, () => {
            restore()
            process.exit(code)
        })
    }

    process.stdout.write(HIDE_CURSOR)
    try {
        // Bands tile the text rows; the last is pulled up to end on the last text row
        const height = PACMAN_RIGHT.height
        const tops: number[] = []
        for (let top = 1; top <= lastTextRow; top += height) tops.push(top)
        if (tops.length > 1) tops[tops.length - 1] = Math.max(1, lastTextRow - height + 1)

        for (let sweep = 0; sweep < tops.length; sweep++) {
            await sweepBand(tops[sweep], sweep % 2 === 0, speed, theme)
        }
    } finally {
        restore()
    }
}

async function main(): Promise<void> {
    let options: Options
    try {
        options = parseArgs(process.argv.slice(2))
    } catch (err) {
        if (!(err instanceof UsageError)) throw err
        console.error(`pacman-cleaner: ${err.message}`)
        console.error('Run "pacclean --help" for usage.')
        process.exitCode = 1
        return
    }

    if (options.help) {
        printHelp()
        return
    }
    if (options.version) {
        console.log(`pacman-cleaner v${VERSION}`)
        return
    }

    await run(options)
}

main().catch((err: unknown) => {
    const message =
        err instanceof UsageError ? err.message : err instanceof Error ? err.stack || err.message : String(err)
    console.error(`pacman-cleaner: ${message}`)
    process.exitCode = 1
})
