const { updateSupabaseAppMetadata, verifySupabaseUser } = require("./payfast-shared");

const TRIAL_DAYS = 3;

function addTrialDays(date) {
  const trialEnd = new Date(date);
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
  return trialEnd;
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
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

    const now = new Date();
    const metadata = user.app_metadata || {};

    if (metadata.payfast_paid || metadata.lifetime_access) {
      res.status(200).json({
        allowed: true,
        reason: "paid",
        planLabel: "Premium",
        app_metadata: metadata,
      });
      return;
    }

    if (!metadata.trial_start || !metadata.trial_end) {
      if (req.method !== "POST") {
        res.status(200).json({
          allowed: false,
          reason: "choose_access",
          planLabel: "Choose Access",
          app_metadata: metadata,
        });
        return;
      }

      const trialStart = now;
      const trialEnd = addTrialDays(now);
      const updatedUser = await updateSupabaseAppMetadata(user.id, {
        trial_start: trialStart.toISOString(),
        trial_end: trialEnd.toISOString(),
        trial_status: "active",
      });

      res.status(200).json({
        allowed: true,
        reason: "trial",
        planLabel: "3-Day Trial",
        trialStart: trialStart.toISOString(),
        trialEnd: trialEnd.toISOString(),
        app_metadata: updatedUser.app_metadata,
      });
      return;
    }

    const trialEnd = new Date(metadata.trial_end);
    if (trialEnd > now) {
      res.status(200).json({
        allowed: true,
        reason: "trial",
        planLabel: "3-Day Trial",
        trialStart: metadata.trial_start,
        trialEnd: metadata.trial_end,
        app_metadata: metadata,
      });
      return;
    }

    await updateSupabaseAppMetadata(user.id, { trial_status: "expired" });
    res.status(200).json({
      allowed: false,
      reason: "trial_expired",
      planLabel: "Trial Expired",
      trialStart: metadata.trial_start,
      trialEnd: metadata.trial_end,
      app_metadata: {
        ...metadata,
        trial_status: "expired",
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not check access" });
  }
};
