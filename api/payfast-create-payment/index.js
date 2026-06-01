const { PAYFAST_HOST, createSignature, verifySupabaseUser } = require("../payfast-shared");

function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing server environment variables: ${missing.join(", ")}`);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    requireEnv([
      "SUPABASE_URL",
      "SUPABASE_PUBLISHABLE_KEY",
      "PAYFAST_MERCHANT_ID",
      "PAYFAST_MERCHANT_KEY",
      "PAYFAST_PASSPHRASE",
    ]);

    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      res.status(401).json({ error: "Missing Supabase session token" });
      return;
    }

    const user = await verifySupabaseUser(token);
    if (!user?.id || !user?.email) {
      res.status(401).json({ error: "Invalid Supabase session" });
      return;
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const paymentId = `lifetime_${user.id}_${Date.now()}`.slice(0, 100);
    const fields = {
      merchant_id: process.env.PAYFAST_MERCHANT_ID,
      merchant_key: process.env.PAYFAST_MERCHANT_KEY,
      return_url: `${origin}/?payment=return`,
      cancel_url: `${origin}/?payment=cancelled`,
      notify_url: `${origin}/api/payfast-itn`,
      email_address: user.email,
      m_payment_id: paymentId,
      amount: "50.00",
      item_name: "Budget App Lifetime Access",
      item_description: "Once-off lifetime access to the premium budget app",
      custom_str1: user.id,
    };

    fields.signature = createSignature(fields, process.env.PAYFAST_PASSPHRASE);

    res.status(200).json({
      action: `${PAYFAST_HOST}/eng/process`,
      fields,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not create PayFast payment" });
  }
};
