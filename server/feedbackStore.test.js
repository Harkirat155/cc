/** @jest-environment node */
import {
  addFeedback,
  listFeedback,
  getFeedbackCount,
  clearFeedbackStore,
} from './feedbackStore.js';

describe('feedbackStore', () => {
  beforeEach(() => {
    clearFeedbackStore();
  });

  test('stores sanitized entries', () => {
    const entry = addFeedback({
      rating: 4.7,
      message: '  Great experience with the new UI!  ',
      context: {
        roomId: 'ROOM-1234567890',
        url: 'https://example.com/session/123',
        userAgent: 'TestAgent/1.0',
        socketId: 'socket-12345',
      },
      meta: {
        ip: '127.0.0.1',
        origin: 'https://test.local',
      },
    });

    expect(entry.id).toEqual(expect.any(String));
    expect(entry.rating).toBe(4.7);
    expect(entry.message).toBe('Great experience with the new UI!');
    expect(entry.context).toMatchObject({
      roomId: 'ROOM-1234567890',
      url: 'https://example.com/session/123',
      socketId: 'socket-12345',
      userAgent: 'TestAgent/1.0',
    });
    expect(entry.meta).toMatchObject({ ip: '127.0.0.1', origin: 'https://test.local' });
    expect(getFeedbackCount()).toBe(1);
    expect(listFeedback()).toHaveLength(1);
  });

  test('enforces capacity and ordering', () => {
    const total = 220;
    for (let index = 0; index < total; index += 1) {
      addFeedback({ rating: index % 5, message: `Feedback #${index}` });
    }

    expect(getFeedbackCount()).toBeLessThanOrEqual(200);
    const recent = listFeedback(5);
    expect(recent).toHaveLength(5);
    expect(recent[0].message).toBe('Feedback #219');
    expect(recent[4].message).toBe('Feedback #215');
  });

  test('listFeedback respects limit', () => {
    clearFeedbackStore();
    addFeedback({ rating: 5, message: 'One' });
    addFeedback({ rating: 4, message: 'Two' });
    addFeedback({ rating: 3, message: 'Three' });

    const lastTwo = listFeedback(2);
    expect(lastTwo).toHaveLength(2);
    expect(lastTwo.map((entry) => entry.message)).toEqual(['Three', 'Two']);
  });
});
