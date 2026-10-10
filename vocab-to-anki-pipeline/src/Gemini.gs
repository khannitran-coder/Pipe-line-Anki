/**
 * Gemini.gs — Gemini CHỈ làm giàu dữ liệu (IPA, nghĩa, ví dụ, collocation)
 * cho danh sách từ đã chốt bằng regex; không được tự thêm/bớt từ.
 */

const GEMINI_MAX_ATTEMPTS = 3;

function buildPrompt(fullText, phraseList) {
  return `Bạn là một chuyên gia ngôn ngữ học. Bạn sẽ KHÔNG tự tìm từ vựng — danh sách từ/cụm cần xử lý đã được chốt sẵn bên dưới. Nhiệm vụ DUY NHẤT của bạn là tra IPA, nghĩa tiếng Việt sát ngữ cảnh, viết câu ví dụ mới, và gợi ý collocation cho ĐÚNG và ĐỦ từng mục trong danh sách này.

DANH SÁCH BẮT BUỘC (phải trả về đúng ${phraseList.length} mục, đúng thứ tự, đúng chính tả như liệt kê — không thêm, không bớt, không đổi từ khác, không gộp/tách mục):
${JSON.stringify(phraseList)}

VĂN BẢN GỐC (chỉ dùng để hiểu bối cảnh, KHÔNG dùng để tìm thêm từ ngoài danh sách):
"""
${fullText}
"""

YÊU CẦU:
1. Nếu cụm chứa ĐỘNG TỪ đang chia thì, đưa RIÊNG động từ đó về nguyên mẫu, giữ nguyên các từ còn lại. Ví dụ: "presented the evidence" -> "present the evidence". Cụm không chứa động từ chia thì giữ nguyên.
2. Tra IPA và nghĩa tiếng Việt sát bối cảnh trong văn bản gốc.
3. Viết 1 câu ví dụ MỚI (không copy câu trong văn bản gốc), cùng chủ đề.
4. Không cần lo viết hoa/thường của "word" — script sẽ chuẩn hóa.
5. Đầu ra là JSON THUẦN, không giải thích, không markdown code fence. Mỗi phần tử:
  {"word": "...", "ipa": "...", "definition": "...", "example": "...", "collocations": ["...", "..."]}
Trả về MẢNG JSON gồm đúng ${phraseList.length} phần tử theo đúng thứ tự. Nếu thiếu thông tin, để trống giá trị nhưng KHÔNG bỏ qua mục.`;
}

/** Gọi Gemini, retry có backoff khi 429/503. Trả về mảng item đã parse. */
function callGemini(fullText, phraseList) {
  const cfg = getConfig();
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';
  const options = {
    method: 'post',
    contentType: 'application/json',
    // Key đặt ở header thay vì query string để không lọt vào log/URL
    headers: { 'x-goog-api-key': cfg.GEMINI_API_KEY },
    payload: JSON.stringify({ contents: [{ parts: [{ text: buildPrompt(fullText, phraseList) }] }] }),
    muteHttpExceptions: true,
  };

  let response = UrlFetchApp.fetch(url, options);
  let attempt = 0;
  while ([429, 503].indexOf(response.getResponseCode()) !== -1 && attempt < GEMINI_MAX_ATTEMPTS) {
    attempt++;
    const waitMs = 5000 * attempt; // backoff tuyến tính: 5s, 10s, 15s
    Logger.log('Gemini lỗi ' + response.getResponseCode() + ', retry ' + attempt + '/' + GEMINI_MAX_ATTEMPTS + ' sau ' + waitMs / 1000 + 's');
    Utilities.sleep(waitMs);
    response = UrlFetchApp.fetch(url, options);
  }

  if (response.getResponseCode() !== 200) {
    Logger.log('Gemini API error ' + response.getResponseCode() + ': ' + response.getContentText());
    throw new Error('Lỗi Gemini API ' + response.getResponseCode() + '. Xem Logs.');
  }

  const result = JSON.parse(response.getContentText());
  return JSON.parse(stripJsonFences(result.candidates[0].content.parts[0].text));
}
