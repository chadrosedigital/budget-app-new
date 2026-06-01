const crypto = require("crypto");

const PAYFAST_HOST = process.env.PAYFAST_HOST || "https://www.payfast.co.za";
const PAYFAST_VALIDATE_URL = `${PAYFAST_HOST}/eng/query/validate`;

function encodePayFastValue(value) {
  return encodeURIComponent(String(value).trim()).replace(/%20/g, "+");
}

function signatureString(fields, passphrase) {
  const pairs = Object.entries(fields)
    .filter(([key, value]) => key !== "signature" && value !== undefined && value !== null && String(value) !== "")
    .map(([key, value]) => `${key}=${encodePayFastValue(value)}`);

  if (passphrase) {
    pairs.push(`passphrase=${encodePayFastValue(passphrase)}`);
  }

  return pairs.join("&");
}

function createSignature(fields, passphrase) {
  return crypto.createHash("md5").update(signatureString(fields, passphrase)).digest("hex");
}

async function verifySupabaseUser(accessToken) {
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

async function markSupabaseUserPaid(userId, payment) {
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_metadata: {
        payfast_paid: true,
        plan: "premium",
        lifetime_access: true,
        payment_status: payment.payment_status,
        payment_amount: payment.amount_gross,
        payfast_payment_id: payment.pf_payment_id,
        paid_at: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase paid update failed: ${await response.text()}`);
  }

  return response.json();
}

async function verifyPayFastItn(fields) {
  const response = await fetch(PAYFAST_VALIDATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: signatureString(fields),
  });

  const text = await response.text();
  return text.trim() === "VALID";
}

module.exports = {
  PAYFAST_HOST,
  createSignature,
  markSupabaseUserPaid,
  signatureString,
  verifyPayFastItn,
  verifySupabaseUser,
};
