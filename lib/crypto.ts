// Cryptographic utilities for zero-knowledge voting system

/**
 * Hash a string using SHA-256
 */
export async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a nullifier from UPI to prevent double voting
 */
export async function generateNullifier(upi: string): Promise<string> {
  return await sha256(`nullifier:${upi}`);
}

/**
 * Create a vote commitment (hash of UPI + vote + salt)
 */
export async function createVoteCommitment(
  upi: string,
  voteOption: string,
  salt: string = Date.now().toString()
): Promise<string> {
  return await sha256(`${upi}:${voteOption}:${salt}`);
}

/**
 * Merkle Tree Node
 */
export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  isLeaf: boolean;
  data?: string;
}

/**
 * Merkle Proof for verifying inclusion
 */
export interface MerkleProof {
  leaf: string;
  path: Array<{ hash: string; position: "left" | "right" }>;
  root: string;
}

/**
 * Merkle Tree implementation for vote commitments
 */
export class MerkleTree {
  private leaves: string[] = [];
  private root: MerkleNode | null = null;

  /**
   * Add a vote commitment as a leaf to the tree
   */
  async addLeaf(commitment: string): Promise<void> {
    // Avoid duplicate commitments
    if (!this.leaves.includes(commitment)) {
      this.leaves.push(commitment);
      await this.buildTree();
    }
  }

  /**
   * Remove a commitment (used when updating votes)
   */
  async removeLeaf(commitment: string): Promise<void> {
    const index = this.leaves.indexOf(commitment);
    if (index > -1) {
      this.leaves.splice(index, 1);
      await this.buildTree();
    }
  }
  /**
   * Build the Merkle tree from leaves
   */
  private async buildTree(): Promise<void> {
    if (this.leaves.length === 0) {
      this.root = null;
      return;
    }

    // Create leaf nodes
    let currentLevel: MerkleNode[] = this.leaves.map((leaf) => ({
      hash: leaf,
      isLeaf: true,
      data: leaf,
    }));

    // Build tree bottom-up
    while (currentLevel.length > 1) {
      const nextLevel: MerkleNode[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;

        const combinedHash = await sha256(left.hash + right.hash);
        nextLevel.push({
          hash: combinedHash,
          left,
          right,
          isLeaf: false,
        });
      }

      currentLevel = nextLevel;
    }

    this.root = currentLevel[0];
  }

  /**
   * Get the Merkle root hash
   */
  getRoot(): string | null {
    return this.root ? this.root.hash : null;
  }

  /**
   * Get all leaves
   */
  getLeaves(): string[] {
    return [...this.leaves];
  }

  /**
   * Generate a Merkle proof for a specific leaf
   */
  async generateProof(leafHash: string): Promise<MerkleProof | null> {
    const leafIndex = this.leaves.indexOf(leafHash);
    if (leafIndex === -1 || !this.root) {
      return null;
    }

    const path: Array<{ hash: string; position: "left" | "right" }> = [];
    let currentLevel: MerkleNode[] = this.leaves.map((leaf) => ({
      hash: leaf,
      isLeaf: true,
      data: leaf,
    }));
    let currentIndex = leafIndex;

    while (currentLevel.length > 1) {
      const nextLevel: MerkleNode[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;

        // If we're at the current index, add sibling to proof
        if (i === currentIndex || i + 1 === currentIndex) {
          if (i === currentIndex && i + 1 < currentLevel.length) {
            path.push({ hash: right.hash, position: "right" });
          } else if (i + 1 === currentIndex) {
            path.push({ hash: left.hash, position: "left" });
          }
        }

        const combinedHash = await sha256(left.hash + right.hash);
        nextLevel.push({
          hash: combinedHash,
          left,
          right,
          isLeaf: false,
        });
      }

      currentIndex = Math.floor(currentIndex / 2);
      currentLevel = nextLevel;
    }

    return {
      leaf: leafHash,
      path,
      root: this.root.hash,
    };
  }

  /**
   * Verify a Merkle proof
   */
  async verifyProof(proof: MerkleProof): Promise<boolean> {
    let currentHash = proof.leaf;

    for (const step of proof.path) {
      if (step.position === "left") {
        currentHash = await sha256(step.hash + currentHash);
      } else {
        currentHash = await sha256(currentHash + step.hash);
      }
    }

    return currentHash === proof.root;
  }

  /**
   * Get tree structure for visualization
   */
  getTreeStructure(): MerkleNode | null {
    return this.root;
  }
}

/**
 * Vote data structure stored locally (commitment only, not the actual vote)
 */
export interface VoteRecord {
  commitment: string;
  timestamp: number;
  nullifier: string;
  voteOption?: string; // Store vote option for updates
  voteColor?: string; // Random color for visualization
  merkleProof?: MerkleProof;
  finalized?: boolean; // Track if vote has been added to tree
}

/**
 * Generate a random color for vote visualization
 */
export function generateRandomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 60 + Math.floor(Math.random() * 30); // 60-90%
  const lightness = 50 + Math.floor(Math.random() * 20); // 50-70%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Storage utilities (now using API calls to persist to Neon DB)
 */
export const VoteStorage = {
  // Fetch voting data from API
  async fetchVotingData(): Promise<{
    commitments: Array<{ hash: string; color: string; timestamp: number }>;
    tallies: Record<string, number>;
    colors: Record<string, string>;
  }> {
    try {
      const response = await fetch("/api/data");
      if (!response.ok) throw new Error("Failed to fetch voting data");
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching voting data:", error);
      return { commitments: [], tallies: {}, colors: {} };
    }
  },

  // Get all finalized commitments (from API)
  async getAllHistoricalCommitments(): Promise<string[]> {
    try {
      const data = await this.fetchVotingData();
      return data.commitments.map((c) => c.hash);
    } catch (error) {
      console.error("Error getting historical commitments:", error);
      return [];
    }
  },

  // Get commitment colors (from API)
  async getCommitmentColors(): Promise<Record<string, string>> {
    try {
      const data = await this.fetchVotingData();
      return data.colors;
    } catch (error) {
      console.error("Error getting commitment colors:", error);
      return {};
    }
  },

  // Get vote tallies (from API)
  async getVoteTallies(): Promise<Record<string, number>> {
    try {
      const data = await this.fetchVotingData();
      return data.tallies;
    } catch (error) {
      console.error("Error getting vote tallies:", error);
      return {};
    }
  },
};
