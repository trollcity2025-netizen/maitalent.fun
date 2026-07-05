// @ts-nocheck
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

  let orderId: string | null = null
  let captureSucceeded = false
  let supabase: any = null

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

    supabase = createClient(supabaseUrl, supabaseServiceRole, {
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
    orderId = body.orderId

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

    const { data: existingOrder, error: orderLookupError } = await supabase
      .from('pending_paypal_orders')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle()

    if (orderLookupError) throw new Error(orderLookupError?.message || JSON.stringify(orderLookupError))
    if (!existingOrder || existingOrder.user_id !== userId) throw new Error('Invalid order')

    if ((existingOrder.status === 'captured' || existingOrder.status === 'completed') && existingOrder.capture_id) {
      return new Response(
        JSON.stringify({ success: true, coins: existingOrder.coins, newBalance: existingOrder.coins, alreadyCompleted: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const lockedAt = existingOrder.updated_at ? new Date(existingOrder.updated_at).getTime() : 0
    const lockExpired = !lockedAt || Date.now() - lockedAt > 2 * 60 * 1000
    if (existingOrder.status === 'processing' && !lockExpired) {
      return new Response(
        JSON.stringify({ error: 'Payment is still processing. Please wait.' }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (existingOrder.status !== 'pending' && !(existingOrder.status === 'processing' && lockExpired)) {
      throw new Error(`Order is already ${existingOrder.status}`)
    }

    const allowedStatuses = existingOrder.status === 'pending' ? ['pending'] : ['pending', 'processing']
    const { data: claimedRows, error: claimError } = await supabase
      .from('pending_paypal_orders')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)
      .in('status', allowedStatuses)
      .select('*')

    if (claimError) throw new Error(claimError?.message || JSON.stringify(claimError))

    const claimedOrder = Array.isArray(claimedRows) ? claimedRows[0] : claimedRows

    if (!claimedOrder) {
      const { data: reloadedOrder } = await supabase
        .from('pending_paypal_orders')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle()

      return new Response(
        JSON.stringify({ error: `Could not claim order. Current status: ${reloadedOrder?.status || 'missing'}` }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

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
    if (!tokenRes.ok) throw new Error(tokenData.error_description || JSON.stringify(tokenData) || 'Failed to get PayPal token')

    const accessToken = tokenData.access_token

    const captureRes = await fetch(`${paypalBase}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
    const captureData = await captureRes.json()
    if (!captureRes.ok) throw new Error(captureData.message || JSON.stringify(captureData) || 'Failed to capture payment')

    const purchaseUnit = captureData.purchase_units?.[0]
    const capture = purchaseUnit?.payments?.captures?.[0]
    if (capture?.status !== 'COMPLETED') {
      throw new Error(`Payment not completed: ${capture?.status}`)
    }

    captureSucceeded = true

    const order = claimedOrder

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('troll_coins,total_deposited')
      .eq('id', userId)
      .single()

    if (profileError) throw new Error(profileError?.message || JSON.stringify(profileError))

    const newBalance = Number(profile?.troll_coins || 0) + Number(order.coins)
    const newTotalDeposited = Number(profile?.total_deposited || 0) + Number(order.price_usd || 0)

    const { error: profileUpdateError } = await supabase
      .from('user_profiles')
      .update({ troll_coins: newBalance, total_deposited: newTotalDeposited })
      .eq('id', userId)

    if (profileUpdateError) throw new Error(profileUpdateError?.message || JSON.stringify(profileUpdateError))

    const { error: transactionError } = await supabase.from('coin_transactions').insert({
      user_id: userId,
      type: 'purchase',
      amount: order.coins,
      price_usd: order.price_usd,
      payment_id: capture.id,
      status: 'completed',
    })

    if (transactionError) throw new Error(transactionError?.message || JSON.stringify(transactionError))

    const { error: finalizeError } = await supabase
      .from('pending_paypal_orders')
      .update({ status: 'captured', capture_id: capture.id, captured_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .eq('status', 'processing')

    if (finalizeError) throw new Error(finalizeError?.message || JSON.stringify(finalizeError))

    return new Response(
      JSON.stringify({ success: true, coins: order.coins, newBalance }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    try {
      if (orderId && supabase) {
        const rollbackUpdate = captureSucceeded
          ? { updated_at: new Date().toISOString() }
          : { status: 'failed', updated_at: new Date().toISOString() }

        await supabase
          .from('pending_paypal_orders')
          .update(rollbackUpdate)
          .eq('order_id', orderId)
          .in('status', ['pending', 'processing'])
      }
    } catch (updateError) {
      console.error('[coin-capture] Failed to update order status after error', updateError)
    }

    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === 'object'
      ? JSON.stringify(error)
      : String(error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
