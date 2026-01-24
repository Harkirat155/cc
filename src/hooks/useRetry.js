import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Configuration for retry behavior
 */
const DEFAULT_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 5000,
};

/**
 * Custom hook for retry logic with exponential backoff
 * Follows Open/Closed Principle - extensible through configuration
 * 
 * @param {Function} operation - Async operation to retry
 * @param {Object} config - Retry configuration
 * @param {number} config.maxAttempts - Maximum number of retry attempts
 * @param {number} config.baseDelayMs - Base delay in milliseconds
 * @param {number} config.maxDelayMs - Maximum delay in milliseconds
 * @returns {Object} Retry state and control functions
 */
export function useRetry(operation, config = {}) {
  const { maxAttempts, baseDelayMs, maxDelayMs } = { ...DEFAULT_CONFIG, ...config };
  
  const [attemptCount, setAttemptCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState(null);
  const retryTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Calculate exponential backoff delay
   */
  const calculateDelay = useCallback((attempt) => {
    return Math.min(baseDelayMs * (1 << attempt), maxDelayMs);
  }, [baseDelayMs, maxDelayMs]);

  /**
   * Execute the operation with retry logic
   */
  const execute = useCallback(async (...args) => {
    if (!isMountedRef.current) return;

    setIsRetrying(true);
    setError(null);

    try {
      const result = await operation(...args);
      if (isMountedRef.current) {
        setAttemptCount(0);
        setIsRetrying(false);
      }
      return result;
    } catch (err) {
      if (!isMountedRef.current) return;

      setError(err);
      
      if (attemptCount < maxAttempts - 1) {
        const delay = calculateDelay(attemptCount);
        console.log(`Retry attempt ${attemptCount + 1}/${maxAttempts} in ${delay}ms`);
        
        retryTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setAttemptCount(prev => prev + 1);
            // Re-execute on next tick
            setTimeout(() => execute(...args), 0);
          }
        }, delay);
      } else {
        setIsRetrying(false);
        throw err;
      }
    }
  }, [operation, attemptCount, maxAttempts, calculateDelay]);

  /**
   * Reset retry state
   */
  const reset = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    setAttemptCount(0);
    setIsRetrying(false);
    setError(null);
  }, []);

  return {
    execute,
    reset,
    attemptCount,
    isRetrying,
    error,
    hasReachedMaxAttempts: attemptCount >= maxAttempts,
  };
}
