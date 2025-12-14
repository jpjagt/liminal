// Braille character to ASCII conversion
// Braille unicode block: U+2800 to U+28FF
// Each braille character is a 2x4 grid of dots
// Dot positions (bit values):
//   1  8
//   2  16
//   4  32
//   64 128

const BRAILLE_BASE = 0x2800

// Convert a single braille character to a 4x2 ASCII grid (4 rows, 2 cols)
const brailleToAscii = (char: string): string[][] => {
  const code = char.charCodeAt(0)
  if (code < BRAILLE_BASE || code > BRAILLE_BASE + 0xff) {
    // Not a braille character - return spaces
    return [
      [" ", " "],
      [" ", " "],
      [" ", " "],
      [" ", " "],
    ]
  }

  const pattern = code - BRAILLE_BASE
  // Bit positions: 1,2,4,64 for left column (top to bottom), 8,16,32,128 for right column
  return [
    [pattern & 1 ? "*" : " ", pattern & 8 ? "*" : " "],
    [pattern & 2 ? "*" : " ", pattern & 16 ? "*" : " "],
    [pattern & 4 ? "*" : " ", pattern & 32 ? "*" : " "],
    [pattern & 64 ? "*" : " ", pattern & 128 ? "*" : " "],
  ]
}

// Convert a line of braille text to multiple lines of ASCII
const brailleLineToAscii = (line: string): string[] => {
  const chars = [...line]
  const asciiChars = chars.map(brailleToAscii)

  // Build 4 output lines
  const result: string[] = ["", "", "", ""]
  for (const charGrid of asciiChars) {
    for (let row = 0; row < 4; row++) {
      result[row] += charGrid[row][0] + charGrid[row][1]
    }
  }
  return result
}

// Convert entire braille art to ASCII
const brailleArtToAscii = (brailleArt: string): string[] => {
  const lines = brailleArt.split("\n").filter((l) => l.length > 0)
  const result: string[] = []

  for (const line of lines) {
    const asciiLines = brailleLineToAscii(line)
    result.push(...asciiLines)
  }

  return result
}

// Strip a line (remove leading/trailing spaces) but track the left offset
const stripLine = (line: string): { text: string; leftOffset: number } => {
  const leftOffset = line.length - line.trimStart().length
  const text = line.trim()
  return { text, leftOffset }
}

