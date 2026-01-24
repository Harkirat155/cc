use crate::models::feedback::{FeedbackContext, FeedbackMeta};
use async_trait::async_trait;

/// Trait for Google Sheets integration (Dependency Inversion Principle)
#[async_trait]
pub trait SheetsClient: Send + Sync {
    async fn append_feedback(
        &self,
        rating: f32,
        message: &str,
        context: Option<&FeedbackContext>,
        meta: Option<&FeedbackMeta>,
        timestamp: &str,
    ) -> Result<(), String>;
}

/// Placeholder Google Sheets service (to be implemented with proper deps)
pub struct GoogleSheetsService {
    configured: bool,
}

impl GoogleSheetsService {
    pub async fn new(
        _service_account_email: Option<String>,
        _service_account_key: Option<String>,
        _spreadsheet_id: Option<String>,
        _range: Option<String>,
    ) -> Result<Self, String> {
        // For now, Google Sheets integration is disabled
        // To enable, add google-sheets4 and yup-oauth2 dependencies
        Ok(Self { configured: false })
    }

    pub fn is_configured(&self) -> bool {
        self.configured
    }
}

#[async_trait]
impl SheetsClient for GoogleSheetsService {
    async fn append_feedback(
        &self,
        _rating: f32,
        _message: &str,
        _context: Option<&FeedbackContext>,
        _meta: Option<&FeedbackMeta>,
        _timestamp: &str,
    ) -> Result<(), String> {
        Err("Google Sheets integration not configured".to_string())
    }
}

/// Mock implementation for testing (Open/Closed Principle)
pub struct MockSheetsClient {
    pub should_fail: bool,
}

#[async_trait]
impl SheetsClient for MockSheetsClient {
    async fn append_feedback(
        &self,
        _rating: f32,
        _message: &str,
        _context: Option<&FeedbackContext>,
        _meta: Option<&FeedbackMeta>,
        _timestamp: &str,
    ) -> Result<(), String> {
        if self.should_fail {
            Err("Mock failure".to_string())
        } else {
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_sheets_client_success() {
        let client = MockSheetsClient { should_fail: false };
        let result = client.append_feedback(5.0, "Test", None, None, "2024-01-01").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_mock_sheets_client_failure() {
        let client = MockSheetsClient { should_fail: true };
        let result = client.append_feedback(5.0, "Test", None, None, "2024-01-01").await;
        assert!(result.is_err());
    }
}
