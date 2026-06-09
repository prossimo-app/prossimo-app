const exactWordScore = 100;
const wordPrefixScore = 80;
const substringScore = 60;
const maxSubsequenceScore = 40;
const subsequenceGapPenalty = 8;
const minSubsequenceScore = 10;
const minSubsequenceQueryLength = 3;
const typoToleranceScore = 20;
const minTypoToleranceQueryLength = 4;

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Scores how well a query fuzzily matches a text. Returns 0 when the query
 * does not match. Every whitespace-separated query token must match at least
 * one word in the text (exactly, as a prefix, as a substring, or as an
 * in-order character subsequence with a small typo tolerance).
 */
export function getFuzzyMatchScore(query: string, text: string) {
  const queryTokens = normalizeSearchText(query)
    .split(/\s+/)
    .filter(Boolean);

  if (queryTokens.length === 0) {
    return 0;
  }

  const words = normalizeSearchText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

  if (words.length === 0) {
    return 0;
  }

  let totalScore = 0;

  for (const token of queryTokens) {
    let bestScore = 0;

    for (const word of words) {
      const score = scoreToken(token, word);

      if (score > bestScore) {
        bestScore = score;
      }

      if (bestScore === exactWordScore) {
        break;
      }
    }

    if (bestScore === 0) {
      return 0;
    }

    totalScore += bestScore;
  }

  return totalScore;
}

function scoreToken(token: string, word: string) {
  if (word === token) {
    return exactWordScore;
  }

  if (word.startsWith(token)) {
    return wordPrefixScore;
  }

  if (word.includes(token)) {
    return substringScore;
  }

  const subsequenceScore = scoreSubsequence(token, word);

  if (subsequenceScore > 0) {
    return subsequenceScore;
  }

  // Tolerate a single mistyped or extra character by retrying the
  // subsequence match with one character of the token removed.
  if (token.length >= minTypoToleranceQueryLength) {
    for (let index = 0; index < token.length; index += 1) {
      const reducedToken = token.slice(0, index) + token.slice(index + 1);

      if (scoreSubsequence(reducedToken, word) > 0) {
        return typoToleranceScore;
      }
    }
  }

  return 0;
}

function scoreSubsequence(token: string, word: string) {
  if (token.length < minSubsequenceQueryLength || token.length > word.length) {
    return 0;
  }

  let gaps = 0;
  let previousIndex = -1;

  for (const character of token) {
    const index = word.indexOf(character, previousIndex + 1);

    if (index === -1) {
      return 0;
    }

    if (previousIndex !== -1) {
      gaps += index - previousIndex - 1;
    }

    previousIndex = index;
  }

  return Math.max(
    maxSubsequenceScore - gaps * subsequenceGapPenalty,
    minSubsequenceScore,
  );
}