// Flower art definitions
const FLOWERS: Record<string, string> = {
  starbouquet: `
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⢦⡀⠀⠀⡀⠀⠀⠀⢀⡀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⢀⣀⣀⣀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠻⣄⠀⣯⠳⢷⠾⢻⣷⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⢸⠁⠀⠀⢸⠀⠀⡀⢵⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⡤⢄⣀⠀⠀⠙⣶⣿⠆⠀⠀⠘⠿⣦⠀⠀⠀⠀⠀
⠀⠀⣠⠴⠒⢲⡦⣄⣰⠀⢰⡄⢸⢃⡄⡿⣸⢀⣠⠤⠦⠤⠤⣀⠀⠀⠀⠀⠀⠀⠀⣼⠋⠀⠀⠈⢦⠀⠀⢾⣴⣶⡆⢀⣶⠶⠚⠃⠀⠀⠀⠀
⠀⢰⣧⣤⢦⠀⠀⠆⢉⣦⡘⢟⠣⢿⠃⡇⡿⢁⡈⣀⣀⠀⠀⠈⢦⠀⠀⠀⠀⠀⠘⣿⣦⢠⣴⣦⠜⡆⠀⠀⢹⡈⢻⣾⠃⠀⠀⠀⠀⠀⠀⠀
⢠⠯⠀⠈⠉⠀⠎⠑⢶⣾⣷⡞⢆⣟⡼⣠⠩⡯⠛⠅⠀⣀⡤⠴⠦⠇⠀⠀⠀⠀⠀⠙⠋⠀⠛⠧⠀⡇⠀⣀⣈⣇⣸⠡⣴⣴⠀⠀⠀⠀⠀⠀
⠸⠿⠹⠿⠒⣢⣄⣠⠄⣈⡿⣷⣽⡿⣷⣟⣞⠔⠳⡒⠾⠣⢄⡀⠀⣀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡠⣖⡯⠭⠖⢲⡧⣏⠑⢮⡀⠀⠀⠀⠀⠀⠀
⠀⠀⣠⠞⠉⠈⠁⢼⡭⠽⣟⣽⣿⣷⣛⠻⠏⡤⡦⢤⣠⠀⠀⡙⢿⠸⢷⡀⠀⠀⠀⠀⠀⣴⡿⠋⢹⠁⠀⠀⢸⣸⠉⠙⡄⠘⢦⢀⡀⠀⠀⠀
⠀⢰⢁⡔⠢⠖⠛⠆⠸⠌⠉⣽⣿⣿⡯⠤⡨⠬⠥⣀⣀⠀⠀⢨⠃⠀⢸⡟⣆⠀⠀⢠⡾⠁⠀⢀⠇⠀⣄⡄⣼⠇⠰⡤⣼⣤⣼⠏⣧⠀⠀⠀
⠀⣄⣎⡞⢀⡤⠟⣀⣬⡤⡞⢗⠁⢻⣰⣪⢄⡀⠀⠉⠀⠙⠢⡏⠀⠀⠀⠀⢸⠀⢠⡟⠀⠀⠀⡜⠀⠈⠟⣹⠏⠀⠀⣽⡄⠉⠁⠀⠿⣧⣀⠀
⠀⠹⡟⣰⣿⠒⠉⠁⠀⠀⡏⠈⢀⢸⡅⠀⠉⠾⡀⠀⠀⠀⠀⢱⠀⣰⠀⣀⠗⠒⠉⠉⠉⠉⠻⡁⠀⠀⣰⠋⠀⠀⢘⡿⠃⠀⠀⠀⣤⠔⠛⠃
⠀⠀⠱⠿⠃⠀⠀⠀⠀⠀⢧⠀⠘⠸⠙⣄⠀⠀⠀⣤⡠⠀⠀⡾⣲⠛⡸⢛⡀⢀⡀⣀⡠⠔⠒⢱⡄⡴⠃⠀⠀⠀⠚⠒⣻⠿⣦⣰⠇⡀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢶⡄⠀⠀⠈⢦⣀⡀⠈⣻⢣⢲⣱⢁⠴⣡⢔⣮⠟⠊⠁⠀⠀⠀⣸⠟⠁⠀⠀⠀⢀⣠⡾⠁⠀⠈⠹⢰⠁⠀⠀
⠀⠀⠀⠀⠀⠀⠀⢠⡀⠀⠀⡈⢪⡀⢄⣧⠶⢛⡢⠆⣶⣯⣾⣷⣷⣿⡾⢇⣤⠆⠀⠀⢀⣤⠞⠃⠀⣴⣒⣺⠿⠟⠋⠀⠀⠀⠀⠀⡞⣰⣤⠀
⠀⠀⠀⠀⠀⠀⠀⠈⠳⣔⢺⣷⡋⡽⠋⢁⣠⡼⢷⣾⣿⣿⣿⡿⣽⡝⡉⣑⡢⠽⠔⠚⢿⡁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢰⣷⠄⡼⠀⠚⠉⠀
⠀⠀⠀⠀⠀⠀⠀⠶⠗⠈⣑⡶⠋⢀⡀⠈⠀⠀⠄⢢⡋⠁⠹⡧⠀⠉⢻⡙⠓⠢⠀⠀⠀⠹⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢈⡜⠁⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⢠⢾⣟⣧⣷⣋⣁⣀⣀⠤⠔⠚⡟⠐⠀⢀⡇⠈⠀⠰⣇⡀⠀⠀⠀⢄⠀⢱⠀⠀⠀⠀⠀⠀⠀⠀⣠⣴⠏⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⢸⠈⠉⣋⢀⣰⡴⠈⢆⠀⠀⠀⡇⠀⠀⢠⠇⠀⠇⢠⠗⠋⠒⠦⣄⠈⣇⡞⠀⠀⠀⠀⠀⠀⠀⠀⠉⠁⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠑⠤⠿⠁⠛⡩⠚⠉⡟⠲⡄⡇⠀⠀⠀⠀⣾⢠⠎⣀⡤⠴⠾⠭⠶⢍⣉⡉⠓⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣤⣇⣀⠀⢸⡠⠼⣇⠀⡴⠓⢦⣿⣯⢮⠥⠄⠠⠤⣄⠀⠀⠀⠈⠙⠲⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⠾⡇⣱⣧⡴⠙⡧⣾⠟⠻⣶⣶⣯⣿⣵⣫⠀⠀⠀⠀⠀⠑⢦⠀⠀⠀⠀⠈⢻⣦⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠟⣉⡡⡟⠢⣧⡜⡦⠜⣿⡯⣬⣽⣱⠟⡠⡄⠀⠀⠀⠀⠈⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠛⠃⠻⣯⡍⠁⢉⣳⠟⢿⠇⠉⢳⡀⢿⡇⠀⠀⠀⠀⢠⠃⠀⢀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣹⣥⣶⣜⡟⡔⠙⠑⠢⡀⣑⠤⠹⢦⠤⠤⢒⣵⣿⣽⡿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⠾⠿⣎⢿⠀⠀⠀⢠⣏⠀⠀⠀⠀⢱⡐⠺⠿⠿⠟⠁⠀⠶⠶⢤⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣴⢧⣀⡈⠻⡦⣀⡠⣷⡿⠇⠀⡀⠀⢈⠼⣑⣒⡤⠤⠄⠀⠀⠀⠀⢹⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹⣢⣠⡎⡴⠎⠋⠽⢿⣿⣿⣽⣿⣵⢆⡼⢤⣄⠀⠀⠀⠀⢠⠞⣭⡝⣿⡅⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠁⠈⠃⢣⡀⠀⠀⠀⢺⣿⣿⣿⣾⠉⠈⠁⠀⢳⠀⠀⠀⠻⠀⢈⡵⢻⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⠤⠒⡂⢤⣠⠚⠙⠉⢻⠀⠀⠀⠀⣽⡟⢵⣈⣀⣤⡶⠶⠊⠀⠠⢼⣆⡴⣋⡴⣿⣦⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢻⣆⠀⠈⠫⡇⠀⠀⠀⠈⠓⠤⢠⡔⢫⡘⠄⠀⠀⢱⢀⣀⠀⢀⣴⢠⣾⠿⠧⢤⡀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡠⡶⠉⠩⠵⢶⣿⣰⡀⠀⠀⣀⠀⢨⣿⡦⡉⠒⠒⣒⣯⢘⣏⠛⠋⣸⣋⠁⠀⠀⠀⢹⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⡞⡉⠀⠀⢀⡤⣶⣻⣿⣷⣶⣿⣶⣶⣅⣿⣿⣌⢦⣼⣠⣤⣸⣋⣀⠀⡤⠭⠓⠀⠐⠒⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⢀⣶⣳⠀⠀⠀⠀⠀⠙⠪⠬⣵⠅⠀⠤⡞⣛⣿⣿⠏⢱⡉⠙⢝⣖⠿⣿⡝⢮⣭⡤⣴⠟⣾⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⣰⡿⣻⣛⢳⡀⠀⢀⣀⣤⣤⣄⡇⠀⠀⢀⡀⠁⠹⡼⠀⠀⢸⢀⢀⣼⠀⠀⢙⣀⣤⢚⣯⣀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⢾⣿⣿⣿⣿⠿⠦⢄⣘⣟⣿⣿⡷⣄⠴⠋⠀⢀⡴⣇⠀⠀⢸⠉⠁⢈⢷⠭⣉⠘⠟⣺⠉⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠘⠽⠛⠁⣠⢶⡶⠋⠀⠉⠉⢀⠙⠢⢶⣒⡽⠹⣮⣵⡒⠋⠀⠀⠸⣿⢏⢗⢷⠀⢸⡠⣶⠂⠘⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠈⠉⠀⠀⠀⣠⣦⠟⢀⣾⣿⣿⠇⣇⠻⣝⣻⣆⡀⠀⠀⠹⣼⡧⣄⡁⠀⠛⠦⠴⠚⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⢠⡏⠀⢘⢟⡫⠥⣴⡿⡿⣢⠤⣄⠉⠀⠀⠀⠀⠉⠙⢧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠐⢺⠯⡾⠳⣀⠔⡞⣾⡿⢿⣝⢼⠋⢀⣧⠤⢶⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⣀⣀⠀⣀⡄⢰⠇⠀⠀⠀⣟⣚⣷⣀⡰⣷⣠⠟⣃⢀⡞⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠘⣏⠛⢹⡇⢸⢠⢀⠀⢀⣟⣁⣀⡩⣾⣾⣿⡿⢯⣥⠭⢭⡿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠾⣥⡄⣰⠾⢻⡿⠟⣔⢿⣿⠋⠈⢊⡿⢻⡿⣿⡀⠙⡽⡁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠙⠏⠀⠘⣇⢰⣿⠿⠿⠠⠶⢻⠂⢸⡧⠈⢷⠢⢤⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⣽⣎⣡⡄⠀⠀⠀⠸⣆⡜⠳⣧⡼⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⡈⢹⣮⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠁⢠⣿⡳⣦⣀⠀⠀⠀⣀⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠁⢿⣶⡈⠉⠉⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⢀⡴⠀⠀⠀⣠⢸⡏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⢸⡀⠀⢀⣸⡏⠻⢷⣶⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠈⠳⣤⣉⣳⠄⣀⢻⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⠚⠉⠉⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,
  dahlia: `
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡠⡦⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⢁⢰⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣦⢠⢯⠀⣀⠀⠀⢀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠜⠌⢁⡿⣏⠀⠀⠡⢀⠞⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣸⠀⢄⣶⡿⠎⠻⣦⣤⣎⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⣀⡀⠀⠀⠀⠀⠀⠀⠳⢣⠸⢸⡅⢀⣴⡼⠁⠀⢿⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⡀⠐⠐⣰⣃⣬⣴⣄⡤⣠⢄⠀⠀⠸⣻⡆⡟⢸⠀⡿⠃⢀⡄⢠⠀⠜⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⢰⣶⣏⠁⠀⠀⠀⠚⠹⢷⣮⡒⢀⢄⡑⣧⣿⢸⣼⠃⢀⣶⡶⠋⡀⠀⠒⠀⠐⠀⠀⠀⠀⠀⠀⠀⠀
⡄⢪⣏⠈⠀⠀⠀⠁⠀⢀⢀⣚⠿⠿⣤⠀⢩⢸⡇⡏⡾⣰⣿⠟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠁⠠⠀⠀⠀
⠃⠀⡅⠀⠀⠀⠀⠀⠀⠀⠀⠈⢀⣀⣜⣇⢸⣨⣷⣿⣽⡟⠁⢄⠀⡁⢂⣡⣲⣶⣥⣤⣤⣄⣀⠀⠀⠀⠀
⠀⠈⠉⠋⠁⠀⠀⠀⠄⠀⠀⠠⠖⠊⠉⢾⣯⣿⣿⣿⣏⣤⡤⠶⠶⠿⢟⠻⢍⡛⠯⠭⠅⠛⠛⠛⠲⡑⡄
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡔⢋⣀⣴⣦⣻⠻⠿⣿⣿⣿⣐⠦⢍⡉⠉⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠃⠃
⠀⠀⠀⠀⠀⠀⡎⠀⠀⣞⢤⣿⡟⢓⢼⠝⠁⡄⣱⢾⣯⣟⣷⡶⣍⡂⡤⡀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠘⠜⣴⣏⣴⡿⡋⣀⢭⣞⣴⠻⠽⠓⢗⠯⢩⠯⡻⣿⢦⡈⠀⢈⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⣤⣾⣯⡟⢏⢰⠇⠉⠈⠀⠀⠀⠀⠀⠈⠂⠁⠁⠻⢟⣿⣿⡬⢇⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠉⠉⠐⠘⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠁⠈⠈⢳⠁⠨⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣞⡠⢀⠘⡆⠀⢡⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⡈⠀⡱⠓⠀⠚⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,
}

