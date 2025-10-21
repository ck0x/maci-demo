"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronLeft, UserPlus, Vote, FileCheck, BarChart3, Check } from "lucide-react"

const VOTING_OPTIONS = [
  { id: "option-a", label: "Blockchain Scalability", emoji: "⚡" },
  { id: "option-b", label: "Privacy & Security", emoji: "🔒" },
  { id: "option-c", label: "Decentralization", emoji: "🌐" },
  { id: "option-d", label: "User Experience", emoji: "✨" },
]

const VOTING_QUESTION = "What's the most important challenge in blockchain voting?"

const loadVotes = () => {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("maci-votes")
    if (stored) {
      return JSON.parse(stored)
    }
  }
  return {}
}

const steps = [
  {
    id: 1,
    title: "User Sign-up",
    description: "Voters prove their identity and become eligible to place a vote.",
    icon: UserPlus,
    bgColor: "bg-[var(--step-signup)]",
    borderColor: "border-[var(--step-signup-border)]",
    details:
      "The first step ensures that only verified users can participate in the voting process. This establishes trust and prevents unauthorized access.",
  },
  {
    id: 2,
    title: "Cast Votes",
    description: "Voters make their decision, encrypt their message and send it to the blockchain.",
    icon: Vote,
    bgColor: "bg-[var(--step-cast)]",
    borderColor: "border-[var(--step-cast-border)]",
    details:
      "Votes are encrypted before being submitted, ensuring privacy. The blockchain provides an immutable record of all encrypted votes.",
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
    description: "Tallies results and generates zero-knowledge proofs to show it was done correctly.",
    icon: BarChart3,
    bgColor: "bg-[var(--step-tally)]",
    borderColor: "border-[var(--step-tally-border)]",
    details:
      "Final results are calculated and cryptographic proofs verify the integrity of the entire process without revealing individual votes.",
  },
]

