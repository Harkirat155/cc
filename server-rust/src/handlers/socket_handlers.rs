use crate::models::game::Mark;
use crate::models::room::{MatchedPlayers, PlayerDisplayInfo, Players, Room, Roster, VoiceState};
use crate::services::{
    code_generator::generate_room_code, LobbyManager, RoomConfig, RoomManager,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use socketioxide::extract::{Data, SocketRef, State};
use std::sync::Arc;
use tracing::{debug, error};

/// Shared application state
#[derive(Clone)]
pub struct AppState {
    pub room_manager: RoomManager,
    pub lobby_manager: LobbyManager,
}

impl AppState {
    pub fn new(room_config: RoomConfig) -> Self {
        Self {
            room_manager: RoomManager::new(room_config),
            lobby_manager: LobbyManager::new(),
        }
    }
}

// Event payload structures

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateRoomPayload {
    #[serde(default)]
    client_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateRoomResponse {
    room_id: String,
    player: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JoinRoomPayload {
    room_id: String,
    #[serde(default)]
    client_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct JoinRoomResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    player: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MakeMovePayload {
    room_id: String,
    index: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RoomActionPayload {
    room_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LeaveRoomPayload {
    room_id: String,
    #[serde(default)]
    client_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LeaveRoomResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ok: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VoiceJoinPayload {
    room_id: String,
    #[serde(default)]
    muted: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VoiceLeavePayload {
    room_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VoiceMutePayload {
    room_id: String,
    muted: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VoiceSignalPayload {
    room_id: String,
    target_id: String,
    data: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct VoiceSignalEvent {
    from: String,
    data: Value,
    room_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JoinLobbyPayload {
    display_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct JoinLobbyResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    position: Option<usize>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LeaveLobbyResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MatchFoundEvent {
    room_id: String,
    player: String,
    opponent: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GameUpdate {
    #[serde(flatten)]
    state: crate::models::game::GameState,
    room_id: String,
    roster: Roster,
    voice_roster: std::collections::HashMap<String, VoiceState>,
}

/// Register all socket event handlers
pub fn register_socket_handlers(socket: SocketRef, State(state): State<Arc<AppState>>) {

    // Create room
    socket.on(
        "createRoom",
        move |socket: SocketRef, Data::<Value>(data), State(state): State<Arc<AppState>>| async move {
            let payload: CreateRoomPayload = serde_json::from_value(data).unwrap_or(CreateRoomPayload { client_id: None });
            
            let mut room_id = generate_room_code();
            let mut attempts = 0;
            
            while state.room_manager.get_room(&room_id).await.is_some() && attempts < 10 {
                room_id = generate_room_code();
                attempts += 1;
            }
            
            if attempts >= 10 {
                error!("Unable to generate unique room code after 10 attempts");
                return;
            }
            
            let room = Room::new(socket.id.to_string(), payload.client_id.clone());
            
            if let Err(e) = state.room_manager.create_room(room_id.clone(), room).await {
                error!("Failed to create room: {}", e);
                return;
            }
            
            debug!(
                "[createRoom] room={} socket={} client={} -> X",
                room_id,
                socket.id,
                payload.client_id.as_deref().unwrap_or("-")
            );
            
            socket.join(room_id.clone()).ok();
            state.room_manager.add_socket_to_room(socket.id.to_string(), room_id.clone()).await;
            
            let response = CreateRoomResponse {
                room_id: room_id.clone(),
                player: "X".to_string(),
            };
            
            socket.emit("createRoom", response).ok();
            publish_room_state(&socket, &state.room_manager, &room_id).await;
        },
    );

    // Join room
    socket.on(
        "joinRoom",
        move |socket: SocketRef, Data::<JoinRoomPayload>(payload), State(state): State<Arc<AppState>>| async move {
            let room_id = payload.room_id.trim().to_uppercase();
            
            if room_id.is_empty() {
                socket.emit("joinRoom", JoinRoomResponse {
                    error: Some("Invalid room ID".to_string()),
                    player: None,
                }).ok();
                return;
            }
            
            let Some(mut room) = state.room_manager.get_room(&room_id).await else {
                socket.emit("joinRoom", JoinRoomResponse {
                    error: Some("Room not found".to_string()),
                    player: None,
                }).ok();
                return;
            };
            
            room.touch();
            
            let socket_id_str = socket.id.to_string();
            let mut role: Option<String> = None;
            
            // 1) Check if client previously had a reserved seat
            if let Some(ref client_id) = payload.client_id {
                if let Some(seat) = room.seat_by_client.get(client_id) {
                    if seat == "X" || seat == "O" {
                        let current_player = if seat == "X" { &room.players.x } else { &room.players.o };
                        if current_player.is_none() || current_player.as_deref() == Some(&socket_id_str) {
                            if seat == "X" {
                                room.players.x = Some(socket_id_str.clone());
                                if room.players.o.as_deref() == Some(&socket_id_str) {
                                    room.players.o = None;
                                }
                            } else {
                                room.players.o = Some(socket_id_str.clone());
                                if room.players.x.as_deref() == Some(&socket_id_str) {
                                    room.players.x = None;
                                }
                            }
                            role = Some(seat.clone());
                            debug!("[joinRoom] rebind seat room={} seat={} socket={} client={}", room_id, seat, socket.id, client_id);
                        }
                    }
                }
            }
            
            // 2) If socket already occupies a seat, honor it
            if role.is_none() {
                if room.players.x.as_deref() == Some(&socket_id_str) {
                    role = Some("X".to_string());
                } else if room.players.o.as_deref() == Some(&socket_id_str) {
                    role = Some("O".to_string());
                }
            }
            
            // 3) Otherwise, seat to an open slot
            if role.is_none() {
                if room.players.x.is_none() {
                    room.players.x = Some(socket_id_str.clone());
                    role = Some("X".to_string());
                    if let Some(ref client_id) = payload.client_id {
                        room.seat_by_client.insert(client_id.clone(), "X".to_string());
                    }
                } else if room.players.o.is_none() {
                    // Guard: if client already mapped to X/O, join as spectator
                    let already_seated = if let Some(ref client_id) = payload.client_id {
                        room.seat_by_client.get(client_id).map_or(false, |s| s == "X" || s == "O")
                    } else {
                        false
                    };
                    
                    if already_seated {
                        room.spectators.insert(socket_id_str.clone());
                        role = Some("spectator".to_string());
                        debug!("[joinRoom] client already seated, joining spectator room={} socket={}", room_id, socket.id);
                    } else {
                        room.players.o = Some(socket_id_str.clone());
                        role = Some("O".to_string());
                        if let Some(ref client_id) = payload.client_id {
                            room.seat_by_client.insert(client_id.clone(), "O".to_string());
                        }
                        debug!("[joinRoom] seated O room={} socket={} client={}", room_id, socket.id, payload.client_id.as_deref().unwrap_or("-"));
                    }
                } else {
                    room.spectators.insert(socket_id_str.clone());
                    role = Some("spectator".to_string());
                    debug!("[joinRoom] room full -> spectator room={} socket={}", room_id, socket.id);
                }
            }
            
            // Final safety: ensure single socket not occupying both seats
            if room.players.x.as_deref() == Some(&socket_id_str) && room.players.o.as_deref() == Some(&socket_id_str) {
                let prefer = if let Some(ref client_id) = payload.client_id {
                    room.seat_by_client.get(client_id).cloned().unwrap_or_else(|| role.clone().unwrap_or_else(|| "X".to_string()))
                } else {
                    role.clone().unwrap_or_else(|| "X".to_string())
                };
                
                if prefer == "X" {
                    room.players.o = None;
                } else {
                    room.players.x = None;
                }
            }
            
            socket.join(room_id.clone()).ok();
            state.room_manager.add_socket_to_room(socket_id_str.clone(), room_id.clone()).await;
            state.room_manager.update_room(&room_id, room.clone()).await;
            
            socket.emit("joinRoom", JoinRoomResponse {
                error: None,
                player: role.clone(),
            }).ok();
            
            if room.has_both_players() {
                socket.to(room_id.clone()).emit("startGame", ()).ok();
            }
            
            publish_room_state(&socket, &state.room_manager, &room_id).await;
        },
    );

    // Make move
    socket.on(
        "makeMove",
        move |socket: SocketRef, Data::<MakeMovePayload>(payload), State(state): State<Arc<AppState>>| async move {
            let Some(mut room) = state.room_manager.get_room(&payload.room_id).await else {
                return;
            };
            
            room.touch();
            
            let socket_id_str = socket.id.to_string();
            let mark = if room.players.x.as_deref() == Some(&socket_id_str) {
                Some(Mark::X)
            } else if room.players.o.as_deref() == Some(&socket_id_str) {
                Some(Mark::O)
            } else {
                None
            };
            
            if let Some(mark) = mark {
                if room.state.make_move(payload.index, mark) {
                    state.room_manager.update_room(&payload.room_id, room).await;
                    publish_room_state(&socket, &state.room_manager, &payload.room_id).await;
                }
            }
        },
    );

    // Reset game
    socket.on(
        "resetGame",
        move |socket: SocketRef, Data::<RoomActionPayload>(payload), State(state): State<Arc<AppState>>| async move {
            let Some(mut room) = state.room_manager.get_room(&payload.room_id).await else {
                return;
            };
            
            room.touch();
            let new_turn = room.state.determine_next_turn();
            room.state.reset_with_scores(new_turn);
            
            state.room_manager.update_room(&payload.room_id, room).await;
            publish_room_state(&socket, &state.room_manager, &payload.room_id).await;
            
            socket.to(payload.room_id.clone()).emit("gameReset", serde_json::json!({ "roomId": payload.room_id })).ok();
        },
    );

    // Reset scores
    socket.on(
        "resetScores",
        move |socket: SocketRef, Data::<RoomActionPayload>(payload), State(state): State<Arc<AppState>>| async move {
            let Some(mut room) = state.room_manager.get_room(&payload.room_id).await else {
                return;
            };
            
            room.touch();
            room.state.reset_scores();
            
            state.room_manager.update_room(&payload.room_id, room).await;
            publish_room_state(&socket, &state.room_manager, &payload.room_id).await;
        },
    );

    // Request new game
    socket.on(
        "requestNewGame",
        move |socket: SocketRef, Data::<RoomActionPayload>(payload), State(state): State<Arc<AppState>>| async move {
            let Some(mut room) = state.room_manager.get_room(&payload.room_id).await else {
                return;
            };
            
            room.touch();
            room.state.new_game_requester = Some(socket.id.to_string());
            room.state.new_game_requested_at = Some(chrono::Utc::now().timestamp_millis());
            
            state.room_manager.update_room(&payload.room_id, room).await;
            publish_room_state(&socket, &state.room_manager, &payload.room_id).await;
        },
    );

    // Cancel new game request
    socket.on(
        "cancelNewGameRequest",
        move |socket: SocketRef, Data::<RoomActionPayload>(payload), State(state): State<Arc<AppState>>| async move {
            let Some(mut room) = state.room_manager.get_room(&payload.room_id).await else {
                return;
            };
            
            room.touch();
            room.state.new_game_requester = None;
            room.state.new_game_requested_at = None;
            
            state.room_manager.update_room(&payload.room_id, room).await;
            publish_room_state(&socket, &state.room_manager, &payload.room_id).await;
        },
    );

    // Leave room
    socket.on(
        "leaveRoom",
        move |socket: SocketRef, Data::<LeaveRoomPayload>(payload), State(state): State<Arc<AppState>>| async move {
            let Some(mut room) = state.room_manager.get_room(&payload.room_id).await else {
                socket.emit("leaveRoom", LeaveRoomResponse {
                    error: Some("Room not found".to_string()),
                    ok: None,
                }).ok();
                return;
            };
            
            let socket_id_str = socket.id.to_string();
            let changed = room.remove_socket(&socket_id_str);
            
            // Free seat reservation
            if let Some(ref client_id) = payload.client_id {
                if let Some(seat) = room.seat_by_client.get(client_id) {
                    if seat == "X" || seat == "O" {
                        room.seat_by_client.remove(client_id);
                    }
                }
            }
            
            if changed {
                room.touch();
                socket.leave(payload.room_id.clone()).ok();
                state.room_manager.remove_socket_from_room(&socket_id_str, &payload.room_id).await;
                state.room_manager.update_room(&payload.room_id, room).await;
                publish_room_state(&socket, &state.room_manager, &payload.room_id).await;
                
                socket.emit("leaveRoom", LeaveRoomResponse {
                    error: None,
                    ok: Some(true),
                }).ok();
            } else {
                socket.emit("leaveRoom", LeaveRoomResponse {
                    error: Some("Not in room".to_string()),
                    ok: None,
                }).ok();
            }
        },
    );

    // Disconnect
    socket.on_disconnect(
        move |socket: SocketRef, State(state): State<Arc<AppState>>| async move {
            let socket_id_str = socket.id.to_string();
            
            // Remove from lobby
            let was_in_lobby = state.lobby_manager.remove_player(&socket_id_str).await;
            if was_in_lobby {
                broadcast_lobby_state(&socket, &state.lobby_manager).await;
            }
            
            // Remove from rooms
            let rooms = state.room_manager.remove_socket(&socket_id_str).await;
            for room_id in rooms {
                if let Some(mut room) = state.room_manager.get_room(&room_id).await {
                    let changed = room.remove_socket(&socket_id_str);
                    if changed {
                        room.touch();
                        state.room_manager.update_room(&room_id, room).await;
                        publish_room_state(&socket, &state.room_manager, &room_id).await;
                    }
                }
            }
        },
    );

    // Voice handlers
    register_voice_handlers(socket.clone(), state.clone());
    
    // Lobby handlers
    register_lobby_handlers(socket, state);
}

fn register_voice_handlers(socket: SocketRef, _state: Arc<AppState>) {
    socket.on(
        "voice:join",
        move |socket: SocketRef, Data::<VoiceJoinPayload>(payload), State(state): State<Arc<AppState>>| async move {
            let Some(mut room) = state.room_manager.get_room(&payload.room_id).await else {
                return;
            };
            
            room.touch();
            room.voice.insert(
                socket.id.to_string(),
                VoiceState { muted: payload.muted },
            );
            
            state.room_manager.update_room(&payload.room_id, room).await;
            
            socket.to(payload.room_id.clone()).emit(
                "voice:user-joined",
                serde_json::json!({
                    "socketId": socket.id.to_string(),
                    "muted": payload.muted
                }),
            ).ok();
            
            publish_room_state(&socket, &state.room_manager, &payload.room_id).await;
        },
    );

    socket.on(
        "voice:leave",
        move |socket: SocketRef, Data::<VoiceLeavePayload>(payload), State(state): State<Arc<AppState>>| async move {
            let Some(mut room) = state.room_manager.get_room(&payload.room_id).await else {
                return;
            };
            
            room.touch();
            room.voice.remove(&socket.id.to_string());
            
            state.room_manager.update_room(&payload.room_id, room).await;
            
            socket.to(payload.room_id.clone()).emit(
                "voice:user-left",
                serde_json::json!({ "socketId": socket.id.to_string() }),
            ).ok();
            
            publish_room_state(&socket, &state.room_manager, &payload.room_id).await;
        },
    );

    socket.on(
        "voice:mute-state",
        move |socket: SocketRef, Data::<VoiceMutePayload>(payload), State(state): State<Arc<AppState>>| async move {
            let Some(mut room) = state.room_manager.get_room(&payload.room_id).await else {
                return;
            };
            
            room.touch();
            room.voice
                .entry(socket.id.to_string())
                .or_insert(VoiceState { muted: payload.muted })
                .muted = payload.muted;
            
            state.room_manager.update_room(&payload.room_id, room).await;
            
            socket.to(payload.room_id.clone()).emit(
                "voice:mute-state",
                serde_json::json!({
                    "socketId": socket.id.to_string(),
                    "muted": payload.muted
                }),
            ).ok();
            
            publish_room_state(&socket, &state.room_manager, &payload.room_id).await;
        },
    );

    socket.on(
        "voice:signal",
        move |socket: SocketRef, Data::<VoiceSignalPayload>(payload)| async move {
            socket.to(payload.target_id.clone()).emit(
                "voice:signal",
                VoiceSignalEvent {
                    from: socket.id.to_string(),
                    data: payload.data,
                    room_id: payload.room_id,
                },
            ).ok();
        },
    );
}

fn register_lobby_handlers(socket: SocketRef, _state: Arc<AppState>) {
    socket.on(
        "joinLobby",
        move |socket: SocketRef, Data::<JoinLobbyPayload>(payload), State(state): State<Arc<AppState>>| async move {
            let result = state
                .lobby_manager
                .add_player(socket.id.to_string(), payload.display_name)
                .await;
            
            match result {
                Ok(position) => {
                    broadcast_lobby_state(&socket, &state.lobby_manager).await;
                    
                    socket.emit("joinLobby", JoinLobbyResponse {
                        success: true,
                        error: None,
                        position: Some(position),
                    }).ok();
                    
                    // Attempt to match players
                    if let Some((player1, player2)) = state.lobby_manager.match_players().await {
                        handle_player_match(&socket, &state, player1, player2).await;
                    }
                }
                Err(error) => {
                    socket.emit("joinLobby", JoinLobbyResponse {
                        success: false,
                        error: Some(error),
                        position: None,
                    }).ok();
                }
            }
        },
    );

    socket.on(
        "leaveLobby",
        move |socket: SocketRef, State(state): State<Arc<AppState>>| async move {
            let removed = state.lobby_manager.remove_player(&socket.id.to_string()).await;
            
            if removed {
                broadcast_lobby_state(&socket, &state.lobby_manager).await;
                socket.emit("leaveLobby", LeaveLobbyResponse {
                    success: true,
                    error: None,
                }).ok();
            } else {
                socket.emit("leaveLobby", LeaveLobbyResponse {
                    success: false,
                    error: Some("Not in lobby".to_string()),
                }).ok();
            }
        },
    );

    socket.on(
        "getLobbyState",
        move |socket: SocketRef, State(state): State<Arc<AppState>>| async move {
            let queue = state.lobby_manager.get_queue_state().await;
            socket.emit("getLobbyState", serde_json::json!({ "queue": queue })).ok();
        },
    );
}

async fn handle_player_match(
    socket: &SocketRef,
    state: &Arc<AppState>,
    player1: crate::models::lobby::LobbyPlayer,
    player2: crate::models::lobby::LobbyPlayer,
) {
    let mut room_id = generate_room_code();
    while state.room_manager.get_room(&room_id).await.is_some() {
        room_id = generate_room_code();
    }
    
    let mut room = Room::new(player1.socket_id.clone(), None);
    room.players = Players {
        x: Some(player1.socket_id.clone()),
        o: Some(player2.socket_id.clone()),
    };
    room.matched_players = Some(MatchedPlayers {
        x: PlayerDisplayInfo {
            display_name: player1.display_name.clone(),
        },
        o: PlayerDisplayInfo {
            display_name: player2.display_name.clone(),
        },
    });
    
    state.room_manager.create_room(room_id.clone(), room).await.ok();
    
    // Add both sockets to room
    socket.to(player1.socket_id.clone()).join(room_id.clone()).ok();
    socket.to(player2.socket_id.clone()).join(room_id.clone()).ok();
    
    state.room_manager.add_socket_to_room(player1.socket_id.clone(), room_id.clone()).await;
    state.room_manager.add_socket_to_room(player2.socket_id.clone(), room_id.clone()).await;
    
    // Notify both players
    socket.to(player1.socket_id.clone()).emit("matchFound", MatchFoundEvent {
        room_id: room_id.clone(),
        player: "X".to_string(),
        opponent: player2.display_name.clone(),
    }).ok();
    
    socket.to(player2.socket_id).emit("matchFound", MatchFoundEvent {
        room_id: room_id.clone(),
        player: "O".to_string(),
        opponent: player1.display_name.clone(),
    }).ok();
    
    debug!(
        "[matchmaking] matched {} vs {} in room {}",
        sanitize_display_name(&player1.display_name),
        sanitize_display_name(&player2.display_name),
        room_id
    );
    
    broadcast_lobby_state(socket, &state.lobby_manager).await;
}

async fn publish_room_state(socket: &SocketRef, room_manager: &RoomManager, room_id: &str) {
    let Some(room) = room_manager.get_room(room_id).await else {
        return;
    };
    
    let roster = Roster::from(&room);
    let voice_roster = room.voice.clone();
    
    let update = GameUpdate {
        state: room.state,
        room_id: room_id.to_string(),
        roster,
        voice_roster,
    };
    
    socket.to(room_id.to_string()).emit("gameUpdate", update).ok();
}

async fn broadcast_lobby_state(socket: &SocketRef, lobby_manager: &LobbyManager) {
    let queue = lobby_manager.get_queue_state().await;
    let update = serde_json::json!({
        "queue": queue,
        "timestamp": chrono::Utc::now().timestamp_millis()
    });
    
    socket.broadcast().emit("lobbyUpdate", update).ok();
}

fn sanitize_display_name(name: &str) -> String {
    name.replace(|c: char| c == '\r' || c == '\n', "")
        .chars()
        .take(32)
        .collect()
}
