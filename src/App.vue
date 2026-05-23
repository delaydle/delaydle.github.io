<template>
  <div class="game-container">
    <header class="game-header">
      <h1>Delaydle</h1>
      <p class="subtitle">A delayed Wordle game - feedback on your last guess appears when you guess again!</p>
    </header>

    <!-- Game state messages -->
    <div v-if="gameState.won" class="message win-message">
      🎉 You won! The word was <strong>{{ gameState.targetWord.toUpperCase() }}</strong>
    </div>
    <div v-if="gameState.gameOver && !gameState.won" class="message lose-message">
      😢 Game over! The word was <strong>{{ gameState.targetWord.toUpperCase() }}</strong>
    </div>

    <!-- Game board -->
    <div class="game-board">
      <!-- Submitted guesses with their feedback -->
      <div v-for="(guess, index) in gameState.guesses" :key="index" class="guess-row">
        <div
          v-for="(letter, letterIndex) in guess.word"
          :key="letterIndex"
          :class="[
            'tile',
            guess.revealed ? `tile-${guess.feedback[letterIndex]}` : 'tile-empty'
          ]"
        >
          {{ letter.toUpperCase() }}
        </div>
      </div>

      <!-- Current guess (no feedback yet) -->
      <div v-if="!gameState.gameOver" class="guess-row current-guess">
        <div
          v-for="(letter, index) in currentGuessDisplay"
          :key="index"
          :class="['tile', { 'tile-empty': !letter }]"
        >
          {{ letter.toUpperCase() }}
        </div>
      </div>

      <!-- Empty rows -->
      <div v-for="i in emptyRowsCount" :key="`empty-${i}`" class="guess-row">
        <div v-for="j in 5" :key="j" class="tile tile-empty"></div>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats">
      <div>Guesses used: {{ gameState.guesses.length }} / 7</div>
    </div>

    <!-- Input area -->
    <div v-if="!gameState.gameOver" class="input-area">
      <input
        v-model="currentGuess"
        @keydown.enter="submitGuess"
        type="text"
        maxlength="5"
        placeholder="Type a 5-letter word"
        class="guess-input"
        :disabled="loadingWords"
      />
      <button @click="submitGuess" :disabled="!canSubmit" class="submit-button">
        Guess
      </button>
    </div>

    <!-- Keyboard hint -->
    <div class="keyboard-hint">
      <p>Press Enter or click Guess to submit a word</p>
    </div>

    <!-- Status message -->
    <div v-if="statusMessage" :class="['status-message', statusMessageType]">
      {{ statusMessage }}
    </div>

    <!-- New game button -->
    <button v-if="gameState.gameOver" @click="resetGame" class="new-game-button">
      Play Again
    </button>

    <!-- Onscreen Keyboard -->
    <div v-if="!gameState.gameOver" class="keyboard-container">
      <div v-for="row in keyboardRows" :key="row.join('')" class="keyboard-row">
        <button
          v-for="letter in row"
          :key="letter"
          @click="addLetterFromKeyboard(letter)"
          :disabled="currentGuess.length >= 5 || loadingWords"
          :class="['key', `key-${letterStatuses[letter]}`]"
        >
          {{ letter }}
        </button>
      </div>
    </div>

    <!-- Loading indicator -->
    <div v-if="loadingWords" class="loading">Loading word lists...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  calculateFeedback,
  loadWords,
  getRandomWord,
  isValidWord,
  checkWin,
  checkLose,
  type GameState,
  type GuessResult,
  type LetterStatus,
} from './utils/gameLogic';

// Game state
const gameState = ref<GameState>({
  targetWord: '',
  guesses: [],
  gameOver: false,
  won: false,
});

// UI state
const currentGuess = ref('');
const allWords = ref<string[]>([]);
const validGuesses = ref<string[]>([]);
const loadingWords = ref(true);
const statusMessage = ref('');
const statusMessageType = ref<'error' | 'success' | 'info'>('info');

// Keyboard layout
const keyboardRows = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

// Computed properties
const currentGuessDisplay = computed(() => {
  return currentGuess.value.padEnd(5, ' ').split('').slice(0, 5);
});

const emptyRowsCount = computed(() => {
  return Math.max(0, 7 - gameState.value.guesses.length - (gameState.value.gameOver ? 0 : 1));
});

