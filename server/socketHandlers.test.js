import { jest } from '@jest/globals';
import { registerSocketHandlers } from './socketHandlers.js';
import { rooms } from './roomManager.js';

// Lightweight socket/io mocks
function createIo() {
  const listeners = new Map();
  const io = {
    on: (event, cb) => { listeners.set(event, cb); },
    to: () => ({ emit: () => {} }),
    __listeners: listeners,
  };
  return io;
}

function createSocket(id = 'sock1') {
  const listeners = new Map();
  return {
    id,
    on: (event, cb) => { listeners.set(event, cb); },
    emit: jest.fn(),
    join: jest.fn(),
    to: () => ({ emit: jest.fn() }),
    __emit: (event, payload, ack) => listeners.get(event)?.(payload, ack),
  };
}

describe('socketHandlers duplicate seat prevention', () => {
  beforeEach(() => {
    rooms.clear();
  });

  test('same clientId cannot occupy X and O after refresh', () => {
    const io = createIo();
    registerSocketHandlers(io);
    // Simulate first connection creating a room
    const sock1 = createSocket('A');
    io.__listeners.get('connection')(sock1);

    let created;
    sock1.__emit('createRoom', { clientId: 'client-1' }, (data) => { created = data; });
    expect(created.player).toBe('X');
    const { roomId } = created;

    // Second socket joins same room with same clientId (refresh)
    const sock2 = createSocket('B');
    io.__listeners.get('connection')(sock2);
    let joined;
    sock2.__emit('joinRoom', { roomId, clientId: 'client-1' }, (data) => { joined = data; });

    expect(['X', 'spectator']).toContain(joined.player);
    const r = rooms.get(roomId);
    // Ensure not both seats are same socket id
    expect(r.players.X).not.toBe(sock2.id);
    expect(r.players.O).not.toBe(sock2.id);
  });
});
