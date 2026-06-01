# Budget Overview

A simple visual budget app for tracking income, expenses, leftover balance, and basic AI-style money advice.

The app includes Supabase Authentication and a PayFast payment gate with two access options:

- 3-day free trial
- Premium: R50 once-off

New users receive full app access during a 3-day trial. The trial start and end dates are stored securely in Supabase `app_metadata`. After the trial expires, access is blocked unless PayFast has confirmed the R50 once-off Premium payment.

## PayFast Lifetime Payment

The Premium plan redirects to PayFast and charges `R50.00` once-off for lifetime access. Payment confirmation is handled by the PayFast ITN endpoint:

`/api/payfast-itn`

After deploying, open this URL to confirm Vercel deployed the API functions:

`https://your-vercel-site.vercel.app/api/health`

It should return JSON with `"ok": true`. If it returns a Vercel `NOT_FOUND` page, the `api` folder was not uploaded or deployed from the project root.

Set these environment variables in Vercel:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`

Use the merchant details from your PayFast account. Do not place the merchant key, passphrase, or Supabase service role key in browser code.

The app also uses `/api/access-status` to create/check trial access and paid lifetime access.

## Supabase Authentication

Authentication is connected to:

- Supabase URL: `https://crhsdxtsdofqtjhqzxox.supabase.co`
- Publishable key configured in `index.html`

The app supports signup, login, logout, and password reset. Add your deployed site URL to the Supabase Auth redirect URLs so email confirmations and password reset links return to the app correctly.

## Deploying to Vercel

Upload or push these files at the root of your GitHub repository:

- `index.html`
- `api/`
- `package.json`
- `vercel.json`
- `README.md`

Do not upload the `.zip` file itself as the website source. Extract the zip first, then upload the files inside it to GitHub.