const canSubmit = computed(() => {
  return (
    currentGuess.value.length === 5 &&
    !gameState.value.gameOver &&
    isValidWord(currentGuess.value, validGuesses.value)
  );
});

// Track letter statuses based on revealed guesses
const letterStatuses = computed(() => {
  const statuses: Record<string, LetterStatus> = {};
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Initialize all letters as empty
  for (const letter of letters) {
    statuses[letter] = 'empty';
  }

  // Update based on revealed guesses
  for (const guess of gameState.value.guesses) {
    if (guess.revealed) {
      for (let i = 0; i < guess.word.length; i++) {
        const letter = guess.word[i].toUpperCase();
        const feedback = guess.feedback[i];

        // Only update if the new status is "better" than the current one
        // Priority: correct > wrong-position > wrong > empty
        const statusPriority: Record<LetterStatus, number> = {
          'correct': 3,
          'wrong-position': 2,
          'wrong': 1,
          'empty': 0,
        };

        if (statusPriority[feedback] > statusPriority[statuses[letter]]) {
          statuses[letter] = feedback;
        }
      }
    }
  }

  return statuses;
});

// Methods
const submitGuess = async () => {
  if (!canSubmit.value) {
    if (currentGuess.value.length !== 5) {
      showStatus('Word must be 5 letters', 'error');
    } else if (!isValidWord(currentGuess.value, validGuesses.value)) {
      showStatus('Word not in dictionary', 'error');
    }
    return;
  }

  const guess = currentGuess.value.toLowerCase();
  const feedback = calculateFeedback(guess, gameState.value.targetWord);

  // Reveal the previous guess (if exists)
  if (gameState.value.guesses.length > 0) {
    gameState.value.guesses[gameState.value.guesses.length - 1].revealed = true;
  }

  // Check if this guess is correct (winning guess)
  const isWinningGuess = feedback.every(status => status === 'correct');

  // Add new guess - reveal immediately if it's a winning guess
  gameState.value.guesses.push({
    word: guess,
    feedback,
    revealed: isWinningGuess, // Reveal immediately if correct
  });

  // Check win condition
  if (isWinningGuess) {
    gameState.value.gameOver = true;
    gameState.value.won = true;
    showStatus('Correct! You won!', 'success');
  }

  // Check lose condition
  if (checkLose(gameState.value.guesses)) {
    gameState.value.gameOver = true;
    gameState.value.won = false;
    showStatus('Out of guesses!', 'error');
    // Reveal the last guess when game ends
    if (gameState.value.guesses.length > 0) {
      gameState.value.guesses[gameState.value.guesses.length - 1].revealed = true;
    }
  }

  currentGuess.value = '';
};

const addLetterFromKeyboard = (letter: string) => {
  if (currentGuess.value.length < 5 && !gameState.value.gameOver) {
    currentGuess.value += letter.toLowerCase();
  }
};

const showStatus = (message: string, type: 'error' | 'success' | 'info') => {
  statusMessage.value = message;
  statusMessageType.value = type;
  setTimeout(() => {
    statusMessage.value = '';
  }, 3000);
};

const resetGame = async () => {
  gameState.value.targetWord = getRandomWord(allWords.value);
  gameState.value.guesses = [];
  gameState.value.gameOver = false;
  gameState.value.won = false;
  currentGuess.value = '';
  statusMessage.value = '';
};

// Lifecycle
onMounted(async () => {
  try {
    const [words, guesses] = await Promise.all([
      loadWords('/WordLists/Words.txt'),
      loadWords('/WordLists/Guesses.txt'),
    ]);

    allWords.value = words;
    validGuesses.value = [...words, ...guesses];

    if (words.length > 0) {
      gameState.value.targetWord = getRandomWord(words);
    }

    loadingWords.value = false;
  } catch (error) {
    console.error('Failed to load words:', error);
    showStatus('Error loading word lists', 'error');
    loadingWords.value = false;
  }
});
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu',
    'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
}

.game-header {
  text-align: center;
  color: white;
  margin-bottom: 30px;
}

.game-header h1 {
  font-size: 3rem;
  margin: 0 0 10px 0;
  font-weight: 900;
  letter-spacing: 2px;
}

