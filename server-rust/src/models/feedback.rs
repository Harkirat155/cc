use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Feedback context information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackContext {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub room_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_multiplayer: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub socket_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,
}

/// Feedback metadata (server-side collected)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackMeta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub referer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,
}

/// Feedback entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackEntry {
    pub id: String,
    pub rating: f32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<FeedbackContext>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<FeedbackMeta>,
    pub received_at: String,
}

/// Feedback request from client
#[derive(Debug, Deserialize)]
pub struct FeedbackRequest {
    pub rating: f32,
    pub message: String,
    #[serde(default)]
    pub context: Option<HashMap<String, serde_json::Value>>,
}

/// Feedback response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackResponse {
    pub status: String,
    pub id: String,
    pub sheets_sync: String,
}
