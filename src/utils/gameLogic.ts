export type LetterStatus = 'correct' | 'wrong-position' | 'wrong' | 'empty';

export interface GuessResult {
  word: string;
  feedback: LetterStatus[];
  revealed: boolean; // Only show feedback after next guess is submitted
}

export interface GameState {
  targetWord: string;
  guesses: GuessResult[];
  gameOver: boolean;
  won: boolean;
}

export const maxAttempts = 7;

/**
 * Calculate feedback for a guess against the target word
 * Following Wordle rules with letter frequency handling
 */
export function calculateFeedback(guess: string, target: string): LetterStatus[] {
  const result: LetterStatus[] = Array(guess.length).fill('wrong');
  const targetLetters = target.split('');

  // First pass: mark correct positions
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === target[i]) {
      result[i] = 'correct';
      targetLetters[i] = ''; // Mark as used
    }
  }

  // Second pass: mark wrong positions
  for (let i = 0; i < guess.length; i++) {
    if (result[i] !== 'correct') {
      const letterIndex = targetLetters.indexOf(guess[i]);
      if (letterIndex !== -1) {
        result[i] = 'wrong-position';
        targetLetters[letterIndex] = ''; // Mark as used
      }
    }
  }

  return result;
}

/**
 * Load words from a text file (one word per line)
 */
export async function loadWords(filePath: string): Promise<string[]> {
  try {
    const response = await fetch(filePath);
    const text = await response.text();
    return text
      .split('\n')
      .map(word => word.trim().toLowerCase())
      .filter(word => word.length > 0 && word.length === 5);
  } catch (error) {
    console.error('Error loading words:', error);
    return [];
  }
}

/**
 * Get a random word from the list (seeded by date for daily word)
 */
export function getRandomWord(words: string[]): string {
  if (words.length === 0) {
    return 'error';
  }

  // Use date-based seed for daily word
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Simple hash function for better distribution across any word list size
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return words[Math.abs(hash) % words.length];
}

/**
 * Check if a word is valid (in word list)
 */
export function isValidWord(word: string, validWords: string[]): boolean {
  return validWords.includes(word.toLowerCase());
}

/**
 * Check if the game is won
 */
export function checkWin(guesses: GuessResult[]): boolean {
  if (guesses.length === 0) return false;
  const lastGuess = guesses[guesses.length - 1];
  return lastGuess.feedback.every(status => status === 'correct');
}

/**
 * Check if the game is lost
 */
export function checkLose(guesses: GuessResult[], maxAttempts: number): boolean {
  return guesses.length >= maxAttempts && !checkWin(guesses);
}
