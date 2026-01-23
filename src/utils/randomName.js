/**
 * Generates a random 5-character name using uppercase letters, 
 * lowercase letters, numbers, and special characters.
 * @returns {string} A random 5-character name
 */
export function generateRandomName() {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%&*';
  
  const allChars = uppercase + lowercase + numbers + special;
  
  let name = '';
  for (let i = 0; i < 5; i++) {
    const randomIndex = Math.floor(Math.random() * allChars.length);
    name += allChars[randomIndex];
  }
  
  return name;
}

const STORAGE_KEY = 'cc_display_name';

/**
 * Get the stored display name, or generate and store a new one.
 * @returns {string} The user's display name
 */
export function getDisplayName() {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
      
      const newName = generateRandomName();
      window.sessionStorage.setItem(STORAGE_KEY, newName);
      return newName;
    }
  } catch {
    // Ignore storage errors
  }
  return generateRandomName();
}

/**
 * Update the stored display name.
 * @param {string} name - The new display name
 * @returns {boolean} True if successfully stored
 */
export function setDisplayName(name) {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(STORAGE_KEY, name);
      return true;
    }
  } catch {
    // Ignore storage errors
  }
  return false;
}
