use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use crate::models::game::GameState;

/// Voice state for a socket
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceState {
    pub muted: bool,
}

/// Player display info for matchmaking
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerDisplayInfo {
    pub display_name: String,
}

/// Room structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Room {
    pub players: Players,
    pub spectators: HashSet<String>,
    pub state: GameState,
    pub voice: HashMap<String, VoiceState>,
    pub seat_by_client: HashMap<String, String>,
    pub last_touched: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matched_players: Option<MatchedPlayers>,
}

/// Players in a room
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Players {
    #[serde(rename = "X")]
    pub x: Option<String>,
    #[serde(rename = "O")]
    pub o: Option<String>,
}

impl Players {
    pub fn new() -> Self {
        Self { x: None, o: None }
    }

    pub fn has_socket(&self, socket_id: &str) -> bool {
        self.x.as_deref() == Some(socket_id) || self.o.as_deref() == Some(socket_id)
    }
}

/// Matched players metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchedPlayers {
    #[serde(rename = "X")]
    pub x: PlayerDisplayInfo,
    #[serde(rename = "O")]
    pub o: PlayerDisplayInfo,
}

impl Room {
    pub fn new(creator_socket_id: String, client_id: Option<String>) -> Self {
        let mut seat_by_client = HashMap::new();
        if let Some(cid) = client_id {
            seat_by_client.insert(cid, "X".to_string());
        }

        Self {
            players: Players {
                x: Some(creator_socket_id),
                o: None,
            },
            spectators: HashSet::new(),
            state: GameState::new(),
            voice: HashMap::new(),
            seat_by_client,
            last_touched: chrono::Utc::now().timestamp_millis(),
            matched_players: None,
        }
    }

    pub fn touch(&mut self) {
        self.last_touched = chrono::Utc::now().timestamp_millis();
    }

    pub fn is_empty(&self) -> bool {
        self.players.x.is_none() 
            && self.players.o.is_none() 
            && self.spectators.is_empty()
    }

    pub fn has_both_players(&self) -> bool {
        self.players.x.is_some() && self.players.o.is_some()
    }

    /// Remove a socket from the room
    pub fn remove_socket(&mut self, socket_id: &str) -> bool {
        let mut changed = false;

        if self.players.x.as_deref() == Some(socket_id) {
            self.players.x = None;
            changed = true;
        }

        if self.players.o.as_deref() == Some(socket_id) {
            self.players.o = None;
            changed = true;
        }

        if self.spectators.remove(socket_id) {
            changed = true;
        }

        if self.voice.remove(socket_id).is_some() {
            changed = true;
        }

        changed
    }
}

/// Roster for broadcasting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Roster {
    #[serde(rename = "X")]
    pub x: Option<String>,
    #[serde(rename = "O")]
    pub o: Option<String>,
    pub spectators: Vec<String>,
}

impl From<&Room> for Roster {
    fn from(room: &Room) -> Self {
        Self {
            x: room.players.x.clone(),
            o: room.players.o.clone(),
            spectators: room.spectators.iter().cloned().collect(),
        }
    }
}

/// Voice roster for broadcasting
pub type VoiceRoster = HashMap<String, VoiceState>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_room() {
        let room = Room::new("socket1".to_string(), None);
        assert_eq!(room.players.x.as_deref(), Some("socket1"));
        assert!(room.players.o.is_none());
        assert!(!room.is_empty());
    }

    #[test]
    fn test_remove_socket() {
        let mut room = Room::new("socket1".to_string(), None);
        room.players.o = Some("socket2".to_string());
        
        assert!(room.remove_socket("socket1"));
        assert!(room.players.x.is_none());
        assert!(room.players.o.is_some());
    }
}
