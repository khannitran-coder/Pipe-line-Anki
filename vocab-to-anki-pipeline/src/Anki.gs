/**
 * Anki.gs — đẩy thẻ sang Anki qua AnkiConnect (expose bằng ngrok).
 */

function ankiRequest(action, params) {
  const cfg = getConfig();
  const response = UrlFetchApp.fetch(cfg.ANKI_CONNECT_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ action: action, version: 6, params: params || {} }),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('HTTP ' + response.getResponseCode() + ' từ AnkiConnect. Kiểm tra Anki/ngrok có đang chạy không.');
  }
  const body = JSON.parse(response.getContentText());
  if (body.error) throw new Error(body.error);
  return body.result;
}

function addCardToAnki(word, ipa, vietnamese, example, collocations, translate) {
  try {
    ankiRequest('addNote', {
      note: {
        deckName: ANKI_DECK,
        modelName: ANKI_MODEL,
        fields: { English: word, IPA: ipa, Vietnamese: vietnamese, Example: example, Collocations: collocations, Translate: translate },
        options: { allowDuplicate: false },
      },
    });
    return true;
  } catch (e) {
    Logger.log("Anki lỗi với '" + word + "': " + e);
    return false;
  }
}

/** Đẩy các dòng Status = Pending sang Anki, cập nhật trạng thái Done / Error - Empty. */
function pushToAnki() {
  const sheet = getVocabSheet();
  const data = sheet.getDataRange().getValues();
  let done = 0, failed = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[COL.STATUS] !== 'Pending') continue;

    const word = row[COL.WORD];
    if (!word || String(word).trim() === '' || String(word).trim().toLowerCase() === 'undefined') {
      sheet.getRange(i + 1, COL.STATUS + 1).setValue('Error - Empty');
      failed++;
      continue;
    }

    const ok = addCardToAnki(word, row[COL.IPA], row[COL.DEFINITION], row[COL.EXAMPLE], row[COL.COLLOCATIONS], row[COL.TRANSLATE]);
    if (ok) {
      sheet.getRange(i + 1, COL.STATUS + 1).setValue('Done');
      done++;
    } else {
      failed++;
    }
  }
  Logger.log('pushToAnki: ' + done + ' thẻ thành công, ' + failed + ' thất bại/bỏ qua.');
}

/** Backfill field Translate cho thẻ đã Done trước đó (update note, không tạo mới). */
function backfillTranslateForExistingCards() {
  const data = getVocabSheet().getDataRange().getValues();
  let updated = 0, notFound = 0;

  for (let i = 1; i < data.length; i++) {
    const word = String(data[i][COL.WORD] || '').trim();
    const translate = String(data[i][COL.TRANSLATE] || '').trim();
    if (!word || data[i][COL.STATUS] !== 'Done' || !translate) continue;
    updateTranslateFieldOnAnki(word, translate) ? updated++ : notFound++;
  }
  Logger.log('Backfill Translate: ' + updated + ' thành công, ' + notFound + ' không khớp.');
}

function updateTranslateFieldOnAnki(word, translate) {
  try {
    const safeWord = word.replace(/"/g, '\\"');
    const noteIds = ankiRequest('findNotes', { query: 'deck:"' + ANKI_DECK + '" English:"' + safeWord + '"' });
    if (!noteIds || noteIds.length === 0) return false;
    noteIds.forEach(id => ankiRequest('updateNoteFields', { note: { id: id, fields: { Translate: translate } } }));
    return true;
  } catch (e) {
    Logger.log("Lỗi cập nhật Translate cho '" + word + "': " + e);
    return false;
  }
}

/** Debug: in tên Deck và Note Type mà AnkiConnect đang thấy. */
function debugAnkiNames() {
  Logger.log('Decks: ' + JSON.stringify(ankiRequest('deckNames')));
  Logger.log('Models: ' + JSON.stringify(ankiRequest('modelNames')));
}
