#!/usr/bin/env node

import console from 'node:console';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createInterface } from 'node:readline';
import { clearTimeout, setTimeout } from 'node:timers';
import { pathToFileURL, URL } from 'node:url';
import { io } from 'socket.io-client';
import '../shared/games/index.js';
import { get as getGameRules, has as hasGame, listIds } from '../shared/games/registry.js';

const DEFAULT_BACKEND = 'https://crisscross-backend.fly.dev';
const DEFAULT_NAME = 'Copilot Agent';
const DEFAULT_GAME = 'ttt';
const CONNECT_TIMEOUT_MS = 10_000;
const ACK_TIMEOUT_MS = 8_000;
const PUBLIC_FRONTEND = 'https://harkirat155.github.io/cc';

export class UsageError extends Error {}

export function helpText() {
  return `Usage: node scripts/agent-play.mjs [options]

Options:
  --backend <url>   Socket.IO backend (default: ${DEFAULT_BACKEND})
  --room <code>     Join an existing room (required unless --create)
  --name <name>     Display name (default: ${DEFAULT_NAME})
  --game <id>       Game for created rooms (default: ${DEFAULT_GAME})
  --create          Create a room instead of joining one
  --auto first      Make the first legal move when it is this agent's turn
  --help            Show this help

Commands after join/create:
  move <cellOrColumn>
  move <from> <to> [captures...]
  reset
  quit`;
}

function splitFlag(arg) {
  const eq = arg.indexOf('=');
  return eq > 0 && arg.startsWith('--') ? [arg.slice(0, eq), arg.slice(eq + 1)] : [arg, null];
}

function readValue(argv, index, flag, inlineValue) {
  const value = inlineValue ?? argv[index + 1];
  if (!value || value.startsWith('--')) throw new UsageError(`${flag} requires a value`);
  return [value, inlineValue === null ? index + 1 : index];
}

export function parseArgs(argv = []) {
  const opts = {
    backend: DEFAULT_BACKEND,
    room: null,
    name: DEFAULT_NAME,
    game: DEFAULT_GAME,
    create: false,
    auto: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inlineValue] = splitFlag(argv[i]);
    if (flag === '--help') opts.help = true;
    else if (flag === '--create') opts.create = true;
    else if (flag === '--backend') {
      const [value, next] = readValue(argv, i, flag, inlineValue);
      opts.backend = value.trim();
      i = next;
    } else if (flag === '--room') {
      const [value, next] = readValue(argv, i, flag, inlineValue);
      opts.room = value.trim().toUpperCase();
      i = next;
    } else if (flag === '--name') {
      const [value, next] = readValue(argv, i, flag, inlineValue);
      opts.name = value.trim();
      i = next;
    } else if (flag === '--game') {
      const [value, next] = readValue(argv, i, flag, inlineValue);
      opts.game = value.trim().toLowerCase();
      i = next;
    } else if (flag === '--auto') {
      const [value, next] = readValue(argv, i, flag, inlineValue);
      opts.auto = value.trim().toLowerCase();
      i = next;
    } else {
      throw new UsageError(`Unknown option: ${flag}`);
    }
  }

  if (opts.help) return opts;
  if (!opts.backend) throw new UsageError('--backend cannot be empty');
  if (!opts.name) throw new UsageError('--name cannot be empty');
  if (!hasGame(opts.game)) throw new UsageError(`Unknown game "${opts.game}". Known: ${listIds().join(', ')}`);
  if (opts.auto && opts.auto !== 'first') throw new UsageError('Only "--auto first" is supported');
  if (opts.create && opts.room) throw new UsageError('Use either --create or --room, not both');
  if (!opts.create && !opts.room) throw new UsageError('Missing --room <code> (or pass --create)');
  return opts;
}

function seatToSlot(seat) {
  if (seat === 'X') return 0;
  if (seat === 'O') return 1;
  return -1;
}

function intToken(value, label) {
  if (!/^-?\d+$/.test(value || '')) throw new UsageError(`${label} must be an integer`);
  return Number(value);
}

