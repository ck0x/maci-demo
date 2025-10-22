import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Get all finalized commitments for the Merkle tree
    const commitments = await db.getAllFinalizedCommitments();

    // Get vote tallies
    const tallies = await db.getVoteTallies();

    // Get commitment colors for visualization
    const colors = await db.getCommitmentColors();

    return NextResponse.json({
      success: true,
      commitments: commitments.map((c) => ({
        hash: c.commitment_hash,
        color: c.vote_color,
        timestamp: c.timestamp,
      })),
      tallies: tallies.reduce((acc, t) => {
        acc[t.vote_option] = t.vote_count;
        return acc;
      }, {} as Record<string, number>),
      colors,
    });
  } catch (error) {
    console.error("Get voting data error:", error);
    return NextResponse.json(
      { error: "Failed to get voting data" },
      { status: 500 }
    );
  }
}
