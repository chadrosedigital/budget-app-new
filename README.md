# Budget Overview

A simple visual budget app for tracking income, expenses, leftover balance, and basic AI-style money advice.

The app includes Supabase Authentication and a demo payment gate with three plans:

- Free
- Pro Monthly: R49/month
- Pro Yearly: R299/year

The payment form is a static demo only. Real payments require a secure backend and a payment provider such as Stripe, PayFast, Peach Payments, or Yoco.

## Supabase Authentication

Authentication is connected to:

- Supabase URL: `https://crhsdxtsdofqtjhqzxox.supabase.co`
- Publishable key configured in `index.html`

The app supports signup, login, logout, and password reset. Add your deployed site URL to the Supabase Auth redirect URLs so email confirmations and password reset links return to the app correctly.

## Deploying to Vercel

Upload or push these files at the root of your GitHub repository:

- `index.html`
- `vercel.json`
- `README.md`

Do not upload the `.zip` file itself as the website source. Extract the zip first, then upload the files inside it to GitHub.
