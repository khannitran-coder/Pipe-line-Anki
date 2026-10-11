# Vocabulary → Anki Pipeline

> Pipeline tự động biến tài liệu học tiếng Anh trên Google Drive thành thẻ Anki: **Drive → Google Sheets → Gemini API → Anki**. Danh sách từ cần học được trích bằng **quy tắc xác định (regex)**; LLM chỉ được giao việc làm giàu dữ liệu (prompt yêu cầu không tự thêm/bớt từ), đầu ra được đối chiếu số lượng.

`Google Apps Script` · `Gemini API` · `AnkiConnect` · `Google Drive / Sheets`

## Vấn đề

Học từ vựng chuyên ngành (ở đây là Project Management) đòi hỏi: đọc tài liệu → bôi đậm từ cần học → tra IPA/nghĩa → soạn ví dụ → nhập từng thẻ vào Anki để ôn tập ghi nhớ. Thao tác thủ công, dễ trùng thẻ, và nếu để LLM tự "chọn từ quan trọng" thì kết quả không ổn định, bỏ sót hoặc thêm từ ngoài ý muốn.

## Giải pháp

Tách pipeline thành phần **xác định** và phần **xác suất**:

| Bước | Thành phần | Bản chất |
|---|---|---|
| 1 | Đọc Google Doc/.docx, chèn `**...**` quanh phần in đậm / gạch chân / tô vàng | Xác định |
| 2 | Regex trích danh sách từ, bỏ số thứ tự, bỏ cụm tiếng Việt, loại trùng nội bộ | Xác định |
| 3 | Loại từ đã có trong Sheet trước khi gọi API | Xác định |
| 4 | Gemini làm giàu: IPA, nghĩa sát ngữ cảnh, câu ví dụ mới, collocation | LLM |
| 5 | **Đối chiếu số lượng đầu ra** với danh sách yêu cầu; lệch thì cảnh báo và không chuyển file | Xác định |
| 6 | Ghi Sheet (trạng thái `Pending`), đẩy sang Anki qua AnkiConnect → `Done` | Xác định |

```
Drive (Input_Documents)
   │  đọc Doc/.docx → text có **...**
   ▼
Regex extract ──► lọc trùng với Sheet
   │ danh sách từ ĐÃ CHỐT
   ▼
Gemini (chỉ enrich) ──► reconcile số lượng ──► Google Sheet [Pending]
                                                   │ menu "Đẩy Pending sang Anki"
                                                   ▼
                                       AnkiConnect (ngrok) ──► Anki [Done]
```

## Điểm kỹ thuật chính

- **Deterministic extraction**: danh sách từ yêu cầu do regex quyết định nên bước chọn từ không còn phụ thuộc LLM và lặp lại được. Việc Gemini có trả đúng từng mục hay không mới chỉ được đối chiếu theo số lượng (xem Hướng phát triển).
- **Gộp run định dạng liên tiếp**: tránh lỗi `**a****b**` khi một cụm bị chia thành nhiều run định dạng trong Google Docs.
- **Reconciliation**: so sánh số mục Gemini trả về với số mục yêu cầu; lệch thì log cảnh báo và giữ file lại để xử lý tiếp.
- **Retry có backoff** khi Gemini trả 429/503 (tối đa 3 lần: 5s, 10s, 15s).
- **Chống trùng 2 lớp**: lọc theo Sheet trước khi gọi API + `allowDuplicate: false` ở Anki.
- **Quản lý secret**: API key, ID thư mục, URL ngrok nằm trong Script Properties, không hard-code; key gửi qua header thay vì query string.
- **Logic thuần có unit test** (`src/Text.gs`, chạy bằng Node, không cần Apps Script).

<!-- TODO: thêm mục "Kết quả" với số liệu thật bạn tự đo (số thẻ đã tạo, thời gian mỗi tài liệu trước/sau) và ảnh chụp Sheet/Anki vào thư mục docs/ -->

## Cấu trúc repo

```
src/
  Config.gs      # cấu hình + Script Properties
  Main.gs        # menu, quét Drive → Gemini → Sheet
  DocReader.gs   # đọc Doc/.docx/.txt, chèn **...**
  Text.gs        # regex, chuẩn hóa, lọc trùng, reconcile (có test)
  Gemini.gs      # prompt + gọi API + retry
  Anki.gs        # AnkiConnect: addNote, backfill, debug
  appsscript.json
test/text.test.js
docs/architecture.md
```

## Cài đặt

1. Tạo Google Sheet có tab `Vocabulary_collector` với hàng tiêu đề: `Word | IPA | Definition | Example | Collocations | Status | Created | Translate`.
2. Tạo 2 thư mục Drive: `Input_Documents` và `Processed_Docs`, lấy ID từ URL.
3. Mở **Extensions → Apps Script**, chép các file trong `src/` (hoặc dùng [clasp](https://github.com/google/clasp): `clasp login && clasp create --type sheets && clasp push`).
4. Bật **Services → Drive API (v3)** (đã khai báo trong `appsscript.json`).
5. Điền giá trị vào `setupConfig()` rồi chạy **một lần**, sau đó **xóa giá trị thật khỏi code**. Hoặc nhập tay trong *Project Settings → Script Properties*:
   `GEMINI_API_KEY`, `INPUT_FOLDER_ID`, `PROCESSED_FOLDER_ID`, `ANKI_CONNECT_URL`.
6. Phía Anki: cài add-on [AnkiConnect](https://ankiweb.net/shared/info/2055492159), tạo deck `Project Management` và note type `Basic CHI 02` với các field `English, IPA, Vietnamese, Example, Collocations, Translate`, rồi chạy `ngrok http 8765`.

## Cách dùng

1. Mở tài liệu, **in đậm / gạch chân / tô vàng** các từ cần học, thả vào `Input_Documents`.
2. Menu **Anki Tools → 1. Quét file từ Drive**.
3. Rà soát Sheet nếu cần, rồi **Anki Tools → 2. Đẩy Pending sang Anki**.

## Kiểm thử

```bash
npm test
```

## Hạn chế đã biết

- Anki phải đang mở trên máy thì mới đẩy thẻ được.
- Chưa đo benchmark chất lượng đầu ra của Gemini; mới có kiểm tra số lượng, chưa kiểm tra tính đúng của IPA/nghĩa.
- File `.txt` không có định dạng nên phải tự gõ `**` quanh từ cần lấy.

## Hướng phát triển

- Kiểm tra từng mục trả về (khớp `word` với danh sách yêu cầu, không chỉ so số lượng).
- Dùng structured output (`responseSchema`) của Gemini thay vì parse JSON từ text.
- Time-driven trigger quét Drive định kỳ.

## Tác giả

Trần Khánh Chi — dự án cá nhân, 07/2026 – nay.
