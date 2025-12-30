import { createAuthClient } from 'better-auth/react';
import { dodopaymentsClient } from '@dodopayments/better-auth';
import { polarClient } from '@polar-sh/better-auth';

// Only include DodoPayments plugin if API key is provided
export const betterauthClient = createAuthClient({
  baseURL: process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_APP_URL : 'http://localhost:3000',
  plugins: process.env.DODO_PAYMENTS_API_KEY ? [dodopaymentsClient()] : [],
});

// Only include Polar plugin if access token is provided
export const authClient = createAuthClient({
  baseURL: process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_APP_URL : 'http://localhost:3000',
  plugins: process.env.POLAR_ACCESS_TOKEN ? [polarClient()] : [],
});

export const { signIn, signOut, signUp, useSession } = authClient;
