# CrissCross Architecture# CrissCross Architecture



## Overview## Overview



CrissCross is a real-time multiplayer Tic Tac Toe application built with React (frontend) and Express + Socket.IO (backend). The architecture follows SOLID principles and separates concerns across distinct modules for game logic, matchmaking, room management, and real-time communication.CrissCross is a real-time multiplayer Tic Tac Toe application built with React (frontend) and Express + Socket.IO (backend). The architecture follows SOLID principles and separates concerns across distinct modules for game logic, matchmaking, room management, and real-time communication.



## Tech Stack## System Architecture



**Frontend:**### High-Level Components



- React 18 with hooks```

- Vite (dev server & bundler)┌─────────────────────────────────────────────────────────────────────┐

- Tailwind CSS│                          CLIENT (Browser)                            │

- Socket.IO client├─────────────────────────────────────────────────────────────────────┤

- React Router│                                                                       │

- React Joyride (walkthrough)│  React Components              Hooks                Custom Logic     │

│  ┌──────────────┐         ┌──────────────┐        ┌──────────────┐ │

**Backend:**│  │  Game.jsx    │────────▶│ useSocketGame│───────▶│ Socket.IO    │ │

│  │  Lobby.jsx   │         │              │        │   Client     │ │

- Node.js + Express│  │  LobbyView   │         │ • Game state │        │              │ │

- Socket.IO server│  │  GameBoard   │         │ • Lobby      │        │              │ │

- In-memory data stores (rooms, lobby queue)│  │  MenuPanel   │         │ • Rooms      │        │              │ │

- LRU cache for room management│  └──────────────┘         └──────────────┘        └──────┬───────┘ │

│                                                           │         │

## System Architecture└───────────────────────────────────────────────────────────┼─────────┘

                                                            │

### High-Level Flow                                                   WebSocket Connection

                                                            │

```text┌───────────────────────────────────────────────────────────┼─────────┐

┌─────────────────────────────────────────────────────────────────────┐│                          SERVER (Node.js)                 │         │

│                          CLIENT (Browser)                            │├─────────────────────────────────────────────────────────────────────┤

├─────────────────────────────────────────────────────────────────────┤│                                                           │         │

│                                                                       ││                            ┌──────────────▼──────────────────────┐  │

│  React Components              Hooks                Custom Logic     ││                            │   Socket Event Handlers             │  │

│  ┌──────────────┐         ┌──────────────┐        ┌──────────────┐ ││                            │   (socketHandlers.js)               │  │

│  │  Game.jsx    │────────▶│ useSocketGame│───────▶│ Socket.IO    │ ││                            │                                     │  │

│  │  Lobby.jsx   │         │              │        │   Client     │ ││                            │  • joinLobby / leaveLobby           │  │

│  │  LobbyView   │         │ • Game state │        │              │ ││                            │  • createRoom / joinRoom            │  │

│  │  GameBoard   │         │ • Lobby      │        │              │ ││                            │  • makeMove / newGame               │  │

│  │  MenuPanel   │         │ • Rooms      │        │              │ ││                            │  • voiceOffer / voiceAnswer         │  │

│  └──────────────┘         └──────────────┘        └──────┬───────┘ ││                            └──────────────┬──────────────────────┘  │

│                                                           │         ││                                           │                         │

└───────────────────────────────────────────────────────────┼─────────┘│                            ┌──────────────▼──────────────────────┐  │

                                                            ││                            │         Core Managers               │  │

                                                   WebSocket Connection│                            │                                     │  │

                                                            ││                            │  LobbyManager   RoomManager         │  │

┌───────────────────────────────────────────────────────────┼─────────┐│                            │  • Queue        • Rooms Map         │  │

│                          SERVER (Node.js)                 │         ││                            │  • Matching     • Game State        │  │

├─────────────────────────────────────────────────────────────────────┤│                            │                 • Players           │  │

│                                                           │         ││                            └─────────────────────────────────────┘  │

│                            ┌──────────────▼──────────────────────┐  ││                                                                     │

