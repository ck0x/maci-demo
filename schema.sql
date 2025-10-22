-- MACI Voting System Database Schema for Neon DB
-- This schema supports persistent storage of voting data, commitments, and Merkle tree

-- ============================================================================
-- TABLE: users
-- Stores registered voters with their nullifier (anonymous identifier)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    upi_hash VARCHAR(64) NOT NULL UNIQUE, -- Hashed UPI for privacy
    nullifier VARCHAR(64) NOT NULL UNIQUE, -- Generated from UPI, prevents double voting
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_nullifier ON users(nullifier);
CREATE INDEX idx_users_upi_hash ON users(upi_hash);

-- ============================================================================
-- TABLE: vote_commitments
-- Stores all vote commitments (current and historical)
-- In MACI, old votes remain in the tree but are invalidated when updated
-- ============================================================================
CREATE TABLE IF NOT EXISTS vote_commitments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    commitment_hash VARCHAR(64) NOT NULL UNIQUE, -- Hash of UPI + vote + salt
    vote_option VARCHAR(50), -- The actual vote choice (encrypted in production)
    vote_color VARCHAR(20), -- Random color for visualization
    timestamp BIGINT NOT NULL, -- Unix timestamp when vote was cast
    is_finalized BOOLEAN DEFAULT FALSE, -- Whether vote has been added to Merkle tree
    is_current BOOLEAN DEFAULT TRUE, -- Whether this is the user's current vote
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vote_commitments_user ON vote_commitments(user_id);
CREATE INDEX idx_vote_commitments_hash ON vote_commitments(commitment_hash);
CREATE INDEX idx_vote_commitments_current ON vote_commitments(user_id, is_current) WHERE is_current = TRUE;
CREATE INDEX idx_vote_commitments_finalized ON vote_commitments(is_finalized);

