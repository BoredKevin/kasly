import React, { useState, useEffect, useRef, useMemo } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { Search, ChevronDown, Check, X, User, Crown, Shield } from "lucide-react";

export interface MemberItem {
  _id: Id<"members">;
  userId: Id<"users">;
  email?: string;
  name?: string;
  nickname?: string;
  isOwner?: boolean;
  roles?: Array<{
    _id: Id<"roles">;
    name: string;
    color?: string;
    position?: number;
  }>;
}

interface MemberSearchSelectProps {
  members: MemberItem[] | undefined;
  value: string; // userId
  onChange: (userId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Calculates Levenshtein edit distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1] + 1         // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Computes a similarity/relevance score for nearest search ranking
 */
function getMatchScore(member: MemberItem, rawQuery: string): number {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return 1;

  const nickname = (member.nickname || "").toLowerCase();
  const name = (member.name || "").toLowerCase();
  const email = (member.email || "").toLowerCase();
  const displayName = (member.nickname || member.name || "member").toLowerCase();
  const roleNames = (member.roles || []).map((r) => r.name.toLowerCase()).join(" ");

  // 1. Exact match
  if (displayName === query || email === query) return 1000;
  if (name === query || nickname === query) return 950;

  // 2. Starts with query (prefix match)
  if (displayName.startsWith(query)) return 850;
  if (nickname.startsWith(query)) return 800;
  if (name.startsWith(query)) return 750;
  if (email.startsWith(query)) return 700;

  // 3. Word boundary start (e.g. query "beaks" matches "Mr MrBeaks")
  const words = `${displayName} ${email}`.split(/[\s@._-]+/);
  for (const word of words) {
    if (word.startsWith(query)) return 650;
  }

  // 4. Substring contains
  if (displayName.includes(query)) return 550;
  if (nickname.includes(query)) return 500;
  if (name.includes(query)) return 450;
  if (email.includes(query)) return 400;
  if (roleNames.includes(query)) return 350;

  // 5. Fuzzy subsequence match (characters appear in sequential order)
  let qIdx = 0;
  let consec = 0;
  let maxConsec = 0;
  const combined = `${displayName} ${email}`;
  for (let i = 0; i < combined.length && qIdx < query.length; i++) {
    if (combined[i] === query[qIdx]) {
      qIdx++;
      consec++;
      if (consec > maxConsec) maxConsec = consec;
    } else {
      consec = 0;
    }
  }
  if (qIdx === query.length) {
    return 250 + maxConsec * 10 - Math.min(50, combined.length);
  }

  // 6. Typo tolerance / Levenshtein for queries of length >= 3
  if (query.length >= 3) {
    const targetSlice = displayName.slice(0, query.length + 2);
    const dist = levenshteinDistance(query, targetSlice);
    if (dist <= 2) {
      return 150 - dist * 30;
    }
    const emailSlice = email.split("@")[0]?.slice(0, query.length + 2) || "";
    const emailDist = levenshteinDistance(query, emailSlice);
    if (emailDist <= 2) {
      return 120 - emailDist * 30;
    }
  }

  return 0;
}

export function MemberSearchSelect({
  members,
  value,
  onChange,
  disabled = false,
  placeholder = "Search member by name or email...",
  className = "",
}: MemberSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Find currently selected member
  const selectedMember = useMemo(() => {
    return members?.find((m) => m.userId === value);
  }, [members, value]);

  // Display text when not actively typing or when closed
  const getMemberLabel = (m: MemberItem) => {
    const name = m.nickname || m.name || "Member";
    const email = m.email ? ` (${m.email})` : "";
    return `${name}${email}`;
  };

  // Rank and filter members according to nearest match
  const filteredAndRankedMembers = useMemo(() => {
    if (!members || members.length === 0) return [];
    if (!searchQuery.trim()) {
      // No search query: sort alphabetically by display name
      return [...members].sort((a, b) => {
        const nameA = (a.nickname || a.name || "").toLowerCase();
        const nameB = (b.nickname || b.name || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }

    const scored = members
      .map((member) => ({
        member,
        score: getMatchScore(member, searchQuery),
      }))
      .filter((item) => item.score > 0);

    // Sort by highest score first
    scored.sort((a, b) => b.score - a.score);

    return scored.map((item) => item.member);
  }, [members, searchQuery]);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // When dropdown opens/closes, reset query or highlighted index
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Auto scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-member-item]");
      const currentItem = items[highlightedIndex] as HTMLElement | undefined;
      if (currentItem) {
        currentItem.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (member: MemberItem) => {
    onChange(member.userId);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchQuery("");
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          filteredAndRankedMembers.length > 0
            ? (prev + 1) % filteredAndRankedMembers.length
            : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          filteredAndRankedMembers.length > 0
            ? (prev - 1 + filteredAndRankedMembers.length) % filteredAndRankedMembers.length
            : 0
        );
        break;
      case "Enter":
        e.preventDefault();
        if (
          filteredAndRankedMembers.length > 0 &&
          filteredAndRankedMembers[highlightedIndex]
        ) {
          handleSelect(filteredAndRankedMembers[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  if (!members) {
    return (
      <div className="w-full h-9 px-3 bg-background border border-border text-xs text-muted-foreground font-mono flex items-center gap-2">
        <Search className="w-3.5 h-3.5 animate-pulse text-muted-foreground" />
        <span>Loading organization members...</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Box */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
        className={`relative flex items-center w-full h-9 px-2.5 bg-background border transition-all cursor-pointer ${isOpen
          ? "border-primary ring-1 ring-primary/40 shadow-sm"
          : selectedMember
            ? "border-border hover:border-primary/60"
            : "border-border hover:border-primary/50"
          } ${disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0 mr-2" />

        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={isOpen ? searchQuery : selectedMember ? getMemberLabel(selectedMember) : ""}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={selectedMember ? getMemberLabel(selectedMember) : placeholder}
          className="w-full h-full bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground placeholder:font-mono focus:outline-none cursor-text truncate"
        />

        {/* Action icons on right */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {(selectedMember || searchQuery) && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) setIsOpen((prev) => !prev);
            }}
            className="p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? "rotate-180 text-primary" : ""
                }`}
            />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card/95 bg-background border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header count / Nearest match status */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b border-border/80 text-[10px] font-mono text-muted-foreground">
            <span>
              {searchQuery.trim()
                ? `Nearest Results (${filteredAndRankedMembers.length})`
                : `All Members (${members.length})`}
            </span>
            {searchQuery.trim() && filteredAndRankedMembers.length > 0 && (
              <span className="text-primary font-semibold">Ranked by relevance</span>
            )}
          </div>

          {/* Members List */}
          <div ref={listRef} className="max-h-56 overflow-y-auto divide-y divide-border/40">
            {filteredAndRankedMembers.length === 0 ? (
              <div className="p-4 text-center space-y-1">
                <p className="text-xs font-mono text-muted-foreground">
                  No members found matching &quot;{searchQuery}&quot;
                </p>
                <p className="text-[11px] text-muted-foreground/70 font-mono">
                  Try searching with a nickname, full name, or email.
                </p>
              </div>
            ) : (
              filteredAndRankedMembers.map((member, index) => {
                const isSelected = member.userId === value;
                const isHighlighted = index === highlightedIndex;
                const displayName = member.nickname || member.name || "Member";
                const isTopResult = searchQuery.trim().length > 0 && index === 0;

                return (
                  <div
                    key={member._id}
                    data-member-item
                    onClick={() => handleSelect(member)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-3 py-2 text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${isHighlighted
                      ? "bg-primary/15 text-foreground"
                      : isSelected
                        ? "bg-muted/50 text-foreground"
                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                      }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Avatar initial badge */}
                      <div
                        className={`w-6 h-6 rounded-sm shrink-0 flex items-center justify-center font-mono text-[11px] font-bold border ${isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : isHighlighted
                            ? "bg-primary/20 text-primary border-primary/40"
                            : "bg-muted text-muted-foreground border-border"
                          }`}
                      >
                        {displayName.charAt(0).toUpperCase()}
                      </div>

                      {/* Name & Email info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`font-semibold font-mono truncate ${isSelected || isHighlighted ? "text-foreground" : ""
                              }`}
                          >
                            {displayName}
                          </span>

                          {member.isOwner && (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[9px] font-mono rounded">
                              <Crown className="w-2.5 h-2.5" />
                              <span>Owner</span>
                            </span>
                          )}

                          {member.roles && member.roles.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-muted border border-border text-muted-foreground text-[9px] font-mono rounded">
                              <Shield className="w-2.5 h-2.5" />
                              <span>{member.roles[0].name}</span>
                            </span>
                          )}

                          {isTopResult && (
                            <span className="px-1 py-0.2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-mono rounded font-semibold">
                              Best Match
                            </span>
                          )}
                        </div>

                        {member.email && (
                          <p className="text-[11px] font-mono text-muted-foreground truncate">
                            {member.email}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Selected Checkmark */}
                    {isSelected && (
                      <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Tip Footer */}
          <div className="px-3 py-1 bg-muted/20 border-t border-border/60 text-[10px] font-mono text-muted-foreground flex items-center justify-between">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
}