│                            │   Socket Event Handlers             │  │└─────────────────────────────────────────────────────────────────────┘

│                            │   (socketHandlers.js)               │  │```

│                            │                                     │  │

│                            │  • joinLobby / leaveLobby           │  │## Matchmaking System

│                            │  • createRoom / joinRoom            │  │

│                            │  • makeMove / newGame               │  │```

│                            │  • voiceOffer / voiceAnswer         │  │┌─────────────────────────────────────────────────────────────────────┐

│                            └──────────────┬──────────────────────┘  ││                          CLIENT (Browser)                            │

│                                           │                         │├─────────────────────────────────────────────────────────────────────┤

│                            ┌──────────────▼──────────────────────┐  ││                                                                       │

│                            │         Core Managers               │  ││  ┌──────────────┐         ┌──────────────┐        ┌──────────────┐ │

│                            │                                     │  ││  │   Game.jsx   │────────▶│  Lobby.jsx   │───────▶│ LobbyView    │ │

│                            │  LobbyManager   RoomManager         │  ││  │              │         │              │        │              │ │

│                            │  • Queue        • Rooms Map         │  ││  │ "Find Match" │         │  Container   │        │  UI Display  │ │

│                            │  • Matching     • Game State        │  ││  │   Button     │         │   + Router   │        │   + Input    │ │

│                            │                 • Players           │  ││  └──────────────┘         └──────┬───────┘        └──────┬───────┘ │

│                            └─────────────────────────────────────┘  ││                                   │                       │         │

│                                                                     ││                                   │                       │         │

└─────────────────────────────────────────────────────────────────────┘│                            ┌──────▼───────────────────────▼──────┐  │

```│                            │     useSocketGame Hook              │  │

│                            │  • lobbyQueue state                 │  │

## Core Modules│                            │  • isInLobby state                  │  │

│                            │  • joinLobby(name)                  │  │

### 1. Matchmaking System (Lobby)│                            │  • leaveLobby()                     │  │

│                            └──────────────┬──────────────────────┘  │

**Purpose:** Automated player matching via FIFO queue│                                           │                         │

└───────────────────────────────────────────┼─────────────────────────┘

**Components:**                                            │

                                   WebSocket Connection

- **LobbyManager** (`server/lobbyManager.js`): Queue management and matching logic                                            │

- **LobbyView** (`src/components/LobbyView.jsx`): UI for entering name and joining queue┌───────────────────────────────────────────┼─────────────────────────┐

- **Lobby** (`src/Lobby.jsx`): Container component with routing│                          SERVER (Node.js)  │                         │

├─────────────────────────────────────────────────────────────────────┤

**Flow:**│                                           │                         │

│                            ┌──────────────▼──────────────────────┐  │

1. Player clicks "Find Match" → navigates to `/lobby`│                            │   Socket Event Handlers             │  │

2. Player enters display name (2-20 characters)│                            │   (socketHandlers.js)               │  │

3. Player joins queue via `socket.emit('joinLobby', { displayName })`│                            │                                     │  │

4. Server adds to queue and broadcasts `lobbyUpdate` to all clients│                            │  • on('joinLobby')                  │  │

5. When 2+ players in queue, server auto-matches first two│                            │  • on('leaveLobby')                 │  │

6. Server creates room, assigns X/O, emits `matchFound` to both players│                            │  • on('getLobbyState')              │  │

7. Players auto-redirect to `/room/:roomId` and game starts│                            │  • on('disconnect')                 │  │

│                            └──────────────┬──────────────────────┘  │

**Key Methods:**│                                           │                         │

│                                           │ delegates to            │

```javascript│                                           │                         │

// LobbyManager│                            ┌──────────────▼──────────────────────┐  │

addPlayer(socketId, displayName)    // Add to queue│                            │      LobbyManager                   │  │

removePlayer(socketId)               // Remove from queue│                            │    (lobbyManager.js)                │  │

matchPlayers()                       // Match first 2 players (FIFO)│                            │                                     │  │

getQueueState()                      // Get current queue│                            │  State:                             │  │

