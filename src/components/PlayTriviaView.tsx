import React, { useState } from 'react';
import { BlooketTokenIcon, BlookArt } from './BlookArt';
import { CIRCUS_BLOOKS } from '../data/blooks';

export interface TriviaQuestion {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  category: string;
}

export const DEFAULT_TRIVIA_QUESTIONS: TriviaQuestion[] = [
  {
    id: 'q1',
    question: 'How many tokens does the Circus Pack cost in the Clicket Market?',
    options: ['15 Tokens', '20 Tokens', '25 Tokens', '50 Tokens'],
    correctIndex: 1,
    category: 'Circus Pack',
  },
  {
    id: 'q2',
    question: 'Which Blook in the Circus Pack has a Mystic rarity with a 0.002% drop chance?',
    options: ['Ring Lion', 'Circus Elephant', 'The Golden Ticket', 'Fire Guy'],
    correctIndex: 2,
    category: 'Circus Pack',
  },
  {
    id: 'q3',
    question: 'What is the drop rate percentage for the Legendary "Circus Ball" Blook?',
    options: ['0.3%', '3%', '0.05%', '8%'],
    correctIndex: 0,
    category: 'Circus Pack',
  },
  {
    id: 'q4',
    question: 'Which of these Circus Pack Blooks is an Epic (3% chance)?',
    options: ['Popcorn', 'Magic Wand', 'Unicycler', 'Top Hat'],
    correctIndex: 1,
    category: 'Circus Pack',
  },
  {
    id: 'q5',
    question: 'Under the big top, what do tightrope walkers often carry to help maintain balance?',
    options: ['A Heavy Anvil', 'A Long Balancing Pole', 'A Pair of Bowling Balls', 'A Glass of Water'],
    correctIndex: 1,
    category: 'Circus Trivia',
  },
  {
    id: 'q6',
    question: 'Which three Chroma Blooks can be unlocked in the Circus Pack?',
    options: [
      'Circus Elephant, Ring Lion, Fire Guy',
      'Jester, Magician, Tightrope Walker',
      'Magic Wand, Tent, Circus Ball',
      'Cotton Candy, Popcorn, Canon Ball',
    ],
    correctIndex: 0,
    category: 'Circus Pack',
  },
  {
    id: 'q7',
    question: 'What is the traditional name for the master of ceremonies who introduces circus acts?',
    options: ['The Jester', 'The Ringmaster', 'The Acrobat', 'The Juggler'],
    correctIndex: 1,
    category: 'Circus Trivia',
  },
  {
    id: 'q8',
    question: 'What is the drop chance of each Uncommon Blook in the Circus Pack?',
    options: ['8%', '12%', '17%', '25%'],
    correctIndex: 2,
    category: 'Circus Pack',
  },
];

interface PlayTriviaModalProps {
  questions: TriviaQuestion[];
  onEarnTokens: (amount: number) => void;
  onExit: () => void;
}

