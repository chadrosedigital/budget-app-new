const { markSupabaseUserPaidFromReturn, verifySupabaseUser } = require("../payfast-shared");

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      res.status(401).json({ error: "Missing Supabase session token" });
      return;
    }

    const user = await verifySupabaseUser(token);
    if (!user?.id) {
      res.status(401).json({ error: "Invalid Supabase session" });
      return;
    }

    const updatedUser = await markSupabaseUserPaidFromReturn(user.id);
    res.status(200).json({
      allowed: true,
      reason: "paid",
      app_metadata: updatedUser.app_metadata,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not confirm PayFast return" });
  }
};
