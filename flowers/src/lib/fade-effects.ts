/**
 * Fade Effects for Text Animation
 *
 * Three modes for how text characters fade in/out based on scroll progress:
 * - random: Each character has random threshold (current behavior)
 * - bg: Characters appear based on background noise intensity at their position
 * - words: Words fade in sequentially with left-to-right fill effect
 */

// =============================================================================
// CONFIGURABLE CONSTANTS - Tweak these!
// =============================================================================

/** Random mode: spread of random thresholds (0-1, higher = more gradual fade) */
export const RANDOM_THRESHOLD_SPREAD = 1.0

/** Random mode: threshold for half-opacity vs full opacity transition */
export const RANDOM_HALF_OPACITY_FACTOR = 0.5

/** BG mode: how much the bg value influences appearance (0-1) */
export const BG_INFLUENCE = 0.8

/** BG mode: base threshold that all chars get regardless of bg */
export const BG_BASE_THRESHOLD = 0.2

/** BG mode: whether darker (false) or brighter (true) bg means earlier appearance */
export const BG_INVERT = false

/** Words mode: number of words overlapping at any time */
export const WORDS_CONCURRENT = 3

/** Words mode: portion of word duration for first opacity level fill (0-0.5) */
export const WORDS_PHASE1_DURATION = 0.45

/** Words mode: portion of word duration for second opacity level fill (0-0.5) */
export const WORDS_PHASE2_DURATION = 0.45

/** Sequential mode: portion of fade for lower opacity phase (0-0.5) */
export const SEQUENTIAL_PHASE1_PORTION = 0.35

/** Sequential mode: portion of fade for higher opacity phase (0-0.5) */
export const SEQUENTIAL_PHASE2_PORTION = 0.35

// =============================================================================
// TYPES
// =============================================================================

export type FadeEffectType = "random" | "bg" | "words" | "sequential"

export interface FadeEffectContext {
  /** Current fade progress 0-1 (0 = hidden, 1 = fully visible) */
  fadeProgress: number
  /** Grid column of the character */
  col: number
  /** Grid row of the character */
  row: number
  /** Character index within the text item (0-based) */
  charIndex: number
  /** Total character count in the text item */
  totalChars: number
  /** The character being rendered */
  char: string
  /** Word index this character belongs to (for words mode) */
  wordIndex?: number
  /** Character index within current word */
  charInWord?: number
  /** Length of the current word */
  wordLength?: number
  /** Total words in text */
  totalWords?: number
  /** Word order for sequential reveal (randomized on init) */
  wordOrder?: number[]
  /** Background value at this position (0-1, from noise texture) */
  bgValue?: number
  /** Reverse animation direction (for RTL/bottom-up text) */
  fadeReverse?: boolean
}

export interface FadeEffectResult {
  /** Opacity multiplier 0-1 */
  opacity: number
}

export type FadeEffectFn = (ctx: FadeEffectContext) => FadeEffectResult

// =============================================================================
// UTILITY
// =============================================================================

/** Deterministic hash for consistent random values per grid position */
const hash = (x: number, y: number, seed: number = 0): number => {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.123) * 43758.5453
  return n - Math.floor(n)
}

