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

interface GameResult {
  correct: boolean;
  payout: number;
  timedOut: boolean;
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
  { id: 28, question: 'Which actor played Iron Man in the Marvel movies?', options: ['Chris Hemsworth', 'Chris Evans', 'Robert Downey Jr.', 'Mark Ruffalo'], correctIndex: 2, difficulty: 'easy' },
  { id: 29, question: 'Which pop star is known as the Queen of Pop?', options: ['Madonna', 'Beyoncé', 'Taylor Swift', 'Ariana Grande'], correctIndex: 0, difficulty: 'easy' },
  { id: 30, question: 'Which entrepreneur founded SpaceX?', options: ['Jeff Bezos', 'Elon Musk', 'Bill Gates', 'Warren Buffett'], correctIndex: 1, difficulty: 'easy' },
  { id: 31, question: 'Which actress played Hermione Granger?', options: ['Emma Watson', 'Emma Stone', 'Natalie Portman', 'Keira Knightley'], correctIndex: 0, difficulty: 'medium' },
  { id: 32, question: 'Who directed the movie Jurassic Park?', options: ['James Cameron', 'Steven Spielberg', 'Christopher Nolan', 'Ridley Scott'], correctIndex: 1, difficulty: 'medium' },
  { id: 33, question: 'Which athlete is nicknamed "The Greatest" in boxing?', options: ['Mike Tyson', 'Muhammad Ali', 'Floyd Mayweather', 'Manny Pacquiao'], correctIndex: 1, difficulty: 'easy' },
  { id: 34, question: 'Which singer is famous for the hit song "Poker Face"?', options: ['Lady Gaga', 'Katy Perry', 'Rihanna', 'Britney Spears'], correctIndex: 0, difficulty: 'easy' },
  { id: 35, question: 'What is the profession of Oprah Winfrey?', options: ['Chef', 'Talk show host', 'Actor', 'Athlete'], correctIndex: 1, difficulty: 'easy' },
  { id: 36, question: 'Which actor played the lead role in the movie "Indiana Jones"?', options: ['Harrison Ford', 'Tom Cruise', 'Mel Gibson', 'Sean Connery'], correctIndex: 0, difficulty: 'easy' },
  { id: 37, question: 'Which actress starred in the movie "La La Land"?', options: ['Emma Stone', 'Anne Hathaway', 'Jennifer Lawrence', 'Scarlett Johansson'], correctIndex: 0, difficulty: 'medium' },
  { id: 38, question: 'Which singer released the album "1989"?', options: ['Selena Gomez', 'Katy Perry', 'Taylor Swift', 'Demi Lovato'], correctIndex: 2, difficulty: 'medium' },
  { id: 39, question: 'Which sport is Serena Williams famous for?', options: ['Soccer', 'Basketball', 'Tennis', 'Golf'], correctIndex: 2, difficulty: 'easy' },
  { id: 40, question: 'Who created the technology company Apple?', options: ['Steve Jobs', 'Bill Gates', 'Mark Zuckerberg', 'Elon Musk'], correctIndex: 0, difficulty: 'easy' },
  { id: 41, question: 'Which director made the movie "Inception"?', options: ['Christopher Nolan', 'Quentin Tarantino', 'Steven Spielberg', 'Martin Scorsese'], correctIndex: 0, difficulty: 'medium' },
  { id: 42, question: 'Who is the author of the Harry Potter series?', options: ['J.K. Rowling', 'Suzanne Collins', 'J.R.R. Tolkien', 'Stephen King'], correctIndex: 0, difficulty: 'easy' },
  { id: 43, question: 'Which singer is a member of the group BTS?', options: ['Taeyeon', 'Jennie', 'Jungkook', 'Lisa'], correctIndex: 2, difficulty: 'medium' },
  { id: 44, question: 'Which famous talk show host had a show called "The Ellen DeGeneres Show"?', options: ['Oprah Winfrey', 'Ellen DeGeneres', 'Jimmy Fallon', 'Conan O’Brien'], correctIndex: 1, difficulty: 'easy' },
  { id: 45, question: 'What is Dwayne Johnson’s nickname?', options: ['The Rock', 'The Flash', 'The Hammer', 'The Shield'], correctIndex: 0, difficulty: 'easy' },
  { id: 46, question: 'Which actor played Jack Sparrow in Pirates of the Caribbean?', options: ['Orlando Bloom', 'Johnny Depp', 'Leonardo DiCaprio', 'Brad Pitt'], correctIndex: 1, difficulty: 'medium' },
  { id: 47, question: 'Which fashion designer founded the brand Chanel?', options: ['Coco Chanel', 'Donatella Versace', 'Giorgio Armani', 'Calvin Klein'], correctIndex: 0, difficulty: 'medium' },
  { id: 48, question: 'Which writer created the character Sherlock Holmes?', options: ['Agatha Christie', 'Arthur Conan Doyle', 'Edgar Allan Poe', 'Raymond Chandler'], correctIndex: 1, difficulty: 'medium' },
  { id: 49, question: 'Which celebrity launched the lifestyle brand Goop?', options: ['Gwyneth Paltrow', 'Jessica Alba', 'Reese Witherspoon', 'Kate Hudson'], correctIndex: 0, difficulty: 'hard' },
  { id: 50, question: 'Who is the founder of Amazon?', options: ['Jeff Bezos', 'Elon Musk', 'Larry Page', 'Jack Ma'], correctIndex: 0, difficulty: 'easy' },
  { id: 51, question: 'Which actor played Wolverine in the X-Men movies?', options: ['Chris Evans', 'Hugh Jackman', 'Robert Downey Jr.', 'Chris Hemsworth'], correctIndex: 1, difficulty: 'easy' },
  { id: 52, question: 'Which Olympic swimmer holds the most gold medals?', options: ['Michael Phelps', 'Usain Bolt', 'Ryan Lochte', 'Mark Spitz'], correctIndex: 0, difficulty: 'medium' },
  { id: 53, question: 'Which actress starred in the movie "Wonder Woman"?', options: ['Gal Gadot', 'Scarlett Johansson', 'Emma Watson', 'Natalie Portman'], correctIndex: 0, difficulty: 'medium' },
  { id: 54, question: 'What is the name of Elon Musk’s rocket company?', options: ['Blue Origin', 'SpaceX', 'Virgin Galactic', 'Apollo'], correctIndex: 1, difficulty: 'easy' },
  { id: 55, question: 'Which actor is famous for the "Mission: Impossible" franchise?', options: ['Tom Cruise', 'Matt Damon', 'Brad Pitt', 'George Clooney'], correctIndex: 0, difficulty: 'easy' },
  { id: 56, question: 'Which celebrity is known for coaching basketball and appearing on reality TV with the Kardashians?', options: ['Kris Jenner', 'Khloé Kardashian', 'Lamar Odom', 'Kourtney Kardashian'], correctIndex: 2, difficulty: 'hard' },
  { id: 57, question: 'Which actor played the character Neo in The Matrix?', options: ['Keanu Reeves', 'Brad Pitt', 'Kiefer Sutherland', 'Matt Damon'], correctIndex: 0, difficulty: 'easy' },
  { id: 58, question: 'Which author wrote Alice\'s Adventures in Wonderland?', options: ['Lewis Carroll', 'Charles Dickens', 'Jules Verne', 'Mark Twain'], correctIndex: 0, difficulty: 'medium' },
  { id: 59, question: 'Which singer is known as the King of Pop?', options: ['Prince', 'Michael Jackson', 'Elvis Presley', 'Freddie Mercury'], correctIndex: 1, difficulty: 'easy' },
  { id: 60, question: 'Which actor played Katniss Everdeen in The Hunger Games?', options: ['Jennifer Lawrence', 'Emma Watson', 'Natalie Portman', 'Scarlett Johansson'], correctIndex: 0, difficulty: 'medium' },
  { id: 61, question: 'Which singer voiced a character in Frozen and sang Let It Go?', options: ['Ariana Grande', 'Demi Lovato', 'Idina Menzel', 'Miley Cyrus'], correctIndex: 2, difficulty: 'medium' },
  { id: 62, question: 'Which tech CEO co-founded Microsoft?', options: ['Steve Jobs', 'Bill Gates', 'Elon Musk', 'Larry Page'], correctIndex: 1, difficulty: 'easy' },
  { id: 63, question: 'Which movie features the line "I\'ll be back"?', options: ['Die Hard', 'Terminator', 'RoboCop', 'Predator'], correctIndex: 1, difficulty: 'easy' },
  { id: 64, question: 'What is the tallest mountain in the world?', options: ['K2', 'Kangchenjunga', 'Mount Everest', 'Lhotse'], correctIndex: 2, difficulty: 'medium' },
  { id: 65, question: 'Who wrote the novel 1984?', options: ['George Orwell', 'Aldous Huxley', 'Ray Bradbury', 'Arthur C. Clarke'], correctIndex: 0, difficulty: 'medium' },
  { id: 66, question: 'Which country hosted the 2016 Summer Olympics?', options: ['China', 'Brazil', 'UK', 'Japan'], correctIndex: 1, difficulty: 'easy' },
  { id: 67, question: 'Who is the CEO of Tesla?', options: ['Tim Cook', 'Mark Zuckerberg', 'Elon Musk', 'Jeff Bezos'], correctIndex: 2, difficulty: 'easy' },
  { id: 68, question: 'Which singer released the hit song "Hello" in 2015?', options: ['Adele', 'Lady Gaga', 'Rihanna', 'Beyonce'], correctIndex: 0, difficulty: 'easy' },
  { id: 69, question: 'Which filmmaker directed Pulp Fiction?', options: ['Quentin Tarantino', 'Martin Scorsese', 'Francis Ford Coppola', 'Steven Spielberg'], correctIndex: 0, difficulty: 'medium' },
  { id: 70, question: 'Which actor played Black Panther in the Marvel films?', options: ['Chadwick Boseman', 'Michael B. Jordan', 'Anthony Mackie', 'Idris Elba'], correctIndex: 0, difficulty: 'medium' },
  { id: 71, question: 'Which author created The Lord of the Rings?', options: ['C.S. Lewis', 'J.R.R. Tolkien', 'George R.R. Martin', 'J.K. Rowling'], correctIndex: 1, difficulty: 'easy' },
  { id: 72, question: 'Which musician is known for the song Shape of You?', options: ['Ed Sheeran', 'Bruno Mars', 'Justin Bieber', 'Shawn Mendes'], correctIndex: 0, difficulty: 'easy' },
  { id: 73, question: 'What is the smallest US state by area?', options: ['Delaware', 'Rhode Island', 'Connecticut', 'New Jersey'], correctIndex: 1, difficulty: 'medium' },
  { id: 74, question: 'Who played the Genie in the 2019 Aladdin movie?', options: ['Will Smith', 'Jamie Foxx', 'Donald Glover', 'Mena Massoud'], correctIndex: 0, difficulty: 'easy' },
  { id: 75, question: 'Which actress starred as Princess Leia in Star Wars?', options: ['Carrie Fisher', 'Natalie Portman', 'Daisy Ridley', 'Scarlett Johansson'], correctIndex: 0, difficulty: 'medium' },
  { id: 76, question: 'Which actor played the lead role in The Revenant?', options: ['Leonardo DiCaprio', 'Brad Pitt', 'Tom Hardy', 'Matt Damon'], correctIndex: 0, difficulty: 'medium' },
  { id: 77, question: 'Which singer released the song Bad Romance?', options: ['Lady Gaga', 'Katy Perry', 'Beyonce', 'Ariana Grande'], correctIndex: 0, difficulty: 'easy' },
  { id: 77, question: 'Who is the CEO of Troll City?', options: ['Kain Towns', 'Noah Webb', 'John Smith', 'Sarah Williams'], correctIndex: 0, difficulty: 'easy' },
  { id: 78, question: 'Who is the founder of Troll City?', options: ['Kain Towns', 'Noah Webb', 'David Miller', 'Emily Davis'], correctIndex: 1, difficulty: 'easy' },
  { id: 79, question: 'What website is used to access Troll City?', options: ['MaiTrollCity.com', 'TrollCity.net', 'TrollWorld.com', 'CityLive.tv'], correctIndex: 0, difficulty: 'easy' },
  { id: 80, question: 'What is the primary focus of Troll City?', options: ['Live streaming and community interaction', 'Food delivery', 'Online banking', 'Photo editing'], correctIndex: 0, difficulty: 'easy' },
  { id: 81, question: 'What can users do on Troll City?', options: ['Broadcast live', 'Watch live streams', 'Join interactive communities', 'All of the above'], correctIndex: 3, difficulty: 'easy' },
  { id: 82, question: 'What feature allows viewers to support creators during broadcasts?', options: ['Sending gifts', 'Posting reviews', 'Creating polls', 'Uploading files'], correctIndex: 0, difficulty: 'easy' },
  { id: 83, question: 'What type of platform is Troll City?', options: ['A live social platform', 'A dating app', 'A banking app', 'A ride-sharing service'], correctIndex: 0, difficulty: 'easy' },
  { id: 84, question: 'What is one goal of Troll City?', options: ['Helping creators build communities', 'Selling vehicles', 'Managing investments', 'Booking hotels'], correctIndex: 0, difficulty: 'easy' },
  { id: 85, question: 'Which activity is available on Troll City?', options: ['Watching live broadcasts', 'Buying airline tickets', 'Ordering groceries', 'Editing videos offline'], correctIndex: 0, difficulty: 'easy' },
  { id: 86, question: 'Who can use Troll City?', options: ['Creators, viewers, and community members', 'Doctors only', 'Teachers only', 'Business owners only'], correctIndex: 0, difficulty: 'easy' }, 
  { id: 87, question: 'What does SUV stand for?', options: ['Sport Utility Vehicle', 'Super Utility Van', 'Special Utility Vehicle', 'Sport Universal Van'], correctIndex: 0, difficulty: 'easy' },
  { id: 88, question: 'What color traffic light means stop?', options: ['Green', 'Yellow', 'Red', 'Blue'], correctIndex: 2, difficulty: 'easy' },
  { id: 89, question: 'Which pedal is used to slow down a car?', options: ['Gas pedal', 'Brake pedal', 'Clutch pedal', 'Parking pedal'], correctIndex: 1, difficulty: 'easy' },
  { id: 90, question: 'What powers a traditional gasoline car?', options: ['Gasoline', 'Water', 'Air', 'Solar Power'], correctIndex: 0, difficulty: 'easy' },
  { id: 91, question: 'What does RPM stand for?', options: ['Revolutions Per Minute', 'Rotations Per Mile', 'Road Power Motor', 'Rapid Performance Mode'], correctIndex: 0, difficulty: 'easy' },
  { id: 92, question: 'Which company makes the Mustang?', options: ['Ford', 'Chevrolet', 'Dodge', 'Toyota'], correctIndex: 0, difficulty: 'easy' },
  { id: 93, question: 'What should you check regularly to help prevent engine damage?', options: ['Engine oil', 'Radio volume', 'Seat position', 'Floor mats'], correctIndex: 0, difficulty: 'easy' },
  { id: 94, question: 'Which part of a car provides traction on the road?', options: ['Tires', 'Mirrors', 'Headlights', 'Steering wheel'], correctIndex: 0, difficulty: 'easy' },
  { id: 95, question: 'What does ABS stand for in a vehicle?', options: ['Anti-lock Braking System', 'Automatic Brake Sensor', 'Advanced Brake Support', 'Auto Balance Steering'], correctIndex: 0, difficulty: 'medium' },
  { id: 96, question: 'What should you do before changing lanes?', options: ['Check mirrors and blind spots', 'Honk the horn', 'Speed up immediately', 'Turn off your headlights'], correctIndex: 0, difficulty: 'easy' },
];

