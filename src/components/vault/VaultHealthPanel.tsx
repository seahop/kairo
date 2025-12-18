import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNoteStore } from "@/stores/noteStore";
import clsx from "clsx";
import { CloseIcon } from "@/components/common/Icons";

// Types matching the Rust backend
interface OrphanNote {
  id: string;
  path: string;
  title: string;
  createdAt: number;
  modifiedAt: number;
}

interface BrokenLink {
  sourceId: string;
  sourcePath: string;
  sourceTitle: string;
  targetReference: string;
  context?: string;
}

interface GraphNode {
  id: string;
  path: string;
  title: string;
  linkCount: number;
  backlinkCount: number;
}

interface VaultHealth {
  totalNotes: number;
  totalLinks: number;
  orphanCount: number;
  brokenLinkCount: number;
  avgLinksPerNote: number;
  mostConnectedNotes: GraphNode[];
  recentlyModified: OrphanNote[];
}

interface UnlinkedMention {
  noteId: string;
  notePath: string;
  noteTitle: string;
  mentionedInId: string;
  mentionedInPath: string;
  mentionedInTitle: string;
  context: string;
}

// Icons
const HealthIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const OrphanIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const BrokenLinkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={clsx("w-4 h-4 transition-transform", expanded && "rotate-90")}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const DiceIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
    <circle cx="8" cy="8" r="1" fill="currentColor" />
    <circle cx="16" cy="8" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="8" cy="16" r="1" fill="currentColor" />
    <circle cx="16" cy="16" r="1" fill="currentColor" />
  </svg>
);

const LinkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const MapIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
);

