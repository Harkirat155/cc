use serde::{Deserialize, Serialize};

/// Player in the lobby queue
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LobbyPlayer {
    pub socket_id: String,
    pub display_name: String,
    pub joined_at: i64,
}

impl LobbyPlayer {
    pub fn new(socket_id: String, display_name: String) -> Self {
        Self {
            socket_id,
            display_name,
            joined_at: chrono::Utc::now().timestamp_millis(),
        }
    }
}

/// Lobby state for broadcasting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LobbyState {
    pub queue: Vec<LobbyPlayer>,
    pub timestamp: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_lobby_player() {
        let player = LobbyPlayer::new("socket1".to_string(), "Alice".to_string());
        assert_eq!(player.socket_id, "socket1");
        assert_eq!(player.display_name, "Alice");
    }
}
