import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import { useGameStore } from '../store/gameStore';
import { supabase } from '../lib/supabase';
import SEO from '../components/SEO';
import { useSoundEngine } from '../lib/soundEngine';

interface Question {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

const QUESTIONS: Question[] = [
  { id: 1, question: 'What planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correctIndex: 1, difficulty: 'easy' },
  { id: 2, question: 'Who painted the Mona Lisa?', options: ['Van Gogh', 'Picasso', 'Da Vinci', 'Monet'], correctIndex: 2, difficulty: 'easy' },
  { id: 3, question: 'What is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correctIndex: 3, difficulty: 'easy' },
  { id: 4, question: 'How many continents are there?', options: ['5', '6', '7', '8'], correctIndex: 2, difficulty: 'easy' },
  { id: 5, question: 'What element does "O" represent?', options: ['Gold', 'Osmium', 'Oxygen', 'Oganesson'], correctIndex: 2, difficulty: 'easy' },
  { id: 6, question: 'In what year did WWII end?', options: ['1943', '1944', '1945', '1946'], correctIndex: 2, difficulty: 'easy' },
  { id: 7, question: 'What is the speed of light?', options: ['300k km/s', '150k km/s', '500k km/s', '1M km/s'], correctIndex: 0, difficulty: 'medium' },
  { id: 8, question: 'Who wrote "Romeo and Juliet"?', options: ['Dickens', 'Shakespeare', 'Austen', 'Hemingway'], correctIndex: 1, difficulty: 'easy' },
  { id: 9, question: 'What is the smallest prime number?', options: ['0', '1', '2', '3'], correctIndex: 2, difficulty: 'medium' },
  { id: 10, question: 'What gas do plants absorb?', options: ['Oxygen', 'Nitrogen', 'CO2', 'Hydrogen'], correctIndex: 2, difficulty: 'easy' },
  { id: 11, question: 'What is the capital of Japan?', options: ['Osaka', 'Kyoto', 'Tokyo', 'Nagoya'], correctIndex: 2, difficulty: 'medium' },
  { id: 12, question: 'How many sides does a hexagon have?', options: ['5', '6', '7', '8'], correctIndex: 1, difficulty: 'easy' },
  { id: 13, question: 'What is H2O commonly known as?', options: ['Salt', 'Water', 'Sugar', 'Air'], correctIndex: 1, difficulty: 'easy' },
  { id: 14, question: 'Who discovered gravity?', options: ['Einstein', 'Newton', 'Galileo', 'Hawking'], correctIndex: 1, difficulty: 'easy' },
  { id: 15, question: 'What is the hardest natural substance?', options: ['Gold', 'Iron', 'Diamond', 'Quartz'], correctIndex: 2, difficulty: 'medium' },
  { id: 16, question: 'What language has the most native speakers?', options: ['English', 'Hindi', 'Spanish', 'Mandarin'], correctIndex: 3, difficulty: 'medium' },
  { id: 17, question: 'What is the largest mammal?', options: ['Elephant', 'Blue Whale', 'Giraffe', 'Hippo'], correctIndex: 1, difficulty: 'easy' },
  { id: 18, question: 'How many bones in adult human body?', options: ['186', '206', '226', '256'], correctIndex: 1, difficulty: 'medium' },
  { id: 19, question: 'What country has the most population?', options: ['USA', 'India', 'China', 'Indonesia'], correctIndex: 1, difficulty: 'medium' },
  { id: 20, question: 'What is the chemical symbol for gold?', options: ['Go', 'Gd', 'Au', 'Ag'], correctIndex: 2, difficulty: 'medium' },
  { id: 21, question: 'What planet is closest to the Sun?', options: ['Venus', 'Mercury', 'Earth', 'Mars'], correctIndex: 1, difficulty: 'medium' },
  { id: 22, question: 'How many legs does a spider have?', options: ['6', '8', '10', '12'], correctIndex: 1, difficulty: 'easy' },
  { id: 23, question: 'What is the longest river?', options: ['Amazon', 'Nile', 'Yangtze', 'Mississippi'], correctIndex: 1, difficulty: 'medium' },
  { id: 24, question: 'What year did the Titanic sink?', options: ['1910', '1912', '1914', '1916'], correctIndex: 1, difficulty: 'easy' },
  { id: 25, question: 'What is the Higgs boson?', options: ['A particle', 'A planet', 'A theory', 'A force'], correctIndex: 0, difficulty: 'hard' },
  { id: 26, question: 'In what year was the first microprocessor released?', options: ['1971', '1975', '1980', '1985'], correctIndex: 0, difficulty: 'hard' },
  { id: 27, question: 'What is the largest known prime number? (as of 2023)', options: ['2^82,589,933 - 1', '2^77,232,917 - 1', '2^74,207,281 - 1', '2^76,243,197 - 1'], correctIndex: 0, difficulty: 'hard' },
];

const TIMER_SECONDS = 15;
const GAME_COST = 15;

function getUsedQuestions(): Set<number> {
  try {
    const stored = localStorage.getItem('ladder_climb_used');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function markUsed(qid: number) {
  const used = getUsedQuestions();
  used.add(qid);
  localStorage.setItem('ladder_climb_used', JSON.stringify(Array.from(used)));
}

function getDifficultyMultiplier(stage: number): number {
  if (stage < 10) return 1.0;
  if (stage < 20) return 1.5;
  if (stage < 30) return 2.0;
  return 2.5;
}

function getMaxReward(stage: number): number {
  const mult = getDifficultyMultiplier(stage);
  return Math.min(10, 0.10 * mult);
}

function pickQuestionForStage(stage: number): Question {
  const available = QUESTIONS.filter((q) => {
    if (stage < 10) return q.difficulty === 'easy';
    if (stage < 20) return q.difficulty === 'easy' || q.difficulty === 'medium';
    return true;
  });
  
  const used = getUsedQuestions();
  const pool = available.filter((q) => !used.has(q.id));
  return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
}

export default function MaiLadderClimb() {
  const { user } = useAuthStore();
  const { wallet, refreshWallet, loadTokenTransactions, isUserFrozen } = useWalletStore();
  const { loadSessions } = useGameStore();
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [result, setResult] = useState<{ correct: boolean; payout: number } | null>(null);
  const [level, setLevel] = useState(0);
  const [insufficientTokens, setInsufficientTokens] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundEngine = useSoundEngine();

  const startQuestion = useCallback(async () => {
    if (!user) return;
    
    if (await isUserFrozen(user.id)) {
      return;
    }
    
    try {
      const { error } = await supabase.rpc('charge_tokens', { p_user_id: user.id, p_cost: GAME_COST });
      if (error) {
        console.warn('[MaiLadderClimb] charge_tokens rpc error', error);
        setInsufficientTokens(true);
        setTimeout(() => setInsufficientTokens(false), 3000);
        return;
      }
    } catch (err) {
      console.error('[MaiLadderClimb] charge_tokens exception', err);
      setInsufficientTokens(true);
      setTimeout(() => setInsufficientTokens(false), 3000);
      return;
    }
    
    await soundEngine.play('ladder_climb', 'start');
    const q = pickQuestionForStage(level);
    setQuestion(q);
    setSelected(null);
    setTimeLeft(TIMER_SECONDS);
    setResult(null);
    setInsufficientTokens(false);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [user, level, isUserFrozen]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (timeLeft === 0 && question && selected === null && !result) {
      handleSubmit(-1);
    }
  }, [timeLeft]);

  const handleSubmit = useCallback(async (answerIdx: number) => {
    if (!question || result) return;
    if (!user || !question) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelected(answerIdx);
    const correct = answerIdx === question.correctIndex;
    let payout = 0;

    if (correct) {
      payout = parseFloat(getMaxReward(level).toFixed(2));
      await soundEngine.play('ladder_climb', 'win');
    } else {
      await soundEngine.play('ladder_climb', 'lose');
    }

    if (correct && payout > 0) {
      try {
        const { error } = await supabase.rpc('process_cashout_deduction', { p_user_id: user.id, p_amount: payout });
        if (error) {
          console.warn('[MaiLadderClimb] process_cashout_deduction error', error);
          // If insufficient cashout balance, fallback to crediting troll_coins directly
          if (error.code === 'P0001' || (error.message && error.message.includes('Insufficient cashout coin balance'))) {
            try {
              const coinAmount = Math.round(payout * 100);
              const { error: upErr } = await supabase.from('user_profiles').update({
                troll_coins: (wallet?.coin_balance ?? 0) + coinAmount,
                total_won: (wallet?.total_won ?? 0) + payout,
                updated_at: new Date().toISOString(),
              }).eq('id', user.id);
              if (upErr) console.warn('[MaiLadderClimb] fallback update failed', upErr);
              else {
                await supabase.from('coin_transactions').insert({ user_id: user.id, type: 'reward', amount: coinAmount, status: 'completed' });
              }
            } catch (fbErr) {
              console.error('[MaiLadderClimb] fallback exception', fbErr);
            }
          }
        }
      } catch (err) {
        console.error('[MaiLadderClimb] process_cashout_deduction exception', err);
      }
    }

    markUsed(question.id);
    setResult({ correct, payout });
    if (correct) setLevel((prev) => prev + 1);

    if (user?.id) {
      try {
        await Promise.all([
          refreshWallet(user.id),
          loadTokenTransactions(user.id),
          loadSessions(user.id),
        ]);
      } catch (err) {
        console.warn('[MaiLadderClimb] refresh failed', err);
      }
    }
  }, [question, result, user?.id, refreshWallet, loadTokenTransactions, loadSessions, level, wallet, soundEngine]);

  const progress = ((TIMER_SECONDS - timeLeft) / TIMER_SECONDS) * 100;
  const stage = Math.floor(level / 10) + 1;
  const inSecondStage = stage >= 2;

  const getLevelColors = (idx: number, playerLevel: number) => {
    const isComplete = idx < playerLevel;
    if (inSecondStage) {
      return {
        bg: isComplete ? '#ff0080' : '#333',
        glow: isComplete ? '0 0 8px #ff0080' : 'none',
      };
    }
    return {
      bg: isComplete ? '#00ff88' : '#333',
      glow: isComplete ? '0 0 8px #00ff88' : 'none',
    };
  };

  return (
    <>
      <SEO title="Mai Ladder Climb" description="Answer trivia and climb the ladder to win!" />
      <div style={{ padding: '1rem', maxWidth: '550px', margin: '0 auto', textAlign: 'center' }}>
        <h1 className="neon-text-pink" style={{ fontSize: '2rem', textShadow: '0 0 10px #ff00ff, 0 0 20px #ff00ff' }}>
          Mai Ladder Climb
        </h1>

        {user && <p style={{ color: '#00ff88', marginBottom: '0.5rem' }}>Tokens: <strong>{wallet?.token_balance ?? 0}</strong></p>}
        {user && <p style={{ color: '#00aaff', marginBottom: '1rem' }}>Level: <strong>{level}</strong> (Stage {stage})</p>}

        {!user && (
          <div className="card neon-border" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ color: '#ff66cc' }}>Sign in to play!</p>
          </div>
        )}

        {insufficientTokens && (
          <div className="card neon-border" style={{ padding: '1rem', marginBottom: '1rem', background: 'rgba(255,0,128,0.2)' }}>
            <p style={{ color: '#ff0080', fontWeight: 'bold' }}>Not enough tokens! You need {GAME_COST} tokens to play.</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginBottom: '1.5rem' }}>
          {Array.from({ length: 10 }, (_, i) => {
            const colors = getLevelColors(i, level % 10);
            return (
              <div
                key={i}
                style={{
                  width: `${180 + i * 12}px`,
                  height: '6px',
                  borderRadius: '3px',
                  background: colors.bg,
                  boxShadow: colors.glow,
                  transition: 'all 0.3s',
                }}
              />
            );
          })}
        </div>

        {!question && user && (
          <button className="btn btn-primary neon-border" onClick={startQuestion} style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}>
            Start Climbing! ({GAME_COST} Tokens)
          </button>
        )}

        {question && !result && (
          <div className="card neon-border" style={{ padding: '1.5rem' }}>
            <div style={{ position: 'relative', width: '60px', height: '60px', margin: '0 auto 1rem' }}>
              <svg width="60" height="60" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="30" cy="30" r="26" fill="none" stroke="#333" strokeWidth="4" />
                <circle
                  cx="30" cy="30" r="26"
                  fill="none"
                  stroke={timeLeft <= 5 ? '#ff0080' : '#00aaff'}
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 26}`}
                  strokeDashoffset={`${2 * Math.PI * 26 * (progress / 100)}`}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  color: timeLeft <= 5 ? '#ff0080' : '#00aaff',
                }}
              >
                {timeLeft}
              </span>
            </div>

            <p style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#fff' }}>{question.question}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {question.options.map((opt, i) => (
                <button
                  key={i}
                  className="neon-border"
                  onClick={() => handleSubmit(i)}
                  disabled={selected !== null}
                  style={{
                    padding: '0.6rem',
                    borderRadius: '8px',
                    background: 'rgba(20,20,50,0.8)',
                    color: '#fff',
                    border: '2px solid #00aaff',
                    cursor: selected !== null ? 'default' : 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="card neon-border" style={{ padding: '1.5rem' }}>
            <p className={result.correct ? 'neon-text-green' : 'neon-text-pink'} style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>
              {result.correct ? `Correct! You Win $${result.payout.toFixed(2)}!` : 'Wrong! Try Again!'}
            </p>
            {question && (
              <p style={{ color: '#aaa', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                Answer: {question.options[question.correctIndex]}
              </p>
            )}
            <button
              className="btn btn-primary neon-border"
              onClick={startQuestion}
              style={{ marginTop: '1rem', padding: '0.6rem 1.5rem' }}
            >
              Next Question ({GAME_COST} Tokens)
            </button>
          </div>
        )}
      </div>
    </>
  );
}
