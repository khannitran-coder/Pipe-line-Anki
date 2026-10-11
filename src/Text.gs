/**
 * Text.gs — logic thuần (không gọi dịch vụ Google), có thể test bằng Node.
 * Đây là phần "quy tắc xác định": danh sách từ vựng được trích bằng regex
 * trên dấu **...** — LLM không được tự chọn từ.
 */

const VIETNAMESE_CHARS_REGEX = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;

function isVietnameseText(text) {
  return VIETNAMESE_CHARS_REGEX.test(text);
}

/** "APPROVE" -> "Approve": chỉ viết hoa chữ cái đầu, làm ở script để đảm bảo nhất quán. */
function normalizeWordCasing(word) {
  if (!word) return word;
  const trimmed = String(word).trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/**
 * Trích danh sách từ/cụm từ văn bản đã đánh dấu **...**:
 * bỏ số thứ tự đầu cụm, bỏ cụm tiếng Việt, gộp trùng (không phân biệt hoa/thường).
 * @return {string[]}
 */
function extractPhrasesFromMarkedText(markedText) {
  const regex = /\*\*([^*]+?)\*\*/g;
  const seen = {};
  const result = [];
  let match;
  while ((match = regex.exec(markedText)) !== null) {
    let phrase = match[1].replace(/\s+/g, ' ').trim();
    phrase = phrase.replace(/^\d+[.)]\s*/, '').trim();
    if (!phrase || isVietnameseText(phrase)) continue;
    const key = phrase.toLowerCase();
    if (!seen[key]) {
      seen[key] = true;
      result.push(phrase);
    }
  }
  return result;
}

/** Loại các cụm đã tồn tại trong Set (so sánh chữ thường). */
function filterNewPhrases(phrases, existingWordsSet) {
  return phrases.filter(p => !existingWordsSet.has(p.toLowerCase()));
}

/**
 * Đối chiếu đầu ra LLM với danh sách yêu cầu (reconciliation).
 * @return {{ok: boolean, expected: number, received: number, missing: number, extra: number}}
 */
function reconcileCounts(requestedPhrases, items) {
  const received = Array.isArray(items) ? items : [];
  const requestedCount = requestedPhrases.length;
  return {
    ok: received.length === requestedCount,
    expected: requestedCount,
    received: received.length,
    missing: Math.max(0, requestedCount - received.length),
    extra: Math.max(0, received.length - requestedCount),
  };
}

/** Bóc code fence markdown nếu model lỡ bọc JSON. */
function stripJsonFences(text) {
  return String(text).replace(/```json/g, '').replace(/```/g, '').trim();
}
