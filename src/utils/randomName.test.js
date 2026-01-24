import { generateRandomName, getDisplayName, setDisplayName } from './randomName';

// Character set size: uppercase (26) + lowercase (26) + numbers (10) + special (7)
const CHAR_SET_SIZE = 69;

describe('generateRandomName', () => {
  it('should generate a 5-character name', () => {
    const name = generateRandomName();
    expect(name).toHaveLength(5);
  });

  it('should only contain valid characters', () => {
    const validChars = /^[A-Za-z0-9!@#$%&*]+$/;
    
    // Generate multiple names to ensure consistency
    for (let i = 0; i < 100; i++) {
      const name = generateRandomName();
      expect(name).toMatch(validChars);
    }
  });

  it('should generate different names on each call', () => {
    // Mock Math.random to test uniqueness deterministically
    let callCount = 0;
    const mockRandom = jest.spyOn(Math, 'random').mockImplementation(() => {
      // Return different values to ensure unique names
      return (callCount++ % CHAR_SET_SIZE) / CHAR_SET_SIZE;
    });
    
    try {
      const names = new Set();
      
      // Generate 50 names
      for (let i = 0; i < 50; i++) {
        names.add(generateRandomName());
      }
      
      // All should be unique with deterministic random
      expect(names.size).toBe(50);
    } finally {
      // Always restore Math.random, even if assertions fail
      mockRandom.mockRestore();
    }
  });
});

describe('getDisplayName and setDisplayName', () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem('cc_display_name');
    }
  });

  it('should generate a name if none is stored', () => {
    const name = getDisplayName();
    expect(name).toHaveLength(5);
  });

  it('should return the same name on subsequent calls', () => {
    const name1 = getDisplayName();
    const name2 = getDisplayName();
    expect(name1).toBe(name2);
  });

  it('should allow setting a custom name', () => {
    const customName = 'Test1';
    setDisplayName(customName);
    const name = getDisplayName();
    expect(name).toBe(customName);
  });
});