/** Seeded random for word order */
const seededRandom = (seed: number): (() => number) => {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

/** Shuffle array with seeded random */
const shuffleArray = <T>(arr: T[], seed: number): T[] => {
  const result = [...arr]
  const rand = seededRandom(seed)
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// =============================================================================
// FADE EFFECT IMPLEMENTATIONS
// =============================================================================

/**
 * Random fade: each character has a random threshold based on grid position.
 * Characters first appear at half opacity, then full opacity.
 */
export const randomFadeEffect: FadeEffectFn = (ctx) => {
  const { fadeProgress, col, row } = ctx

  if (fadeProgress >= 1) return { opacity: 1 }
  if (fadeProgress <= 0) return { opacity: 0 }

  const charRandom = hash(col, row) * RANDOM_THRESHOLD_SPREAD

  if (fadeProgress < charRandom * RANDOM_HALF_OPACITY_FACTOR) {
    return { opacity: 0 }
  } else if (fadeProgress < charRandom) {
    return { opacity: 0.5 }
  } else {
    return { opacity: 1 }
  }
}

/**
 * BG-based fade: characters appear based on background noise intensity.
 * Higher bg values = earlier appearance (or inverted if BG_INVERT is true).
 */
export const bgFadeEffect: FadeEffectFn = (ctx) => {
  const { fadeProgress, bgValue = 0.5 } = ctx

  if (fadeProgress >= 1) return { opacity: 1 }
  if (fadeProgress <= 0) return { opacity: 0 }

  // Normalize bg value to threshold
  const effectiveBg = BG_INVERT ? 1 - bgValue : bgValue

  // Combine base threshold with bg influence
  // Higher bg = lower threshold = appears earlier
  const threshold = BG_BASE_THRESHOLD + (1 - effectiveBg) * BG_INFLUENCE

  // Scale threshold to 0-1 range
  const normalizedThreshold = Math.min(1, Math.max(0, threshold))

  if (fadeProgress < normalizedThreshold * 0.5) {
    return { opacity: 0 }
  } else if (fadeProgress < normalizedThreshold) {
    return { opacity: 0.5 }
  } else {
    return { opacity: 1 }
  }
}

/**
 * Words fade: words appear in random order with smooth left-to-right fill.
 *
 * - Words are assigned a random reveal order
 * - WORDS_CONCURRENT words overlap at any time
 * - Each word takes (totalWords / WORDS_CONCURRENT) of total duration
 * - First 45%: letters fill left-to-right at half opacity
 * - Last 45%: letters fill left-to-right at full opacity
 */
export const wordsFadeEffect: FadeEffectFn = (ctx) => {
  const {
    fadeProgress,
    wordIndex = 0,
    charInWord = 0,
    wordLength = 1,
    totalWords = 1,
    wordOrder = [],
  } = ctx

  if (fadeProgress >= 1) return { opacity: 1 }
  if (fadeProgress <= 0) return { opacity: 0 }

  // Find this word's position in the reveal order
  const revealPosition = wordOrder.indexOf(wordIndex)
  if (revealPosition === -1) return { opacity: 0 }

  // Word duration as fraction of total timeline
  // With 3 concurrent words, each word spans 1/3 of total time for its full animation
  const wordDuration = 1 / WORDS_CONCURRENT

  // Stagger word starts evenly across timeline, leaving room for last words to complete
  // Timeline: |----word0----|----word1----|...
  // Start times spread across (1 - wordDuration) so last word ends at 1
  const availableStartRange = 1 - wordDuration
  const wordStart = totalWords > 1 
    ? (revealPosition / (totalWords - 1)) * availableStartRange
    : 0
  const wordEnd = wordStart + wordDuration

  // Progress within this word's window (0 to 1)
  if (fadeProgress < wordStart) return { opacity: 0 }
  if (fadeProgress >= wordEnd) return { opacity: 1 }

  const wordProgress = (fadeProgress - wordStart) / wordDuration

  // Character position normalized (0 to 1 across word length)
  // For single char words, position is 0
  const charPosition = wordLength > 1 ? charInWord / (wordLength - 1) : 0

  // Phase 1 (0 to 45%): letters fill left-to-right at half opacity
  // Phase 2 (45% to 90%): letters fill left-to-right at full opacity
  // (last 10% all letters at full)

  const phase1End = WORDS_PHASE1_DURATION
  // Note: phase2End would be phase1End + WORDS_PHASE2_DURATION but we don't need it

  // How far through phase 1 are we? (0 to 1 within phase 1)
  const phase1Progress = Math.min(1, wordProgress / phase1End)
  // How far through phase 2 are we? (0 to 1 within phase 2)
  const phase2Progress = wordProgress > phase1End 
    ? Math.min(1, (wordProgress - phase1End) / WORDS_PHASE2_DURATION)
    : 0

  // Has this character reached half opacity? (phase 1 fill)
  const reachedHalf = charPosition <= phase1Progress
  // Has this character reached full opacity? (phase 2 fill)  
  const reachedFull = wordProgress > phase1End && charPosition <= phase2Progress

  if (reachedFull) return { opacity: 1 }
  if (reachedHalf) return { opacity: 0.5 }
  return { opacity: 0 }
}

/**
 * Sequential fade: characters appear/disappear in a staggered fashion.
 * 
 * The fade fraction is divided into three parts:
 * - First 35%: characters at lower opacity (0.5)
 * - Middle 30%: break/transition (maintains previous state)
 * - Last 35%: characters at higher opacity (1.0)
 * 
 * This creates a smooth staggered reveal effect.
 * 
 * When fadeReverse is true, the animation flows in reverse order
 * (last char first instead of first char first).
 */
export const sequentialFadeEffect: FadeEffectFn = (ctx) => {
  const { fadeProgress, charIndex, totalChars, fadeReverse = false } = ctx

  if (fadeProgress >= 1) return { opacity: 1 }
  if (fadeProgress <= 0) return { opacity: 0 }

  // Character position normalized (0 to 1 across all characters)
  // When reversed, invert the position so last char = 0, first char = 1
  let charPosition = totalChars > 1 ? charIndex / (totalChars - 1) : 0
  if (fadeReverse) {
    charPosition = 1 - charPosition
  }

  // Phase boundaries
  const phase1End = SEQUENTIAL_PHASE1_PORTION // 0.35
  const phase2Start = 1 - SEQUENTIAL_PHASE2_PORTION // 0.65
  
  // Phase 1 (0 to 35%): characters reveal at half opacity
  if (fadeProgress < phase1End) {
    // How far through phase 1 are we? (0 to 1 within phase 1)
    const phase1Progress = fadeProgress / phase1End
    // Has this character been revealed yet?
    if (charPosition <= phase1Progress) {
      return { opacity: 0.5 }
    }
    return { opacity: 0 }
  }
  
  // Middle break (35% to 65%): all revealed chars stay at half opacity
  if (fadeProgress < phase2Start) {
    return { opacity: 0.5 }
  }
  
  // Phase 2 (65% to 100%): characters transition to full opacity
  const phase2Progress = (fadeProgress - phase2Start) / SEQUENTIAL_PHASE2_PORTION
  if (charPosition <= phase2Progress) {
    return { opacity: 1 }
  }
  return { opacity: 0.5 }
}

// =============================================================================
// EFFECT REGISTRY
// =============================================================================

export const fadeEffects: Record<FadeEffectType, FadeEffectFn> = {
  random: randomFadeEffect,
  bg: bgFadeEffect,
  words: wordsFadeEffect,
  sequential: sequentialFadeEffect,
}

export const getFadeEffect = (type: FadeEffectType): FadeEffectFn => {
  return fadeEffects[type] || randomFadeEffect
}

// =============================================================================
// WORD PARSING HELPERS
// =============================================================================

export interface WordInfo {
  word: string
  startIndex: number
  endIndex: number
}

/** Parse text into words with their character indices */
export const parseWords = (text: string): WordInfo[] => {
  const words: WordInfo[] = []
  const regex = /\S+/g
  let match

  while ((match = regex.exec(text)) !== null) {
    words.push({
      word: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length - 1,
    })
  }

  return words
}

/** Generate shuffled word order for a text item (deterministic based on text hash) */
export const generateWordOrder = (text: string, seed?: number): number[] => {
  const words = parseWords(text)
  const indices = words.map((_, i) => i)
  const hashSeed = seed ?? text.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return shuffleArray(indices, hashSeed)
}

/** Get word info for a character at given index */
export const getCharWordInfo = (
  charIndex: number,
  words: WordInfo[]
): { wordIndex: number; charInWord: number } | null => {
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (charIndex >= w.startIndex && charIndex <= w.endIndex) {
      return {
        wordIndex: i,
        charInWord: charIndex - w.startIndex,
      }
    }
  }
  return null
}