function StatCard({ label, value, color = "text-dark-100" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-dark-800 rounded-lg p-3">
      <div className={clsx("text-2xl font-bold", color)}>{value}</div>
      <div className="text-xs text-dark-400 mt-1">{label}</div>
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  variant?: "default" | "warning" | "danger";
}

function CollapsibleSection({ title, count, icon, children, defaultExpanded = false, variant = "default" }: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const badgeColor = variant === "danger" ? "bg-red-500/20 text-red-400" :
                     variant === "warning" ? "bg-yellow-500/20 text-yellow-400" :
                     "bg-dark-700 text-dark-300";

  return (
    <div className="border border-dark-700 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 bg-dark-850 hover:bg-dark-800 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronIcon expanded={expanded} />
        <span className="text-dark-400">{icon}</span>
        <span className="font-medium text-dark-200">{title}</span>
        <span className={clsx("ml-auto text-xs px-2 py-0.5 rounded-full", badgeColor)}>
          {count}
        </span>
      </button>
      {expanded && (
        <div className="p-4 bg-dark-900 border-t border-dark-700">
          {children}
        </div>
      )}
    </div>
  );
}

type TabId = "overview" | "orphans" | "broken" | "unlinked" | "mocs" | "random";

export function VaultHealthPanel({ onClose }: { onClose: () => void }) {
  const { openNote, createNote } = useNoteStore();

  const [health, setHealth] = useState<VaultHealth | null>(null);
  const [orphans, setOrphans] = useState<OrphanNote[]>([]);
  const [brokenLinks, setBrokenLinks] = useState<BrokenLink[]>([]);
  const [unlinkedMentions, setUnlinkedMentions] = useState<UnlinkedMention[]>([]);
  const [potentialMocs, setPotentialMocs] = useState<GraphNode[]>([]);
  const [randomNote, setRandomNote] = useState<OrphanNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [healthData, orphanData, brokenData, unlinkedData, mocsData] = await Promise.all([
        invoke<VaultHealth>("get_vault_health"),
        invoke<OrphanNote[]>("get_orphan_notes"),
        invoke<BrokenLink[]>("get_broken_links"),
        invoke<UnlinkedMention[]>("get_unlinked_mentions"),
        invoke<GraphNode[]>("get_potential_mocs", { minLinks: 3 }),
      ]);
      setHealth(healthData);
      setOrphans(orphanData);
      setBrokenLinks(brokenData);
      setUnlinkedMentions(unlinkedData);
      setPotentialMocs(mocsData);
    } catch (error) {
      console.error("Failed to load vault health:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRandomNote = async () => {
    try {
      const note = await invoke<OrphanNote | null>("get_random_note");
      setRandomNote(note);
    } catch (error) {
      console.error("Failed to load random note:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateMissingNote = async (reference: string) => {
    const path = `notes/${reference}.md`;
    const content = `# ${reference}\n\n`;
    await createNote(path, content);
    loadData(); // Refresh to update broken links
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getHealthScore = () => {
    if (!health) return 0;
    const orphanPenalty = Math.min(health.orphanCount / health.totalNotes, 0.5) * 30;
    const brokenLinkPenalty = Math.min(health.brokenLinkCount / Math.max(health.totalLinks, 1), 0.5) * 40;
    const linkBonus = Math.min(health.avgLinksPerNote / 3, 1) * 30;
    return Math.max(0, Math.min(100, 100 - orphanPenalty - brokenLinkPenalty + linkBonus));
  };

  const healthScore = getHealthScore();
  const healthColor = healthScore >= 80 ? "text-green-400" :
                      healthScore >= 60 ? "text-yellow-400" :
                      healthScore >= 40 ? "text-orange-400" : "text-red-400";

  return (
    <div className="h-full flex flex-col bg-dark-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-800">
        <div className="flex items-center gap-2">
          <HealthIcon />
          <h2 className="font-semibold text-dark-100">Vault Health</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded transition-colors"
            onClick={loadData}
            title="Refresh"
          >
            <RefreshIcon />
          </button>
          <button
            className="p-1.5 text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded transition-colors"
            onClick={onClose}
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-800 overflow-x-auto">
        {[
          { id: "overview", label: "Overview", icon: null },
          { id: "orphans", label: `Orphans`, count: orphans.length, icon: <OrphanIcon /> },
          { id: "broken", label: `Broken`, count: brokenLinks.length, icon: <BrokenLinkIcon /> },
          { id: "unlinked", label: `Unlinked`, count: unlinkedMentions.length, icon: <LinkIcon /> },
          { id: "mocs", label: `MOCs`, count: potentialMocs.length, icon: <MapIcon /> },
          { id: "random", label: `Random`, icon: <DiceIcon /> },
        ].map((tab) => (
          <button
            key={tab.id}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "text-accent-primary border-b-2 border-accent-primary"
                : "text-dark-400 hover:text-dark-200"
            )}
            onClick={() => {
              setActiveTab(tab.id as TabId);
              if (tab.id === "random") loadRandomNote();
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="text-xs bg-dark-700 px-1.5 py-0.5 rounded">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-dark-400">
            Loading...
          </div>
        ) : activeTab === "overview" ? (
          <div className="space-y-6">
            {/* Health Score */}
            <div className="bg-dark-850 rounded-lg p-6 text-center">
              <div className={clsx("text-5xl font-bold", healthColor)}>
                {Math.round(healthScore)}
              </div>
              <div className="text-sm text-dark-400 mt-2">Health Score</div>
              <div className="mt-4 h-2 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    "h-full rounded-full transition-all",
                    healthScore >= 80 ? "bg-green-500" :
                    healthScore >= 60 ? "bg-yellow-500" :
                    healthScore >= 40 ? "bg-orange-500" : "bg-red-500"
                  )}
                  style={{ width: `${healthScore}%` }}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total Notes" value={health?.totalNotes ?? 0} />
              <StatCard label="Total Links" value={health?.totalLinks ?? 0} />
              <StatCard
                label="Orphan Notes"
                value={health?.orphanCount ?? 0}
                color={health?.orphanCount ? "text-yellow-400" : "text-green-400"}
              />
              <StatCard
                label="Broken Links"
                value={health?.brokenLinkCount ?? 0}
                color={health?.brokenLinkCount ? "text-red-400" : "text-green-400"}
              />
            </div>

            {/* Average Links */}
            <div className="bg-dark-850 rounded-lg p-4">
              <div className="text-sm text-dark-400">Average links per note</div>
              <div className="text-xl font-semibold text-dark-100 mt-1">
                {health?.avgLinksPerNote.toFixed(2) ?? 0}
              </div>
            </div>

            {/* Most Connected Notes */}
            {health?.mostConnectedNotes && health.mostConnectedNotes.length > 0 && (
              <CollapsibleSection
                title="Most Connected Notes"
                count={health.mostConnectedNotes.length}
                icon={<span>🌟</span>}
                defaultExpanded
              >
                <div className="space-y-2">
                  {health.mostConnectedNotes.map((note) => (
                    <button
                      key={note.id}
                      className="w-full text-left p-2 rounded hover:bg-dark-800 transition-colors"
                      onClick={() => openNote(note.path)}
                    >
                      <div className="text-sm font-medium text-dark-200 truncate">
                        {note.title}
                      </div>
                      <div className="text-xs text-dark-500 mt-1">
                        {note.linkCount} outgoing • {note.backlinkCount} incoming
                      </div>
                    </button>
                  ))}
                </div>
              </CollapsibleSection>
            )}
          </div>
        ) : activeTab === "orphans" ? (
          <div className="space-y-4">
            {orphans.length === 0 ? (
              <div className="text-center py-8 text-dark-400">
                <OrphanIcon />
                <div className="mt-2">No orphan notes found!</div>
                <div className="text-xs mt-1">All your notes are well connected.</div>
              </div>
            ) : (
              <>
                <div className="text-sm text-dark-400 mb-4">
                  These notes have no incoming or outgoing links. Consider connecting them to your knowledge graph.
                </div>
                <div className="space-y-2">
                  {orphans.map((note) => (
                    <button
                      key={note.id}
                      className="w-full text-left p-3 bg-dark-850 rounded-lg hover:bg-dark-800 transition-colors group"
                      onClick={() => openNote(note.path)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-medium text-dark-200 group-hover:text-accent-primary">
                            {note.title}
                          </div>
                          <div className="text-xs text-dark-500 mt-1">
                            {note.path}
                          </div>
                        </div>
                        <div className="text-xs text-dark-500">
                          {formatDate(note.modifiedAt)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : activeTab === "broken" ? (
          <div className="space-y-4">
            {brokenLinks.length === 0 ? (
              <div className="text-center py-8 text-dark-400">
                <BrokenLinkIcon />
                <div className="mt-2">No broken links found!</div>
                <div className="text-xs mt-1">All your links are valid.</div>
              </div>
            ) : (
              <>
                <div className="text-sm text-dark-400 mb-4">
                  These links point to notes that don't exist. You can create the missing notes or fix the links.
                </div>
                <div className="space-y-2">
                  {brokenLinks.map((link, idx) => (
                    <div
                      key={`${link.sourceId}-${link.targetReference}-${idx}`}
                      className="p-3 bg-dark-850 rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <button
                            className="text-sm font-medium text-dark-200 hover:text-accent-primary truncate block"
                            onClick={() => openNote(link.sourcePath)}
                          >
                            {link.sourceTitle}
                          </button>
                          <div className="text-xs text-dark-500 mt-1 flex items-center gap-1">
                            <span>links to</span>
                            <span className="text-red-400 font-mono">[[{link.targetReference}]]</span>
                          </div>
                          {link.context && (
                            <div className="text-xs text-dark-600 mt-2 italic truncate">
                              ...{link.context}...
                            </div>
                          )}
                        </div>
                        <button
                          className="ml-2 px-2 py-1 text-xs bg-accent-primary/20 text-accent-primary rounded hover:bg-accent-primary/30 transition-colors whitespace-nowrap"
                          onClick={() => handleCreateMissingNote(link.targetReference)}
                        >
                          Create Note
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : activeTab === "unlinked" ? (
          <div className="space-y-4">
            {unlinkedMentions.length === 0 ? (
              <div className="text-center py-8 text-dark-400">
                <LinkIcon />
                <div className="mt-2">No unlinked mentions found!</div>
                <div className="text-xs mt-1">All note titles are properly linked where mentioned.</div>
              </div>
            ) : (
              <>
                <div className="text-sm text-dark-400 mb-4">
                  These note titles appear in other notes but aren't wiki-linked. Consider adding [[links]].
                </div>
                <div className="space-y-2">
                  {unlinkedMentions.map((mention, idx) => (
                    <div
                      key={`${mention.noteId}-${mention.mentionedInId}-${idx}`}
                      className="p-3 bg-dark-850 rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-dark-500 mb-1">
                            "{mention.noteTitle}" appears in:
                          </div>
                          <button
                            className="text-sm font-medium text-dark-200 hover:text-accent-primary truncate block"
                            onClick={() => openNote(mention.mentionedInPath)}
                          >
                            {mention.mentionedInTitle}
                          </button>
                          <div className="text-xs text-dark-600 mt-2 italic truncate">
                            {mention.context}
                          </div>
                        </div>
                        <button
                          className="ml-2 px-2 py-1 text-xs bg-accent-primary/20 text-accent-primary rounded hover:bg-accent-primary/30 transition-colors whitespace-nowrap"
                          onClick={() => openNote(mention.notePath)}
                        >
                          View Note
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : activeTab === "mocs" ? (
          <div className="space-y-4">
            {potentialMocs.length === 0 ? (
              <div className="text-center py-8 text-dark-400">
                <MapIcon />
                <div className="mt-2">No potential MOCs found</div>
                <div className="text-xs mt-1">Create notes with 3+ outgoing links to see them here.</div>
              </div>
            ) : (
              <>
                <div className="text-sm text-dark-400 mb-4">
                  These notes have many outgoing links and could serve as Maps of Content (MOCs) - index notes that organize related topics.
                </div>
                <div className="space-y-2">
                  {potentialMocs.map((note) => (
                    <button
                      key={note.id}
                      className="w-full text-left p-3 bg-dark-850 rounded-lg hover:bg-dark-800 transition-colors group"
                      onClick={() => openNote(note.path)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-medium text-dark-200 group-hover:text-accent-primary">
                            {note.title}
                          </div>
                          <div className="text-xs text-dark-500 mt-1">
                            {note.path}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-accent-primary">{note.linkCount}</div>
                          <div className="text-xs text-dark-500">outgoing links</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : activeTab === "random" ? (
          <div className="space-y-4">
            <div className="text-sm text-dark-400 mb-4">
              Review a random note from your vault. Great for Zettelkasten-style spaced repetition and finding forgotten ideas.
            </div>

            {randomNote ? (
              <div className="bg-dark-850 rounded-lg p-6">
                <button
                  className="text-lg font-medium text-dark-100 hover:text-accent-primary mb-2 block"
                  onClick={() => openNote(randomNote.path)}
                >
                  {randomNote.title}
                </button>
                <div className="text-sm text-dark-500 mb-4">{randomNote.path}</div>
                <div className="text-xs text-dark-600">
                  Modified: {formatDate(randomNote.modifiedAt)}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-dark-400">
                Click the button below to discover a random note
              </div>
            )}

            <button
              className="w-full py-3 bg-accent-primary text-dark-950 font-medium rounded-lg hover:bg-accent-primary/90 transition-colors flex items-center justify-center gap-2"
              onClick={loadRandomNote}
            >
              <DiceIcon />
              {randomNote ? "Get Another Random Note" : "Discover a Random Note"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