export default function MACIProcess() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isSignedUp, setIsSignedUp] = useState(false)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [allVotes, setAllVotes] = useState<Record<string, number>>(loadVotes())

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("maci-votes", JSON.stringify(allVotes))
    }
  }, [allVotes])

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const goToStep = (index: number) => {
    setCurrentStep(index)
  }

  const handleSignUp = () => {
    setIsSignedUp(true)
    setTimeout(() => nextStep(), 800)
  }

  const handleCastVote = () => {
    if (selectedOption) {
      setHasVoted(true)
      setTimeout(() => nextStep(), 800)
    }
  }

  const handleProcessing = () => {
    setIsProcessing(true)
    setTimeout(() => {
      setIsProcessing(false)
      nextStep()
    }, 2000)
  }

  const handleFinalize = () => {
    if (selectedOption) {
      setAllVotes((prev) => ({
        ...prev,
        [selectedOption]: (prev[selectedOption] || 0) + 1,
      }))
    }
  }

  const resetVoting = () => {
    setCurrentStep(0)
    setIsSignedUp(false)
    setSelectedOption(null)
    setHasVoted(false)
    setIsProcessing(false)
  }

  const getTotalVotes = () => {
    return Object.values(allVotes).reduce((sum, count) => sum + count, 0)
  }

  const getVotePercentage = (optionId: string) => {
    const total = getTotalVotes()
    if (total === 0) return 0
    return Math.round(((allVotes[optionId] || 0) / total) * 100)
  }

  const step = steps[currentStep]
  const Icon = step.icon

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="py-8 px-4 text-center border-b">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">MACI PROCESSES</h1>
        <p className="text-muted-foreground text-lg">Minimum Anti-Collusion Infrastructure</p>
      </header>

      {/* Progress Indicator */}
      <div className="py-6 px-4 border-b bg-card">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-2">
            {steps.map((s, index) => (
              <div key={s.id} className="flex items-center flex-1">
                <button
                  onClick={() => goToStep(index)}
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                    index === currentStep
                      ? `${s.borderColor} ${s.bgColor} scale-110`
                      : index < currentStep
                        ? `${s.borderColor} ${s.bgColor}`
                        : "border-border bg-muted"
                  }`}
                  aria-label={`Go to step ${index + 1}`}
                >
                  <span className="text-sm font-bold">{index + 1}</span>
                </button>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded transition-all ${
                      index < currentStep ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-3xl w-full">
          <div
            className={`${step.bgColor} ${step.borderColor} border-4 rounded-2xl p-8 md:p-12 shadow-lg transition-all duration-500 ease-in-out`}
          >
            <div className="flex flex-col items-center text-center space-y-6">
              {/* Icon */}
              <div className={`${step.borderColor} border-4 rounded-full p-6 bg-white`}>
                <Icon className="w-16 h-16 text-foreground" strokeWidth={1.5} />
              </div>

              {/* Step Number */}
              <div className="text-sm font-semibold text-muted-foreground">
                STEP {step.id} OF {steps.length}
              </div>

              {/* Title */}
              <h2 className="text-3xl md:text-4xl font-bold text-foreground text-balance">{step.title}</h2>

              {/* Description */}
              <p className="text-xl text-foreground/90 leading-relaxed text-balance">{step.description}</p>

              {/* Details */}
              <p className="text-base text-foreground/70 leading-relaxed max-w-2xl text-pretty">{step.details}</p>

              <div className="w-full max-w-md mt-6">
                {/* Step 1: Sign Up */}
                {currentStep === 0 && (
                  <div className="space-y-4">
                    {!isSignedUp ? (
                      <Button onClick={handleSignUp} size="lg" className="w-full text-lg">
                        Sign Up to Vote
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-green-600 font-semibold">
                        <Check className="w-6 h-6" />
                        Successfully Signed Up!
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Cast Vote */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-foreground">{VOTING_QUESTION}</h3>
                    <div className="grid gap-3">
                      {VOTING_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setSelectedOption(option.id)}
                          disabled={hasVoted}
                          className={`p-4 rounded-lg border-2 transition-all text-left ${
                            selectedOption === option.id
                              ? "border-primary bg-primary/10 scale-105"
                              : "border-border bg-white hover:border-primary/50"
                          } ${hasVoted ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <span className="text-2xl mr-3">{option.emoji}</span>
                          <span className="font-medium text-foreground">{option.label}</span>
                        </button>
                      ))}
                    </div>
                    {!hasVoted ? (
                      <Button
                        onClick={handleCastVote}
                        disabled={!selectedOption}
                        size="lg"
                        className="w-full text-lg mt-4"
                      >
                        Cast Encrypted Vote
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-green-600 font-semibold mt-4">
                        <Check className="w-6 h-6" />
                        Vote Encrypted & Submitted!
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Processing */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    {!isProcessing ? (
                      <Button onClick={handleProcessing} size="lg" className="w-full text-lg">
                        Start Processing
                      </Button>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
                        <p className="text-foreground font-semibold">Processing encrypted votes...</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 4: Results */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-foreground mb-4">Current Results</h3>
                    <div className="space-y-3">
                      {VOTING_OPTIONS.map((option) => {
                        const votes = allVotes[option.id] || 0
                        const percentage = getVotePercentage(option.id)
                        return (
                          <div key={option.id} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-foreground">
                                <span className="text-xl mr-2">{option.emoji}</span>
                                {option.label}
                              </span>
                              <span className="text-muted-foreground">
                                {votes} votes ({percentage}%)
                              </span>
                            </div>
                            <div className="w-full bg-white rounded-full h-3 border border-border overflow-hidden">
                              <div
                                className="bg-primary h-full transition-all duration-500 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="pt-4 border-t border-foreground/20 mt-6">
                      <p className="text-sm text-foreground/70">Total votes cast: {getTotalVotes()}</p>
                    </div>
                    {hasVoted && (
                      <Button onClick={handleFinalize} size="lg" className="w-full text-lg mt-4">
                        Finalize My Vote
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 gap-4">
            <Button
              onClick={prevStep}
              disabled={currentStep === 0}
              variant="outline"
              size="lg"
              className="gap-2 bg-transparent"
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </Button>

            <div className="text-sm text-muted-foreground">
              {currentStep + 1} / {steps.length}
            </div>

            {currentStep === steps.length - 1 ? (
              <Button onClick={resetVoting} size="lg" className="gap-2">
                Vote Again
              </Button>
            ) : (
              <Button onClick={nextStep} disabled={currentStep === steps.length - 1} size="lg" className="gap-2">
                Next
                <ChevronRight className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-4 text-center border-t text-sm text-muted-foreground">
        <p>Interactive demonstration of the MACI voting process</p>
      </footer>
    </div>
  )
}
