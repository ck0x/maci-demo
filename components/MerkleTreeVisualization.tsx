"use client";

import { useEffect, useState } from "react";
import { MerkleNode } from "@/lib/crypto";

interface MerkleTreeVisualizationProps {
  tree: MerkleNode | null;
  highlightLeaf?: string;
  highlightColor?: string;
}

interface TreeNodePosition {
  node: MerkleNode;
  x: number;
  y: number;
  level: number;
}

export function MerkleTreeVisualization({
  tree,
  highlightLeaf,
  highlightColor,
}: MerkleTreeVisualizationProps) {
  const [positions, setPositions] = useState<TreeNodePosition[]>([]);

  useEffect(() => {
    if (!tree) {
      setPositions([]);
      return;
    }

    const nodePositions: TreeNodePosition[] = [];
    let maxLevel = 0;

    // Calculate tree depth
    const getDepth = (node: MerkleNode | undefined): number => {
      if (!node) return 0;
      return 1 + Math.max(getDepth(node.left), getDepth(node.right));
    };

    const depth = getDepth(tree);

    // Position nodes using BFS
    const positionNodes = (
      node: MerkleNode,
      level: number,
      left: number,
      right: number
    ) => {
      const x = (left + right) / 2;
      const y = level * 100 + 50;
      nodePositions.push({ node, x, y, level });
      maxLevel = Math.max(maxLevel, level);

      if (node.left) {
        positionNodes(node.left, level + 1, left, (left + right) / 2);
      }
      if (node.right && node.right !== node.left) {
        positionNodes(node.right, level + 1, (left + right) / 2, right);
      }
    };

    const width = Math.pow(2, depth - 1) * 150;
    positionNodes(tree, 0, 0, width);
    setPositions(nodePositions);
  }, [tree]);

  if (!tree) {
    return (
      <div className="flex items-center justify-center p-4 md:p-8 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20">
        <p className="text-muted-foreground text-xs md:text-sm">
          No votes yet - tree will appear here
        </p>
      </div>
    );
  }

  const maxY = Math.max(...positions.map((p) => p.y), 0);

  return (
    <div className="w-full overflow-x-auto overflow-y-hidden touch-pan-x">
      <svg
        width="100%"
        height={maxY + 100}
        viewBox={`0 0 ${Math.max(...positions.map((p) => p.x), 100) + 100} ${
          maxY + 100
        }`}
        className="mx-auto min-w-[300px]"
      >
        {/* Draw connections */}
        {positions.map((pos, idx) => (
          <g key={`connections-${idx}`}>
            {pos.node.left && (
              <>
                {(() => {
                  const leftPos = positions.find(
                    (p) => p.node === pos.node.left
                  );
                  if (!leftPos) return null;
                  return (
                    <line
                      x1={pos.x}
                      y1={pos.y + 20}
                      x2={leftPos.x}
                      y2={leftPos.y - 20}
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-muted-foreground/30"
                    />
                  );
                })()}
              </>
            )}
            {pos.node.right && pos.node.right !== pos.node.left && (
              <>
                {(() => {
                  const rightPos = positions.find(
                    (p) => p.node === pos.node.right
                  );
                  if (!rightPos) return null;
                  return (
                    <line
                      x1={pos.x}
                      y1={pos.y + 20}
                      x2={rightPos.x}
                      y2={rightPos.y - 20}
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-muted-foreground/30"
                    />
                  );
                })()}
              </>
            )}
          </g>
        ))}

        {/* Draw nodes */}
        {positions.map((pos, idx) => {
          const isHighlighted =
            highlightLeaf && pos.node.hash === highlightLeaf;
          const isRoot = pos.level === 0;
          const isLeaf = pos.node.isLeaf;

          return (
            <g
              key={`node-${idx}`}
              className="animate-in fade-in zoom-in duration-300"
            >
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isRoot ? 30 : isLeaf ? 20 : 25}
                fill={
                  isHighlighted && highlightColor
                    ? highlightColor
                    : isRoot
                    ? "oklch(0.6 0.12 235)"
                    : isLeaf
                    ? "oklch(0.75 0.12 75)"
                    : "oklch(0.65 0.15 155)"
                }
                stroke={isHighlighted ? "white" : "white"}
                strokeWidth={isHighlighted ? 4 : 2}
                className={isHighlighted ? "animate-pulse" : ""}
              />
              <text
                x={pos.x}
                y={pos.y + 5}
                textAnchor="middle"
                fill="white"
                fontSize={isRoot ? 14 : 10}
                fontWeight="bold"
              >
                {isRoot ? "ROOT" : isLeaf ? "VOTE" : "NODE"}
              </text>
              <text
                x={pos.x}
                y={pos.y + 45}
                textAnchor="middle"
                fill="currentColor"
                fontSize="10"
                className="text-muted-foreground font-mono"
              >
                {pos.node.hash.slice(0, 8)}...
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface MerkleProofDisplayProps {
  proof: {
    leaf: string;
    path: Array<{ hash: string; position: "left" | "right" }>;
    root: string;
  };
  verified: boolean;
  voteColor?: string;
}

export function MerkleProofDisplay({
  proof,
  verified,
  voteColor = "#8b5cf6",
}: MerkleProofDisplayProps) {
  const [animationStep, setAnimationStep] = useState(-1);

  useEffect(() => {
    // Animate the proof verification
    let step = 0;
    const interval = setInterval(() => {
      setAnimationStep(step);
      step++;
      if (step > proof.path.length) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [proof]);

  return (
    <div className="space-y-3 md:space-y-4">
      {/* What is Zero-Knowledge Proof? */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-lg p-3 md:p-4 border-2 border-indigo-200 dark:border-indigo-800">
        <h4 className="font-bold text-xs md:text-sm text-foreground mb-1.5 md:mb-2 flex items-center gap-2">
          🔐 What's Happening Here?
        </h4>
        <p className="text-xs text-foreground/80 leading-relaxed">
          You can prove your vote is included in the final tally{" "}
          <span className="font-bold">WITHOUT</span> revealing what you voted
          for! The colored dot represents your encrypted vote - nobody knows
          what it means except you.
        </p>
      </div>

      {/* Visual Proof Flow */}
      <div className="bg-muted/30 rounded-lg p-3 md:p-4 border-2 border-muted-foreground/20">
        <div className="flex items-center justify-between mb-2 md:mb-3">
          <h4 className="font-semibold text-xs md:text-sm text-foreground">
            Your Cryptographic Proof
          </h4>
          <span
            className={`text-xs font-bold px-1.5 md:px-2 py-0.5 md:py-1 rounded ${
              verified
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {verified ? "✓ VERIFIED" : "✗ INVALID"}
          </span>
        </div>

        {/* Animated Visual Flow */}
        <div className="space-y-2 md:space-y-3 mb-3 md:mb-4">
          {/* Your Vote (Hidden) */}
          <div
            className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg border-2 transition-all ${
              animationStep >= 0
                ? "bg-white dark:bg-gray-800 border-indigo-300 dark:border-indigo-700"
                : "bg-muted/50 border-muted-foreground/20"
            }`}
          >
            <div
              className="w-6 h-6 md:w-8 md:h-8 rounded-full border-3 md:border-4 border-white shadow-lg animate-pulse flex-shrink-0"
              style={{ backgroundColor: voteColor }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground">
                Your Secret Vote
              </div>
              <div className="text-xs text-muted-foreground">
                Encrypted as colored commitment
              </div>
            </div>
            {animationStep >= 0 && (
              <span className="text-green-500 font-bold text-sm md:text-base flex-shrink-0">
                ✓
              </span>
            )}
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div
              className={`transition-all ${
                animationStep >= 0 ? "opacity-100" : "opacity-20"
              }`}
            >
              ↓
            </div>
          </div>

          {/* Merkle Path */}
          <div
            className={`p-2 md:p-3 rounded-lg border-2 transition-all ${
              animationStep >= 1
                ? "bg-white dark:bg-gray-800 border-blue-300 dark:border-blue-700"
                : "bg-muted/50 border-muted-foreground/20"
            }`}
          >
            <div className="text-xs font-semibold text-foreground mb-1.5 md:mb-2">
              Verification Path
            </div>
            <div className="flex gap-1 flex-wrap">
              {proof.path.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-5 h-5 md:w-6 md:h-6 rounded border-2 transition-all ${
                    animationStep > idx + 1
                      ? "bg-blue-500 border-blue-600"
                      : animationStep === idx + 1
                      ? "bg-blue-400 border-blue-500 animate-pulse"
                      : "bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  }`}
                />
              ))}
            </div>
            {animationStep >= proof.path.length && (
              <span className="text-green-500 font-bold text-xs mt-1 block">
                ✓ Path Valid
              </span>
            )}
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div
              className={`transition-all ${
                animationStep >= proof.path.length
                  ? "opacity-100"
                  : "opacity-20"
              }`}
            >
              ↓
            </div>
          </div>

          {/* Merkle Root */}
          <div
            className={`p-2 md:p-3 rounded-lg border-2 transition-all ${
              animationStep > proof.path.length
                ? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-300 dark:border-green-700"
                : "bg-muted/50 border-muted-foreground/20"
            }`}
          >
            <div className="text-xs font-semibold text-foreground mb-1">
              Merkle Root (Public Record)
            </div>
            <div className="font-mono text-xs text-foreground break-all bg-white/50 dark:bg-black/20 rounded p-1.5 md:p-2">
              {proof.root.slice(0, 32)}...
            </div>
            {animationStep > proof.path.length && (
              <div className="mt-1.5 md:mt-2 text-xs leading-relaxed text-green-700 dark:text-green-400 font-bold">
                ✓ Your vote is cryptographically proven to be in the final
                tally!
              </div>
            )}
          </div>
        </div>

        {/* Key Information */}
        <div className="grid grid-cols-2 gap-1.5 md:gap-2 text-xs">
          <div className="bg-background rounded p-1.5 md:p-2 border">
            <div className="text-muted-foreground font-semibold">Privacy</div>
            <div className="text-foreground font-mono text-sm md:text-base">
              100%
            </div>
          </div>
          <div className="bg-background rounded p-1.5 md:p-2 border">
            <div className="text-muted-foreground font-semibold">
              Proof Steps
            </div>
            <div className="text-foreground font-mono text-sm md:text-base">
              {proof.path.length}
            </div>
          </div>
        </div>

        {/* Technical Details (Collapsible) */}
        <details className="mt-2 md:mt-3">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            Show technical details
          </summary>
          <div className="mt-2 space-y-2 text-xs">
            <div>
              <div className="text-muted-foreground font-semibold mb-1">
                Your Vote Commitment:
              </div>
              <div className="font-mono bg-background rounded px-2 py-1 text-foreground break-all">
                {proof.leaf}
              </div>
            </div>

            <div>
              <div className="text-muted-foreground font-semibold mb-1">
                Proof Path:
              </div>
              <div className="space-y-1">
                {proof.path.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-muted-foreground">{idx + 1}.</span>
                    <span
                      className={`text-xs px-1 rounded ${
                        step.position === "left"
                          ? "bg-blue-100 dark:bg-blue-900/30"
                          : "bg-purple-100 dark:bg-purple-900/30"
                      }`}
                    >
                      {step.position}
                    </span>
                    <span className="font-mono text-foreground">
                      {step.hash.slice(0, 16)}...
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
