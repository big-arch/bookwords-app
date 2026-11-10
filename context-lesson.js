(function (root) {
  function create(word) {
    const term = String(word?.en || '').trim();
    const sentence = String(word?.example || '').trim();
    if (!term || !sentence || sentence.length > 2000) return null;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}_'’\\-])${escaped}(?![\\p{L}\\p{N}_'’\\-])`, 'giu');
    const matches = [...sentence.matchAll(pattern)];
    if (!matches.length) return null;
    const parts = []; let cursor = 0;
    for (const match of matches) {
      parts.push({text:sentence.slice(cursor, match.index), blank:false});
      parts.push({text:match[0], blank:true});
      cursor = match.index + match[0].length;
    }
    parts.push({text:sentence.slice(cursor), blank:false});
    // An isolated word is not a contextual exercise.
    if (!parts.some(part => !part.blank && /\p{L}/u.test(part.text))) return null;
    return {sentence, answer:term, parts};
  }
  const api = {create, eligible:words => words.filter(word => create(word))};
  if (typeof module !== 'undefined') module.exports = api;
  else root.BookWordsContext = api;
})(typeof window === 'undefined' ? globalThis : window);