const GAME_COST = 15;
const TIMER_SECONDS = 30;

const USED_STORAGE_KEY = 'ladder_climb_used';

function getUsedQuestions(): Set<number> {
  try {
    const stored = localStorage.getItem(USED_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function markUsed(questionId: number) {
  try {
    const used = getUsedQuestions();
    used.add(questionId);

    if (used.size >= QUESTIONS.length) {
      localStorage.removeItem(USED_STORAGE_KEY);
      return;
    }

    localStorage.setItem(USED_STORAGE_KEY, JSON.stringify(Array.from(used)));
  } catch {
    // localStorage may be unavailable in some browsers. The game can still continue.
  }
}

function getDifficultyMultiplier(level: number): number {
  if (level < 10) return 1.0;
  if (level < 20) return 1.5;
  if (level < 30) return 2.0;
  return 2.5;
}

function getMaxReward(level: number): number {
  const multiplier = getDifficultyMultiplier(level);
  return Number(Math.min(10, 0.10 * multiplier).toFixed(2));
}

function getAllowedDifficulties(level: number): Question['difficulty'][] {
  if (level < 10) return ['easy'];
  if (level < 20) return ['easy', 'medium'];
  return ['easy', 'medium', 'hard'];
}

function pickQuestionForLevel(level: number): Question {
  const allowed = getAllowedDifficulties(level);
  const available = QUESTIONS.filter((question) => allowed.includes(question.difficulty));
  const used = getUsedQuestions();
  const unusedPool = available.filter((question) => !used.has(question.id));

  if (unusedPool.length > 0) {
    return unusedPool[Math.floor(Math.random() * unusedPool.length)];
  }

  return available[Math.floor(Math.random() * available.length)] ?? QUESTIONS[0];
}

export default function MaiLadderClimb() {
  const { user } = useAuthStore();
  const {
    wallet,
    refreshWallet,
    loadTokenTransactions,
    isUserFrozen,
  } = useWalletStore();
  const { loadSessions } = useGameStore();
  const soundEngine = useSoundEngine();

  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [result, setResult] = useState<GameResult | null>(null);
  const [level, setLevel] = useState(0);
  const [streak, setStreak] = useState(0);
  const [insufficientTokens, setInsufficientTokens] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [crownMessage, setCrownMessage] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittingRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const refreshGameData = useCallback(async () => {
    if (!user?.id) return;

    try {
      await Promise.all([
        refreshWallet(user.id),
        loadTokenTransactions(user.id),
        loadSessions(user.id),
      ]);
    } catch (err) {
      console.warn('[MaiLadderClimb] refresh failed', err);
    }
  }, [user?.id, refreshWallet, loadTokenTransactions, loadSessions]);

  const handleCashReward = useCallback(async (payout: number) => {
    if (!user?.id || payout <= 0) return;

    try {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('cash_balance,total_won')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.warn('[MaiLadderClimb] reward profile lookup failed:', profileError);
        return;
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          cash_balance: Number(profile?.cash_balance ?? 0) + payout,
          total_won: Number(profile?.total_won ?? 0) + payout,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.warn('[MaiLadderClimb] reward update failed:', updateError);
        return;
      }

      const coinAmount = Math.round(payout * 100);
      const { error: transactionError } = await supabase
        .from('coin_transactions')
        .insert({
          user_id: user.id,
          type: 'reward',
          amount: coinAmount,
          price_usd: payout,
          status: 'completed',
        });

      if (transactionError) {
        console.warn('[MaiLadderClimb] reward transaction failed:', transactionError);
      }
    } catch (err) {
      console.error('[MaiLadderClimb] reward processing exception:', err);
    }
  }, [user?.id]);

  const awardCrownStreakBonus = useCallback(async (nextStreak: number) => {
    if (!user?.id || nextStreak <= 0 || nextStreak % 3 !== 0) return;

    const crownsAwarded = 25;

    try {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('crowns')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.warn('[MaiLadderClimb] crown profile lookup failed:', profileError);
        return;
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          crowns: Number(profile?.crowns ?? 0) + crownsAwarded,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.warn('[MaiLadderClimb] crown streak reward update failed:', updateError);
        return;
      }

      setCrownMessage(`Streak bonus! +${crownsAwarded} Crowns`);
      setTimeout(() => setCrownMessage(null), 3000);
    } catch (err) {
      console.warn('[MaiLadderClimb] crown streak reward failed:', err);
    }
  }, [user?.id]);

  const startQuestion = useCallback(async () => {
    if (!user?.id || isLoading) return;

    setIsLoading(true);
    setInsufficientTokens(false);
    submittingRef.current = false;

    try {
      const frozen = await isUserFrozen(user.id);
      if (frozen) return;

      if ((wallet?.token_balance ?? 0) < GAME_COST) {
        setInsufficientTokens(true);
        setTimeout(() => setInsufficientTokens(false), 3000);
        return;
      }

      const { error } = await supabase.rpc('charge_tokens', {
        p_user_id: user.id,
        p_cost: GAME_COST,
      });

      if (error) {
        console.warn('[MaiLadderClimb] charge_tokens rpc error:', error);
        setInsufficientTokens(true);
        setTimeout(() => setInsufficientTokens(false), 3000);
        return;
      }

      await soundEngine.play('ladder_climb', 'start');

      const nextQuestion = pickQuestionForLevel(level);
      setQuestion(nextQuestion);
      setSelected(null);
      setResult(null);
      setTimeLeft(TIMER_SECONDS);

      clearTimer();
      timerRef.current = setInterval(() => {
        setTimeLeft((previous: number) => {
          if (previous <= 1) {
            clearTimer();
            return 0;
          }

          return previous - 1;
        });
      }, 1000);

      await refreshGameData();
    } catch (err) {
      console.error('[MaiLadderClimb] start question failed:', err);
      setInsufficientTokens(true);
      setTimeout(() => setInsufficientTokens(false), 3000);
    } finally {
      setIsLoading(false);
    }
  }, [
    user?.id,
    wallet?.token_balance,
    level,
    isLoading,
    isUserFrozen,
    soundEngine,
    clearTimer,
    refreshGameData,
  ]);

  const handleSubmit = useCallback(async (answerIndex: number, timedOut = false) => {
    if (!user?.id || !question || result || submittingRef.current) return;

    submittingRef.current = true;
    clearTimer();
    setSelected(answerIndex);

    const correct = answerIndex === question.correctIndex;
    const payout = correct ? getMaxReward(level) : 0;

    try {
      if (correct) {
        await soundEngine.play('ladder_climb', 'win');
        await handleCashReward(payout);

        const nextStreak = streak + 1;
        setStreak(nextStreak);
        await awardCrownStreakBonus(nextStreak);
        setLevel((previous) => previous + 1);
      } else {
        await soundEngine.play('ladder_climb', 'lose');
        setStreak(0);
      }

      markUsed(question.id);
      setResult({ correct, payout, timedOut });
      await refreshGameData();
    } catch (err) {
      console.error('[MaiLadderClimb] submit failed:', err);
      setResult({ correct, payout, timedOut });
    } finally {
      submittingRef.current = false;
    }
  }, [
    user?.id,
    question,
    result,
    level,
    streak,
    clearTimer,
    soundEngine,
    handleCashReward,
    awardCrownStreakBonus,
    refreshGameData,
  ]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    if (timeLeft === 0 && question && selected === null && !result && !submittingRef.current) {
      void handleSubmit(-1, true);
    }
  }, [timeLeft, question, selected, result, handleSubmit]);

  const progressRemaining = (timeLeft / TIMER_SECONDS) * 100;
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

  const getAnswerButtonStyle = (index: number): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: '0.6rem',
      borderRadius: '8px',
      background: 'rgba(20,20,50,0.8)',
      color: '#fff',
      border: '2px solid #00aaff',
      cursor: selected !== null ? 'default' : 'pointer',
      fontSize: '0.9rem',
      transition: 'all 0.2s ease',
    };

    if (!result || !question) return base;

    if (index === question.correctIndex) {
      return {
        ...base,
        background: 'rgba(0,255,136,0.25)',
        border: '2px solid #00ff88',
        boxShadow: '0 0 12px #00ff88',
      };
    }

    if (index === selected && selected !== question.correctIndex) {
      return {
        ...base,
        background: 'rgba(255,0,128,0.25)',
        border: '2px solid #ff0080',
        boxShadow: '0 0 12px #ff0080',
      };
    }

    return base;
  };

  return (
    <>
      <SEO title="Mai Ladder Climb" description="Answer trivia and climb the ladder to win!" />

      <div style={{ padding: '1rem', maxWidth: '550px', margin: '0 auto', textAlign: 'center' }}>
        <h1 className="neon-text-pink" style={{ fontSize: '2rem', textShadow: '0 0 10px #ff00ff, 0 0 20px #ff00ff' }}>
          Mai Ladder Climb
        </h1>

        {user && (
          <>
            <p style={{ color: '#00ff88', marginBottom: '0.5rem' }}>
              Tokens: <strong>{wallet?.token_balance ?? 0}</strong>
            </p>
            <p style={{ color: '#00aaff', marginBottom: '0.5rem' }}>
              Level: <strong>{level}</strong> (Stage {stage})
            </p>
            <p style={{ color: '#ffd740', marginBottom: '1rem' }}>
              Streak: <strong>{streak}</strong> | Crowns every 3-correct streak
            </p>
          </>
        )}

        {crownMessage && (
          <div className="card neon-border" style={{ padding: '0.75rem', marginBottom: '1rem' }}>
            <p className="neon-text-yellow" style={{ fontWeight: 700 }}>{crownMessage}</p>
          </div>
        )}

        {!user && (
          <div className="card neon-border" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ color: '#ff66cc' }}>Sign in to play!</p>
          </div>
        )}

        {insufficientTokens && (
          <div className="card neon-border" style={{ padding: '1rem', marginBottom: '1rem', background: 'rgba(255,0,128,0.2)' }}>
            <p style={{ color: '#ff0080', fontWeight: 'bold' }}>
              Not enough tokens! You need {GAME_COST} tokens to play.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginBottom: '1.5rem' }}>
          {Array.from({ length: 10 }, (_, index) => {
            const colors = getLevelColors(index, level % 10);

            return (
              <div
                key={index}
                style={{
                  width: `${180 + index * 12}px`,
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
          <button
            className="btn btn-primary neon-border"
            onClick={startQuestion}
            disabled={isLoading}
            style={{ padding: '0.75rem 2rem', fontSize: '1.1rem', opacity: isLoading ? 0.65 : 1 }}
          >
            {isLoading ? 'Starting...' : `Start Climbing! (${GAME_COST} Tokens)`}
          </button>
        )}

        {question && !result && (
          <div className="card neon-border" style={{ padding: '1.5rem' }}>
            <div style={{ position: 'relative', width: '60px', height: '60px', margin: '0 auto 1rem' }}>
              <svg width="60" height="60" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="30" cy="30" r="26" fill="none" stroke="#333" strokeWidth="4" />
                <circle
                  cx="30"
                  cy="30"
                  r="26"
                  fill="none"
                  stroke={timeLeft <= 5 ? '#ff0080' : '#00aaff'}
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 26}`}
                  strokeDashoffset={`${2 * Math.PI * 26 * (1 - progressRemaining / 100)}`}
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

            <p style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#fff' }}>
              {question.question}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {question.options.map((option, index) => (
                <button
                  key={option}
                  className="neon-border"
                  onClick={() => handleSubmit(index)}
                  disabled={selected !== null}
                  style={getAnswerButtonStyle(index)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="card neon-border" style={{ padding: '1.5rem' }}>
            <p
              className={result.correct ? 'neon-text-green' : 'neon-text-pink'}
              style={{ fontSize: '1.3rem', fontWeight: 'bold' }}
            >
              {result.correct
                ? `Correct! You Win $${result.payout.toFixed(2)}!`
                : result.timedOut
                  ? 'Time\'s Up! Try Again!'
                  : 'Wrong! Try Again!'}
            </p>

            {question && (
              <p style={{ color: '#aaa', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                Answer: {question.options[question.correctIndex]}
              </p>
            )}

            <button
              className="btn btn-primary neon-border"
              onClick={startQuestion}
              disabled={isLoading}
              style={{ marginTop: '1rem', padding: '0.6rem 1.5rem', opacity: isLoading ? 0.65 : 1 }}
            >
              {isLoading ? 'Loading...' : `Next Question (${GAME_COST} Tokens)`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
