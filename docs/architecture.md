# Ghi chú kiến trúc

## Nguyên tắc: tách phần xác định khỏi phần xác suất

Phiên bản đầu để Gemini vừa chọn từ quan trọng vừa tra nghĩa. Kết quả không ổn định: bỏ sót từ đã đánh dấu, thêm từ không đánh dấu, khác nhau giữa các lần chạy. Nguyên nhân gốc: định dạng (in đậm/gạch chân/tô vàng) bị mất khi lấy text thô, nên model phải đoán.

Phiên bản hiện tại:

1. Giữ định dạng bằng cách chèn `**...**` khi đọc tài liệu.
2. Regex quyết định danh sách từ (nguồn sự thật duy nhất).
3. Gemini nhận danh sách đã chốt, chỉ làm giàu dữ liệu.
4. Script đối chiếu đầu ra với danh sách yêu cầu.

## Trạng thái và xử lý lỗi

| Tình huống | Hành vi |
|---|---|
| File không có đoạn nào đánh dấu | Bỏ qua, **không** chuyển file để người dùng kiểm tra |
| Toàn bộ từ đã có trong Sheet | Không gọi API, chuyển file sang Processed |
| Gemini trả sai số lượng | Ghi những mục hợp lệ, cảnh báo, **không** chuyển file |
| Gemini 429/503 | Retry tối đa 3 lần, backoff 5s/10s/15s |
| Anki lỗi / ngrok tắt | Giữ `Pending`, chạy lại sau |
| Word rỗng | Đánh dấu `Error - Empty` |

Khi lệch số lượng, file được giữ lại; lần quét sau các từ đã có trong Sheet bị lọc nên chỉ xử lý nốt phần thiếu.

## Sheet schema

| A Word | B IPA | C Definition | D Example | E Collocations | F Status | G Created | H Translate |
|---|---|---|---|---|---|---|---|
| Approve | /əˈpruːv/ | … | … | … | Pending → Done | timestamp | (nhập tay) |

## Bảo mật

- Secret lưu trong Script Properties.
- Gemini key gửi qua header `x-goog-api-key`.
- Không commit `.clasp.json`.
- Nếu từng để key trong code hoặc chat, hãy **revoke** và tạo key mới.