```│                            │   • queue: []                       │  │

│                            │   • playerMetadata: Map()           │  │

**Socket Events:**│                            │                                     │  │

│                            │  Methods:                           │  │

- `joinLobby` → `lobbyUpdate` (broadcast)│                            │   • addPlayer()                     │  │

- `leaveLobby` → `lobbyUpdate` (broadcast)│                            │   • removePlayer()                  │  │

- `matchFound` → sent to matched players only│                            │   • matchPlayers()                  │  │

│                            │   • getQueueState()                 │  │

### 2. Room Management│                            └─────────────────────────────────────┘  │

│                                           │                         │

**Purpose:** Handle game rooms, player assignments, and game state│                                           │ broadcasts              │

│                                           ▼                         │

**Components:**│                            ┌─────────────────────────────────────┐  │

│                            │  Socket.IO emit()                   │  │

- **RoomManager** (`server/roomManager.js`): Manages room lifecycle and state│                            │  • lobbyUpdate → all clients        │  │

- **Game** (`src/Game.jsx`): Main game container│                            │  • matchFound → matched players     │  │

- **useSocketGame** (`src/hooks/useSocketGame.js`): Socket integration and state management│                            └─────────────────────────────────────┘  │

│                                                                     │

**Room Structure:**└─────────────────────────────────────────────────────────────────────┘

```

```javascript

{## Component Responsibility Map

  roomId: "ABC12",           // 5-char code

  players: {```

    X: socketId1,┌─────────────────────────────────────────────────────────────────────┐

    O: socketId2│                     SINGLE RESPONSIBILITY                           │

  },├─────────────────────────────────────────────────────────────────────┤

  spectators: [socketId3],   // Read-only observers│                                                                       │

  gameState: {│  LobbyManager         ◄──── Queue Management + Matching Logic        │

    board: [null, null, ...],│  ├─ addPlayer()                                                      │

    currentPlayer: "X",│  ├─ removePlayer()                                                   │

    winner: null,│  ├─ matchPlayers()                                                   │

    scores: { X: 0, O: 0 }│  └─ getQueueState()                                                  │

  },│                                                                       │

  matchedPlayers: {│  socketHandlers       ◄──── Event Routing (Thin Delegates)          │

    X: { displayName: "Alice" },│  ├─ on('joinLobby')                                                  │

    O: { displayName: "Bob" }│  ├─ on('leaveLobby')                                                 │

  }│  └─ on('disconnect')                                                 │

}│                                                                       │

```│  LobbyView            ◄──── UI Rendering + User Input                │

│  ├─ Display name form                                                │

**Room Flow:**│  ├─ Queue display                                                    │

│  └─ Loading states                                                   │

1. **Create Room:** Player clicks "Create Room" → gets X, receives 5-char code│                                                                       │

2. **Join Room:** Other player uses code/link → gets O (or spectator if full)│  Lobby                ◄──── Container + Routing Logic                │

3. **Play:** Players take turns, server validates moves and broadcasts state│  ├─ Connect hooks                                                    │

4. **End Game:** Winner/draw detected → result modal → "Request New Game" flow│  └─ Auto-redirect                                                    │

│                                                                       │

**Socket Events:**│  useSocketGame        ◄──── State Management + Socket Events         │

│  ├─ Lobby state                                                      │

- `createRoom` → `roomCreated`│  ├─ Socket listeners                                                 │

- `joinRoom` → `playerJoined`, `gameState`│  └─ Action methods                                                   │

- `makeMove` → `gameState` (broadcast to room)│                                                                       │

- `requestNewGame` → `newGameRequested` (broadcast)└─────────────────────────────────────────────────────────────────────┘

- `startNewGame` → `gameState` (reset board)```



### 3. Game Logic## Data Flow: Join Lobby



**Purpose:** Validate moves, detect wins/draws, manage turns```

User clicks "Find Match"

**Location:** `server/gameLogic.js`         │

         ▼

**Key Functions:**Navigate to /lobby

         │

```javascript         ▼

