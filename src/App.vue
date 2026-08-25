<template>
  <div class="header">
    <font-awesome-icon 
      icon="circle-info" 
      @click="infoShowing = !infoShowing"
    />
    <font-awesome-icon 
      icon="sack-dollar" 
      @click="supportShowing = !supportShowing"
    />
  </div>
  <div class="game-container" @keydown="handleKeydown" tabindex="0">
    <input
      ref="hiddenInput"
      type="text"
      style="position: absolute; left: -9999px; opacity: 0;"
    />
    <header class="game-header">
      <h1>Delaydle</h1>
    </header>

    <!-- Game board -->
    <div class="game-board">
      <!-- Submitted guesses with their feedback -->
      <div v-for="(guess, index) in gameState.guesses" :key="index" class="guess-row">
        <div
          v-for="(letter, letterIndex) in guess.word"
          :key="letterIndex"
          class="tile"
        >
          <div
          class="tile-card"
          :style="{
              animationName: guess.revealed ? 'tileFlip' : 'none',
              animationDuration: '0.35s',
              animationTimingFunction: 'ease-in-out',
              animationDelay: `${letterIndex * 0.3}s`,
              animationFillMode: 'forwards'
          }">
            <div class="front">
              {{ letter.toUpperCase() }}
            </div>
            <div :class="[
              'back',
              guess.revealed ? `tile-${guess.feedback[letterIndex]}` : 'tile-empty'
          ]">
              {{ letter.toUpperCase() }}
            </div>
          </div>
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
      <div class="keyboard-row">
        <button
          @click="submitGuess"
          :disabled="currentGuess.length !== 5 || !canSubmit || loadingWords"
          class="key key-action"
        >
          Enter
        </button>
        <button
          @click="removeLastLetter"
          :disabled="currentGuess.length === 0 || loadingWords"
          class="key key-action"
        >
          Backspace
        </button>
      </div>
    </div>

    <!-- Loading indicator -->
    <div v-if="loadingWords" class="loading">Loading word lists...</div>
    <div v-if="infoShowing" class="message info-message">
      <div class="message-header">
        <font-awesome-icon 
          icon="xmark" 
          @click="infoShowing = !infoShowing"
        />
      </div>
      <div class="message-body">
        <h2>How to Play Delaydle</h2>

        <p>
          Delaydle is a twist on the classic word guessing game. Your goal is to find the
          hidden 5-letter word in 7 guesses, but there's a catch:
          <strong>feedback is delayed by one guess.</strong>
        </p>

        <h3>The Delay</h3>

        <p>
          When you submit a guess, you won't immediately see how accurate it was.
          Instead, the result for each guess is revealed <strong>after your next guess</strong>.
        </p>

        <p>
          For example:
        </p>

        <ol>
          <li>Enter your first guess — no feedback is shown yet.</li>
          <li>Enter your second guess — feedback for your first guess is revealed.</li>
          <li>Enter your third guess — feedback for your second guess is revealed.</li>
          <li>Continue until you find the word or run out of guesses.</li>
        </ol>

        <h3>Tile Colors</h3>

        <ul>
          <li>
            <strong>Green</strong> — The letter is in the correct position.
          </li>
          <li>
            <strong>Yellow</strong> — The letter is in the word, but in a different position.
          </li>
          <li>
            <strong>Gray</strong> — The letter is not in the word.
          </li>
        </ul>

        <h3>Entering Guesses</h3>

        <p>
          You can type using the on-screen keyboard or your device's keyboard.
          Press <strong>Enter</strong> to submit a guess and <strong>Backspace</strong>
          to remove letters.
        </p>

        <h3>Tips</h3>

        <ul>
          <li>Remember that feedback is always one guess behind.</li>
          <li>Plan ahead—you'll need to make each guess without knowing the result of your most recent one.</li>
          <li>Keep track of revealed information to narrow down the answer.</li>
        </ul>

        <p>
          Good luck, and see if you can master the delay!
        </p>
      </div>
    </div>
    <div v-if="supportShowing" class="message support-message">
      <div class="message-header">
        <font-awesome-icon 
          icon="xmark" 
          @click="supportShowing = !supportShowing"
        />
      </div>
      <div class="message-body">
        <h2>Support Delaydle</h2>
        <p>I am actively working on improving Delaydle and more features are on the way!</p>
        <p>
          I would love to be able to add more complex features to Delayble, such as:
        </p>
        <ul>
          <li>User profiles</li>
          <li>Record tracking</li>
          <li>Completion statistics</li>
        </ul>
        <p>
          This would require a back end server though which would incur non trivial hosting costs. If you enjoy playing and would like to see these features implemented, please consider supporting the project! Even a small one off donation is really helpful and greatly appreciated.
        </p>
        <p>
          <a href="https://buymeacoffee.com/delaydle" target="_blank" rel="noopener noreferrer">
            Donate to Delaydle
          </a>
        </p>
        <p>
          Thanks for playing
        </p>
      </div>
    </div>
    <!-- Result modal -->
    <div
      v-if="resultShowing"
      class="modal-backdrop"
      @click="resultShowing = false"
    ></div>
    <div
      v-if="resultShowing"
      :class="['message', 'result-message', gameState.won ? 'result-win' : 'result-lose']"
    >
      <div class="message-header">
        <font-awesome-icon
          icon="xmark"
          @click="resultShowing = false"
        />
      </div>
      <div class="message-body">
        <h2>{{ gameState.won ? '🎉 You won!' : '😢 Game over' }}</h2>
        <p class="result-word">
          The word was <strong>{{ gameState.targetWord.toUpperCase() }}</strong>
        </p>
        <p v-if="gameState.won" class="result-detail">
          Solved in {{ gameState.guesses.length }} of {{ maxAttempts }} guesses.
        </p>
      </div>
    </div>
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
  maxAttempts,
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
const hiddenInput = ref<HTMLInputElement>();
const currentGuess = ref('');
const allWords = ref<string[]>([]);
const validGuesses = ref<string[]>([]);
const loadingWords = ref(true);
const infoShowing = ref(false);
const supportShowing = ref(false);
const resultShowing = ref(false);
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
  return Math.max(0, maxAttempts - gameState.value.guesses.length - (gameState.value.gameOver ? 0 : 1));
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

  // Initialize all letters as empty
  for (const letter of keyboardRows.flat()) {
    statuses[letter] = 'empty';
  }

  // Update based on revealed guesses
  for (const guess of gameState.value.guesses) {
    if (guess.revealed) {
      for (let i = 0; i < guess.word.length; i++) {
        const letter = guess.word[i].toUpperCase();
        const feedback = guess.feedback[i];

        if (feedback == 'wrong-position' && statuses[letter] === 'correct') {
          continue; 
        }
        
        statuses[letter] = feedback;        
      }
    }
  }

  return statuses;
});