export const PlayTriviaView: React.FC<PlayTriviaModalProps> = ({
  questions,
  onEarnTokens,
  onExit,
}) => {
  const [gameState, setGameState] = useState<'LOBBY' | 'QUESTION' | 'FEEDBACK' | 'CHEST' | 'SUMMARY'>('LOBBY');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [streak, setStreak] = useState(0);
  const [sessionTokens, setSessionTokens] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [chestChoices, setChestChoices] = useState<{ label: string; delta: number }[]>([]);
  const [chosenChestIdx, setChosenChestIdx] = useState<number | null>(null);

  const currentQ = questions[currentIdx % questions.length];

  const startGame = () => {
    setCurrentIdx(0);
    setStreak(0);
    setSessionTokens(0);
    setCorrectCount(0);
    setGameState('QUESTION');
  };

  const handleSelectOption = (idx: number) => {
    setSelectedOption(idx);
    const correct = idx === currentQ.correctIndex;
    setIsCorrect(correct);

    if (correct) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setCorrectCount((c) => c + 1);
      const earned = 15 + newStreak * 5;
      setSessionTokens((t) => t + earned);
      onEarnTokens(earned);
    } else {
      setStreak(0);
    }

    setGameState('FEEDBACK');
  };

  const generateChests = () => {
    const pool = [
      { label: '+20 Tokens!', delta: 20 },
      { label: '+40 Tokens!', delta: 40 },
      { label: 'Double Streak Bonus (+60 Tokens)!', delta: 60 },
    ].sort(() => Math.random() - 0.5);
    setChestChoices(pool);
    setChosenChestIdx(null);
    setGameState('CHEST');
  };

  const handlePickChest = (idx: number) => {
    if (chosenChestIdx !== null) return;
    setChosenChestIdx(idx);
    const reward = chestChoices[idx].delta;
    setSessionTokens((t) => t + reward);
    onEarnTokens(reward);
  };

  const handleNext = () => {
    if (gameState === 'FEEDBACK' && isCorrect) {
      generateChests();
      return;
    }

    if (currentIdx + 1 >= questions.length) {
      setGameState('SUMMARY');
    } else {
      setCurrentIdx((i) => i + 1);
      setSelectedOption(null);
      setGameState('QUESTION');
    }
  };

  const optionColors = [
    'bg-[#f59e0b] shadow-[0_6px_0_#b45309] hover:brightness-105',
    'bg-[#3b82f6] shadow-[0_6px_0_#1d4ed8] hover:brightness-105',
    'bg-[#10b981] shadow-[0_6px_0_#047857] hover:brightness-105',
    'bg-[#ef4444] shadow-[0_6px_0_#b91c1c] hover:brightness-105',
  ];

  return (
    <div className="h-full w-full flex flex-col p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="font-titan text-white text-4xl tracking-wide drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]">
            Circus Gold Quest
          </h1>
          <span className="text-white/90 font-nunito font-extrabold text-sm">
            Earn Tokens for the Circus Pack!
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#dc2626] border-2 border-[#b91c1c] px-4 py-1.5 rounded-xl text-white font-nunito font-black text-lg shadow-md">
            <BlooketTokenIcon className="w-6 h-6" />
            <span>+{sessionTokens} Earned</span>
          </div>
          <button
            onClick={onExit}
            className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-nunito font-extrabold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Back to Market
          </button>
        </div>
      </div>

      {gameState === 'LOBBY' && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            {CIRCUS_BLOOKS.slice(0, 4).map((b) => (
              <div key={b.id} className="w-20 h-20 animate-float">
                <BlookArt id={b.id} className="w-full h-full" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-3xl p-8 shadow-[0_10px_0_rgba(0,0,0,0.18)] w-full text-slate-800">
            <h2 className="font-titan text-3xl text-[#dc2626] mb-3">
              Answer Questions & Open Token Chests!
            </h2>
            <p className="font-nunito font-bold text-slate-600 text-base mb-6">
              Every correct answer rewards Clicket Tokens AND lets you pick 1 of 3 Circus Chests for bonus tokens. Use your tokens in the Market to open the 20-Token Circus Pack!
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={startGame}
                className="px-8 py-3.5 rounded-2xl bg-[#f87171] text-white font-titan text-2xl shadow-[0_6px_0_#dc2626] active:translate-y-1 active:shadow-none hover:brightness-105 transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                Start Trivia Game
              </button>
            </div>
          </div>
        </div>
      )}

      {gameState === 'QUESTION' && (
        <div className="flex-1 flex flex-col justify-between max-w-4xl w-full mx-auto">
          <div className="bg-white rounded-3xl p-8 shadow-[0_8px_0_rgba(0,0,0,0.15)] text-center my-auto">
            <div className="flex items-center justify-between text-xs font-nunito font-extrabold text-slate-400 mb-3">
              <span>
                Question {currentIdx + 1} of {questions.length} · {currentQ.category}
              </span>
              <span>Streak: {streak}x</span>
            </div>
            <h2 className="font-nunito font-black text-2xl md:text-3xl text-slate-800">
              {currentQ.question}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {currentQ.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectOption(idx)}
                className={`${optionColors[idx]} text-white font-nunito font-black text-xl p-6 rounded-2xl transition-transform active:translate-y-1 cursor-pointer text-left flex items-center gap-4`}
              >
                <span className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center font-titan text-lg shrink-0">
                  {idx + 1}
                </span>
                <span>{opt}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {gameState === 'FEEDBACK' && (
        <div
          onClick={handleNext}
          className={`flex-1 rounded-3xl p-8 flex flex-col items-center justify-center text-white cursor-pointer select-none shadow-xl transition-colors ${
            isCorrect ? 'bg-[#22c55e]' : 'bg-[#ef4444]'
          }`}
        >
          <div className="w-28 h-28 mb-4 animate-bounce">
            <BlookArt id={isCorrect ? 'jester' : 'canon-ball'} className="w-full h-full" />
          </div>
          <h2 className="font-titan text-5xl mb-3 drop-shadow-[0_4px_0_rgba(0,0,0,0.2)]">
            {isCorrect ? 'CORRECT!' : 'INCORRECT!'}
          </h2>
          {isCorrect ? (
            <div className="flex items-center gap-2 font-nunito font-black text-2xl bg-black/20 px-6 py-2 rounded-2xl mb-6">
              <BlooketTokenIcon className="w-7 h-7" />
              <span>+{15 + streak * 5} Tokens Earned!</span>
            </div>
          ) : (
            <p className="font-nunito font-bold text-xl mb-6 bg-black/20 px-5 py-2 rounded-xl">
              Correct Answer: {currentQ.options[currentQ.correctIndex]}
            </p>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="px-8 py-3 rounded-2xl bg-white text-slate-900 font-titan text-xl shadow-[0_5px_0_#cbd5e1] cursor-pointer whitespace-nowrap shrink-0"
          >
            {isCorrect ? 'Open Bonus Chest' : 'Next Question'}
          </button>
        </div>
      )}

      {gameState === 'CHEST' && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full text-center">
          <h2 className="font-titan text-white text-4xl mb-2 drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]">
            {chosenChestIdx === null ? 'Choose a Circus Chest!' : chestChoices[chosenChestIdx].label}
          </h2>
          <p className="font-nunito font-bold text-white/90 text-lg mb-8">
            {chosenChestIdx === null
              ? 'Click one of the three chests below to claim bonus Clicket Tokens!'
              : 'Tokens added straight to your balance!'}
          </p>

          <div className="grid grid-cols-3 gap-6 w-full mb-8">
            {[0, 1, 2].map((idx) => {
              const isSelected = chosenChestIdx === idx;
              const isRevealed = chosenChestIdx !== null;
              return (
                <button
                  key={idx}
                  onClick={() => handlePickChest(idx)}
                  disabled={isRevealed}
                  className={`bg-white rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.2)] flex flex-col items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? 'ring-4 ring-[#fbbf24] scale-105'
                      : isRevealed
                      ? 'opacity-65 scale-95'
                      : 'hover:-translate-y-1.5'
                  }`}
                >
                  <div className="w-24 h-24 mb-3">
                    <BlookArt
                      id={isRevealed ? (idx === 0 ? 'the-golden-ticket' : idx === 1 ? 'circus-elephant' : 'popcorn') : 'tent'}
                      className="w-full h-full"
                    />
                  </div>
                  <span className="font-titan text-lg text-slate-800">
                    {isRevealed ? `+${chestChoices[idx].delta} Tokens` : `Chest #${idx + 1}`}
                  </span>
                </button>
              );
            })}
          </div>

          {chosenChestIdx !== null && (
            <button
              onClick={() => {
                if (currentIdx + 1 >= questions.length) {
                  setGameState('SUMMARY');
                } else {
                  setCurrentIdx((i) => i + 1);
                  setSelectedOption(null);
                  setGameState('QUESTION');
                }
              }}
              className="px-8 py-3 rounded-2xl bg-[#fbbf24] text-amber-950 font-titan text-xl shadow-[0_5px_0_#b45309] cursor-pointer whitespace-nowrap shrink-0"
            >
              Continue
            </button>
          )}
        </div>
      )}

      {gameState === 'SUMMARY' && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto w-full text-center">
          <div className="bg-white rounded-3xl p-8 shadow-[0_10px_0_rgba(0,0,0,0.2)] w-full">
            <div className="w-24 h-24 mx-auto mb-3">
              <BlookArt id="the-golden-ticket" className="w-full h-full" />
            </div>
            <h2 className="font-titan text-3xl text-[#dc2626] mb-2">Game Complete!</h2>
            <p className="font-nunito font-bold text-slate-600 mb-6">
              You answered {correctCount} of {questions.length} questions correctly!
            </p>
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 mb-6 flex items-center justify-center gap-3">
              <BlooketTokenIcon className="w-9 h-9" />
              <span className="font-titan text-3xl text-amber-600">
                +{sessionTokens} Total Tokens
              </span>
            </div>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={startGame}
                className="px-6 py-3 rounded-xl bg-[#f87171] text-white font-titan text-lg shadow-[0_5px_0_#dc2626] cursor-pointer whitespace-nowrap shrink-0"
              >
                Play Again
              </button>
              <button
                onClick={onExit}
                className="px-6 py-3 rounded-xl bg-[#dc2626] text-white font-titan text-lg shadow-[0_5px_0_#991b1b] cursor-pointer whitespace-nowrap shrink-0"
              >
                Go Open Circus Packs!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
