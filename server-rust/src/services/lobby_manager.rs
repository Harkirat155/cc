use crate::models::lobby::LobbyPlayer;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Lobby manager for matchmaking following Single Responsibility Principle
#[derive(Clone)]
pub struct LobbyManager {
    queue: Arc<RwLock<Vec<LobbyPlayer>>>,
    player_metadata: Arc<RwLock<HashMap<String, LobbyPlayer>>>,
}

impl Default for LobbyManager {
    fn default() -> Self {
        Self::new()
    }
}

impl LobbyManager {
    pub fn new() -> Self {
        Self {
            queue: Arc::new(RwLock::new(Vec::new())),
            player_metadata: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Add a player to the lobby queue
    pub async fn add_player(
        &self,
        socket_id: String,
        display_name: String,
    ) -> Result<usize, String> {
        // Validation
        if socket_id.is_empty() {
            return Err("Invalid socket ID".to_string());
        }

        let trimmed_name = display_name.trim();
        if trimmed_name.len() < 2 {
            return Err("Display name must be at least 2 characters".to_string());
        }
        if trimmed_name.len() > 20 {
            return Err("Display name must be 20 characters or less".to_string());
        }

        // Check if already in queue
        if self.player_metadata.read().await.contains_key(&socket_id) {
            return Err("Already in lobby".to_string());
        }

        let player = LobbyPlayer::new(socket_id.clone(), trimmed_name.to_string());
        
        let mut queue = self.queue.write().await;
        let position = queue.len();
        queue.push(player.clone());
        
        self.player_metadata.write().await.insert(socket_id, player);

        Ok(position)
    }

    /// Remove a player from the queue
    pub async fn remove_player(&self, socket_id: &str) -> bool {
        if !self.player_metadata.read().await.contains_key(socket_id) {
            return false;
        }

        let mut queue = self.queue.write().await;
        queue.retain(|p| p.socket_id != socket_id);
        
        self.player_metadata.write().await.remove(socket_id);
        
        true
    }

    /// Get the current queue state
    pub async fn get_queue_state(&self) -> Vec<LobbyPlayer> {
        self.queue.read().await.clone()
    }

    /// Attempt to match two players (FIFO)
    pub async fn match_players(&self) -> Option<(LobbyPlayer, LobbyPlayer)> {
        let mut queue = self.queue.write().await;
        
        if queue.len() < 2 {
            return None;
        }

        let player1 = queue.remove(0);
        let player2 = queue.remove(0);

        // Clean up metadata
        let mut metadata = self.player_metadata.write().await;
        metadata.remove(&player1.socket_id);
        metadata.remove(&player2.socket_id);

        Some((player1, player2))
    }

    /// Check if a socket is in the queue
    pub async fn is_in_queue(&self, socket_id: &str) -> bool {
        self.player_metadata.read().await.contains_key(socket_id)
    }

    /// Get player by socket ID
    pub async fn get_player(&self, socket_id: &str) -> Option<LobbyPlayer> {
        self.player_metadata.read().await.get(socket_id).cloned()
    }

    /// Get queue size
    pub async fn get_queue_size(&self) -> usize {
        self.queue.read().await.len()
    }

    /// Clear the entire queue
    pub async fn clear_queue(&self) {
        self.queue.write().await.clear();
        self.player_metadata.write().await.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_add_player() {
        let manager = LobbyManager::new();
        let result = manager.add_player("socket1".to_string(), "Alice".to_string()).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 0);
    }

    #[tokio::test]
    async fn test_invalid_display_name() {
        let manager = LobbyManager::new();
        let result = manager.add_player("socket1".to_string(), "A".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_duplicate_player() {
        let manager = LobbyManager::new();
        manager.add_player("socket1".to_string(), "Alice".to_string()).await.unwrap();
        let result = manager.add_player("socket1".to_string(), "Alice".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_match_players() {
        let manager = LobbyManager::new();
        manager.add_player("socket1".to_string(), "Alice".to_string()).await.unwrap();
        manager.add_player("socket2".to_string(), "Bob".to_string()).await.unwrap();
        
        let match_result = manager.match_players().await;
        assert!(match_result.is_some());
        
        let (p1, p2) = match_result.unwrap();
        assert_eq!(p1.socket_id, "socket1");
        assert_eq!(p2.socket_id, "socket2");
    }
}