.subtitle {
  font-size: 0.95rem;
  margin: 0;
  opacity: 0.9;
  max-width: 500px;
}

.message {
  padding: 15px 20px;
  border-radius: 10px;
  margin-bottom: 20px;
  font-size: 1.1rem;
  font-weight: 500;
  text-align: center;
  animation: slideDown 0.3s ease-out;
}

.win-message {
  background-color: #10b981;
  color: white;
}

.lose-message {
  background-color: #ef4444;
  color: white;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.game-board {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 30px;
  background: rgba(255, 255, 255, 0.1);
  padding: 20px;
  border-radius: 15px;
  backdrop-filter: blur(10px);
}

.guess-row {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.tile {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 700;
  border-radius: 8px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  transition: all 0.3s ease;
  animation: popIn 0.3s ease;
}

@keyframes popIn {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.tile-empty {
  background-color: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.tile-correct {
  background-color: #10b981;
  border-color: #059669;
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.5);
}

.tile-wrong-position {
  background-color: #f59e0b;
  border-color: #d97706;
  box-shadow: 0 0 15px rgba(245, 158, 11, 0.5);
}

.tile-wrong {
  background-color: #6b7280;
  border-color: #4b5563;
  opacity: 0.7;
}

.current-guess .tile {
  animation: none;
  border-color: rgba(255, 255, 255, 0.5);
  background-color: rgba(255, 255, 255, 0.15);
}

.stats {
  color: white;
  font-size: 1rem;
  margin-bottom: 20px;
  font-weight: 500;
}

.input-area {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.guess-input {
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  width: 200px;
  text-transform: uppercase;
  letter-spacing: 2px;
  font-weight: 600;
  background: white;
  color: #333;
  transition: all 0.3s ease;
}

.guess-input:focus {
  outline: none;
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
}

.guess-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.submit-button {
  padding: 12px 24px;
  background-color: white;
  color: #667eea;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.submit-button:hover:not(:disabled) {
  background-color: #f0f0f0;
  transform: scale(1.05);
}

.submit-button:active:not(:disabled) {
  transform: scale(0.95);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.keyboard-hint {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  text-align: center;
  margin-bottom: 15px;
}

.keyboard-hint p {
  margin: 0;
}

.status-message {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  margin-bottom: 15px;
  animation: slideDown 0.3s ease-out;
}

.status-message.error {
  background-color: #ef4444;
  color: white;
}

.status-message.success {
  background-color: #10b981;
  color: white;
}

.status-message.info {
  background-color: #3b82f6;
  color: white;
}

.new-game-button {
  padding: 12px 32px;
  background-color: white;
  color: #667eea;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.new-game-button:hover {
  background-color: #f0f0f0;
  transform: scale(1.05);
}

.new-game-button:active {
  transform: scale(0.95);
}

.loading {
  color: white;
  font-size: 1.1rem;
  font-weight: 500;
}

.keyboard-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 15px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  margin-bottom: 20px;
  width: 100%;
  max-width: 600px;
}

.keyboard-row {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
}

.key {
  padding: 10px 8px;
  min-width: 40px;
  height: 40px;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  color: white;
  background-color: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.key:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.key:active:not(:disabled) {
  transform: translateY(0);
}

.key:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.key-correct {
  background-color: #10b981;
  border-color: #059669;
  color: white;
}

.key-wrong-position {
  background-color: #f59e0b;
  border-color: #d97706;
  color: white;
}

.key-wrong {
  background-color: #6b7280;
  border-color: #4b5563;
  color: white;
  opacity: 0.7;
}

.key-empty {
  background-color: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  color: white;
}

@media (max-width: 600px) {
  .game-header h1 {
    font-size: 2rem;
  }

  .tile {
    width: 40px;
    height: 40px;
    font-size: 1rem;
    border-width: 2px;
  }

  .guess-input {
    width: 150px;
  }

  .input-area {
    flex-direction: column;
    width: 100%;
    max-width: 300px;
  }

  .guess-input,
  .submit-button {
    width: 100%;
  }

  .keyboard-container {
    max-width: 100%;
    padding: 12px;
  }

  .key {
    padding: 8px 6px;
    min-width: 32px;
    height: 36px;
    font-size: 0.75rem;
  }
}
</style>
