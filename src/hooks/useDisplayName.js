import { useState, useCallback } from "react";
import { getDisplayName, setDisplayName as saveDisplayName } from "../utils/randomName";

/**
 * Hook for managing display name state and persistence.
 * Provides current display name and a function to update it with validation.
 */
export default function useDisplayName() {
  const [displayName, setDisplayNameState] = useState(() => getDisplayName());

  /**
   * Update the display name with validation.
   * @param {string} newName - The new display name
   * @param {object} options - Optional callbacks
   * @param {Function} options.onServerNotify - Called with trimmed name if server should be notified
   * @returns {boolean} Whether the update was successful
   */
  const updateDisplayName = useCallback((newName, options = {}) => {
    const trimmed = String(newName || "").trim();
    
    // Validate length (1-20 characters)
    if (trimmed.length < 1 || trimmed.length > 20) {
      return false;
    }
    
    // Persist to storage
    saveDisplayName(trimmed);
    setDisplayNameState(trimmed);
    
    // Allow caller to notify server if needed
    if (options.onServerNotify) {
      options.onServerNotify(trimmed);
    }
    
    return true;
  }, []);

  return {
    displayName,
    updateDisplayName,
  };
}
