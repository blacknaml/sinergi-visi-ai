export type ClaimDecision = {
  status: "approved" | "manual_review";
  reason: string;
  amount: number;
};

export const evaluateClaim = (
  isDamaged: boolean,
  confidence: number,
  price: number
): ClaimDecision => {
  const THRESHOLD = 500000;

  if (!isDamaged || confidence < 0.8) {
    return {
      status: "manual_review",
      reason: "Kerusakan tidak terdeteksi dengan jelas atau tingkat kepercayaan rendah. Perlu verifikasi manual oleh agen.",
      amount: price,
    };
  }

  if (price <= THRESHOLD) {
    return {
      status: "approved",
      reason: "Klaim valid dan nilai di bawah ambang batas otomatis (Rp 500.000).",
      amount: price,
    };
  }

  return {
    status: "manual_review",
    reason: "Klaim valid secara visual (Gemini), namun nilai nominal melebihi ambang batas otomatis (Rp 500.000).",
    amount: price,
  };
};
