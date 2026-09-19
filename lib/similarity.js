// 따라말하기 채점용 문자열 유사도 계산

/**
 * 채점 전 정규화.
 * - 대소문자 통일, 공백 제거
 * - 문장부호/기호만 제거하고 한글·영문·숫자 등 의미 있는 글자는 보존
 * - NFC 정규화로 한글 조합 차이를 흡수
 */
export function normalize(value) {
  const raw = value === 0 ? '0' : String(value || '');
  const nfc = typeof raw.normalize === 'function' ? raw.normalize('NFC') : raw;
  return nfc
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, '')
    .replace(/\s+/g, '')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }

  return prev[b.length];
}

export function similarityScore(target, said) {
  const a = normalize(target);
  const b = normalize(said);
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  const score = 1 - distance / Math.max(a.length, b.length);
  return Math.max(0, Math.round(score * 100));
}
