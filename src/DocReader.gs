/**
 * DocReader.gs — đọc Google Doc/.docx/.txt và chèn **...** quanh phần
 * in đậm / gạch chân / tô vàng. Các run liên tiếp cùng trạng thái được
 * gộp lại để tránh lỗi "**a****b**".
 */

function extractTextFromFile(file) {
  const mimeType = file.getMimeType();

  if (mimeType === MimeType.GOOGLE_DOCS) {
    return extractMarkedTextFromDoc(file.getId());
  }

  // .docx: convert tạm sang Google Docs (cần bật Advanced Drive Service: Drive API v3)
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    let convertedId = null;
    try {
      const converted = Drive.Files.create(
        { name: 'TEMP_CONVERT_' + file.getName(), mimeType: MimeType.GOOGLE_DOCS },
        file.getBlob()
      );
      convertedId = converted.id;
      return extractMarkedTextFromDoc(convertedId);
    } catch (e) {
      throw new Error("Không đọc được .docx '" + file.getName() + "'. Đã bật Drive API (Services) chưa? " + e);
    } finally {
      if (convertedId) Drive.Files.remove(convertedId);
    }
  }

  // .txt: không có định dạng, người dùng phải tự gõ ** quanh từ cần lấy
  if (mimeType === MimeType.PLAIN_TEXT) {
    return file.getBlob().getDataAsString();
  }

  Logger.log("File '" + file.getName() + "' có MimeType '" + mimeType + "' không được hỗ trợ. Bỏ qua.");
  return null;
}

function isHeadingParagraph(element) {
  try {
    if (typeof element.getHeading !== 'function') return false;
    return element.getHeading() !== DocumentApp.ParagraphHeading.NORMAL;
  } catch (e) {
    return false;
  }
}

function extractMarkedTextFromDoc(docId) {
  const body = DocumentApp.openById(docId).getBody();
  let output = '';

  function walk(element) {
    const type = element.getType();
    if (type === DocumentApp.ElementType.PARAGRAPH || type === DocumentApp.ElementType.LIST_ITEM) {
      // Heading tự động in đậm theo style -> lấy text thô, không bọc **
      output += (isHeadingParagraph(element) ? element.getText() : markElementText(element)) + '\n';
    } else if (type === DocumentApp.ElementType.TABLE) {
      const table = element.asTable();
      for (let r = 0; r < table.getNumRows(); r++) {
        for (let c = 0; c < table.getRow(r).getNumCells(); c++) walk(table.getRow(r).getCell(c));
      }
    } else if (element.getNumChildren) {
      for (let i = 0; i < element.getNumChildren(); i++) walk(element.getChild(i));
    }
  }

  walk(body);
  return output;
}

function markElementText(element) {
  let text;
  try {
    text = element.editAsText();
  } catch (e) {
    return '';
  }
  const fullText = text.getText();
  if (!fullText) return '';

  const indices = text.getTextAttributeIndices();
  let result = '';
  let buffer = '';
  let bufferMarked = false;
  let started = false;

  function flush() {
    if (!started) return;
    result += (bufferMarked && buffer.trim() !== '') ? '**' + buffer + '**' : buffer;
    buffer = '';
  }

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = (i + 1 < indices.length) ? indices[i + 1] : fullText.length;
    const segment = fullText.substring(start, end);
    const marked = !!(text.isBold(start) || isYellowish(text.getBackgroundColor(start)) || text.isUnderline(start));

    if (!started) {
      started = true;
      bufferMarked = marked;
      buffer = segment;
    } else if (marked === bufferMarked) {
      buffer += segment;
    } else {
      flush();
      bufferMarked = marked;
      buffer = segment;
    }
  }
  flush();
  return result;
}

function isYellowish(hex) {
  if (!hex) return false;
  hex = hex.replace('#', '');
  if (hex.length !== 6) return false;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return r > 180 && g > 160 && b < 140;
}
