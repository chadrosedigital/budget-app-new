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

function stripSignatureFromParamString(paramString) {
  return String(paramString || "")
    .split("&")
    .filter((pair) => pair && !pair.startsWith("signature="))
    .join("&");
}

function createSignatureFromParamString(paramString, passphrase) {
  const base = stripSignatureFromParamString(paramString);
  const signedString = passphrase ? `${base}&passphrase=${encodePayFastValue(passphrase)}` : base;
  return crypto.createHash("md5").update(signedString).digest("hex");
}

async function verifySupabaseUser(accessToken) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase environment variables are not configured on the server");
  }

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
  const updatedUser = await updateSupabaseAppMetadata(userId, {
    payfast_paid: true,
    plan: "premium",
    lifetime_access: true,
    payment_status: payment.payment_status,
    payment_amount: payment.amount_gross,
    payfast_payment_id: payment.pf_payment_id,
    paid_at: new Date().toISOString(),
  });

  await recordSupabasePayment(userId, {
    status: "paid",
    payment_status: payment.payment_status,
    payment_amount: payment.amount_gross,
    payfast_payment_id: payment.pf_payment_id,
    m_payment_id: payment.m_payment_id,
    raw: payment,
  });

  return updatedUser;
}

async function markSupabaseUserPaidFromReturn(userId) {
  const payment = {
    payment_status: "RETURN_CONFIRMED",
    amount_gross: "49.00",
    pf_payment_id: null,
    m_payment_id: null,
    source: "payfast_return",
  };

  const updatedUser = await updateSupabaseAppMetadata(userId, {
    payfast_paid: true,
    plan: "premium",
    lifetime_access: true,
    payment_status: payment.payment_status,
    payment_amount: payment.amount_gross,
    payfast_payment_id: payment.pf_payment_id,
    paid_at: new Date().toISOString(),
  });

  await recordSupabasePayment(userId, {
    status: "paid",
    payment_status: payment.payment_status,
    payment_amount: payment.amount_gross,
    payfast_payment_id: payment.pf_payment_id,
    m_payment_id: payment.m_payment_id,
    raw: payment,
  });

  return updatedUser;
}

async function recordSupabasePayment(userId, payment) {
  try {
    return await upsertSupabasePaymentRecord(userId, payment);
  } catch (error) {
    console.error(error.message || "Could not record Supabase payment");
    return null;
  }
}

async function upsertSupabasePaymentRecord(userId, payment) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service role environment variables are not configured on the server");
  }

  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/user_payments`, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      user_id: userId,
      status: payment.status || "pending",
      payment_status: payment.payment_status || null,
      payment_amount: payment.payment_amount || null,
      payfast_payment_id: payment.payfast_payment_id || null,
      m_payment_id: payment.m_payment_id || null,
      raw: payment.raw || null,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase payment record update failed: ${await response.text()}`);
  }

  return response.json();
}

async function updateSupabaseAppMetadata(userId, metadata) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service role environment variables are not configured on the server");
  }

  const currentResponse = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!currentResponse.ok) {
    throw new Error(`Supabase user lookup failed: ${await currentResponse.text()}`);
  }

  const currentUser = await currentResponse.json();
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_metadata: {
        ...(currentUser.app_metadata || {}),
        ...metadata,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase paid update failed: ${await response.text()}`);
  }

  return response.json();
}

async function verifyPayFastItn(fields, paramString) {
  const response = await fetch(PAYFAST_VALIDATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: paramString || signatureString(fields),
  });

  const text = await response.text();
  return text.trim() === "VALID";
}

module.exports = {
  PAYFAST_HOST,
  createSignature,
  createSignatureFromParamString,
  markSupabaseUserPaid,
  markSupabaseUserPaidFromReturn,
  recordSupabasePayment,
  signatureString,
  stripSignatureFromParamString,
  updateSupabaseAppMetadata,
  upsertSupabasePaymentRecord,
  verifyPayFastItn,
  verifySupabaseUser,
};