function sameCaptures(a = [], b = []) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameMove(a, b) {
  if (a.type !== b.type) return false;
  if (a.type === 'place') return a.cell === b.cell;
  return a.from === b.from && a.to === b.to && sameCaptures(a.captures || [], b.captures || []);
}

export function buildMoveFromArgs(args, legalMoves = []) {
  if (args.length === 1) {
    const candidate = { type: 'place', cell: intToken(args[0], 'cellOrColumn') };
    const match = legalMoves.find((move) => sameMove(candidate, move));
    return { move: match || candidate, matched: Boolean(match) };
  }
  if (args.length >= 2) {
    const candidate = {
      type: 'transfer',
      from: intToken(args[0], 'from'),
      to: intToken(args[1], 'to'),
    };
    const captures = args.slice(2).map((value) => intToken(value, 'capture'));
    if (captures.length) candidate.captures = captures;
    const match = legalMoves.find((move) => sameMove(candidate, move));
    return { move: match || candidate, matched: Boolean(match) };
  }
  throw new UsageError('move requires at least one argument');
}

function slotLabel(update, slot) {
  if (slot !== 0 && slot !== 1) return 'spectator';
  return update?.playerInfo?.[slot]?.label || update?.marks?.[slot] || (slot === 0 ? 'X' : 'O');
}

function resolveSlotFromLabel(update, value) {
  if (Number.isInteger(value)) return value;
  const labels = update?.playerInfo?.map((player) => player.label) || update?.marks || ['X', 'O'];
  const index = labels.findIndex((label) => label === value);
  return index >= 0 ? index : 0;
}

function resolveStatus(update) {
  if (update?.status) return update.status;
  if (update?.winner === 'draw') return 'draw';
  if (update?.winner) return 'win';
  return 'active';
}

export function reconstructState(update) {
  const status = resolveStatus(update);
  const winner = Number.isInteger(update?.winnerSlot)
    ? update.winnerSlot
    : (status === 'win' ? resolveSlotFromLabel(update, update?.winner) : null);
  return {
    board: Array.isArray(update?.board) ? update.board : [],
    turn: resolveSlotFromLabel(update, update?.turnSlot ?? update?.turn),
    status,
    winner,
    winningCells: update?.winningCells || update?.winningLine || [],
    scores: Array.isArray(update?.scores) ? update.scores : [update?.xScore || 0, update?.oScore || 0],
    moveCount: Number.isInteger(update?.moveCount) ? update.moveCount : 0,
  };
}

export function getLegalMoveInfo(update, seat) {
  if (!update) return { moves: [], reason: 'no gameUpdate yet' };
  const slot = seatToSlot(seat);
  if (slot < 0) return { moves: [], reason: 'spectator' };
  let rules;
  try {
    rules = getGameRules(update.gameId || DEFAULT_GAME);
  } catch (error) {
    return { moves: [], reason: error.message };
  }
  const state = reconstructState(update);
  if (state.status !== 'active') return { moves: [], reason: state.status };
  if (state.turn !== slot) return { moves: [], reason: `waiting for ${slotLabel(update, state.turn)}`, rules, state, slot };
  return { moves: rules.getLegalMoves(state, slot) || [], reason: '', rules, state, slot };
}

function describeMove(rules, move) {
  const label = rules?.describeMove?.(move, rules) || '';
  if (move.type === 'place') return `${label || `cell ${move.cell}`} [cmd: move ${move.cell}]`;
  const captures = (move.captures || []).join(' ');
  return `${label || `${move.from}→${move.to}`} [cmd: move ${move.from} ${move.to}${captures ? ` ${captures}` : ''}]`;
}

function isEmptyCell(cell) {
  return cell === '' || cell === null || cell === undefined;
}

function cellLabel(cell, update) {
  if (isEmptyCell(cell)) return '.';
  if (typeof cell === 'string') return cell.slice(0, 2);
  if (typeof cell === 'object') {
    const owner = slotLabel(update, cell.owner).slice(0, 1).toUpperCase();
    return `${owner}${cell.type === 'king' ? 'K' : 'm'}`;
  }
  return String(cell).slice(0, 2);
}

