"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast, Toaster } from "sonner";
import {
  ChevronRight,
  UserPlus,
  Vote,
  FileCheck,
  BarChart3,
  Check,
  Shield,
} from "lucide-react";
import {
  generateRandomColor,
  MerkleTree,
  VoteStorage,
  type MerkleProof,
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
    emoji: "🤷",
    color: "#ef4444",
  },
];

const VOTING_QUESTION = "Does pineapple belong on pizza?";

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
  const [allVotes, setAllVotes] = useState<Record<string, number>>({});
  const [merkleTree] = useState(() => new MerkleTree());
  const [commitmentId, setCommitmentId] = useState<number | null>(null);
  const [userVoteCommitment, setUserVoteCommitment] = useState<string | null>(
    null
  );
  const [userMerkleProof, setUserMerkleProof] = useState<MerkleProof | null>(
    null
  );
  const [proofVerified, setProofVerified] = useState(false);
  const [previousVoteOption, setPreviousVoteOption] = useState<string | null>(
    null
  );
  const [isVoteUpdate, setIsVoteUpdate] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalized, setIsFinalized] = useState(false);
  const [userVoteColor, setUserVoteColor] = useState<string | null>(null);
  const [leafColors, setLeafColors] = useState<Record<string, string>>({});

  // Initialize Merkle tree with existing commitments on mount
  useEffect(() => {
    if (!isInitialized && typeof window !== "undefined") {
      setIsLoading(true);
      // Load ALL historical commitments from API (including old/invalidated ones - MACI style)
      VoteStorage.fetchVotingData()
        .then(({ commitments, tallies, colors }) => {
          setLeafColors(colors);
          setAllVotes(tallies);

          if (commitments.length > 0) {
            // Add all existing commitments to the tree
            return Promise.all(
              commitments.map((c) => merkleTree.addLeaf(c.hash))
            );
          }
          return Promise.resolve([]);
        })
        .then(() => {
          setIsInitialized(true);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error initializing tree:", error);
          setIsInitialized(true);
          setIsLoading(false);
        });
    }
  }, [isInitialized, merkleTree]);

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

  const handleSignUp = async () => {
    if (!upi.trim()) {
      toast.error("Please enter your UPI");
      return;
    }

    const trimmedUpi = upi.trim().toLowerCase(); // Normalize UPI

    try {
      // Call signup API
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upi: trimmedUpi }),
      });

      if (!response.ok) {
        throw new Error("Signup failed");
      }

      const data = await response.json();

      setNullifier(data.nullifier);

      // Check if this user has already voted
      if (data.hasExistingVote && data.existingVote) {
        const existingVote = data.existingVote;
        setIsVoteUpdate(true);
        setPreviousVoteOption(existingVote.voteOption || null);
        setUserVoteColor(existingVote.voteColor || generateRandomColor());
        setUserVoteCommitment(existingVote.commitment);
        setSelectedOption(existingVote.voteOption || null);

        // Check if vote was already finalized
        if (existingVote.finalized) {
          // Allow them to change their vote - clear finalized state
          setIsFinalized(false);
          setHasVoted(false);
          toast.success(
            "Welcome back! You can change your vote if you'd like."
          );
        } else {
          setHasVoted(false); // Allow them to change their vote
          toast.success("Welcome back! You can update your vote.");
        }
      } else {
        setIsVoteUpdate(false);
        setPreviousVoteOption(null);
        setUserVoteColor(generateRandomColor());
        toast.success("Successfully signed up!");
      }

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
      const voteColor = userVoteColor || generateRandomColor();

      // Call vote API
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upi: trimmedUpi,
          voteOption: selectedOption,
          voteColor,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to cast vote");
      }

      const data = await response.json();
      setUserVoteCommitment(data.commitment);
      setCommitmentId(data.commitmentId);

      if (data.isUpdate && data.previousVoteOption) {
        setPreviousVoteOption(data.previousVoteOption);
      }

      setHasVoted(true);
      toast.success("Vote ready to finalize!");

      // Return to tree view after voting
      setTimeout(() => setViewMode("tree"), 1000);
    } catch (error) {
      console.error("Error casting vote:", error);
      toast.error("Failed to cast vote. Please try again.");
    }
  };

  const handleFinalize = async () => {
    if (!selectedOption || !userVoteCommitment || !commitmentId) {
      toast.error("No vote to finalize");
      return;
    }

    if (isFinalized) {
      toast.error("Vote already finalized");
      return;
    }

    try {
      // Add new commitment to Merkle tree (old one stays in tree but is invalidated)
      await merkleTree.addLeaf(userVoteCommitment);

      // Generate proof (wait a moment to ensure tree is fully built)
      await new Promise((resolve) => setTimeout(resolve, 100));
      const proof = await merkleTree.generateProof(userVoteCommitment);
      let verified = false;

      if (proof) {
        verified = await merkleTree.verifyProof(proof);
        setUserMerkleProof(proof);
        setProofVerified(verified);
      } else {
        console.error(
          "Failed to generate proof for commitment:",
          userVoteCommitment
        );
        setProofVerified(false);
      }

      // Call finalize API
      const response = await fetch("/api/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commitmentId,
          voteOption: selectedOption,
          previousVoteOption: isVoteUpdate ? previousVoteOption : null,
          proofData: proof
            ? {
                leaf: proof.leaf,
                root: proof.root,
                proof: { path: proof.path },
                verified,
              }
            : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to finalize vote");
      }

      // Update local state
      if (isVoteUpdate && previousVoteOption) {
        setAllVotes((prev) => ({
          ...prev,
          [previousVoteOption]: Math.max(
            (prev[previousVoteOption] || 0) - 1,
            0
          ),
        }));
      }

      setAllVotes((prev) => ({
        ...prev,
        [selectedOption]: (prev[selectedOption] || 0) + 1,
      }));

      // Update leaf colors mapping
      const voteColor = userVoteColor || generateRandomColor();
      setLeafColors((prev) => ({
        ...prev,
        [userVoteCommitment]: voteColor,
      }));

      setIsFinalized(true);
      toast.success("Vote finalized and added to the tree!");
    } catch (error) {
      console.error("Error finalizing vote:", error);
      toast.error("Failed to finalize vote. Please try again.");
    }
  };

  const resetVoting = () => {
    setCurrentStep(0);
    setIsSignedUp(false);
    setUpi("");
    setNullifier(null);
    setSelectedOption(null);
    setHasVoted(false);
    setUserVoteCommitment(null);
    setUserMerkleProof(null);
    setProofVerified(false);
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
        {/* Main Content */}
        <main className="flex-1 px-4 md:px-8 py-6 md:py-12">
          <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
            {/* Merkle Tree Visualization */}
            <div className="bg-card rounded-lg border p-4 md:p-6">
              <h3 className="font-semibold text-lg md:text-xl text-foreground mb-4">
                🌳 Merkle Tree - All Votes Secured
              </h3>
              <div className="overflow-x-auto">
                <MerkleTreeVisualization
                  tree={merkleTree.getTreeStructure()}
                  highlightLeaf={
                    isFinalized && userVoteCommitment
                      ? userVoteCommitment
                      : undefined
                  }
                  highlightColor={
                    isFinalized && userVoteColor ? userVoteColor : undefined
                  }
                  leafColors={leafColors}
                />
              </div>

              {/* Vote Now Button / Vote Again for finalized users */}
              {!hasVoted && (
                <div className="mt-6 flex justify-center">
                  <Button
                    onClick={() => {
                      setViewMode("vote");
                      setCurrentStep(0);
                    }}
                    size="lg"
                    className="text-lg px-8 py-6"
                  >
                    <Vote className="w-6 h-6 mr-2" />
                    Vote Now!
                  </Button>
                </div>
              )}

              {isFinalized && (
                <div className="mt-6 flex justify-center">
                  <Button
                    onClick={() => {
                      resetVoting();
                      setViewMode("vote");
                      setCurrentStep(0);
                    }}
                    size="lg"
                    variant="outline"
                    className="text-lg px-8 py-6"
                  >
                    🔄 Vote Again
                  </Button>
                </div>
              )}
            </div>

            {/* Finalize Vote Section - Simple and Clean */}
            {hasVoted && !isFinalized && (
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 rounded-lg p-6 border-2 border-amber-300 dark:border-amber-700">
                <div className="text-center space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-2">
                      Ready to Finalize Your Vote?
                    </h3>
                    <p className="text-sm text-foreground/80">
                      Your vote is prepared. Click below to add it to the Merkle
                      tree and make it official.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      onClick={handleFinalize}
                      size="lg"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      ✓ Finalize Vote
                    </Button>
                  </div>
                </div>
              </div>
            )}

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
                {/* Finalization Success View */}
                {isFinalized ? (
                  <div className="space-y-6">
                    {/* Success Message */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg p-6 border-2 border-green-300 dark:border-green-700">
                      <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                          <h4 className="font-bold text-xl text-foreground">
                            Vote Finalized!
                          </h4>
                        </div>
                        <p className="text-sm text-center text-foreground/80">
                          Your vote has been secured in the Merkle tree
                        </p>
                      </div>
                    </div>

                    {/* Your Proof */}
                    {userMerkleProof && userVoteColor && (
                      <div className="bg-card rounded-lg border p-4">
                        <h3 className="font-semibold text-base text-foreground mb-3">
                          🔐 Your Vote Proof
                        </h3>
                        <MerkleProofDisplay
                          verified={proofVerified}
                          voteColor={userVoteColor}
                        />
                      </div>
                    )}

                    {/* View Tree Button */}
                    <Button
                      onClick={() => {
                        setViewMode("tree");
                        // Reset to allow voting again if needed
                        setCurrentStep(0);
                        setIsSignedUp(false);
                        setSelectedOption(null);
                      }}
                      size="lg"
                      className="w-full"
                    >
                      Go Back to Dashboard
                    </Button>
                  </div>
                ) : (
                  <>
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
                                anonymous identifier. It won&apos;t be stored in
                                plain text.
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
                                  In MACI, you can change your vote as many
                                  times as you want before voting ends. Only
                                  your{" "}
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
                              You&apos;re updating your previous vote. Your new
                              choice will replace the old one in the final
                              tally.
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
                                  selectedOption === option.id
                                    ? "scale-110"
                                    : ""
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
                                with this RANDOM color signature. Only you will
                                know what it represents - nobody can tell what
                                you voted for by the color!
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
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Buttons - Hide when finalized */}
          {!isFinalized && (
            <div className="flex items-center justify-between mt-6 md:mt-8 gap-4">
              <Button
                onClick={() => {
                  if (currentStep === 0) {
                    setViewMode("tree");
                  } else {
                    prevStep();
                  }
                }}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back
              </Button>

              {currentStep === 0 && isSignedUp && (
                <Button onClick={nextStep} size="lg" className="gap-2">
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </main>

      <Toaster position="top-center" richColors />
    </div>
  );
}
