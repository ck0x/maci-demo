"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast, Toaster } from "sonner";
import {
  ChevronRight,
  ChevronLeft,
  UserPlus,
  Vote,
  FileCheck,
  BarChart3,
  Check,
  Shield,
} from "lucide-react";
import {
  generateNullifier,
  createVoteCommitment,
  generateRandomColor,
  MerkleTree,
  VoteStorage,
  type MerkleProof,
  type VoteRecord,
} from "@/lib/crypto";
import {
  MerkleTreeVisualization,
  MerkleProofDisplay,
} from "@/components/MerkleTreeVisualization";

const VOTING_OPTIONS = [
  {
    id: "option-a",
    label: "Yes, absolutely!",
    emoji: "🍍",
    color: "#f59e0b",
  },
  {
    id: "option-b",
    label: "No, never!",
    emoji: "�",
    color: "#ef4444",
  },
  { id: "option-c", label: "I don't care", emoji: "🤷", color: "#6b7280" },
  { id: "option-d", label: "Only with ham", emoji: "🍖", color: "#ec4899" },
];

const VOTING_QUESTION = "Does pineapple belong on pizza?";

const loadVotes = () => {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("maci-votes");
    if (stored) {
      return JSON.parse(stored);
    }
  }
  return {};
};

const steps = [
  {
    id: 1,
    title: "User Sign-up",
    description:
      "Voters prove their identity and become eligible to place a vote.",
    icon: UserPlus,
    bgColor: "bg-[var(--step-signup)]",
    borderColor: "border-[var(--step-signup-border)]",
    details:
      "The first step ensures that only verified users can participate in the voting process. This establishes trust and prevents unauthorized access.",
  },
  {
    id: 2,
    title: "Cast Votes",
    description:
      "Voters make their decision, encrypt their message and send it to the blockchain. Votes can be updated anytime!",
    icon: Vote,
    bgColor: "bg-[var(--step-cast)]",
    borderColor: "border-[var(--step-cast-border)]",
    details:
      "Votes are encrypted before being submitted, ensuring privacy. The blockchain provides an immutable record of all encrypted votes. In MACI, you can change your vote as many times as you want - only the latest one counts!",
  },
  {
    id: 3,
    title: "Process Messages",
    description: "Decrypts and validates messages, building proof inputs.",
    icon: FileCheck,
    bgColor: "bg-[var(--step-process)]",
    borderColor: "border-[var(--step-process-border)]",
    details:
      "The system securely decrypts and validates each vote, preparing the data for the final tallying process while maintaining voter privacy.",
  },
  {
    id: 4,
    title: "Tally and Prove",
    description:
      "Tallies results and generates zero-knowledge proofs to show it was done correctly.",
    icon: BarChart3,
    bgColor: "bg-[var(--step-tally)]",
    borderColor: "border-[var(--step-tally-border)]",
    details:
      "Final results are calculated and cryptographic proofs verify the integrity of the entire process without revealing individual votes.",
  },
];