calculateWinner(board)       // Returns winner ('X'/'O') or nullUser enters "PlayerName"

isDraw(board)                // Check if board is full with no winner         │

isValidMove(board, index)    // Validate square is empty         ▼

```Click "Join Lobby"

         │

**Win Detection:** Checks all 8 possible winning lines (3 rows, 3 columns, 2 diagonals)         ▼

┌────────────────────────────────────────────┐

### 4. Voice Chat (WebRTC)│ joinLobby("PlayerName")                    │

│   ↓                                        │

**Purpose:** Enable voice communication in multiplayer games│ socket.emit('joinLobby', {                 │

│   displayName: "PlayerName"                │

**Components:**│ })                                         │

└────────────────────────────────────────────┘

- **useVoiceChat** (`src/hooks/useVoiceChat.js`): WebRTC peer connection management         │

- **AudioRenderer** (`src/components/AudioRenderer.jsx`): Renders remote audio streams         │ WebSocket

         ▼

**Flow:**┌────────────────────────────────────────────┐

│ Server: on('joinLobby')                    │

1. Player enables mic → gets media stream│   ↓                                        │

2. Creates RTCPeerConnection for each remote player│ lobbyManager.addPlayer(socketId, name)     │

3. Sends offer via Socket.IO → receives answer│   ↓                                        │

4. ICE candidates exchanged → peer connection established│ Validate (2-20 chars, no duplicates)       │

5. Remote audio streams rendered in `<audio>` elements│   ↓                                        │

│ queue.push({ socketId, name, timestamp })  │

**Socket Events:**│   ↓                                        │

│ broadcastLobbyState(io)                    │

- `voiceOffer` → send WebRTC offer│   ↓                                        │

- `voiceAnswer` → send WebRTC answer│ io.emit('lobbyUpdate', { queue })          │

- `voiceIceCandidate` → exchange ICE candidates└────────────────────────────────────────────┘

         │

### 5. Frontend State Management         │ WebSocket

         ▼

**Central Hook:** `useSocketGame` manages all game state and socket communication┌────────────────────────────────────────────┐

│ Client: on('lobbyUpdate')                  │

**State:**│   ↓                                        │

│ setLobbyQueue(queue)                       │

```javascript│   ↓                                        │

{│ setIsInLobby(true)                         │

  gameState: { board, currentPlayer, winner, scores },│   ↓                                        │

  history: [{ board, move }],           // Time-travel history│ UI updates: Show waiting state             │

  completedGames: [],                   // Past game summaries└────────────────────────────────────────────┘

  roomId: null,                         // Current room code```

  player: null,                         // 'X', 'O', or null (spectator)

  isMultiplayer: false,                 // Local vs multiplayer mode## Data Flow: Player Match

  lobbyQueue: [],                       // Waiting players

  roster: Map,                          // socketId → player info```

  message: ""                           // Status messagePlayer 1 in queue

}         │

```         ▼

Player 2 joins

**Actions:**         │

         ▼

```javascript┌────────────────────────────────────────────┐

createRoom()                 // Create multiplayer room│ Server: after joinLobby                    │

joinRoom(code)              // Join existing room│   ↓                                        │

leaveRoom()                 // Leave multiplayer room│ matchResult = lobbyManager.matchPlayers()  │

joinLobby(name)             // Join matchmaking queue│   ↓                                        │

leaveLobby()                // Leave queue│ if (queue.length >= 2) {                   │

handleSquareClick(index)    // Make move│   player1 = queue.shift()                  │

resetGame()                 // New game (keep scores)│   player2 = queue.shift()                  │

resetScores()               // Reset scores│   return { matched: true, players }        │

requestNewGame()            // Request new game in multiplayer│ }                                          │

