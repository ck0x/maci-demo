import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  try {
    const { upi } = await request.json();

    if (!upi || typeof upi !== "string") {
      return NextResponse.json({ error: "UPI is required" }, { status: 400 });
    }

    const trimmedUpi = upi.trim().toLowerCase();

    // Hash the UPI for storage
    const upiHash = await sha256(trimmedUpi);
    const nullifier = await sha256(`nullifier:${trimmedUpi}`);

    // Check if user already exists
    let user = await db.getUserByUpiHash(upiHash);

    if (!user) {
      // Create new user
      user = await db.createUser(upiHash, nullifier);
      await db.logAction("USER_SIGNUP", user.id, null, { upi_hash: upiHash });
    }

    // Check if user has an existing vote
    const existingVote = await db.getVoteCommitmentByUser(user.id);

    return NextResponse.json({
      success: true,
      nullifier,
      userId: user.id,
      hasExistingVote: !!existingVote,
      existingVote: existingVote
        ? {
            commitment: existingVote.commitment_hash,
            voteOption: existingVote.vote_option,
            voteColor: existingVote.vote_color,
            finalized: existingVote.is_finalized,
          }
        : null,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Failed to sign up" }, { status: 500 });
  }
}
