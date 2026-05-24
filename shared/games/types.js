// Shared game-platform type definitions (JSDoc only — runtime is plain JS).
// Imported by both server (relative path) and client (Vite alias `@shared`).
// Source of truth for the GameRules contract every game must implement.

/**
 * @typedef {0 | 1} Slot
 * Player slot index. Replaces game-specific labels like 'X'/'O' so the
 * platform can host games with arbitrary player labels.
 */

/**
 * @typedef {Object} Player
 * @property {Slot}   slot   0 or 1.
 * @property {string} label  Game-specific short label ('X', 'Red', 'Black').
 * @property {string} color  Tailwind-friendly token hint (e.g. 'sky', 'rose').
 */

/**
 * @typedef {Object} Piece
 * @property {string} type   Game-defined piece type ('mark', 'disc', 'man', 'king', ...).
 * @property {Slot}   owner  Which player slot owns this piece.
 */

/**
 * @typedef {Object} Cell
 * @property {string}        [type]   Cell type hint for the renderer ('square', 'dark', ...).
 * @property {Piece | null}  [piece]  Occupant, if any.
 */

/**
 * @typedef {Object} BoardSpec
 * Describes the *shape* of the board for the renderer. Pure metadata.
 * @property {'grid'} kind  Only 'grid' is implemented today; reserved for future graph boards.
 * @property {number} rows
 * @property {number} cols
 */

/**
 * @typedef {Object} PlaceMove
 * @property {'place'} type
 * @property {number}  cell   Flat board index (row * cols + col).
 */

/**
 * @typedef {Object} TransferMove
 * @property {'transfer'} type
 * @property {number}     from      Flat board index.
 * @property {number}     to        Flat board index.
 * @property {number[]}   [captures] Indices of captured pieces (Checkers, etc.).
 */

/** @typedef {PlaceMove | TransferMove} Move */

/**
 * @typedef {'active' | 'win' | 'draw'} GameStatus
 */

/**
 * @typedef {Object} GameState
 * @property {Array<string | Piece | null>} board   Flat array, length rows*cols. Empty cell = '' (grid-mark) or null (piece-movement).
 * @property {Slot}        turn          Whose turn it is.
 * @property {GameStatus}  status
 * @property {Slot | null} winner        null on active or draw.
 * @property {number[]}    winningCells  Indices forming the winning line (empty when not won).
 * @property {[number, number]} scores   Running scores keyed by slot (scores[0], scores[1]).
 * @property {number}      moveCount
 */

/**
 * @typedef {Object} MoveEvent
 * @property {string}   type            Event tag for the UI ('placed', 'captured', 'promoted', ...).
 * @property {number[]} affectedCells   Indices the renderer should animate/highlight.
 */

/**
 * @typedef {Object} ApplyMoveResult
 * @property {GameState}    state   New (immutable) state after the move.
 * @property {MoveEvent[]}  events  Side-effect descriptions for the renderer/history.
 */

/**
 * @typedef {Object} TerminalResult
 * @property {GameStatus}  status
 * @property {Slot | null} [winner]
 * @property {number[]}    [line]
 */

// Re-export nothing — this module is types-only. Importing it for its side
// effects is a no-op and safe.
export {};
