/**
 * Build file context around cursor position
 * @param {string} content - Full file content
 * @param {object} cursor - Cursor position {line: number}
 * @param {number} contextLines - Number of lines before/after (default: 50)
 * @returns {string} Context snippet
 */
export function buildFileContext(content, cursor, contextLines = 50) {
  if (!content || typeof content !== "string") {
    console.warn("⚠️  Invalid content provided to buildFileContext");
    return "";
  }
  
  const lines = content.split("\n");
  const cursorLine = Math.max(0, parseInt(cursor.line) || 0);
  
  const start = Math.max(cursorLine - contextLines, 0);
  const end = Math.min(cursorLine + contextLines, lines.length);
  
  const context = lines.slice(start, end);
  
  // Add line numbers for better context
  const numberedContext = context
    .map((line, idx) => `${start + idx + 1}: ${line}`)
    .join("\n");
  
  return numberedContext;
}
