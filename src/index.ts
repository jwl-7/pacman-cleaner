#!/usr/bin/env node

const HIDE_CURSOR = '\x1B[?25l'
const SHOW_CURSOR = '\x1B[?25h'
const CLEAR_SCREEN = '\x1B[2J\x1B[1;1H'
const YELLOW = '\x1B[33;1m'
const RESET_COLOR = '\x1B[0m'

// Pac-Man Animation Frames (15x34)
const BASE_FRAMES = [
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
    '  ██████████████████████        ',
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
    '    ████████████████████         ',
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
]

const ANIMATION_ORDER = [0, 1, 2, 3, 4, 3, 2, 1]
const FRAMES_RIGHT = ANIMATION_ORDER.map((i) => BASE_FRAMES[i])
const FRAMES_LEFT = FRAMES_RIGHT.map((frame) =>
  frame.map((row) => row.split('').reverse().join(''))
)

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

function getCursorPos(): Promise<{ rows: number; cols: number }> {
  return new Promise((resolve) => {
    const stdin = process.stdin
    const stdout = process.stdout
    let resolved = false

    const cleanup = () => {
      if (!stdin.isTTY) return
      stdin.setRawMode(false)
      stdin.pause()
    }

    if (!stdin.isTTY) {
      resolve({ rows: stdout.rows || 24, cols: stdout.columns || 80 })
      return
    }

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        cleanup()
        resolve({ rows: stdout.rows || 24, cols: stdout.columns || 80 })
      }
    }, 500)

    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')

    stdin.once('data', (data) => {
      if (resolved) return
      resolved = true
      clearTimeout(timeout)
      const match = /\[(\d+);(\d+)R/.exec(data.toString())
      cleanup()
      if (match) {
        resolve({ rows: parseInt(match[1], 10), cols: parseInt(match[2], 10) })
      } else {
        resolve({ rows: stdout.rows || 24, cols: stdout.columns || 80 })
      }
    })

    stdout.write('\x1B[6n')
  })
}

async function printTestText(rows: number): Promise<void> {
  const testRows = Math.min(rows - 2, 25)
  for (let i = 1; i <= testRows; i++) {
    process.stdout.write(`>>> Pac-Man Wipe Test Line ${i} <<<\n`)
  }
  await delay(150)
}

function drawBigSprite(
  x: number,
  y: number,
  sprite: string[],
  cols: number,
  totalRows: number,
  facingRight: boolean
) {
  let buf = ''

  for (let i = 0; i < sprite.length; i++) {
    const screenY = y + i
    if (screenY < 1 || screenY > totalRows) continue

    const rowStr = sprite[i]
    const firstBlock = rowStr.indexOf('█')
    const lastBlock = rowStr.lastIndexOf('█')

    if (firstBlock === -1) continue

    if (facingRight) {
      const clearLen = 12
      const clearStart = x + firstBlock - clearLen
      const clearEnd = x + firstBlock - 1
      const blockStart = x + firstBlock
      const blockEnd = x + lastBlock

      const drawClearStart = Math.max(1, clearStart)
      const drawClearEnd = Math.min(cols, clearEnd)

      let cursorCol = 0
      if (drawClearEnd >= drawClearStart) {
        buf += `\x1B[${screenY};${drawClearStart}H` + ' '.repeat(drawClearEnd - drawClearStart + 1)
        cursorCol = drawClearEnd + 1
      }

      const drawBlockStart = Math.max(1, blockStart)
      const drawBlockEnd = Math.min(cols, blockEnd)
      if (drawBlockEnd >= drawBlockStart) {
        if (drawBlockStart !== cursorCol) {
          buf += `\x1B[${screenY};${drawBlockStart}H`
        }
        buf += `${YELLOW}${'█'.repeat(drawBlockEnd - drawBlockStart + 1)}${RESET_COLOR}`
      }
    } else {
      const blockStart = x + firstBlock
      const blockEnd = x + lastBlock
      const clearLen = 12
      const clearStart = x + lastBlock + 1
      const clearEnd = x + lastBlock + clearLen

      const drawBlockStart = Math.max(1, blockStart)
      const drawBlockEnd = Math.min(cols, blockEnd)

      let cursorCol = 0
      if (drawBlockEnd >= drawBlockStart) {
        buf += `\x1B[${screenY};${drawBlockStart}H` + `${YELLOW}${'█'.repeat(drawBlockEnd - drawBlockStart + 1)}${RESET_COLOR}`
        cursorCol = drawBlockEnd + 1
      }

      const drawClearStart = Math.max(1, clearStart)
      const drawClearEnd = Math.min(cols, clearEnd)
      if (drawClearEnd >= drawClearStart) {
        if (drawClearStart !== cursorCol) {
          buf += `\x1B[${screenY};${drawClearStart}H`
        }
        buf += ' '.repeat(drawClearEnd - drawClearStart + 1)
      }
    }
  }

  if (buf.length > 0) {
    process.stdout.write(buf)
  }
}

async function main(): Promise<void> {
  const cols = process.stdout.columns || 80
  const totalRows = process.stdout.rows || 24
  const speedMs = 12
  const mouthDivider = 3

  if (process.argv.includes('--test')) {
    await printTestText(totalRows)
  }

  const cursorPos = await getCursorPos()
  const maxTextRow = cursorPos.rows || totalRows

  process.stdout.write(HIDE_CURSOR)

  process.on('SIGINT', () => {
    process.stdout.write(SHOW_CURSOR)
    process.stdout.write(CLEAR_SCREEN)
    process.exit(0)
  })

  const spriteHeight = BASE_FRAMES[0].length
  const spriteWidth = BASE_FRAMES[0][0].length
  let sweepCount = 0

  for (let y = 1; y <= maxTextRow; y += spriteHeight) {
    const facingRight = sweepCount % 2 === 0
    let step = 0

    if (facingRight) {
      for (let x = -spriteWidth - 2; x <= cols + 5; x++) {
        const frameIdx = Math.floor(step / mouthDivider) % FRAMES_RIGHT.length
        drawBigSprite(x, y, FRAMES_RIGHT[frameIdx], cols, totalRows, true)
        await delay(speedMs)
        step++
      }
    } else {
      for (let x = cols + 5; x >= -spriteWidth - 2; x--) {
        const frameIdx = Math.floor(step / mouthDivider) % FRAMES_LEFT.length
        drawBigSprite(x, y, FRAMES_LEFT[frameIdx], cols, totalRows, false)
        await delay(speedMs)
        step++
      }
    }
    sweepCount++
  }

  process.stdout.write(SHOW_CURSOR)
  process.stdout.write(CLEAR_SCREEN)
}

main()