// Methods
// One row's flip animation: the last tile starts at 4 * 0.3s of stagger and
// runs for 0.35s (see the animation bindings on .tile-card), plus a short beat.
const rowFlipMs = 1600;

const submitGuess = async () => {
  if (!canSubmit.value) {
    return;
  }

  const guess = currentGuess.value.toLowerCase();
  const feedback = calculateFeedback(guess, gameState.value.targetWord);

  // The delayed feedback: submitting reveals the *previous* guess.
  const previousIndex = gameState.value.guesses.length - 1;
  if (previousIndex >= 0) {
    gameState.value.guesses[previousIndex].revealed = true;
  }

  const isWinningGuess = feedback.every(status => status === 'correct');

  gameState.value.guesses.push({
    word: guess,
    feedback,
    revealed: false
  });

  if (isWinningGuess) {
    gameState.value.gameOver = true;
    gameState.value.won = true;
  }

  // Check lose condition
  if (checkLose(gameState.value.guesses, maxAttempts)) {
    gameState.value.gameOver = true;
    gameState.value.won = false;
  }

  currentGuess.value = '';

  // Ending the game reveals two rows: the previous guess and the final one.
  // Chain them so the final row only starts flipping once the previous row
  // has finished, then let that settle before covering the board.
  if (gameState.value.gameOver) {
    const finalIndex = gameState.value.guesses.length - 1;
    const finalRevealDelay = previousIndex >= 0 ? rowFlipMs : 0;

    setTimeout(() => {
      gameState.value.guesses[finalIndex].revealed = true;

      setTimeout(() => {
        resultShowing.value = true;
      }, rowFlipMs);
    }, finalRevealDelay);
  }
};