```└────────────────────────────────────────────┘

         │

## Design Principles (SOLID)         ▼

┌────────────────────────────────────────────┐

### Single Responsibility│ Create new game room                       │

│   ↓                                        │

Each module has one clear purpose:│ roomId = genCode()                         │

│ rooms.set(roomId, {                        │

- `LobbyManager`: Queue & matching only│   players: {                               │

- `RoomManager`: Room lifecycle only│     X: player1.socketId,                   │

- `gameLogic`: Win/draw detection only│     O: player2.socketId                    │

- `LobbyView`: UI rendering only│   },                                       │

- Socket handlers: Event routing only│   state: initialState(),                   │

│   matchedPlayers: {                        │

### Open/Closed│     X: { displayName: player1.name },      │

│     O: { displayName: player2.name }       │

System is extensible without modification:│   }                                        │

│ })                                         │

- New matching algorithms can extend `LobbyManager`└────────────────────────────────────────────┘

- Custom game rules can extend `gameLogic`         │

- UI components accept props for customization         ▼

┌────────────────────────────────────────────┐

### Liskov Substitution│ Notify both players                        │

│   ↓                                        │

Components follow consistent interfaces:│ io.to(player1.socketId).emit('matchFound', │

│   { roomId, player: 'X', opponent: name2 })│

- All game modes use same `useSocketGame` interface│   ↓                                        │

- Socket handlers follow uniform patterns│ io.to(player2.socketId).emit('matchFound', │

│   { roomId, player: 'O', opponent: name1 })│

### Interface Segregation│   ↓                                        │

│ io.to(roomId).emit('startGame')            │

Components receive only needed props:└────────────────────────────────────────────┘

         │

- `LobbyView` gets lobby state, not full game state         │ WebSocket

- `GameBoard` gets board/moves, not socket details         ▼

┌────────────────────────────────────────────┐

### Dependency Inversion│ Both Clients: on('matchFound')             │

│   ↓                                        │

Depends on abstractions, not implementations:│ setIsInLobby(false)                        │

│ setRoomId(roomId)                          │

- Components use hook interfaces (`useSocketGame`)│ setPlayer(assignedPlayer)                  │

- Server modules use manager abstractions│   ↓                                        │

│ Auto-redirect to /room/:roomId             │

## Data Flow Examples│   ↓                                        │

│ Game starts!                               │

### Example 1: Matchmaking Flow└────────────────────────────────────────────┘

```

```text

User → "Find Match" → /lobby → Enter name → Join Queue## SOLID Principles Applied

                                                ↓

Server: Add to queue → Broadcast lobbyUpdate → Match 2 players### Single Responsibility Principle

                                                ↓```

Server: Create room → Emit matchFound → Players redirect to /room/:roomIdLobbyManager        → Queue & matching only

                                                ↓LobbyView          → UI rendering only

                                            Game starts!Socket handlers    → Event routing only

```useSocketGame      → State & events only

```

### Example 2: Making a Move

### Open/Closed Principle

```text```

Player clicks square → socket.emit('makeMove', { roomId, index })LobbyManager class can be extended:

                                                ↓  class SkillBasedLobbyManager extends LobbyManager {

Server: Validate turn & move → Update game state → Check winner    matchPlayers() { /* custom logic */ }

                                                ↓  }

Server: io.to(roomId).emit('gameState', newState)

                                                ↓UI components accept props for customization

All clients in room: Update board, check modal, update UI```

```

### Liskov Substitution Principle

## Performance Characteristics```

Components follow consistent interfaces:

| Operation | Time Complexity | Notes |  <LobbyView {...props} />

|-----------|----------------|-------|  <GameView {...props} />

| `addPlayer()` | O(1) | Queue push |Both work with same hook structure

| `removePlayer()` | O(n) | Array search & splice |```

| `matchPlayers()` | O(1) | First 2 from queue |

| `makeMove()` | O(1) | Direct board access |### Interface Segregation Principle

| `calculateWinner()` | O(1) | Check 8 lines |```

| `broadcastLobbyState()` | O(n × m) | n=players, m=clients |LobbyView only receives needed props:

  - lobbyQueue (not entire game state)

**Memory:**  - isInLobby (not all flags)

  - onJoinLobby (not all actions)

