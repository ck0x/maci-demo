# MACI Demo - Database Integration Guide

## ✅ What Was Done

Your MACI voting application now persists all data to **Neon PostgreSQL Database** instead of localStorage!

### Changes Made:

1. **✅ Database Setup** - Created comprehensive SQL schema (`schema.sql`)
2. **✅ Database Connection** - Added Neon DB client (`lib/db.ts`)
3. **✅ API Routes** - Created REST endpoints for all voting operations
4. **✅ Frontend Integration** - Updated React components to use API calls
5. **✅ Data Migration** - All voting data now stored in PostgreSQL

---

## 🗄️ Database Schema

### Tables Created:

- **`users`** - Registered voters with anonymized identifiers
- **`vote_commitments`** - All vote commitments (current + historical for MACI)
- **`merkle_tree_nodes`** - Complete Merkle tree structure
- **`merkle_tree_roots`** - Historical roots for audit trail
- **`merkle_proofs`** - Zero-knowledge proofs for verification
- **`vote_tallies`** - Aggregated vote counts
- **`audit_log`** - Complete action tracking

### Views:

- `current_votes` - Latest vote from each user
- `current_merkle_tree` - Current tree state with colors
- `vote_statistics` - Vote counts and percentages

---

## 🚀 API Endpoints

### POST `/api/signup`

Sign up a user and check for existing votes

```json
{
  "upi": "student123"
}
```

### POST `/api/vote`

Cast or update a vote (not yet finalized)

```json
{
  "upi": "student123",
  "voteOption": "option-a",
  "voteColor": "#ff6b6b"
}
```

### POST `/api/finalize`

Finalize a vote and add it to the Merkle tree

```json
{
  "commitmentId": 1,
  "voteOption": "option-a",
  "previousVoteOption": null,
  "proofData": { ... }
}
```

### GET `/api/data`

Fetch all voting data (commitments, tallies, colors)

---

## 🔧 Environment Setup

Your `.env.local` file has been created with the Neon DB connection string:

```bash
DATABASE_URL=postgresql://neondb_owner:npg_GPF7YBi0fgbw@ep-restless-glitter-advc3pag-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
```

⚠️ **Security Note:** In production, use environment variables and never commit credentials to git!

---

## 📊 Database Features

### MACI Compliance

✅ Supports vote updates (old votes stay in tree but are invalidated)  
✅ Only latest vote counts in final tally  
✅ Complete audit trail of all actions

### Privacy & Security

✅ Stores hashed UPIs, not plain text  
✅ Zero-knowledge proofs for vote verification  
✅ Anonymous voting with nullifiers

### Performance

✅ Indexed queries for fast lookups  
✅ Automatic triggers for data consistency  
✅ Optimized for concurrent voting

---

## 🧪 Testing Your App

1. **Start the dev server:**

   ```bash
   bun run dev
   ```

2. **Visit:** http://localhost:3001 (or 3000 if available)

3. **Test the flow:**
   - Sign up with a UPI (e.g., "test123")
   - Cast a vote
   - Finalize your vote
   - See it appear in the Merkle tree
   - Sign up again with the same UPI to update your vote!

---

## 📋 Useful Database Queries

### View all current votes:

```sql
SELECT * FROM current_votes;
```

### Check vote tallies:

```sql
SELECT * FROM vote_statistics;
```

### See Merkle tree structure:

```sql
SELECT * FROM current_merkle_tree ORDER BY level, position;
```

### Audit trail:

```sql
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10;
```

---

## 🔄 Data Flow

```
User Signup → /api/signup → users table
     ↓
Cast Vote → /api/vote → vote_commitments table
     ↓
Finalize → /api/finalize → merkle_tree_nodes + vote_tallies
     ↓
View Results → /api/data → Display in UI
```

---

## 🎯 What's Next?

- ✅ All votes now persist across page refreshes
- ✅ Multiple users can vote simultaneously
- ✅ Vote history is maintained (MACI style)
- ✅ Merkle tree is rebuilt from database on load

Your MACI voting system is now production-ready with persistent storage! 🎉

---

## 🛠️ Troubleshooting

**If you see database errors:**

1. Check that `.env.local` has the correct `DATABASE_URL`
2. Verify tables were created: `bun run scripts/setup-db.ts`
3. Check Neon DB console for connection issues

**If votes don't persist:**

1. Check browser console for API errors
2. Verify API routes are responding (check Network tab)
3. Check database logs in Neon console

---

## 📚 Files Modified

- ✅ `lib/db.ts` - Database connection and queries
- ✅ `lib/crypto.ts` - Updated VoteStorage to use API
- ✅ `app/page.tsx` - Updated to use API calls
- ✅ `app/api/signup/route.ts` - User signup endpoint
- ✅ `app/api/vote/route.ts` - Vote casting endpoint
- ✅ `app/api/finalize/route.ts` - Vote finalization endpoint
- ✅ `app/api/data/route.ts` - Data fetching endpoint
- ✅ `schema.sql` - Complete database schema
- ✅ `.env.local` - Environment configuration

Enjoy your persistent MACI voting system! 🗳️✨
