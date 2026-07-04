-- Gift card types reference table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.gift_card_types (
    code TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    min_amount INTEGER NOT NULL DEFAULT 5,
    max_amount INTEGER NOT NULL DEFAULT 500,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Populate common gift card types
INSERT INTO public.gift_card_types (code, provider, description, image_url, min_amount, max_amount)
VALUES
    ('visa', 'Visa', 'Standard Visa gift card', 'https://example.com/visa-gift-card.png', 5, 500),
    ('amzn', 'Amazon', 'Amazon gift cards', 'https://example.com/amazon-gift-card.png', 25, 200),
    ('gc-com', 'Google Card', 'Google Play & YouTube cards', 'https://example.com/google-gift-card.png', 5, 100)
ON CONFLICT (code) DO UPDATE SET
    provider = EXCLUDED.provider,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    min_amount = EXCLUDED.min_amount,
    max_amount = EXCLUDED.max_amount;

-- Enable RLS
ALTER TABLE public.gift_card_types ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read gift card types
DROP POLICY IF EXISTS gift_card_types_read ON public.gift_card_types;
CREATE POLICY gift_card_types_read ON public.gift_card_types
    FOR SELECT TO authenticated USING (true);

-- Allow admins to manage gift card types
DROP POLICY IF EXISTS gift_card_types_admin_all ON public.gift_card_types;
CREATE POLICY gift_card_types_admin_all ON public.gift_card_types
    FOR ALL TO authenticated USING (public.is_requester_admin()) WITH CHECK (public.is_requester_admin());

NOTIFY pgrst, 'reload schema';