/**
 * Config.gs — toàn bộ cấu hình đọc từ Script Properties, KHÔNG hard-code secret.
 *
 * Thiết lập 1 lần: chạy setupConfig() sau khi sửa giá trị bên dưới,
 * hoặc vào Project Settings > Script Properties và nhập tay.
 */

const SHEET_NAME = 'Vocabulary_collector';
const ANKI_DECK = 'Project Management';
const ANKI_MODEL = 'Basic CHI 02';
const GEMINI_MODEL = 'gemini-flash-latest';

// Chỉ số cột trong Sheet (0-based khi đọc mảng)
const COL = { WORD: 0, IPA: 1, DEFINITION: 2, EXAMPLE: 3, COLLOCATIONS: 4, STATUS: 5, CREATED: 6, TRANSLATE: 7 };

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  const cfg = {
    GEMINI_API_KEY: props.getProperty('GEMINI_API_KEY'),
    INPUT_FOLDER_ID: props.getProperty('INPUT_FOLDER_ID'),
    PROCESSED_FOLDER_ID: props.getProperty('PROCESSED_FOLDER_ID'),
    ANKI_CONNECT_URL: props.getProperty('ANKI_CONNECT_URL'),
  };
  Object.keys(cfg).forEach(k => {
    if (!cfg[k]) throw new Error('Thiếu Script Property: ' + k + ' (xem README mục Cài đặt).');
  });
  return cfg;
}

/** Chạy 1 lần để lưu cấu hình. Điền giá trị thật TẠM THỜI, chạy xong thì xóa khỏi code. */
function setupConfig() {
  PropertiesService.getScriptProperties().setProperties({
    GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY',
    INPUT_FOLDER_ID: 'YOUR_INPUT_FOLDER_ID',
    PROCESSED_FOLDER_ID: 'YOUR_PROCESSED_FOLDER_ID',
    ANKI_CONNECT_URL: 'https://YOUR-NGROK-URL.ngrok-free.dev',
  });
}

function getVocabSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Không tìm thấy tab '" + SHEET_NAME + "'. Kiểm tra tên tab hoặc sửa SHEET_NAME.");
  return sheet;
}
