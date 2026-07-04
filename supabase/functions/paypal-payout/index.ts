import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceRole, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { cashoutRequestId } = await req.json()

    // Verify user is admin
    const { data: profile } = await supabase.from('user_profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return new Response(JSON.stringify({ error: 'Forbidden - admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID')!
    const paypalClientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')!
    const paypalMode = Deno.env.get('PAYPAL_MODE') || 'sandbox'
    const paypalBase = paypalMode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'

    // Fetch the cashout request
    const { data: cashout, error: fetchError } = await supabase
      .from('cashout_requests')
      .select('*')
      .eq('id', cashoutRequestId)
      .single()

    if (fetchError || !cashout) throw new Error('Cashout request not found')
    if (cashout.status !== 'approved') throw new Error('Cashout must be approved before payout')

    // Get PayPal access token
    const auth = btoa(`${paypalClientId}:${paypalClientSecret}`)
    const tokenRes = await fetch(`${paypalBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok) throw new Error(tokenData.error_description || 'Failed to get PayPal token')

    const accessToken = tokenData.access_token

    // Create PayPal Payout
    const payoutBody = {
      sender_batch_header: {
        sender_batch_id: `MAITALENT_${cashoutRequestId.replace(/-/g, '')}`,
        email_subject: 'You have a payout from MaiTalent.fun!',
        email_message: 'Your MaiTalent.fun cashout has been processed.',
      },
      items: [{
        recipient_type: 'EMAIL',
        receiver: cashout.paypal_email,
        amount: {
          currency: 'USD',
          value: cashout.requested_amount.toFixed(2),
        },
        note: `MaiTalent.fun cashout - ${cashout.coin_amount} coins`,
        sender_item_id: cashoutRequestId,
      }],
    }

    const payoutRes = await fetch(`${paypalBase}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payoutBody),
    })
    const payoutData = await payoutRes.json()
    if (!payoutRes.ok) throw new Error(payoutData.message || 'Failed to create payout')

    const batchId = payoutData.batch_header?.payout_batch_id
    if (!batchId) throw new Error('No batch ID in payout response')

    // Update cashout request with PayPal batch ID and mark as paid
    const { error: updateError } = await supabase
      .from('cashout_requests')
      .update({
        status: 'paid',
        paypal_payout_batch_id: batchId,
        paypal_transaction_id: batchId,
        paid_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .eq('id', cashoutRequestId)

    if (updateError) throw new Error(updateError.message)

    // Deduct coins from user's cashout balance
    const { error: deductError } = await supabase.rpc('process_cashout_deduction', {
      p_user_id: cashout.user_id,
      p_coins: cashout.coin_amount,
    })

    if (deductError) console.error('Deduction error:', deductError.message)

    return new Response(
      JSON.stringify({ success: true, batchId, amount: cashout.requested_amount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
