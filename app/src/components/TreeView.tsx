import { useState } from "react";
import type { Case, TreeNode } from "../types";

function Node({
  node,
  depth,
  selectedId,
  onSelect,
  defaultOpen,
}: {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (c: Case) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isLeaf = !!node.caseRef;
  const selected = isLeaf && node.caseRef!.id === selectedId;

  if (isLeaf) {
    return (
      <div
        className={"tv-leaf" + (selected ? " selected" : "")}
        style={{ paddingLeft: 12 + depth * 14 }}
        onClick={() => onSelect(node.caseRef!)}
        title={node.caseRef!.id}
      >
        {!node.caseRef!.id.includes("#") && (
          <span className="tv-id">{node.caseRef!.id}</span>
        )}
        <span className="tv-label">{node.label}</span>
      </div>
    );
  }

  return (
    <div>
      <div
        className="tv-branch"
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="tv-caret">{open ? "▾" : "▸"}</span>
        <span className="tv-label">{node.label}</span>
        <span className="tv-count">{node.count}</span>
      </div>
      {open &&
        node.children.map((ch) => (
          <Node
            key={ch.key}
            node={ch}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            defaultOpen={false}
          />
        ))}
    </div>
  );
}

export default function TreeView({
  tree,
  selectedId,
  onSelect,
}: {
  tree: TreeNode[];
  selectedId: string | null;
  onSelect: (c: Case) => void;
}) {
  return (
    <div className="tv-root">
      {tree.map((n, i) => (
        <Node
          key={n.key}
          node={n}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          defaultOpen={i === 0}
        />
      ))}
    </div>
  );
}
