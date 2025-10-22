import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { commitmentId, voteOption, previousVoteOption, proofData } =
      await request.json();

    if (!commitmentId || !voteOption) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get the commitment
    const commitment = await db.getVoteCommitmentByHash(
      (await db.getVoteCommitmentByUser(commitmentId))?.commitment_hash || ""
    );

    if (!commitment) {
      return NextResponse.json(
        { error: "Commitment not found" },
        { status: 404 }
      );
    }

    // Check if already finalized
    if (commitment.is_finalized) {
      return NextResponse.json(
        { error: "Vote already finalized" },
        { status: 400 }
      );
    }

    // If updating vote, decrement old vote count
    if (previousVoteOption) {
      await db.decrementVoteTally(previousVoteOption);
    }

    // Finalize the commitment
    await db.finalizeVoteCommitment(commitment.id);

    // Increment new vote count
    await db.incrementVoteTally(voteOption);

    // Save Merkle proof if provided
    if (proofData && proofData.proof && proofData.root) {
      await db.saveMerkleProof(
        commitment.id,
        proofData.leaf,
        proofData.root,
        proofData.proof.path,
        proofData.verified
      );
    }

    await db.logAction("VOTE_FINALIZED", commitment.user_id, commitment.id, {
      vote_option: voteOption,
      previous_vote_option: previousVoteOption,
    });

    return NextResponse.json({
      success: true,
      commitment: commitment.commitment_hash,
    });
  } catch (error) {
    console.error("Finalize vote error:", error);
    return NextResponse.json(
      { error: "Failed to finalize vote" },
      { status: 500 }
    );
  }
}
