# CrissCross TicTacToe - Rust Backend

This is the Rust implementation of the CrissCross Tic Tac Toe backend server, migrated from Node.js/Express.

## Features

- **High Performance**: Built with Rust for maximum performance and safety
- **WebSocket Support**: Real-time multiplayer gaming via Socket.IO compatibility
- **SOLID Principles**: Clean architecture with separation of concerns
- **Type Safety**: Compile-time guarantees for correctness
- **Async/Await**: Modern async runtime with Tokio
- **Resilient**: Comprehensive error handling

## Architecture

The codebase follows SOLID principles:

### Single Responsibility Principle
- Each module has one clear purpose
- `RoomManager`: Manages game rooms
- `LobbyManager`: Handles matchmaking queue
- `FeedbackService`: Stores and retrieves feedback
- `GoogleSheetsService`: Integrates with Google Sheets

### Open/Closed Principle
- Traits define interfaces for extensibility
- `SheetsClient` trait allows different implementations

### Liskov Substitution Principle
- All trait implementations are substitutable

### Interface Segregation Principle
- Focused trait definitions
- Clients don't depend on unused methods

### Dependency Inversion Principle
- High-level modules depend on abstractions (traits)
- Dependency injection via constructors

## Project Structure

```
server-rust/
├── src/
│   ├── config/          # Configuration management
│   ├── handlers/        # WebSocket event handlers  
│   ├── models/          # Data models
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   ├── lib.rs          # Library entry point
│   └── main.rs         # Application entry point
├── Cargo.toml          # Dependencies and metadata
└── README.md           # This file
```

## Building

```bash
cargo build --release
```

## Running

```bash
# Development
cargo run

# Production (with optimizations)
cargo run --release
```

## Environment Variables

The server reads configuration from environment variables:

- `PORT` (default: `10000`) - Server port
- `CORS_ORIGIN` (default: `*`) - Allowed CORS origins (comma-separated)
- `ROOM_LIMIT` (default: `500`) - Maximum number of rooms
- `ROOM_TTL_MS` (default: `120000`) - Room inactivity timeout in milliseconds

### Google Sheets Integration (Optional)
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Service account email
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` - Service account private key
- `GOOGLE_SHEETS_SPREADSHEET_ID` - Spreadsheet ID
- `GOOGLE_SHEETS_FEEDBACK_RANGE` - Sheet range (default: `Feedback!A:E`)

## Testing

```bash
# Run all tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test test_name
```

## API Endpoints

### HTTP Endpoints

#### GET /health
Health check endpoint
- **Response**: `{"status": "ok"}`

#### POST /feedback
Submit user feedback
- **Request**: 
  ```json
  {
    "rating": 4.5,
    "message": "Great game!",
    "context": {
      "roomId": "ABC123",
      "isMultiplayer": true
    }
  }
  ```
- **Response**:
  ```json
  {
    "status": "received",
    "id": "feedback-id",
    "sheetsSync": "ok|skipped|failed"
  }
  ```

### WebSocket Events

#### Room Management
- `createRoom` - Create a new game room
- `joinRoom` - Join an existing room
- `leaveRoom` - Leave a room

#### Game Actions
- `makeMove` - Make a move on the board
- `resetGame` - Reset the current game
- `resetScores` - Reset player scores
- `requestNewGame` - Request a new game
- `cancelNewGameRequest` - Cancel new game request

#### Lobby/Matchmaking
- `joinLobby` - Join matchmaking queue
- `leaveLobby` - Leave matchmaking queue
- `getLobbyState` - Get current lobby state

#### Voice Chat
- `voice:join` - Join voice chat
- `voice:leave` - Leave voice chat
- `voice:mute-state` - Update mute state
- `voice:signal` - WebRTC signaling

## Deployment

### Using Cargo

```bash
# Build release binary
cargo build --release

# Binary will be at target/release/crisscross-server
./target/release/crisscross-server
```

### Using Docker (Recommended)

See `Dockerfile` for containerized deployment.

### Using systemd

Create `/etc/systemd/system/crisscross-server.service`:

```ini
[Unit]
Description=CrissCross Tic Tac Toe Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/crisscross
Environment="PORT=10000"
Environment="CORS_ORIGIN=*"
ExecStart=/var/www/crisscross/crisscross-server
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable crisscross-server
sudo systemctl start crisscross-server
```

## Performance

The Rust backend provides significant performance improvements:

- **Lower Latency**: Faster response times for WebSocket events
- **Higher Throughput**: Can handle more concurrent connections
- **Lower Memory Usage**: More efficient memory management
- **Better CPU Utilization**: Multi-threaded async runtime

## Security

- **Type Safety**: Compile-time checks prevent many bugs
- **Memory Safety**: No buffer overflows or use-after-free
- **Input Validation**: All user input is validated
- **CORS Protection**: Configurable CORS policies
- **Rate Limiting**: Built-in protection (can be enhanced)

## Migration from Node.js

The Rust backend is a drop-in replacement for the Node.js server. It maintains API compatibility while providing:

1. Better performance
2. Type safety
3. Memory safety
4. Lower resource usage

To migrate:
1. Build the Rust server
2. Update `VITE_SOCKET_SERVER` to point to the Rust server
3. Stop the Node.js server
4. Start the Rust server

## Contributing

When contributing to this codebase:

1. Follow Rust conventions and idioms
2. Maintain SOLID principles
3. Add tests for new features
4. Update documentation
5. Run `cargo fmt` before committing
6. Run `cargo clippy` to catch common issues

## License

Same as the main project.
