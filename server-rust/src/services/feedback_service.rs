use crate::models::feedback::{FeedbackContext, FeedbackEntry, FeedbackMeta};
use std::sync::Arc;
use tokio::sync::RwLock;

const MAX_ENTRIES: usize = 200;

/// Feedback service following Single Responsibility Principle
#[derive(Clone)]
pub struct FeedbackService {
    entries: Arc<RwLock<Vec<FeedbackEntry>>>,
}

impl Default for FeedbackService {
    fn default() -> Self {
        Self::new()
    }
}

impl FeedbackService {
    pub fn new() -> Self {
        Self {
            entries: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Add feedback entry
    pub async fn add_feedback(
        &self,
        rating: f32,
        message: String,
        context: Option<FeedbackContext>,
        meta: Option<FeedbackMeta>,
    ) -> FeedbackEntry {
        let entry = FeedbackEntry {
            id: Self::create_id(),
            rating: Self::clamp_rating(rating),
            message: Self::sanitize_text(&message, 2000).unwrap_or_default(),
            context,
            meta,
            received_at: chrono::Utc::now().to_rfc3339(),
        };

        let mut entries = self.entries.write().await;
        entries.push(entry.clone());

        // Trim to max entries
        if entries.len() > MAX_ENTRIES {
            let start = entries.len() - MAX_ENTRIES;
            *entries = entries[start..].to_vec();
        }

        entry
    }

    /// List recent feedback entries
    pub async fn list_feedback(&self, limit: usize) -> Vec<FeedbackEntry> {
        let entries = self.entries.read().await;
        if limit == 0 {
            return Vec::new();
        }

        let start = entries.len().saturating_sub(limit);
        let mut result = entries[start..].to_vec();
        result.reverse();
        result
    }

    /// Get feedback count
    pub async fn get_count(&self) -> usize {
        self.entries.read().await.len()
    }

    /// Clear all feedback
    pub async fn clear(&self) {
        self.entries.write().await.clear();
    }

    // Helper functions

    fn clamp_rating(value: f32) -> f32 {
        if !value.is_finite() {
            return 0.0;
        }
        let clamped = value.max(0.0).min(5.0);
        (clamped * 10.0).round() / 10.0
    }

    fn sanitize_text(value: &str, max_length: usize) -> Option<String> {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            return None;
        }
        Some(trimmed.chars().take(max_length).collect())
    }

    fn create_id() -> String {
        let timestamp = chrono::Utc::now().timestamp_millis();
        let random: u32 = rand::random();
        format!("{:x}-{:x}", timestamp, random)
    }

    /// Sanitize context
    pub fn sanitize_context(context: Option<FeedbackContext>) -> Option<FeedbackContext> {
        context.map(|ctx| FeedbackContext {
            room_id: ctx.room_id.and_then(|s| Self::sanitize_text(&s, 32)),
            is_multiplayer: ctx.is_multiplayer,
            socket_id: ctx.socket_id.and_then(|s| Self::sanitize_text(&s, 48)),
            url: ctx.url.and_then(|s| Self::sanitize_text(&s, 2048)),
            user_agent: ctx.user_agent.and_then(|s| Self::sanitize_text(&s, 512)),
        })
    }

    /// Sanitize meta
    pub fn sanitize_meta(meta: Option<FeedbackMeta>) -> Option<FeedbackMeta> {
        meta.map(|m| FeedbackMeta {
            ip: m.ip.and_then(|s| Self::sanitize_text(&s, 64)),
            origin: m.origin.and_then(|s| Self::sanitize_text(&s, 256)),
            referer: m.referer.and_then(|s| Self::sanitize_text(&s, 2048)),
            user_agent: m.user_agent.and_then(|s| Self::sanitize_text(&s, 512)),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_add_feedback() {
        let service = FeedbackService::new();
        let entry = service
            .add_feedback(4.5, "Great!".to_string(), None, None)
            .await;
        
        assert_eq!(entry.rating, 4.5);
        assert_eq!(entry.message, "Great!");
        assert_eq!(service.get_count().await, 1);
    }

    #[tokio::test]
    async fn test_clamp_rating() {
        assert_eq!(FeedbackService::clamp_rating(6.0), 5.0);
        assert_eq!(FeedbackService::clamp_rating(-1.0), 0.0);
        assert_eq!(FeedbackService::clamp_rating(3.7), 3.7);
    }

    #[tokio::test]
    async fn test_max_entries() {
        let service = FeedbackService::new();
        
        // Add more than MAX_ENTRIES
        for i in 0..250 {
            service.add_feedback(5.0, format!("Message {}", i), None, None).await;
        }
        
        assert_eq!(service.get_count().await, MAX_ENTRIES);
    }
}
