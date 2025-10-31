import 'server-only'

import Stripe from 'stripe'

// Lazy, safe init: avoid throwing during import when no env key is present
export const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key, { apiVersion: '2024-06-20' })
}


