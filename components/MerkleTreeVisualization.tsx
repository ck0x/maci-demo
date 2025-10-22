"use client";

import { useEffect, useState } from "react";
import { MerkleNode } from "@/lib/crypto";

interface MerkleTreeVisualizationProps {
  tree: MerkleNode | null;
  highlightLeaf?: string;
  highlightColor?: string;
  leafColors?: Record<string, string>; // Map commitment hash to color
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
  leafColors = {},
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

          // Get the color for this leaf from the mapping
          const leafColor = isLeaf && leafColors[pos.node.hash];

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
                    : leafColor
                    ? leafColor
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
  return (
    <div className="space-y-3 md:space-y-4">
      {/* What's Happening Here? */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-lg p-3 md:p-4 border-2 border-indigo-200 dark:border-indigo-800">
        <h4 className="font-bold text-xs md:text-sm text-foreground mb-1.5 md:mb-2 flex items-center gap-2">
          🔐 What's Happening Here?
        </h4>
        <div className="flex items-start gap-2 md:gap-3 mb-2">
          <div
            className="w-6 h-6 md:w-8 md:h-8 rounded-full border-3 md:border-4 border-white shadow-lg flex-shrink-0 mt-0.5"
            style={{ backgroundColor: voteColor }}
          />
          <p className="text-xs text-foreground/80 leading-relaxed">
            You can prove your vote is included in the final tally{" "}
            <span className="font-bold">WITHOUT</span> revealing what you voted
            for! The colored dot represents your encrypted vote - nobody knows
            what it means except you.
          </p>
        </div>
        {verified && (
          <div className="mt-2 pt-2 border-t border-indigo-200 dark:border-indigo-700">
            <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 font-semibold">
              <span className="text-sm">✓</span>
              Your vote is cryptographically verified in the Merkle tree!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