function boardSpec(update) {
  if (update?.boardSpec?.rows && update?.boardSpec?.cols) return update.boardSpec;
  try {
    return getGameRules(update?.gameId || DEFAULT_GAME).boardSpec;
  } catch {
    const length = Array.isArray(update?.board) ? update.board.length : 0;
    return { rows: 1, cols: length || 0 };
  }
}

function boardLines(update) {
  const board = Array.isArray(update?.board) ? update.board : [];
  const spec = boardSpec(update);
  const rows = spec.rows || 1;
  const cols = spec.cols || board.length || 1;
  const withIndexes = board.length <= 16;
  const lines = [`board ${rows}x${cols}`];
  for (let row = 0; row < rows; row += 1) {
    const cells = [];
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      const label = cellLabel(board[index], update);
      cells.push(withIndexes ? `${index}:${label}` : label);
    }
    lines.push(`${withIndexes ? '' : `r${row}: `}${cells.join(' ')}`.trim());
  }
  if (!withIndexes) {
    const occupied = board
      .map((cell, index) => (isEmptyCell(cell) ? null : `${index}:${cellLabel(cell, update)}`))
      .filter(Boolean)
      .slice(0, 24);
    lines.push(`occupied: ${occupied.join(' ') || 'none'}`);
  }
  return lines;
}

function roomUrl(backend, roomId) {
  try {
    const parsed = new URL(backend);
    if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
      const host = parsed.hostname === '127.0.0.1' ? 'localhost' : parsed.hostname;
      return `http://${host}:5173/cc/room/${roomId}`;
    }
  } catch {
    // Fall through to the public frontend URL.
  }
  return `${PUBLIC_FRONTEND}/room/${roomId}`;
}

function printUpdate(update, session) {
  const seat = session.player || 'unknown';
  const info = getLegalMoveInfo(update, seat);
  const turn = slotLabel(update, reconstructState(update).turn);
  const scores = Array.isArray(update.scores) ? update.scores : [update.xScore || 0, update.oScore || 0];
  const status = resolveStatus(update);
  const winner = status === 'win' ? ` winner=${slotLabel(update, reconstructState(update).winner)}` : '';
  const you = info.slot >= 0 && !info.reason ? 'your-turn' : info.reason || 'ready';
  console.log(`state room=${update.roomId || session.roomId} game=${update.gameId || DEFAULT_GAME} seat=${seat} turn=${turn} status=${status}${winner} score=${scores[0]}-${scores[1]} you=${you}`);
  for (const line of boardLines(update)) console.log(line);
  if (info.moves.length) {
    const shown = info.moves.slice(0, 12).map((move) => describeMove(info.rules, move));
    const suffix = info.moves.length > shown.length ? ` …+${info.moves.length - shown.length}` : '';
    console.log(`legal: ${shown.join(', ')}${suffix}`);
  } else {
    console.log(`legal: none (${info.reason || 'no legal moves'})`);
  }
}

