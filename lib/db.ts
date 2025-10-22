import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// Create SQL client
export const sql = neon(process.env.DATABASE_URL);

// Type definitions for database records
export interface DbUser {
  id: number;
  upi_hash: string;
  nullifier: string;
  created_at: Date;
  updated_at: Date;
}

export interface DbVoteCommitment {
  id: number;
  user_id: number;
  commitment_hash: string;
  vote_option: string | null;
  vote_color: string | null;
  timestamp: number;
  is_finalized: boolean;
  is_current: boolean;
  created_at: Date;
}

export interface DbMerkleProof {
  id: number;
  commitment_id: number;
  leaf_hash: string;
  root_hash: string;
  proof_path: Array<{ hash: string; position: "left" | "right" }>;
  is_verified: boolean;
  created_at: Date;
}

export interface DbVoteTally {
  id: number;
  vote_option: string;
  vote_count: number;
  updated_at: Date;
}

// Database operations
export const db = {
  // User operations
  async getUserByUpiHash(upiHash: string): Promise<DbUser | null> {
    const result = await sql`
      SELECT * FROM users WHERE upi_hash = ${upiHash} LIMIT 1
    `;
    return (result[0] as DbUser) || null;
  },

  async getUserByNullifier(nullifier: string): Promise<DbUser | null> {
    const result = await sql`
      SELECT * FROM users WHERE nullifier = ${nullifier} LIMIT 1
    `;
    return (result[0] as DbUser) || null;
  },

  async createUser(upiHash: string, nullifier: string): Promise<DbUser> {
    const result = await sql`
      INSERT INTO users (upi_hash, nullifier)
      VALUES (${upiHash}, ${nullifier})
      RETURNING *
    `;
    return result[0] as DbUser;
  },

  // Vote commitment operations
  async getVoteCommitmentByUser(
    userId: number
  ): Promise<DbVoteCommitment | null> {
    const result = await sql`
      SELECT * FROM vote_commitments 
      WHERE id = ${userId} AND is_current = TRUE 
      LIMIT 1
    `;
    return (result[0] as DbVoteCommitment) || null;
  },

  async getVoteCommitmentByHash(
    commitmentHash: string
  ): Promise<DbVoteCommitment | null> {
    const result = await sql`
      SELECT * FROM vote_commitments 
      WHERE commitment_hash = ${commitmentHash}
      LIMIT 1
    `;
    return (result[0] as DbVoteCommitment) || null;
  },

  async createVoteCommitment(
    userId: number,
    commitmentHash: string,
    voteOption: string,
    voteColor: string,
    timestamp: number,
    isFinalized: boolean = false
  ): Promise<DbVoteCommitment> {
    const result = await sql`
      INSERT INTO vote_commitments 
        (user_id, commitment_hash, vote_option, vote_color, timestamp, is_finalized, is_current)
      VALUES 
        (${userId}, ${commitmentHash}, ${voteOption}, ${voteColor}, ${timestamp}, ${isFinalized}, TRUE)
      RETURNING *
    `;
    return result[0] as DbVoteCommitment;
  },

  async finalizeVoteCommitment(
    commitmentId: number
  ): Promise<DbVoteCommitment> {
    const result = await sql`
      UPDATE vote_commitments 
      SET is_finalized = TRUE 
      WHERE id = ${commitmentId}
      RETURNING *
    `;
    return result[0] as DbVoteCommitment;
  },

  async getAllFinalizedCommitments(): Promise<DbVoteCommitment[]> {
    const result = await sql`
      SELECT * FROM vote_commitments 
      WHERE is_finalized = TRUE
      ORDER BY created_at ASC
    `;
    return result as DbVoteCommitment[];
  },

  async getAllCurrentCommitments(): Promise<DbVoteCommitment[]> {
    const result = await sql`
      SELECT * FROM vote_commitments 
      WHERE is_current = TRUE
      ORDER BY created_at ASC
    `;
    return result as DbVoteCommitment[];
  },

  // Merkle proof operations
  async saveMerkleProof(
    commitmentId: number,
    leafHash: string,
    rootHash: string,
    proofPath: Array<{ hash: string; position: "left" | "right" }>,
    isVerified: boolean
  ): Promise<DbMerkleProof> {
    const result = await sql`
      INSERT INTO merkle_proofs 
        (commitment_id, leaf_hash, root_hash, proof_path, is_verified)
      VALUES 
        (${commitmentId}, ${leafHash}, ${rootHash}, ${JSON.stringify(
      proofPath
    )}, ${isVerified})
      ON CONFLICT (commitment_id, root_hash) 
      DO UPDATE SET 
        proof_path = ${JSON.stringify(proofPath)},
        is_verified = ${isVerified}
      RETURNING *
    `;
    return result[0] as DbMerkleProof;
  },

  async getMerkleProofByCommitment(
    commitmentId: number
  ): Promise<DbMerkleProof | null> {
    const result = await sql`
      SELECT * FROM merkle_proofs 
      WHERE commitment_id = ${commitmentId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return (result[0] as DbMerkleProof) || null;
  },

  // Vote tally operations
  async getVoteTallies(): Promise<DbVoteTally[]> {
    const result = await sql`
      SELECT * FROM vote_tallies ORDER BY vote_option
    `;
    return result as DbVoteTally[];
  },

  async incrementVoteTally(voteOption: string): Promise<void> {
    await sql`
      INSERT INTO vote_tallies (vote_option, vote_count)
      VALUES (${voteOption}, 1)
      ON CONFLICT (vote_option) 
      DO UPDATE SET 
        vote_count = vote_tallies.vote_count + 1,
        updated_at = CURRENT_TIMESTAMP
    `;
  },

  async decrementVoteTally(voteOption: string): Promise<void> {
    await sql`
      UPDATE vote_tallies 
      SET 
        vote_count = GREATEST(vote_count - 1, 0),
        updated_at = CURRENT_TIMESTAMP
      WHERE vote_option = ${voteOption}
    `;
  },

  // Audit log
  async logAction(
    actionType: string,
    userId: number | null,
    commitmentId: number | null,
    details: Record<string, unknown> | null
  ): Promise<void> {
    await sql`
      INSERT INTO audit_log (action_type, user_id, commitment_id, details)
      VALUES (${actionType}, ${userId}, ${commitmentId}, ${
      details ? JSON.stringify(details) : null
    })
    `;
  },

  // Get commitment colors for visualization
  async getCommitmentColors(): Promise<Record<string, string>> {
    const result = await sql`
      SELECT commitment_hash, vote_color 
      FROM vote_commitments 
      WHERE vote_color IS NOT NULL AND is_finalized = TRUE
    `;

    const colors: Record<string, string> = {};
    for (const row of result) {
      colors[row.commitment_hash] = row.vote_color;
    }
    return colors;
  },
};
