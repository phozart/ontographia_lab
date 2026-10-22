# How to copy and export a doc (and copy a table)

## Copy a doc with formatting (Outlook, Word, Google Docs)

1. Open the doc (double-click the card, or select it and press Enter).
2. Click **Copy** in the panel header, or press **Cmd/Ctrl+Shift+C** while the panel is focused. You can also right-click the card and choose **Copy with formatting**.
3. Paste into the mail or document. Headings, lists, tables, code and links keep their formatting. Links to board elements become full lab links that open the board and focus that element.

Pasting into a plain-text field gives readable text: headings as plain lines, "- " bullets, links as `text (url)`, tables as tab separated rows. It is not raw Markdown. If the browser blocks formatted copy, you get plain text and a message says so.

Normal Cmd/Ctrl+C inside the editor still copies the selected Markdown.

## Export a file

In the doc panel header (or the card's right-click menu): **.docx** (Word), **.pdf**, **.md** (Markdown). The file is named after the doc title. Read-only viewers can export too.

- **.docx** keeps headings, nested bullet and numbered lists, bold / italic / code, code blocks, quotes, tables and clickable links.
- **.pdf** is A4 with the same structure and clickable links. It uses built-in fonts, so only Latin-1 text and common punctuation print; other scripts (Chinese, Cyrillic, emoji) show as `?`. Use .docx for those.

## Copy a table

Right-click the table and choose **Copy table with formatting** (or use the table's ⋯ menu, **Copy table (formatted)**). Paste into Excel or Google Sheets for cells, or into Word or Outlook for a bordered table. Text that a spreadsheet would read as a formula (starting with `=`, `+`, `-` or `@`) is pasted with a leading `'` so it is not evaluated.

## Scrolling a long doc

The editor and the preview scroll inside the side panel. On the board, put the pointer over a card's text and scroll: if the text is longer than the card, the card scrolls (a bar at the bottom fades while there is more); otherwise the canvas pans as usual. Cmd/Ctrl+scroll always zooms the canvas.
