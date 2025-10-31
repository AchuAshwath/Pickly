import 'server-only'

import Stripe from 'stripe'

// Lazy, safe init: avoid throwing during import when no env key is present
export const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  // Use the SDK's bundled API version to satisfy types across releases
  return new Stripe(key)
}


