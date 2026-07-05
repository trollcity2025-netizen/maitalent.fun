// @ts-nocheck
/* eslint-disable */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const Deno: any = globalThis.Deno as any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  console.log('[coin-purchase] Incoming request URL', req.url)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')

    console.log('[coin-purchase] Request received', {
      method: req.method,
      hasAuth: !!authHeader,
      contentType: req.headers.get('content-type'),
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer'),
    })

    if (!authHeader) {
      console.error('[coin-purchase] Missing Authorization header')
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    console.log('[coin-purchase] Env check', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRole: !!supabaseServiceRole,
    })

    const supabase = createClient(supabaseUrl, supabaseServiceRole, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('[coin-purchase] Unauthorized - invalid token')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log('[coin-purchase] User authenticated', { userId: user.id, email: user.email })

    const body = await req.json().catch((e: unknown) => {
      console.error('[coin-purchase] JSON parse error:', e)
      return null
    })

    console.log('[coin-purchase] request body:', body)

    if (!body) {
      return new Response(JSON.stringify({ error: 'Missing JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (body.tokens === undefined && body.coins === undefined) {
      return new Response(JSON.stringify({ error: 'Missing tokens' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (body.price === undefined) {
      return new Response(JSON.stringify({ error: 'Missing price' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tokens = Number(body.tokens ?? body.coins)
    const price = Number(body.price)
    const packageLabel = body.packageLabel ?? body.label

    console.log('[coin-purchase] Parsed values', {
      tokens,
      price,
      packageLabel,
      bodyTokensType: typeof body?.tokens,
      bodyCoinsType: typeof body?.coins,
      bodyPriceType: typeof body?.price,
    })

    if (!Number.isFinite(tokens) || tokens <= 0) {
      console.error('[coin-purchase] Invalid tokens amount', { tokens })
      return new Response(JSON.stringify({ error: 'Invalid tokens amount', received: body?.tokens ?? body?.coins }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!Number.isFinite(price) || price <= 0) {
      console.error('[coin-purchase] Invalid price amount', { price })
      return new Response(JSON.stringify({ error: 'Invalid price amount', received: body?.price }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID')
    const paypalClientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')
    const paypalMode = Deno.env.get('PAYPAL_MODE') ?? Deno.env.get('Paypal_MODE') ?? 'sandbox'
    const paypalBase = paypalMode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'

    console.log('[coin-purchase] PayPal config', {
      hasClientId: !!paypalClientId,
      clientIdPrefix: paypalClientId?.slice(0, 8),
      hasSecret: !!paypalClientSecret,
      mode: paypalMode,
      baseUrl: paypalBase,
    })

    if (!paypalClientId || !paypalClientSecret) {
      console.error('[coin-purchase] Missing PayPal credentials')
      return new Response(JSON.stringify({ error: 'PayPal credentials not configured on server' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get PayPal access token
    const auth = btoa(`${paypalClientId}:${paypalClientSecret}`)
    console.log('[coin-purchase] Requesting PayPal token...')

    const tokenRes = await fetch(`${paypalBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    const tokenData = await tokenRes.json()
    console.log('[coin-purchase] PayPal token response', {
      status: tokenRes.status,
      ok: tokenRes.ok,
      hasAccessToken: !!tokenData.access_token,
      error: tokenData.error || tokenData.error_description,
      tokenType: tokenData.token_type,
    })

    if (!tokenRes.ok) throw new Error(tokenData.error_description || `PayPal token error: ${tokenRes.status}`)

    const accessToken = tokenData.access_token

    // Create PayPal order
    console.log('[coin-purchase] Creating PayPal order', { tokens, price, packageLabel })

    const orderRes = await fetch(`${paypalBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: price.toFixed(2),
          },
          description: `${tokens} Tokens - MaiTalent.fun`,
        }],
        application_context: {
          brand_name: 'MaiTalent.fun',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
        },
      }),
    })

    const orderData = await orderRes.json()
    console.log('[coin-purchase] PayPal order response', {
      status: orderRes.status,
      ok: orderRes.ok,
      orderId: orderData.id,
      statusText: orderData.status,
      error: orderData.message || orderData.name,
      raw: orderData,
    })

    if (!orderRes.ok) throw new Error(orderData.message || orderData.name || 'Failed to create order')

    // Store pending order in DB
    console.log('[coin-purchase] Storing pending order in DB', { orderId: orderData.id, userId: user.id, tokens, packageLabel })

    const { error }: any = await supabase
      .from('pending_paypal_orders')
      .upsert({
        order_id: orderData.id,
        user_id: user.id,
        coins: tokens,
        price_usd: price,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'order_id' }) as any

    if (error) console.error('[coin-purchase] DB insert error:', error)
    else console.log('[coin-purchase] Order stored successfully')

    console.log('[coin-purchase] Success - returning orderId')
    return new Response(
      JSON.stringify({ orderId: orderData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[coin-purchase] Unhandled error:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      cause: error instanceof Error ? (error as any).cause : undefined,
    })
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
