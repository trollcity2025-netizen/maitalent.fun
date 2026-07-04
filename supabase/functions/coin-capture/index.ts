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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceRole, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = user.id
    const body = await req.json().catch(() => ({}))
    const orderId = body.orderId

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Missing orderId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID')!
    const paypalClientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')!
    const paypalMode = Deno.env.get('PAYPAL_MODE') ?? Deno.env.get('Paypal_MODE') ?? 'sandbox'
    const paypalBase = paypalMode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'

    const auth = btoa(`${paypalClientId}:${paypalClientSecret}`)
    const tokenRes = await fetch(`${paypalBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok) throw new Error(tokenData.error_description || 'Failed to get PayPal token')

    const accessToken = tokenData.access_token

    const captureRes = await fetch(`${paypalBase}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
    const captureData = await captureRes.json()
    if (!captureRes.ok) throw new Error(captureData.message || 'Failed to capture payment')

    const purchaseUnit = captureData.purchase_units?.[0]
    const capture = purchaseUnit?.payments?.captures?.[0]
    if (capture?.status !== 'COMPLETED') {
      throw new Error(`Payment not completed: ${capture?.status}`)
    }

    const { data: existingOrder, error: orderLookupError } = await supabase
      .from('pending_paypal_orders')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle()

    if (orderLookupError) throw orderLookupError
    if (!existingOrder || existingOrder.user_id !== userId) throw new Error('Invalid order')

    if (existingOrder.status === 'captured' && existingOrder.capture_id) {
      return new Response(
        JSON.stringify({ success: true, coins: existingOrder.coins, newBalance: existingOrder.coins }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (existingOrder.status !== 'pending') {
      throw new Error(`Order is already ${existingOrder.status}`)
    }

    const { data: claimedOrder, error: claimError } = await supabase
      .from('pending_paypal_orders')
      .update({
        status: 'processing',
        capture_id: capture.id,
        captured_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .select('*')
      .single()

    if (claimError || !claimedOrder) {
      const { data: reloadedOrder } = await supabase
        .from('pending_paypal_orders')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle()

      if (reloadedOrder?.status === 'captured' && reloadedOrder.capture_id) {
        return new Response(
          JSON.stringify({ success: true, coins: reloadedOrder.coins, newBalance: reloadedOrder.coins }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      throw new Error('Order is already being processed')
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('troll_coins,total_deposited')
      .eq('id', userId)
      .single()

    if (profileError) throw profileError

    const newBalance = Number(profile?.troll_coins || 0) + Number(claimedOrder.coins)
    const newTotalDeposited = Number(profile?.total_deposited || 0) + Number(claimedOrder.price_usd || 0)

    const { error: profileUpdateError } = await supabase
      .from('user_profiles')
      .update({ troll_coins: newBalance, total_deposited: newTotalDeposited })
      .eq('id', userId)

    if (profileUpdateError) throw profileUpdateError

    const { error: transactionError } = await supabase.from('coin_transactions').insert({
      user_id: userId,
      type: 'purchase',
      amount: claimedOrder.coins,
      price_usd: claimedOrder.price_usd,
      payment_id: capture.id,
      status: 'completed',
    })

    if (transactionError) throw transactionError

    const { error: finalizeError } = await supabase
      .from('pending_paypal_orders')
      .update({ status: 'captured', capture_id: capture.id, captured_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .eq('status', 'processing')

    if (finalizeError) throw finalizeError

    return new Response(
      JSON.stringify({ success: true, coins: claimedOrder.coins, newBalance }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
