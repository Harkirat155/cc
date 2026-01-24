use serde::Deserialize;
use std::env;

/// Application configuration
#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    #[serde(default = "default_port")]
    pub port: u16,
    
    #[serde(default = "default_cors_origin")]
    pub cors_origin: String,
    
    #[serde(default = "default_room_limit")]
    pub room_limit: usize,
    
    #[serde(default = "default_room_ttl_ms")]
    pub room_ttl_ms: i64,
    
    #[serde(default)]
    pub google_service_account_email: Option<String>,
    
    #[serde(default)]
    pub google_service_account_private_key: Option<String>,
    
    #[serde(default)]
    pub google_sheets_spreadsheet_id: Option<String>,
    
    #[serde(default)]
    pub google_sheets_feedback_range: Option<String>,
}

fn default_port() -> u16 {
    10000
}

fn default_cors_origin() -> String {
    "*".to_string()
}

fn default_room_limit() -> usize {
    500
}

fn default_room_ttl_ms() -> i64 {
    120_000
}

impl AppConfig {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self, envy::Error> {
        // Load .env file if it exists
        dotenv::dotenv().ok();
        
        // Use envy to deserialize from environment
        let mut config: AppConfig = envy::from_env()?;
        
        // Handle PORT separately for compatibility
        if let Ok(port_str) = env::var("PORT") {
            if let Ok(port) = port_str.parse::<u16>() {
                config.port = port;
            }
        }
        
        Ok(config)
    }

    /// Get allowed CORS origins as a list
    pub fn allowed_origins(&self) -> Vec<String> {
        self.cors_origin
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        // Set minimal env for testing
        env::set_var("CORS_ORIGIN", "*");
        
        let config = AppConfig::from_env().unwrap_or_else(|_| AppConfig {
            port: default_port(),
            cors_origin: default_cors_origin(),
            room_limit: default_room_limit(),
            room_ttl_ms: default_room_ttl_ms(),
            google_service_account_email: None,
            google_service_account_private_key: None,
            google_sheets_spreadsheet_id: None,
            google_sheets_feedback_range: None,
        });
        
        assert_eq!(config.port, 10000);
        assert_eq!(config.room_limit, 500);
    }

    #[test]
    fn test_allowed_origins() {
        let config = AppConfig {
            port: 3000,
            cors_origin: "http://localhost:3000, http://example.com".to_string(),
            room_limit: 500,
            room_ttl_ms: 120_000,
            google_service_account_email: None,
            google_service_account_private_key: None,
            google_sheets_spreadsheet_id: None,
            google_sheets_feedback_range: None,
        };
        
        let origins = config.allowed_origins();
        assert_eq!(origins.len(), 2);
        assert!(origins.contains(&"http://localhost:3000".to_string()));
    }
}
