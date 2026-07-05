import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: npx tsx scripts/test_play_rpc.ts <user_id> [game_type]');
  process.exit(1);
}

const userId = args[0];
const gameType = args[1] || 'coin_flip';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SERVICE_ROLE;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE in .env');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function run() {
  console.log('Calling RPC play_game for', userId, 'game:', gameType);
  const { data: rpcData, error: rpcError } = await supabase.rpc('play_game', { p_game_type: gameType, p_user_id: userId });
  if (rpcError) {
    console.error('RPC error:', rpcError);
  } else {
    console.log('RPC result:', rpcData);
  }

  const { data: profile, error: pErr } = await supabase.from('user_profiles').select('cash_balance,total_won').eq('id', userId).single();
  if (pErr) console.error('Profile query error:', pErr); else console.log('Profile after RPC:', profile);

  const { data: coins, error: cErr } = await supabase.from('coin_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5);
  if (cErr) console.error('coin_transactions query error:', cErr); else console.log('Recent coin_transactions:', coins);

  const { data: allCoins, error: allErr } = await supabase.from('coin_transactions').select('id,user_id,type,amount,created_at').order('created_at', { ascending: false }).limit(10);
  if (allErr) console.error('coin_transactions (all) query error:', allErr); else console.log('Recent coin_transactions (global):', allCoins);
}

run().catch((e) => { console.error(e); process.exit(1); });
