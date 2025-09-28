/** @jest-environment node */

const originalEnv = { ...process.env };

describe('googleSheetsClient', () => {
  afterEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  test('skips appending when configuration is incomplete', async () => {
    process.env = {
      ...originalEnv,
      GOOGLE_SERVICE_ACCOUNT_EMAIL: '',
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: '',
      GOOGLE_SHEETS_SPREADSHEET_ID: '',
    };

    const { appendFeedbackRow } = await import('./googleSheetsClient.js');
    const result = await appendFeedbackRow({ rating: 5, message: 'Test feedback' });

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('Missing');
  });

  test('appends a row when configured', async () => {
    const appendMock = jest.fn().mockResolvedValue({});

    process.env = {
      ...originalEnv,
      GOOGLE_SERVICE_ACCOUNT_EMAIL: 'service@example.com',
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: '---KEY---\\nLINE2',
      GOOGLE_SHEETS_SPREADSHEET_ID: 'spreadsheet-id-123',
      GOOGLE_SHEETS_FEEDBACK_RANGE: 'Sheet1!A:E',
    };

    const {
      appendFeedbackRow,
      resetSheetsClient,
      __setGoogleClient,
      __resetGoogleClient,
    } = await import('./googleSheetsClient.js');

    __setGoogleClient({
      auth: {
        JWT: jest.fn().mockImplementation(() => ({
          authorize: jest.fn().mockResolvedValue(undefined),
        })),
      },
      sheets: jest.fn(() => ({
        spreadsheets: {
          values: {
            append: appendMock,
          },
        },
      })),
    });

    const result = await appendFeedbackRow({
      rating: 4.5,
      message: 'Loved it',
      context: { roomId: 'ROOM123' },
      meta: { ip: '127.0.0.1' },
      timestamp: '2025-09-28T12:34:56.000Z',
    });
    expect(result.success).toBe(true);
    expect(appendMock).toHaveBeenCalledWith({
      spreadsheetId: 'spreadsheet-id-123',
      range: 'Sheet1!A:E',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          '2025-09-28T12:34:56.000Z',
          4.5,
          'Loved it',
          '{"roomId":"ROOM123"}',
          '{"ip":"127.0.0.1"}',
        ]],
      },
    });

    resetSheetsClient();
    __resetGoogleClient();
  });
});
