const { createSignature, markSupabaseUserPaid, verifyPayFastItn } = require("../payfast-shared");

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function parseItnBody(rawBody, parsedBody) {
  if (parsedBody && typeof parsedBody === "object" && !Buffer.isBuffer(parsedBody)) {
    return parsedBody;
  }

  const params = new URLSearchParams(rawBody || "");
  return Object.fromEntries(params.entries());
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    const rawBody = req.body && typeof req.body === "object" ? "" : typeof req.body === "string" ? req.body : await collectBody(req);
    const fields = parseItnBody(rawBody, req.body);
    const expectedSignature = createSignature(fields, process.env.PAYFAST_PASSPHRASE);

    if (fields.signature !== expectedSignature) {
      res.status(400).send("Invalid signature");
      return;
    }

    const validPayFastPost = await verifyPayFastItn(fields);
    if (!validPayFastPost) {
      res.status(400).send("Invalid PayFast validation");
      return;
    }

    if (fields.merchant_id !== process.env.PAYFAST_MERCHANT_ID) {
      res.status(400).send("Invalid merchant");
      return;
    }

    if (fields.payment_status !== "COMPLETE" || Number(fields.amount_gross) !== 50) {
      res.status(200).send("Ignored");
      return;
    }

    const userId = fields.custom_str1;
    if (!userId) {
      res.status(400).send("Missing user id");
      return;
    }

    await markSupabaseUserPaid(userId, fields);
    res.status(200).send("OK");
  } catch (error) {
    res.status(500).send(error.message || "ITN failed");
  }
};