-- ============================================================================
-- TABLE: merkle_tree_nodes
-- Stores all nodes in the Merkle tree (leaves and internal nodes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS merkle_tree_nodes (
    id SERIAL PRIMARY KEY,
    node_hash VARCHAR(64) NOT NULL UNIQUE, -- Hash value of this node
    level INTEGER NOT NULL, -- Level in tree (0 = root, max = leaves)
    position INTEGER NOT NULL, -- Position at this level (left to right)
    left_child_hash VARCHAR(64), -- Hash of left child node
    right_child_hash VARCHAR(64), -- Hash of right child node
    is_leaf BOOLEAN DEFAULT FALSE, -- Whether this is a leaf node
    commitment_id INTEGER REFERENCES vote_commitments(id) ON DELETE SET NULL, -- Links to vote commitment if leaf
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_node_position UNIQUE (level, position)
);

CREATE INDEX idx_merkle_nodes_hash ON merkle_tree_nodes(node_hash);
CREATE INDEX idx_merkle_nodes_level ON merkle_tree_nodes(level);
CREATE INDEX idx_merkle_nodes_leaf ON merkle_tree_nodes(is_leaf) WHERE is_leaf = TRUE;
CREATE INDEX idx_merkle_nodes_commitment ON merkle_tree_nodes(commitment_id);

-- ============================================================================
-- TABLE: merkle_tree_roots
-- Stores historical Merkle tree roots (for audit trail)
-- Each time the tree is updated, a new root is created
-- ============================================================================
CREATE TABLE IF NOT EXISTS merkle_tree_roots (
    id SERIAL PRIMARY KEY,
    root_hash VARCHAR(64) NOT NULL, -- The Merkle root hash
    total_leaves INTEGER NOT NULL DEFAULT 0, -- Number of leaves at this state
    is_current BOOLEAN DEFAULT TRUE, -- Whether this is the current active root
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_merkle_roots_hash ON merkle_tree_roots(root_hash);
CREATE INDEX idx_merkle_roots_current ON merkle_tree_roots(is_current) WHERE is_current = TRUE;

-- ============================================================================
-- TABLE: merkle_proofs
-- Stores Merkle proofs for vote verification
-- Allows voters to prove their vote is included without revealing it
-- ============================================================================
CREATE TABLE IF NOT EXISTS merkle_proofs (
    id SERIAL PRIMARY KEY,
    commitment_id INTEGER NOT NULL REFERENCES vote_commitments(id) ON DELETE CASCADE,
    leaf_hash VARCHAR(64) NOT NULL, -- The leaf being proven
    root_hash VARCHAR(64) NOT NULL, -- The Merkle root this proof is for
    proof_path JSONB NOT NULL, -- Array of {hash, position} objects
    is_verified BOOLEAN DEFAULT FALSE, -- Whether proof has been verified
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_commitment_proof UNIQUE (commitment_id, root_hash)
);

CREATE INDEX idx_merkle_proofs_commitment ON merkle_proofs(commitment_id);
CREATE INDEX idx_merkle_proofs_root ON merkle_proofs(root_hash);
CREATE INDEX idx_merkle_proofs_leaf ON merkle_proofs(leaf_hash);

-- ============================================================================
-- TABLE: vote_tallies
-- Stores aggregated vote counts for each option
-- Updated when votes are finalized
-- ============================================================================
CREATE TABLE IF NOT EXISTS vote_tallies (
    id SERIAL PRIMARY KEY,
    vote_option VARCHAR(50) NOT NULL UNIQUE, -- The voting option (e.g., "option-a")
    vote_count INTEGER DEFAULT 0, -- Current count for this option
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vote_tallies_option ON vote_tallies(vote_option);

-- ============================================================================
-- TABLE: audit_log
-- Tracks all major actions for transparency and debugging
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL, -- e.g., "USER_SIGNUP", "VOTE_CAST", "VOTE_UPDATED", "VOTE_FINALIZED"
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    commitment_id INTEGER REFERENCES vote_commitments(id) ON DELETE SET NULL,
    details JSONB, -- Additional context about the action
    ip_address INET, -- Optional: track IP for security
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_action ON audit_log(action_type);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for vote_tallies table
CREATE TRIGGER update_vote_tallies_updated_at
    BEFORE UPDATE ON vote_tallies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to invalidate old vote commitments when a user votes again
CREATE OR REPLACE FUNCTION invalidate_old_commitments()
RETURNS TRIGGER AS $$
BEGIN
    -- When a new commitment is added for a user, mark all their previous commitments as not current
    IF NEW.is_current = TRUE THEN
        UPDATE vote_commitments
        SET is_current = FALSE
        WHERE user_id = NEW.user_id
          AND id != NEW.id
          AND is_current = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically invalidate old commitments
CREATE TRIGGER invalidate_old_commitments_trigger
    BEFORE INSERT OR UPDATE ON vote_commitments
    FOR EACH ROW
    WHEN (NEW.is_current = TRUE)
    EXECUTE FUNCTION invalidate_old_commitments();

-- Function to invalidate old Merkle roots when a new one is created
CREATE OR REPLACE FUNCTION invalidate_old_roots()
RETURNS TRIGGER AS $$
BEGIN
    -- When a new root is marked as current, mark all others as not current
    IF NEW.is_current = TRUE THEN
        UPDATE merkle_tree_roots
        SET is_current = FALSE
        WHERE id != NEW.id
          AND is_current = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically invalidate old roots
CREATE TRIGGER invalidate_old_roots_trigger
    BEFORE INSERT OR UPDATE ON merkle_tree_roots
    FOR EACH ROW
    WHEN (NEW.is_current = TRUE)
    EXECUTE FUNCTION invalidate_old_roots();

-- ============================================================================
-- VIEWS FOR EASY QUERYING
-- ============================================================================

-- View: Current votes (only the latest vote from each user)
CREATE OR REPLACE VIEW current_votes AS
SELECT 
    u.id as user_id,
    u.upi_hash,
    u.nullifier,
    vc.id as commitment_id,
    vc.commitment_hash,
    vc.vote_option,
    vc.vote_color,
    vc.is_finalized,
    vc.timestamp,
    vc.created_at
FROM users u
JOIN vote_commitments vc ON u.id = vc.user_id
WHERE vc.is_current = TRUE;

-- View: Current Merkle tree state
CREATE OR REPLACE VIEW current_merkle_tree AS
SELECT 
    mtn.*,
    vc.vote_color,
    vc.vote_option
FROM merkle_tree_nodes mtn
LEFT JOIN vote_commitments vc ON mtn.commitment_id = vc.id
WHERE EXISTS (
    SELECT 1 FROM merkle_tree_roots mtr 
    WHERE mtr.is_current = TRUE 
    AND mtr.root_hash = (
        SELECT node_hash FROM merkle_tree_nodes WHERE level = 0 LIMIT 1
    )
);

-- View: Vote statistics
CREATE OR REPLACE VIEW vote_statistics AS
SELECT 
    vt.vote_option,
    vt.vote_count,
    ROUND(100.0 * vt.vote_count / NULLIF(SUM(vt.vote_count) OVER (), 0), 2) as percentage,
    (SELECT COUNT(*) FROM vote_commitments WHERE is_finalized = TRUE) as total_finalized_votes,
    (SELECT COUNT(*) FROM users) as total_users
FROM vote_tallies vt;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert voting options (based on your app)
INSERT INTO vote_tallies (vote_option, vote_count) VALUES
    ('option-a', 0),
    ('option-b', 0)
ON CONFLICT (vote_option) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE users IS 'Registered voters with anonymized identifiers';
COMMENT ON TABLE vote_commitments IS 'All vote commitments - current and historical (MACI keeps all votes)';
COMMENT ON TABLE merkle_tree_nodes IS 'Complete Merkle tree structure for vote verification';
COMMENT ON TABLE merkle_tree_roots IS 'Historical Merkle tree roots for audit trail';
COMMENT ON TABLE merkle_proofs IS 'Zero-knowledge proofs for vote inclusion verification';
COMMENT ON TABLE vote_tallies IS 'Aggregated vote counts per option';
COMMENT ON TABLE audit_log IS 'Audit trail of all voting system actions';

COMMENT ON COLUMN users.nullifier IS 'Unique anonymous identifier derived from UPI';
COMMENT ON COLUMN vote_commitments.is_current IS 'TRUE if this is the users latest vote (only latest counts in MACI)';
COMMENT ON COLUMN vote_commitments.is_finalized IS 'TRUE if vote has been added to Merkle tree';
COMMENT ON COLUMN merkle_proofs.proof_path IS 'JSON array of proof steps: [{hash: string, position: left|right}]';