const addLetterFromKeyboard = (letter: string) => {
  if (currentGuess.value.length < 5 && !gameState.value.gameOver) {
    currentGuess.value += letter.toLowerCase();
  }
};

const removeLastLetter = () => {
  if (currentGuess.value.length > 0) {
    currentGuess.value = currentGuess.value.slice(0, -1);
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (gameState.value.gameOver) return;
  
  const key = event.key;
  
  if (key === 'Enter') {
    event.preventDefault();
    submitGuess();
  } else if (key === 'Backspace') {
    event.preventDefault();
    removeLastLetter();
  } else {
    const upperKey = key.toUpperCase();
    const isLetter = /^[A-Z]$/.test(upperKey);
    
    if (isLetter && currentGuess.value.length < 5) {
      currentGuess.value += upperKey.toLowerCase();
    }
  }
};

onMounted(async () => {
  try {
    const [words, guesses] = await Promise.all([
      loadWords('/WordLists/Words.txt'),
      loadWords('/WordLists/Guesses.txt'),
    ]);

    allWords.value = words;
    validGuesses.value = [...words, ...guesses];

    gameState.value.targetWord = getRandomWord(words);
    
    loadingWords.value = false;
    
    // Focus the game container so it can receive keyboard events
    setTimeout(() => {
      const gameContainer = document.querySelector('.game-container') as HTMLElement;
      gameContainer?.focus();
    }, 0);
  } catch (error) {
    console.error('Failed to load words:', error);
    loadingWords.value = false;
  }
});
</script>

<style scoped>
.header {
  position: fixed;
  top: 0px;
  left: 50%;
  transform: translateX(-50%);
  width:100%;
  padding: 14px 28px;
  background: rgba(256, 256, 256, 0.1);
  color: white;
  z-index: 1000;
  text-align: right;
}

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
  perspective: 1000px;
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
  perspective: 1000px;

  .tile-card {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;

    .front,
    .back {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      backface-visibility: hidden;
      border-radius: 5px;
      box-sizing: border-box;
    }

    .back {
      transform: rotateY(180deg);
    }
  }
}

.tile-empty{
  background-color: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.tile-correct {
  background-color: #10b981;
  border-color: #059669;
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.5);
}

.tile-wrong-position {
  background-color: #fbbf24;
  border-color: #d97706;
  box-shadow: 0 0 15px rgba(251, 191, 36, 0.5);
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
  background-color: #fbbf24;
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

.key-action {
  background-color: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  color: white;
  padding: 10px 12px;
  min-width: 60px;
}

.message {
  .message-header {
    text-align: right;
    color: red;
  }

  .message-body{
    overflow-y: auto;
    max-height: 80vh;
  }

  h2 {
      margin-bottom: 20px;
  }

  h3 {
      margin-top: 24px;
      margin-bottom: 10px;
  }

  p {
      margin-bottom: 16px;
  }

  ol,
  ul {
      margin: 16px 0;
      padding-left: 24px;
  }

  li {
      margin-bottom: 8px;
  }

  text-align: left;
  padding: 20px;
  line-height: 1.6;
  border-radius: 12px;
  background-color: rgba(255, 255, 255, 1);
  color: black;
  max-width: 70vw;
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  max-height: 90vh;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 1500;
}

.result-message {
  z-index: 1600;
  text-align: center;
  min-width: 280px;
  max-width: min(90vw, 420px);
}

.result-message .message-body {
  text-align: center;
  overflow-y: visible;
}

.result-message h2 {
  margin-bottom: 12px;
}

.result-win h2 {
  color: #10b981;
}

.result-lose h2 {
  color: #ef4444;
}

.result-word {
  font-size: 1.15rem;
}

.result-word strong {
  letter-spacing: 0.12em;
}

.result-detail {
  opacity: 0.7;
  font-size: 0.95rem;
  margin-bottom: 0;
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

  .message {
    width: 90vw;
    max-width: none;
  }
}
</style>

<style>
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

@keyframes tileFlip {
  from {
    transform: rotateY(0deg);
  }
  to {
    transform: rotateY(180deg);
  }
}
</style>