function waitForConnect(socket) {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let lastError = null;
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Connection timed out${lastError ? `: ${lastError.message}` : ''}`));
    }, CONNECT_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timer);
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
    };
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (error) => {
      lastError = error;
    };
    socket.on('connect', onConnect);
    socket.on('connect_error', onError);
  });
}

function emitWithAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (error, response = {}) => {
      if (error) reject(new Error(`${event} ack timed out`));
      else if (response.error || response.success === false) reject(new Error(response.error || `${event} failed`));
      else resolve(response);
    });
  });
}

function sendMove(socket, session, move, prefix = 'sent') {
  socket.emit('makeMove', { roomId: session.roomId, move });
  console.log(`${prefix} move ${JSON.stringify(move)}`);
}

function maybeAutoMove(socket, session, opts) {
  if (opts.auto !== 'first' || session.autoMoved) return;
  const info = getLegalMoveInfo(session.latestUpdate, session.player);
  if (!info.moves.length || info.reason) return;
  session.autoMoved = true;
  sendMove(socket, session, info.moves[0], 'auto first');
}

async function handleCommand(line, socket, session) {
  const parts = line.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return;
  const [command, ...args] = parts;
  if (command === 'quit' || command === 'exit') {
    session.shutdown(0);
    return;
  }
  if (command === 'help') {
    console.log('commands: move <cellOrColumn> | move <from> <to> [captures...] | reset | quit');
    return;
  }
  if (command === 'reset') {
    socket.emit('resetGame', { roomId: session.roomId });
    console.log('sent reset');
    return;
  }
  if (command === 'move') {
    const info = getLegalMoveInfo(session.latestUpdate, session.player);
    const { move, matched } = buildMoveFromArgs(args, info.moves);
    if (info.moves.length && !matched) console.log('warning: move is not in current legal hints; server may reject it');
    if (info.reason) console.log(`warning: ${info.reason}; server may reject it`);
    sendMove(socket, session, move);
    return;
  }
  console.log(`unknown command: ${command}`);
}

function startCommandLoop(socket, session) {
  console.log('commands: move <cellOrColumn> | move <from> <to> [captures...] | reset | quit');
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
  if (process.stdin.isTTY) rl.setPrompt('agent> ');
  rl.on('line', (line) => {
    handleCommand(line, socket, session)
      .catch((error) => console.error(`command error: ${error.message}`))
      .finally(() => {
        if (!session.exiting && process.stdin.isTTY) rl.prompt();
      });
  });
  rl.on('close', () => {
    if (!session.exiting) console.log('stdin closed; listening for gameUpdate until interrupted');
  });
  if (process.stdin.isTTY) rl.prompt();
  return rl;
}

export async function runCli(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (opts.help) {
    console.log(helpText());
    return;
  }

  const socket = io(opts.backend, { transports: ['websocket', 'polling'] });
  const session = {
    roomId: opts.room,
    player: null,
    latestUpdate: null,
    autoMoved: false,
    exiting: false,
    shutdown: () => {},
  };
  let rl = null;

  session.shutdown = (code = 0) => {
    if (session.exiting) return;
    session.exiting = true;
    socket.disconnect();
    rl?.close();
    process.exitCode = code;
  };

  process.once('SIGINT', () => session.shutdown(0));
  process.once('SIGTERM', () => session.shutdown(0));
  socket.on('gameUpdate', (update) => {
    session.latestUpdate = update;
    if (update.roomId) session.roomId = update.roomId;
    printUpdate(update, session);
    maybeAutoMove(socket, session, opts);
  });
  socket.on('connect_error', (error) => {
    if (!session.exiting) console.error(`connect_error: ${error.message}`);
  });
  socket.on('disconnect', (reason) => {
    if (!session.exiting) console.error(`disconnected: ${reason}`);
  });

  try {
    await waitForConnect(socket);
    console.log(`connected backend=${opts.backend} socket=${socket.id}`);

    const clientId = `agent:${randomUUID()}`;
    if (opts.create) {
      const response = await emitWithAck(socket, 'createRoom', {
        clientId,
        displayName: opts.name,
        gameId: opts.game,
      });
      session.roomId = response.roomId;
      session.player = response.player || 'X';
      console.log(`created room=${session.roomId} seat=${session.player}`);
      console.log(`open ${roomUrl(opts.backend, session.roomId)}`);
    } else {
      const response = await emitWithAck(socket, 'joinRoom', {
        roomId: opts.room,
        clientId,
        displayName: opts.name,
      });
      session.player = response.player || 'spectator';
      console.log(`joined room=${session.roomId} seat=${session.player}`);
    }

    rl = startCommandLoop(socket, session);
  } catch (error) {
    session.shutdown(1);
    throw error;
  }
}

function isMain() {
  return Boolean(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href);
}

if (isMain()) {
  runCli().catch((error) => {
    console.error(`error: ${error.message}`);
    if (error instanceof UsageError) console.error('Run with --help for usage.');
    process.exitCode = 1;
  });
}