- Rooms: O(r) where r = active rooms (LRU-capped at 500)```

- Lobby queue: O(q) where q = waiting players

- History: O(h) per game where h = moves (max 9)### Dependency Inversion Principle

```

## TestingComponents depend on hook interface, not implementation:

  const { joinLobby, lobbyQueue } = useSocketGame()

**Backend Tests:**  // Works with any implementation of useSocketGame

```

- `server/lobbyManager.test.js` (27 tests) ✅

- `server/socketHandlers.test.js`## Testing Architecture

- `server/roomManager.test.js`

```

**Frontend Tests:**┌─────────────────────────────────────────────────────────────────────┐

│                    lobbyManager.test.js                             │

- `src/components/FeedbackDialog.test.jsx`├─────────────────────────────────────────────────────────────────────┤

- `src/components/ui/ToastStack.test.jsx`│                                                                       │

- `src/utils/completedGames.test.js`│  Unit Tests (27 tests)                                               │

- `src/utils/history.test.js`│  ├─ addPlayer validation                                             │

│  ├─ removePlayer queue management                                    │

**Test Coverage:**│  ├─ matchPlayers FIFO logic                                          │

│  ├─ getQueueState data integrity                                     │

- Input validation│  └─ Integration scenarios                                            │

- Queue management│                                                                       │

- Matching logic│  Edge Cases                                                           │

- Win/draw detection│  ├─ Duplicate socket IDs                                             │

- Edge cases (disconnections, invalid moves)│  ├─ Invalid display names                                            │

│  ├─ Empty queue matching                                             │

## Environment Variables│  ├─ Player leaving before match                                      │

│  └─ Multiple sequential matches                                      │

**Frontend (Vite):**│                                                                       │

│  All tests passing ✅                                                 │

- `VITE_SOCKET_SERVER`: Backend URL (default: auto-detect)│                                                                       │

- `VITE_API_BASE`: API base URL└─────────────────────────────────────────────────────────────────────┘

```

**Backend (Node):**

## Performance Characteristics

- `PORT`: Server port (default: 5123)

- `CORS_ORIGIN`: CORS allowed origins (default: `*`)```

- `ROOM_LIMIT`: Max concurrent rooms (default: 500)Operation              Time Complexity    Space Complexity

─────────────────────────────────────────────────────────

## File StructureaddPlayer()            O(1)               O(1)

removePlayer()         O(n)               O(1)

```textmatchPlayers()         O(1)               O(1)

server/getQueueState()        O(n)               O(n)

  app.js                    # Express + Socket.IO setupbroadcastLobbyState()  O(n * m)           O(n)

  socketHandlers.js         # Socket event handlers                       n=players, m=clients

  lobbyManager.js           # Matchmaking queue

  roomManager.js            # Room lifecycleMemory: O(n) where n = waiting players

  gameLogic.js              # Win/draw detectionNetwork: O(m) where m = connected clients

  feedbackStore.js          # User feedback storage```

  googleSheetsClient.js     # Feedback → Google Sheets

src/
  App.jsx                   # Router setup
  Game.jsx                  # Main game container
  Lobby.jsx                 # Matchmaking lobby
  components/
    GameBoard.jsx           # 3×3 board
    MenuPanel.jsx           # Action buttons
    LobbyView.jsx           # Lobby UI
    HistoryPanel.jsx        # Move history
    ResultModal.jsx         # End-game modal
    Navbar.jsx              # Top controls
    Walkthrough.jsx         # First-time tutorial
  hooks/
    useSocketGame.js        # Socket + state management
    useVoiceChat.js         # WebRTC voice chat
    useWalkthrough.js       # Tutorial logic
```

## Deployment

**Frontend:** Static hosting (GitHub Pages, Netlify, Vercel)

- Build: `npm run build`
- Set `VITE_SOCKET_SERVER` to backend URL

**Backend:** Node.js hosting (Railway, Render, Heroku, PM2)

- Start: `npm run server`
- Set environment variables (`PORT`, `CORS_ORIGIN`)

**Note:** Frontend and backend can be hosted separately. Frontend connects to backend via WebSocket URL.
