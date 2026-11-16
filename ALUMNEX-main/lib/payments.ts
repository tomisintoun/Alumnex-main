import { createHmac } from "node:crypto";
import { one, query, transaction } from "./db";
import { assert, equal, notify, audit } from "./security";
export function paymentSignature(raw: string, signature: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  return (
    !!secret &&
    equal(createHmac("sha512", secret).update(raw).digest("hex"), signature)
  );
}
export async function provider(path: string, options: RequestInit = {}) {
  assert(
    process.env.PAYSTACK_SECRET_KEY,
    503,
    "Giving is awaiting payment-provider configuration. No payment has been taken.",
  );
  const response = await fetch("https://api.paystack.co" + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + process.env.PAYSTACK_SECRET_KEY,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });
  const result = await response.json();
  assert(
    response.ok && result.status,
    502,
    "Payment provider could not complete this request. Please try again.",
  );
  return result.data;
}
export async function verifyPayment(reference: string) {
  const data = await provider(
    "/transaction/verify/" + encodeURIComponent(reference),
  );
  return settlePayment(reference, data);
}
export async function settlePayment(
  reference: string,
  data: Record<string, any>,
) {
  return transaction(async () => {
    const donation = await one(
      "SELECT d.*,u.email FROM donations d JOIN users u ON d.user_id=u.id WHERE reference=$1" +
        (process.env.DATABASE_URL ? " FOR UPDATE OF d" : ""),
      [reference],
    );
    assert(donation, 404, "Donation not found.");
    assert(
      data.status === "success" &&
        data.reference === reference &&
        Number(data.amount) === Number(donation.amount) &&
        data.currency === "NGN" &&
        data.customer?.email?.toLowerCase() === donation.email.toLowerCase(),
      409,
      "Payment confirmation did not match the donation.",
    );
    if (donation.status === "paid") return donation;
    await query(
      "UPDATE donations SET status=$1,provider_id=$2,paid_at=$3 WHERE id=$4 AND status=$5",
      ["paid", String(data.id), Date.now(), donation.id, "pending"],
    );
    await audit(donation.user_id, "donation_confirmed", donation.id, {
      amount: donation.amount,
      currency: "NGN",
    });
    await notify(
      donation.user_id,
      "Thank you for giving back to ABUAD.",
      "Your donation is confirmed. Your receipt is ready.",
      "/app/giving/history",
    );
    return { ...donation, status: "paid" };
  });
}
