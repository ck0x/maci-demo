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
 * Storage utilities (using localStorage for now)
 */
export const VoteStorage = {
  saveVote(upi: string, record: VoteRecord): void {
    if (typeof window !== "undefined") {
      try {
        const normalizedUpi = upi.toLowerCase().trim();
        localStorage.setItem(`vote:${normalizedUpi}`, JSON.stringify(record));
      } catch (error) {
        console.error("Error saving vote:", error);
      }
    }
  },

  getVote(upi: string): VoteRecord | null {
    if (typeof window !== "undefined") {
      try {
        const normalizedUpi = upi.toLowerCase().trim();
        const stored = localStorage.getItem(`vote:${normalizedUpi}`);
        if (!stored) return null;
        const parsed = JSON.parse(stored);
        // Validate the record has required fields
        if (parsed && parsed.commitment && parsed.nullifier) {
          return parsed;
        }
      } catch (error) {
        console.error("Error getting vote:", error);
      }
    }
    return null;
  },

  hasVoted(nullifier: string): boolean {
    if (typeof window !== "undefined") {
      try {
        const nullifiers = this.getAllNullifiers();
        return nullifiers.includes(nullifier);
      } catch (error) {
        console.error("Error checking if voted:", error);
      }
    }
    return false;
  },

  getAllNullifiers(): string[] {
    if (typeof window !== "undefined") {
      try {
        const nullifiers: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith("vote:")) {
            const record = localStorage.getItem(key);
            if (record) {
              const parsed = JSON.parse(record);
              if (parsed.nullifier) {
                nullifiers.push(parsed.nullifier);
              }
            }
          }
        }
        return nullifiers;
      } catch (error) {
        console.error("Error getting all nullifiers:", error);
      }
    }
    return [];
  },

  getAllCommitments(): string[] {
    if (typeof window !== "undefined") {
      try {
        const commitments: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith("vote:")) {
            const record = localStorage.getItem(key);
            if (record) {
              const parsed = JSON.parse(record);
              // Only include finalized commitments in the tree
              if (parsed.commitment && parsed.finalized === true) {
                commitments.push(parsed.commitment);
              }
            }
          }
        }
        return commitments;
      } catch (error) {
        console.error("Error getting all commitments:", error);
      }
    }
    return [];
  },

  getCommitmentColors(): Record<string, string> {
    if (typeof window !== "undefined") {
      try {
        const colorMap: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith("vote:")) {
            const record = localStorage.getItem(key);
            if (record) {
              const parsed = JSON.parse(record);
              // Only include finalized votes with colors
              if (
                parsed.commitment &&
                parsed.finalized === true &&
                parsed.voteColor
              ) {
                colorMap[parsed.commitment] = parsed.voteColor;
              }
            }
          }
        }
        // Also get colors from historical commitments
        const history = this.getAllCommitmentHistory();
        history.forEach((record) => {
          if (record.commitment && record.voteColor) {
            colorMap[record.commitment] = record.voteColor;
          }
        });
        return colorMap;
      } catch (error) {
        console.error("Error getting commitment colors:", error);
      }
    }
    return {};
  },

  // Store a commitment in the historical record (for MACI-style tracking)
  saveCommitmentToHistory(record: VoteRecord): void {
    if (typeof window !== "undefined") {
      try {
        const history = this.getAllCommitmentHistory();
        // Add new record to history (don't remove old ones)
        history.push(record);
        localStorage.setItem(
          "maci-commitment-history",
          JSON.stringify(history)
        );
      } catch (error) {
        console.error("Error saving commitment to history:", error);
      }
    }
  },

  // Get all historical commitments (including invalidated ones)
  getAllCommitmentHistory(): VoteRecord[] {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("maci-commitment-history");
        if (stored) {
          const history = JSON.parse(stored);
          return Array.isArray(history) ? history : [];
        }
      } catch (error) {
        console.error("Error getting commitment history:", error);
      }
    }
    return [];
  },

  // Get all finalized commitments from history
  getAllHistoricalCommitments(): string[] {
    const history = this.getAllCommitmentHistory();
    return history
      .filter((record) => record.finalized === true && record.commitment)
      .map((record) => record.commitment);
  },
};
