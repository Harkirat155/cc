import { google } from 'googleapis';

let googleClient = google;

const {
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  GOOGLE_SHEETS_SPREADSHEET_ID,
  GOOGLE_SHEETS_FEEDBACK_RANGE,
} = process.env;

const REQUIRED_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let sheetsClientPromise = null;

const normalizeKey = (key) => {
  if (!key) return key;
  return key.replace(/\\n/g, '\n');
};

export const getSheetsConfigStatus = () => {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return { configured: false, reason: 'Missing service account credentials.' };
  }
  if (!GOOGLE_SHEETS_SPREADSHEET_ID) {
    return { configured: false, reason: 'Missing spreadsheet ID.' };
  }
  return { configured: true };
};

const createSheetsClient = async () => {
  const { configured, reason } = getSheetsConfigStatus();
  if (!configured) {
    throw new Error(reason || 'Google Sheets integration not configured.');
  }

  try {
    const auth = new googleClient.auth.JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: normalizeKey(GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY),
      scopes: REQUIRED_SCOPES,
    });
    await auth.authorize();

    return googleClient.sheets({ version: 'v4', auth });
  } catch (error) {
    sheetsClientPromise = null;
    throw error;
  }
};

const getSheetsClient = async () => {
  if (!sheetsClientPromise) {
    sheetsClientPromise = createSheetsClient();
  }
  try {
    return await sheetsClientPromise;
  } catch (error) {
    sheetsClientPromise = null;
    throw error;
  }
};

export const appendFeedbackRow = async ({
  rating,
  message,
  context,
  meta,
  timestamp = new Date().toISOString(),
}) => {
  const configStatus = getSheetsConfigStatus();
  if (!configStatus.configured) {
    return { success: false, skipped: true, reason: configStatus.reason };
  }

  try {
    const sheets = await getSheetsClient();
    const range = GOOGLE_SHEETS_FEEDBACK_RANGE || 'Feedback!A:E';
    const rowPayload = [
      timestamp,
      rating,
      message,
      context ? JSON.stringify(context) : '',
      meta ? JSON.stringify(meta) : '',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
      range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowPayload],
      },
    });

    return { success: true };
  } catch (error) {
    return { success: false, skipped: false, error };
  }
};

export const resetSheetsClient = () => {
  sheetsClientPromise = null;
};

export const __setGoogleClient = (client) => {
  googleClient = client;
  resetSheetsClient();
};

export const __resetGoogleClient = () => {
  googleClient = google;
  resetSheetsClient();
};
