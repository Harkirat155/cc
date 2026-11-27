// Barrel: import this once to register all built-in games.
// Side-effecting import — server bootstrap and Vite entry both pull this in.

import { register } from './registry.js';
import ttt from './ttt.js';
import connect4 from './connect4.js';
import checkers from './checkers.js';
import five from './five.js';

register(ttt);
register(connect4);
register(checkers);
register(five);

export { ttt, connect4, checkers, five };
export * as registry from './registry.js';