export interface FlowerwallOptions {
  leftText?: string
  rightText?: string
  marginTop?: number // lines of just text at top
  paddingX?: number // spaces around stripped flower text
}

/**
 * Generate a flowerwall pattern with a centered flower and surrounding text
 */
export const getFlowerwall = (
  flowerName: string,
  cols: number,
  rows: number,
  options: FlowerwallOptions = {},
): string => {
  const {
    leftText = "liminal.flowers..",
    rightText = "liminal.flowers..",
    marginTop = 2,
    paddingX = 3,
  } = options

  const brailleArt = FLOWERS[flowerName]
  if (!brailleArt) {
    throw new Error(`Unknown flower: ${flowerName}`)
  }

  // Convert braille to ASCII
  const asciiLines = brailleArtToAscii(brailleArt)

  // Find the max width of the ASCII art
  const maxArtWidth = Math.max(...asciiLines.map((l) => l.length))

  // Helper to generate repeating text to fill width
  const fillWithText = (text: string, width: number): string => {
    if (width <= 0) return ""
    const repeated = text.repeat(Math.ceil(width / text.length))
    return repeated.slice(0, width)
  }

  // Generate a full line of just text
  const textOnlyLine = fillWithText(leftText, cols)

  // Build output lines
  const outputLines: string[] = []

  // Add margin top lines (just text)
  for (let i = 0; i < marginTop; i++) {
    outputLines.push(textOnlyLine)
  }

  // Process each ASCII art line
  for (const line of asciiLines) {
    const { text: strippedText, leftOffset } = stripLine(line)

    if (strippedText.length === 0) {
      // Empty line - just fill with text
      outputLines.push(textOnlyLine)
      continue
    }

    // Calculate centering
    const artCenterOffset = Math.floor((cols - maxArtWidth) / 2)
    const flowerStartX = artCenterOffset + leftOffset

    // Build the line:
    // [left text] [paddingX spaces] [flower] [paddingX spaces] [right text]
    const leftPadding = " ".repeat(paddingX)
    const rightPadding = " ".repeat(paddingX)

    const flowerWithPadding = leftPadding + strippedText + rightPadding
    const flowerTotalWidth = flowerWithPadding.length

    // Calculate where the flower block starts (centered)
    const flowerBlockStart = Math.max(0, flowerStartX - paddingX)
    const flowerBlockEnd = flowerBlockStart + flowerTotalWidth

    // Generate left text portion
    const leftWidth = flowerBlockStart
    const leftPortion = fillWithText(leftText, leftWidth)

    // Generate right text portion
    const rightWidth = Math.max(0, cols - flowerBlockEnd)
    const rightPortion = fillWithText(rightText, rightWidth)

    const fullLine = leftPortion + flowerWithPadding + rightPortion

    // Ensure line is exactly cols width
    outputLines.push(fullLine.slice(0, cols).padEnd(cols, " "))
  }

  // Add some margin bottom lines too
  for (let i = 0; i < marginTop; i++) {
    outputLines.push(textOnlyLine)
  }

  // Fill remaining rows with text
  while (outputLines.length < rows) {
    outputLines.push(textOnlyLine)
  }

  return outputLines.join("\n")
}
