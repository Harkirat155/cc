use crate::models::room::Room;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Room manager service following Single Responsibility Principle
#[derive(Clone)]
pub struct RoomManager {
    rooms: Arc<RwLock<HashMap<String, Room>>>,
    socket_rooms: Arc<RwLock<HashMap<String, Vec<String>>>>,
    config: RoomConfig,
}

#[derive(Clone)]
pub struct RoomConfig {
    pub room_limit: usize,
    pub room_ttl_ms: i64,
}

impl Default for RoomConfig {
    fn default() -> Self {
        Self {
            room_limit: 500,
            room_ttl_ms: 120_000, // 2 minutes
        }
    }
}

impl RoomManager {
    pub fn new(config: RoomConfig) -> Self {
        Self {
            rooms: Arc::new(RwLock::new(HashMap::new())),
            socket_rooms: Arc::new(RwLock::new(HashMap::new())),
            config,
        }
    }

    /// Create a new room
    pub async fn create_room(&self, room_id: String, room: Room) -> Result<(), String> {
        let mut rooms = self.rooms.write().await;
        
        if rooms.contains_key(&room_id) {
            return Err("Room already exists".to_string());
        }

        rooms.insert(room_id, room);
        self.enforce_lru(&mut rooms).await;
        
        Ok(())
    }

    /// Get a room by ID
    pub async fn get_room(&self, room_id: &str) -> Option<Room> {
        self.rooms.read().await.get(room_id).cloned()
    }

    /// Update a room
    pub async fn update_room(&self, room_id: &str, room: Room) {
        self.rooms.write().await.insert(room_id.to_string(), room);
    }

    /// Touch a room to update its last accessed time
    pub async fn touch_room(&self, room_id: &str) {
        if let Some(room) = self.rooms.write().await.get_mut(room_id) {
            room.touch();
        }
    }

    /// Remove a room
    pub async fn remove_room(&self, room_id: &str) -> Option<Room> {
        self.rooms.write().await.remove(room_id)
    }

    /// Track socket to room association
    pub async fn add_socket_to_room(&self, socket_id: String, room_id: String) {
        let mut socket_rooms = self.socket_rooms.write().await;
        socket_rooms
            .entry(socket_id)
            .or_insert_with(Vec::new)
            .push(room_id);
    }

    /// Get all rooms for a socket
    pub async fn get_socket_rooms(&self, socket_id: &str) -> Vec<String> {
        self.socket_rooms
            .read()
            .await
            .get(socket_id)
            .cloned()
            .unwrap_or_default()
    }

    /// Remove socket from all rooms
    pub async fn remove_socket_from_room(&self, socket_id: &str, room_id: &str) {
        let mut socket_rooms = self.socket_rooms.write().await;
        if let Some(rooms) = socket_rooms.get_mut(socket_id) {
            rooms.retain(|r| r != room_id);
            if rooms.is_empty() {
                socket_rooms.remove(socket_id);
            }
        }
    }

    /// Remove socket from all rooms on disconnect
    pub async fn remove_socket(&self, socket_id: &str) -> Vec<String> {
        let rooms = self.get_socket_rooms(socket_id).await;
        self.socket_rooms.write().await.remove(socket_id);
        rooms
    }

    /// Enforce LRU limit
    async fn enforce_lru(&self, rooms: &mut HashMap<String, Room>) {
        while rooms.len() > self.config.room_limit {
            // Find the oldest room
            if let Some(oldest_id) = rooms
                .iter()
                .min_by_key(|(_, room)| room.last_touched)
                .map(|(id, _)| id.clone())
            {
                rooms.remove(&oldest_id);
            } else {
                break;
            }
        }
    }

    /// Garbage collect empty and inactive rooms
    pub async fn garbage_collect(&self) {
        let now = chrono::Utc::now().timestamp_millis();
        let mut rooms = self.rooms.write().await;
        
        rooms.retain(|_, room| {
            let has_occupants = !room.is_empty();
            if has_occupants {
                return true;
            }
            
            let age = now - room.last_touched;
            age <= self.config.room_ttl_ms
        });
    }

    /// Start garbage collection loop
    pub fn start_gc_loop(self) {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
            loop {
                interval.tick().await;
                self.garbage_collect().await;
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_room() {
        let manager = RoomManager::new(RoomConfig::default());
        let room = Room::new("socket1".to_string(), None);
        
        assert!(manager.create_room("ROOM1".to_string(), room).await.is_ok());
        assert!(manager.get_room("ROOM1").await.is_some());
    }

    #[tokio::test]
    async fn test_duplicate_room() {
        let manager = RoomManager::new(RoomConfig::default());
        let room1 = Room::new("socket1".to_string(), None);
        let room2 = Room::new("socket2".to_string(), None);
        
        manager.create_room("ROOM1".to_string(), room1).await.unwrap();
        assert!(manager.create_room("ROOM1".to_string(), room2).await.is_err());
    }
}
