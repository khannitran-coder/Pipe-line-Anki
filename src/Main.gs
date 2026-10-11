/**
 * Main.gs — điểm vào: menu + quét Drive → Gemini → Sheet.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Anki Tools')
    .addItem('1. Quét file từ Drive', 'processNewFiles')
    .addItem('2. Đẩy Pending sang Anki', 'pushToAnki')
    .addToUi();
}

function getExistingWordsSet(sheet) {
  const set = new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return set; // bỏ qua hàng tiêu đề
  sheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(r => {
    const w = r[0] ? r[0].toString().trim().toLowerCase() : '';
    if (w) set.add(w);
  });
  return set;
}

function processNewFiles() {
  const cfg = getConfig();
  const sheet = getVocabSheet();
  const processedFolder = DriveApp.getFolderById(cfg.PROCESSED_FOLDER_ID);
  const files = DriveApp.getFolderById(cfg.INPUT_FOLDER_ID).getFiles();

  const existingWords = getExistingWordsSet(sheet);
  Logger.log('Đã có ' + existingWords.size + ' từ/cụm trong Sheet.');

  let scanned = 0;
  while (files.hasNext()) {
    const file = files.next();
    scanned++;
    Logger.log('--- ' + file.getName() + ' | ' + file.getMimeType());

    try {
      const content = extractTextFromFile(file);
      if (!content || content.trim() === '') {
        Logger.log('File rỗng/không đọc được. Bỏ qua.');
        continue;
      }

      // Bước A — quy tắc xác định: regex trên **...**, loại tiếng Việt, loại trùng với Sheet
      const raw = extractPhrasesFromMarkedText(content);
      const phrases = filterNewPhrases(raw, existingWords);
      Logger.log(raw.length + ' mục đánh dấu, ' + phrases.length + ' mục mới.');

      if (phrases.length === 0) {
        if (raw.length === 0) {
          Logger.log('Không thấy đoạn nào được đánh dấu. KHÔNG chuyển file để bạn kiểm tra lại.');
        } else {
          file.moveTo(processedFolder); // toàn bộ đã có trong Sheet
        }
        continue;
      }

      // Bước B — Gemini chỉ làm giàu dữ liệu cho danh sách đã chốt
      const data = callGemini(content, phrases);
      const rec = reconcileCounts(phrases, data);
      Logger.log('Gemini trả về ' + rec.received + '/' + rec.expected + ' mục.');
      if (!rec.ok) {
        // Không chuyển file khi lệch số lượng, để lần quét sau thử lại những từ chưa có trong Sheet
        Logger.log('CẢNH BÁO lệch số lượng: thiếu ' + rec.missing + ', thừa ' + rec.extra + '. Kiểm tra Sheet.');
      }

      (Array.isArray(data) ? data : []).forEach(item => {
        const word = normalizeWordCasing(item.word);
        if (!word || existingWords.has(word.toLowerCase())) return;
        const col = Array.isArray(item.collocations) ? item.collocations.join(', ') : '';
        sheet.appendRow([word, item.ipa, item.definition, item.example, col, 'Pending', new Date()]);
        existingWords.add(word.toLowerCase());
      });

      if (rec.ok) {
        file.moveTo(processedFolder);
        Logger.log('Đã chuyển file sang Processed_Docs.');
      }
    } catch (e) {
      Logger.log("Lỗi file '" + file.getName() + "': " + e);
    }
  }

  if (scanned === 0) Logger.log('Thư mục Input rỗng. Kiểm tra INPUT_FOLDER_ID.');
}
