import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  try {
    const { redemptionId, email, amount } = await req.json()
    
    if (!email) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No email address provided for gift card notification' 
        }), 
        { 
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          }
        }
      )
    }

    // Create a mailto: link that will open the user's default email client
    const subject = `Your Visa Gift Card from MAI Pay ($${amount})`
    const body = `
Dear MAI Pay User,

Your Visa gift card for $${amount} has been approved and is ready for use.

You can access your gift card details in your MAI Pay account dashboard.

If you have any questions, please contact our support team.

Best regards,
The MAI Pay Team
`.trim()

    const mailtoLink = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

    // Return success response with the mailto link
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email client opened successfully',
        mailtoLink,
        email: email,
        amount: amount,
        redemptionId
      }), 
      { 
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        }
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to prepare email' 
      }), 
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        }
      }
    )
  }
})