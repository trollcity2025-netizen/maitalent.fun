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

    const userId = user.id
    const { orderId } = await req.json()

    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID')!
    const paypalClientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')!
    const paypalMode = Deno.env.get('PAYPAL_MODE') ?? Deno.env.get('Paypal_MODE') ?? 'sandbox'
    const paypalBase = paypalMode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'

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

    // Capture the order
    const captureRes = await fetch(`${paypalBase}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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

    // Look up the pending order
    const { data: order } = await supabase
      .from('pending_paypal_orders')
      .select('*')
      .eq('order_id', orderId)
      .single()

    if (!order || order.user_id !== userId) {
      throw new Error('Invalid order')
    }

    // Credit coins to public.user_profiles only
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('troll_coins,total_deposited')
      .eq('id', userId)
      .single()

    const newBalance = (profile?.troll_coins || 0) + order.coins
    const newTotalDeposited = Number(profile?.total_deposited || 0) + Number(order.price_usd || 0)

    await supabase.from('user_profiles').update({ troll_coins: newBalance, total_deposited: newTotalDeposited }).eq('id', userId)

    // Record transaction
    await supabase.from('coin_transactions').insert({
      user_id: userId,
      type: 'purchase',
      amount: order.coins,
      price_usd: order.price_usd,
      payment_id: capture.id,
      status: 'completed',
    })

    // Update order status
    await supabase
      .from('pending_paypal_orders')
      .update({ status: 'captured', capture_id: capture.id, captured_at: new Date().toISOString() })
      .eq('order_id', orderId)

    return new Response(
      JSON.stringify({ success: true, coins: order.coins, newBalance }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