export default function MACIProcess() {
  const [viewMode, setViewMode] = useState<"tree" | "vote">("tree"); // Default to tree view
  const [currentStep, setCurrentStep] = useState(0); // For voting flow
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [upi, setUpi] = useState("");
  const [nullifier, setNullifier] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [allVotes, setAllVotes] = useState<Record<string, number>>(loadVotes());
  const [merkleTree] = useState(() => new MerkleTree());
  const [userVoteCommitment, setUserVoteCommitment] = useState<string | null>(
    null
  );
  const [userMerkleProof, setUserMerkleProof] = useState<MerkleProof | null>(
    null
  );
  const [proofVerified, setProofVerified] = useState(false);
  const [treeVersion, setTreeVersion] = useState(0);
  const [previousVote, setPreviousVote] = useState<string | null>(null);
  const [previousVoteOption, setPreviousVoteOption] = useState<string | null>(
    null
  );
  const [isVoteUpdate, setIsVoteUpdate] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalized, setIsFinalized] = useState(false);
  const [showAntiCoercionModal, setShowAntiCoercionModal] = useState(false);
  const [userVoteColor, setUserVoteColor] = useState<string | null>(null);

  // Initialize Merkle tree with existing commitments on mount
  useEffect(() => {
    if (!isInitialized && typeof window !== "undefined") {
      setIsLoading(true);
      const existingCommitments = VoteStorage.getAllCommitments();
      if (existingCommitments.length > 0) {
        // Add all existing commitments to the tree
        Promise.all(
          existingCommitments.map((commitment) =>
            merkleTree.addLeaf(commitment)
          )
        )
          .then(() => {
            setTreeVersion((v) => v + 1);
            setIsInitialized(true);
            setIsLoading(false);
          })
          .catch((error) => {
            console.error("Error initializing tree:", error);
            setIsInitialized(true);
            setIsLoading(false);
          });
      } else {
        setIsInitialized(true);
        setIsLoading(false);
      }
    }
  }, [isInitialized, merkleTree]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("maci-votes", JSON.stringify(allVotes));
    }
  }, [allVotes]);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (index: number) => {
    setCurrentStep(index);
  };

  const handleSignUp = async () => {
    if (!upi.trim()) {
      toast.error("Please enter your UPI");
      return;
    }

    const trimmedUpi = upi.trim().toLowerCase(); // Normalize UPI

    try {
      // Generate nullifier from UPI
      const userNullifier = await generateNullifier(trimmedUpi);

      // Check if this user has already voted
      const existingVote = VoteStorage.getVote(trimmedUpi);
      if (existingVote && existingVote.commitment) {
        setIsVoteUpdate(true);
        setPreviousVote(existingVote.commitment);
        setPreviousVoteOption(existingVote.voteOption || null);
        // Restore their existing color
        setUserVoteColor(existingVote.voteColor || generateRandomColor());
        toast.success("Welcome back! You can update your vote");
        setShowAntiCoercionModal(true); // Show modal for returning voters
      } else {
        setIsVoteUpdate(false);
        setPreviousVote(null);
        setPreviousVoteOption(null);
        // Generate a new random color for new voters
        setUserVoteColor(generateRandomColor());
        toast.success("Successfully signed up!");
      }

      setNullifier(userNullifier);
      setIsSignedUp(true);
      setTimeout(() => nextStep(), 800);
    } catch (error) {
      console.error("Error during signup:", error);
      toast.error("Failed to sign up. Please try again.");
    }
  };

  const handleCastVote = async () => {
    if (!selectedOption || !upi || !nullifier) {
      toast.error("Please select an option");
      return;
    }

    const trimmedUpi = upi.trim().toLowerCase();

    try {
      // If updating vote, remove old commitment from tree
      if (isVoteUpdate && previousVote) {
        await merkleTree.removeLeaf(previousVote);
      }

      // Create vote commitment (hash of UPI + vote + timestamp)
      const commitment = await createVoteCommitment(trimmedUpi, selectedOption);
      setUserVoteCommitment(commitment);

      // Add commitment to Merkle tree
      await merkleTree.addLeaf(commitment);
      setTreeVersion((v) => v + 1);

      // Save vote record (this updates the previous vote if it exists)
      const record: VoteRecord = {
        commitment,
        timestamp: Date.now(),
        nullifier,
        voteOption: selectedOption, // Store the vote option for tracking
        voteColor: userVoteColor || generateRandomColor(), // Store the random color
      };
      VoteStorage.saveVote(trimmedUpi, record);

      setHasVoted(true);

      // Generate proof automatically
      const proof = await merkleTree.generateProof(commitment);
      if (proof) {
        setUserMerkleProof(proof);
        const verified = await merkleTree.verifyProof(proof);
        setProofVerified(verified);
      }

      if (isVoteUpdate) {
        toast.success("Vote updated! Check the tree to see your colored vote.");
      } else {
        toast.success("Vote cast! Look for your colored vote in the tree.");
      }

      // Return to tree view after voting
      setTimeout(() => setViewMode("tree"), 1000);
    } catch (error) {
      console.error("Error casting vote:", error);
      toast.error("Failed to cast vote. Please try again.");
    }
  };

  const handleProcessing = async () => {
    if (!userVoteCommitment) {
      toast.error("No vote commitment found");
      return;
    }

    setIsProcessing(true);

    // Generate Merkle proof for user's vote
    try {
      const proof = await merkleTree.generateProof(userVoteCommitment);
      if (proof) {
        setUserMerkleProof(proof);
        const verified = await merkleTree.verifyProof(proof);
        setProofVerified(verified);

        if (verified) {
          toast.success("Proof generated and verified successfully!");
        } else {
          toast.error("Proof verification failed");
        }
      } else {
        setProofVerified(false);
        toast.error("Failed to generate proof");
      }
    } catch (error) {
      setProofVerified(false);
      toast.error("Error generating proof. Please try again.");
    }

    setTimeout(() => {
      setIsProcessing(false);
      nextStep();
    }, 2000);
  };

  const handleFinalize = () => {
    if (!selectedOption) {
      toast.error("No vote option selected");
      return;
    }

    if (isFinalized) {
      toast.error("Vote already finalized");
      return;
    }

    // If updating vote, decrement the old vote count first
    if (isVoteUpdate && previousVoteOption) {
      setAllVotes((prev) => ({
        ...prev,
        [previousVoteOption]: Math.max((prev[previousVoteOption] || 0) - 1, 0),
      }));
    }

    // Then add the new vote
    setAllVotes((prev) => ({
      ...prev,
      [selectedOption]: (prev[selectedOption] || 0) + 1,
    }));

    setIsFinalized(true);
    toast.success("Vote finalized!");
  };

  const resetVoting = () => {
    setCurrentStep(0);
    setIsSignedUp(false);
    setUpi("");
    setNullifier(null);
    setSelectedOption(null);
    setHasVoted(false);
    setIsProcessing(false);
    setUserVoteCommitment(null);
    setUserMerkleProof(null);
    setProofVerified(false);
    setPreviousVote(null);
    setPreviousVoteOption(null);
    setIsVoteUpdate(false);
    setIsFinalized(false);
    setUserVoteColor(null);
  };

  const getTotalVotes = () => {
    return Object.values(allVotes).reduce((sum, count) => sum + count, 0);
  };

  const getVotePercentage = (optionId: string) => {
    const total = getTotalVotes();
    if (total === 0) return 0;
    return Math.round(((allVotes[optionId] || 0) / total) * 100);
  };

  const step = steps[currentStep];
  const Icon = step.icon;

  // Show loading state while initializing
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4" />
        <p className="text-muted-foreground">Initializing voting system...</p>
      </div>
    );
  }

  // Tree View (Default)
  if (viewMode === "tree") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {/* Header */}
        <div className="py-4 md:py-6 px-4 md:px-8 border-b bg-card">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">
                🍕 Pineapple Pizza Vote
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Zero-Knowledge Merkle Tree Visualization
              </p>
            </div>
            {!hasVoted && (
              <Button
                onClick={() => {
                  setViewMode("vote");
                  setCurrentStep(0);
                }}
                size="lg"
                className="text-base md:text-lg"
              >
                <Vote className="w-5 h-5 mr-2" />
                Place Vote
              </Button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 px-4 md:px-8 py-6 md:py-12">
          <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
            {/* What Just Happened? */}
            {hasVoted && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg p-4 md:p-6 border-2 border-green-300 dark:border-green-700">
                <div className="flex items-center gap-2 mb-3">
                  <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                  <h4 className="font-bold text-base md:text-lg text-foreground">
                    Your Vote is Secured!
                  </h4>
                </div>
                <div className="space-y-2 text-sm md:text-base text-foreground/90">
                  <p>
                    ✅ <strong>Your vote is private:</strong> Only you know what
                    you voted for
                  </p>
                  <p>
                    ✅ <strong>Your vote is in the tree:</strong> Look for your
                    colored signature below
                  </p>
                  <p>
                    ✅ <strong>Anti-coercion enabled:</strong> You can update
                    your vote anytime before finalization
                  </p>
                </div>
              </div>
            )}

            {/* Color Explanation */}
            {userVoteColor && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg p-4 md:p-6 border border-blue-200 dark:border-blue-800">
                <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  🎨 Your Secret Color
                </div>
                <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg p-3 border mb-3">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-white shadow-md animate-pulse"
                    style={{ backgroundColor: userVoteColor }}
                  />
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      Only you know what this means!
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Each voter gets a random color for privacy
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Merkle Tree Visualization */}
            <div className="bg-card rounded-lg border p-4 md:p-6">
              <h3 className="font-semibold text-lg md:text-xl text-foreground mb-4">
                🌳 Merkle Tree - All Votes Secured
              </h3>
              <div className="overflow-x-auto">
                <MerkleTreeVisualization
                  tree={merkleTree.getTreeStructure()}
                  highlightLeaf={hasVoted && nullifier ? nullifier : undefined}
                  highlightColor={userVoteColor || undefined}
                />
              </div>
            </div>

            {/* Your Proof */}
            {userMerkleProof && userVoteColor && proofVerified && (
              <div className="bg-card rounded-lg border p-4 md:p-6">
                <h3 className="font-semibold text-lg md:text-xl text-foreground mb-4">
                  🔐 Your Cryptographic Proof
                </h3>
                <MerkleProofDisplay
                  proof={userMerkleProof}
                  verified={proofVerified}
                  voteColor={userVoteColor}
                />
              </div>
            )}

            {/* Vote Tallies */}
            <div className="bg-card rounded-lg border p-4 md:p-6">
              <h3 className="font-semibold text-lg md:text-xl text-foreground mb-4">
                📊 Current Results
              </h3>
              <div className="space-y-4">
                {VOTING_OPTIONS.map((option) => {
                  const votes = allVotes[option.id] || 0;
                  const percentage = getVotePercentage(option.id);
                  return (
                    <div key={option.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm md:text-base">
                        <span className="font-medium text-foreground flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: option.color }}
                          />
                          <span className="text-xl">{option.emoji}</span>
                          <span>{option.label}</span>
                        </span>
                        <span className="text-muted-foreground">
                          {votes} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-white dark:bg-gray-800 rounded-full h-3 border border-border overflow-hidden">
                        <div
                          className="h-full transition-all duration-500 rounded-full"
                          style={{
                            width: `${percentage}%`,
                            background: `linear-gradient(90deg, ${option.color}, ${option.color}dd)`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-background rounded-lg p-4 border text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {getTotalVotes()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Votes
                  </div>
                </div>
                <div className="bg-background rounded-lg p-4 border text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {merkleTree.getLeaves().length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Tree Leaves
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            {hasVoted && (
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={() => {
                    setViewMode("vote");
                    setCurrentStep(0);
                  }}
                  size="lg"
                  variant="outline"
                  className="flex-1"
                >
                  🔄 Update My Vote
                </Button>
                <Button
                  onClick={handleFinalize}
                  size="lg"
                  className="flex-1"
                  disabled={isFinalized}
                >
                  {isFinalized ? "✓ Vote Finalized" : "Finalize My Vote"}
                </Button>
              </div>
            )}

            {/* Anti-Coercion Info */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg p-4 md:p-6 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🔄</span>
                <h4 className="font-semibold text-sm md:text-base text-foreground">
                  Anti-Coercion Feature
                </h4>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">
                You can change your vote as many times as needed before
                finalization. This prevents vote buying and coercion - even if
                someone forces you to vote a certain way, you can change it
                later!
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-4 px-4 text-center border-t text-sm text-muted-foreground">
          <p>Interactive demo of MACI voting with Zero-Knowledge Proofs</p>
        </footer>

        <Toaster position="top-center" richColors />
      </div>
    );
  }

  // Voting Flow View
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header with Back Button */}
      <div className="py-4 md:py-6 px-4 md:px-8 border-b bg-card">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Button onClick={() => setViewMode("tree")} variant="ghost" size="sm">
            <ChevronRight className="w-4 h-4 mr-2 rotate-180" />
            Back to Tree
          </Button>
          <div className="text-sm text-muted-foreground">
            Step {currentStep + 1} of 2
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 md:py-12">
        <div className="max-w-2xl w-full">
          <div
            className={`${step.bgColor} ${step.borderColor} border-2 md:border-4 rounded-xl md:rounded-2xl p-4 md:p-8 lg:p-12 shadow-lg transition-all duration-500 ease-in-out`}
          >
            <div className="flex flex-col items-center text-center space-y-4 md:space-y-6">
              {/* Icon */}
              <div
                className={`${step.borderColor} border-2 md:border-4 rounded-full p-4 md:p-6 bg-white`}
              >
                <Icon
                  className="w-12 h-12 md:w-16 md:h-16 text-foreground"
                  strokeWidth={1.5}
                />
              </div>

              {/* Step Number */}
              <div className="text-xs md:text-sm font-semibold text-muted-foreground">
                {currentStep === 0 ? "STEP 1: SIGN UP" : "STEP 2: CAST VOTE"}
              </div>

              {/* Title */}
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground text-balance px-2">
                {currentStep === 0 ? "Sign Up to Vote" : VOTING_QUESTION}
              </h2>

              {/* Description */}
              <p className="text-base md:text-xl text-foreground/90 leading-relaxed text-balance px-2">
                {currentStep === 0
                  ? "Enter your UPI to generate your anonymous voting identity"
                  : "Select your answer below"}
              </p>

              <div className="w-full max-w-md mt-4 md:mt-6">
                {/* Step 1: Sign Up */}
                {currentStep === 0 && (
                  <div className="space-y-4">
                    {!isSignedUp ? (
                      <>
                        <div className="text-left space-y-2">
                          <label
                            htmlFor="upi"
                            className="text-sm font-semibold text-foreground flex items-center gap-2"
                          >
                            <Shield className="w-4 h-4" />
                            Enter Your Student UPI
                          </label>
                          <Input
                            id="upi"
                            type="text"
                            placeholder="e.g. jsmith123"
                            value={upi}
                            onChange={(e) => setUpi(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && upi.trim()) {
                                handleSignUp();
                              }
                            }}
                            className="text-base"
                            maxLength={20}
                            autoComplete="off"
                          />
                          <p className="text-xs text-muted-foreground">
                            Your UPI will be hashed to create a unique,
                            anonymous identifier. It won't be stored in plain
                            text.
                          </p>
                        </div>
                        <Button
                          onClick={handleSignUp}
                          disabled={!upi.trim()}
                          size="lg"
                          className="w-full text-lg"
                        >
                          Sign Up to Vote
                        </Button>
                      </>
                    ) : (
                      <div className="space-y-3">
                        {isVoteUpdate ? (
                          <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 font-semibold">
                            <Check className="w-6 h-6" />
                            Existing Voter - You Can Update Your Vote!
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 text-green-600 font-semibold">
                            <Check className="w-6 h-6" />
                            Successfully Signed Up!
                          </div>
                        )}
                        {isVoteUpdate && (
                          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800 text-xs">
                            <div className="font-semibold text-amber-900 dark:text-amber-300 mb-1">
                              🔄 MACI Vote Update Feature
                            </div>
                            <p className="text-amber-800 dark:text-amber-400">
                              In MACI, you can change your vote as many times as
                              you want before voting ends. Only your{" "}
                              <span className="font-bold">latest vote</span>{" "}
                              will count in the final tally. This prevents
                              coercion!
                            </p>
                          </div>
                        )}
                        <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
                          <div className="font-semibold text-muted-foreground">
                            Your Nullifier (Anonymous ID):
                          </div>
                          <div className="font-mono text-foreground break-all">
                            {nullifier?.slice(0, 32)}...
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Cast Vote */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    {isVoteUpdate && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border-2 border-amber-300 dark:border-amber-700">
                        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-semibold text-sm mb-1">
                          🔄 Updating Your Vote
                        </div>
                        <p className="text-xs text-amber-800 dark:text-amber-400">
                          You're updating your previous vote. Your new choice
                          will replace the old one in the final tally.
                        </p>
                      </div>
                    )}
                    <h3 className="font-semibold text-lg text-foreground">
                      {VOTING_QUESTION}
                    </h3>
                    <div className="grid gap-3">
                      {VOTING_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setSelectedOption(option.id)}
                          disabled={hasVoted}
                          className={`p-3 md:p-4 rounded-lg border-2 transition-all text-left flex items-center gap-2 md:gap-3 ${
                            selectedOption === option.id
                              ? "border-primary bg-primary/10 scale-105 shadow-lg"
                              : "border-border bg-white dark:bg-gray-800 hover:border-primary/50 active:scale-95"
                          } ${
                            hasVoted
                              ? "opacity-50 cursor-not-allowed"
                              : "cursor-pointer"
                          }`}
                        >
                          <div
                            className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-3 border-white shadow-md transition-all flex-shrink-0 ${
                              selectedOption === option.id ? "scale-110" : ""
                            }`}
                            style={{ backgroundColor: option.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xl md:text-2xl mr-1.5 md:mr-2">
                              {option.emoji}
                            </span>
                            <span className="font-medium text-foreground text-sm md:text-base">
                              {option.label}
                            </span>
                          </div>
                          {selectedOption === option.id && (
                            <Check className="w-4 h-4 md:w-5 md:h-5 text-primary flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                    {selectedOption && !hasVoted && userVoteColor && (
                      <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-2.5 md:p-3 border border-indigo-200 dark:border-indigo-800">
                        <div className="flex items-start gap-2">
                          <div
                            className="w-4 h-4 md:w-5 md:h-5 rounded-full border-2 border-white shadow-sm mt-0.5 flex-shrink-0"
                            style={{
                              backgroundColor: userVoteColor,
                            }}
                          />
                          <div className="text-xs text-foreground/80 leading-relaxed">
                            <span className="font-semibold">
                              Your vote will be encrypted
                            </span>{" "}
                            with this RANDOM color signature. Only you will know
                            what it represents - nobody can tell what you voted
                            for by the color!
                          </div>
                        </div>
                      </div>
                    )}
                    {!hasVoted ? (
                      <Button
                        onClick={handleCastVote}
                        disabled={!selectedOption}
                        size="lg"
                        className="w-full text-base md:text-lg mt-4"
                      >
                        {isVoteUpdate
                          ? "🔄 Update My Vote"
                          : "Cast Encrypted Vote"}
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-green-600 font-semibold mt-4 text-sm md:text-base">
                        <Check className="w-5 h-5 md:w-6 md:h-6" />
                        {isVoteUpdate
                          ? "Vote Updated Successfully!"
                          : "Vote Encrypted & Submitted!"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Toaster position="top-center" richColors />
    </div>
  );
}
