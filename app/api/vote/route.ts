import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createVoteCommitment } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  try {
    const { upi, voteOption, voteColor } = await request.json();

    if (!upi || !voteOption || !voteColor) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const trimmedUpi = upi.trim().toLowerCase();

    // Get user
    const upiHash = await import("@/lib/crypto").then((m) =>
      m.sha256(trimmedUpi)
    );
    const user = await db.getUserByUpiHash(upiHash);

    if (!user) {
      return NextResponse.json(
        { error: "User not found. Please sign up first." },
        { status: 404 }
      );
    }

    // Create vote commitment
    const commitment = await createVoteCommitment(trimmedUpi, voteOption);
    const timestamp = Date.now();

    // Check if user already has a vote
    const existingVote = await db.getVoteCommitmentByUser(user.id);
    const isUpdate = !!existingVote;

    // Save vote commitment (not finalized yet)
    const voteRecord = await db.createVoteCommitment(
      user.id,
      commitment,
      voteOption,
      voteColor,
      timestamp,
      false // not finalized
    );

    await db.logAction(
      isUpdate ? "VOTE_UPDATED" : "VOTE_CAST",
      user.id,
      voteRecord.id,
      { vote_option: voteOption, commitment }
    );

    return NextResponse.json({
      success: true,
      commitment,
      commitmentId: voteRecord.id,
      isUpdate,
      previousVoteOption: existingVote?.vote_option || null,
    });
  } catch (error) {
    console.error("Cast vote error:", error);
    return NextResponse.json({ error: "Failed to cast vote" }, { status: 500 });
  }
}
