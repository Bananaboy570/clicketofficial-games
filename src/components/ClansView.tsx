import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Users,
  Crown,
  Plus,
  Search,
  Send,
  LogOut,
  Trophy,
  UserMinus,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Edit3,
  X,
} from 'lucide-react';
import { ALL_BLOOKS } from '../data/blooks';
import { BlookArt, BlooketTokenIcon } from './BlookArt';
import { OwnerAchievementIcon, DeveloperAchievementIcon } from './AchievementsView';
import { apiFetch } from '../lib/apiClient';

export interface ClanMemberSummary {
  id: string;
  username: string;
  equippedBlookId: string;
  tokens: number;
  uniqueBlooksCount: number;
  achievements: string[];
  role: 'Leader' | 'Officer' | 'Member';
}

export interface ClanMessageItem {
  id: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
}

export interface ClanSummary {
  id: string;
  name: string;
  tag: string;
  description: string;
  bannerColor: string;
  emblemBlookId: string;
  leaderId: string;
  leaderUsername: string;
  memberCount: number;
  totalTokens: number;
  totalUniqueBlooks: number;
  powerScore: number;
  members: ClanMemberSummary[];
  messages: ClanMessageItem[];
  createdAt: string;
}

const BANNER_COLORS = [
  '#dc2626',
  '#2563eb',
  '#16a34a',
  '#9333ea',
  '#ea580c',
  '#0891b2',
];

const EMBLEM_BLOOK_IDS = [
  'jester',
  'magician',
  'ring-lion',
  'fire-guy',
  'circus-elephant',
  'the-golden-ticket',
  'athlete-soccer',
  'athlete-cyborg',
];

interface ClansViewProps {
  myUserId: string;
  myClanId: string | null;
  sessionToken: string | null;
  onRefreshUser: () => Promise<void>;
}

export const ClansView: React.FC<ClansViewProps> = ({
  myUserId,
  myClanId,
  sessionToken,
  onRefreshUser,
}) => {
  const [clans, setClans] = useState<ClanSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [subTab, setSubTab] = useState<'my-clan' | 'browse'>(myClanId ? 'my-clan' : 'browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Create clan modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState('#dc2626');
  const [newEmblem, setNewEmblem] = useState('jester');

  // Edit clan modal (leader)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState('#dc2626');
  const [editEmblem, setEditEmblem] = useState('jester');

  // Clan chat input
  const [chatText, setChatText] = useState('');

  const fetchClans = useCallback(async () => {
    try {
      const res = await apiFetch('/api/clans');
      if (res.ok) {
        const data = await res.json();
        setClans(Array.isArray(data.clans) ? data.clans : []);
      }
    } catch {
      // Ignore transient refresh failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClans();
    const interval = setInterval(fetchClans, 8000);
    return () => clearInterval(interval);
  }, [fetchClans]);

  const myClan = clans.find(
    (c) => c.id === myClanId || c.members.some((m) => m.id === myUserId)
  ) || null;

  useEffect(() => {
    if (myClan && subTab !== 'my-clan' && !showCreateModal) {
      // keep user choice if they explicitly clicked Browse, only auto-switch when joining/creating
    } else if (!myClan && subTab === 'my-clan') {
      setSubTab('browse');
    }
  }, [myClan, subTab, showCreateModal]);

  const handleCreateClan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken) return;
    setErrorMsg(null);
    setActionBusy(true);
    try {
      const res = await apiFetch('/api/clans/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          name: newName.trim(),
          tag: newTag.trim().toUpperCase(),
          description: newDesc.trim(),
          bannerColor: newColor,
          emblemBlookId: newEmblem,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not create clan.');
        return;
      }
      setShowCreateModal(false);
      setNewName('');
      setNewTag('');
      setNewDesc('');
      await Promise.all([fetchClans(), onRefreshUser()]);
      setSubTab('my-clan');
    } catch {
      setErrorMsg('Network error creating clan.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleJoinClan = async (clanId: string) => {
    if (!sessionToken) return;
    setErrorMsg(null);
    setActionBusy(true);
    try {
      const res = await apiFetch(`/api/clans/${encodeURIComponent(clanId)}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not join clan.');
        return;
      }
      await Promise.all([fetchClans(), onRefreshUser()]);
      setSubTab('my-clan');
    } catch {
      setErrorMsg('Network error joining clan.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleLeaveClan = async () => {
    if (!sessionToken) return;
    setErrorMsg(null);
    setActionBusy(true);
    try {
      const res = await apiFetch('/api/clans/leave', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || 'Could not leave clan.');
        return;
      }
      await Promise.all([fetchClans(), onRefreshUser()]);
      setSubTab('browse');
    } catch {
      setErrorMsg('Network error leaving clan.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken || !myClan || !chatText.trim()) return;
    const text = chatText.trim();
    setChatText('');
    try {
      const res = await apiFetch(`/api/clans/${encodeURIComponent(myClan.id)}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        await fetchClans();
      }
    } catch {
      // Ignore transient failure
    }
  };

  const handleToggleRole = async (targetUserId: string) => {
    if (!sessionToken || !myClan) return;
    try {
      const res = await apiFetch(`/api/clans/${encodeURIComponent(myClan.id)}/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ targetUserId }),
      });
      if (res.ok) await fetchClans();
    } catch {
      // Ignore
    }
  };

  const handleKickMember = async (targetUserId: string) => {
    if (!sessionToken || !myClan) return;
    try {
      const res = await apiFetch(`/api/clans/${encodeURIComponent(myClan.id)}/kick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ targetUserId }),
      });
      if (res.ok) await fetchClans();
    } catch {
      // Ignore
    }
  };

  const handleUpdateClan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken || !myClan) return;
    setActionBusy(true);
    try {
      const res = await apiFetch(`/api/clans/${encodeURIComponent(myClan.id)}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          description: editDesc.trim(),
          bannerColor: editColor,
          emblemBlookId: editEmblem,
        }),
      });
      if (res.ok) {
        setShowEditModal(false);
        await fetchClans();
      }
    } finally {
      setActionBusy(false);
    }
  };

  const filteredClans = clans.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.tag.toLowerCase().includes(q) ||
      c.leaderUsername.toLowerCase().includes(q)
    );
  });

  const isLeader = myClan?.leaderId === myUserId;

  return (
    <div className="relative z-10 px-6 sm:px-9 pt-6 pb-16 min-h-full flex flex-col max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="font-titan text-white text-[44px] leading-none tracking-wide drop-shadow-[0_3px_0_rgba(0,0,0,0.18)]">
            Clans
          </h1>
          <p className="font-nunito font-extrabold text-white/90 text-sm mt-1">
            Team up with friends, climb the Clan Leaderboard, and chat in your Clan Hall!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {myClan && (
            <button
              type="button"
              onClick={() => setSubTab('my-clan')}
              className={`px-4 py-2 rounded-xl font-titan text-sm cursor-pointer transition-all flex items-center gap-1.5 ${
                subTab === 'my-clan'
                  ? 'bg-white text-[#dc2626] shadow-md'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>My Clan [{myClan.tag}]</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSubTab('browse')}
            className={`px-4 py-2 rounded-xl font-titan text-sm cursor-pointer transition-all flex items-center gap-1.5 ${
              subTab === 'browse'
                ? 'bg-white text-[#dc2626] shadow-md'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Browse & Leaderboard ({clans.length})</span>
          </button>

          {!myClan && (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setShowCreateModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-[#fbbf24] hover:brightness-105 shadow-[0_4px_0_#b45309] active:translate-y-0.5 active:shadow-none text-amber-950 font-titan text-sm cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Clan</span>
            </button>
          )}

          <button
            type="button"
            aria-label="Refresh Clans"
            onClick={fetchClans}
            className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 max-w-xl bg-rose-50 border-2 border-rose-300 text-rose-700 font-nunito font-extrabold text-sm px-4 py-3 rounded-2xl shadow">
          {errorMsg}
        </div>
      )}

      {/* MY CLAN DASHBOARD */}
      {subTab === 'my-clan' && myClan && (
        <div className="flex flex-col gap-6">
          {/* Clan Banner Card */}
          <div
            className="rounded-3xl p-6 text-white shadow-[0_8px_0_rgba(0,0,0,0.22)] border-4 border-white/25 flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
            style={{ backgroundColor: myClan.bannerColor }}
          >
            <div className="flex items-center gap-5">
              <div className="w-24 h-24 rounded-3xl bg-white/20 border-2 border-white/40 p-2.5 flex items-center justify-center shrink-0 shadow-inner">
                <BlookArt id={myClan.emblemBlookId} className="w-full h-full" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-lg bg-black/30 font-titan text-sm tracking-wider">
                    [{myClan.tag}]
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-white/20 font-nunito font-black text-xs">
                    {myClan.memberCount}/30 Members
                  </span>
                </div>
                <h2 className="font-titan text-3xl sm:text-4xl leading-tight drop-shadow-[0_2px_0_rgba(0,0,0,0.25)]">
                  {myClan.name}
                </h2>
                <p className="font-nunito font-bold text-white/90 text-sm mt-1 max-w-xl">
                  {myClan.description}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-stretch md:self-auto justify-between md:justify-end">
              <div className="bg-black/25 rounded-2xl px-4 py-2.5 flex items-center gap-4 border border-white/15">
                <div>
                  <span className="block font-nunito font-black text-[10px] uppercase text-white/75">
                    Clan Power
                  </span>
                  <span className="font-titan text-xl tabular-nums">
                    {myClan.powerScore.toLocaleString()}
                  </span>
                </div>
                <div className="w-px h-8 bg-white/20" />
                <div>
                  <span className="block font-nunito font-black text-[10px] uppercase text-white/75">
                    Tokens
                  </span>
                  <span className="font-titan text-xl tabular-nums flex items-center gap-1">
                    <BlooketTokenIcon className="w-4 h-4" />
                    {myClan.totalTokens.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isLeader && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditDesc(myClan.description);
                      setEditColor(myClan.bannerColor);
                      setEditEmblem(myClan.emblemBlookId);
                      setShowEditModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-nunito font-black text-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={handleLeaveClan}
                  className="px-3.5 py-2 rounded-xl bg-black/30 hover:bg-black/45 text-white font-nunito font-black text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{myClan.memberCount === 1 ? 'Disband' : 'Leave'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Roster & Clan Noticeboard */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Members Roster */}
            <div className="lg:col-span-3 bg-white rounded-3xl p-5 shadow-[0_8px_0_rgba(0,0,0,0.18)] flex flex-col">
              <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#dc2626]" />
                  <h3 className="font-titan text-xl text-slate-800">
                    Clan Roster ({myClan.members.length})
                  </h3>
                </div>
                <span className="font-nunito font-extrabold text-xs text-slate-400">
                  {myClan.totalUniqueBlooks} Combined Blooks
                </span>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                {myClan.members.map((member) => {
                  const isMe = member.id === myUserId;
                  return (
                    <div
                      key={member.id}
                      className={`flex items-center justify-between gap-3 p-3 rounded-2xl border-2 ${
                        isMe ? 'bg-red-50/70 border-red-200' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 p-1 shrink-0 flex items-center justify-center">
                          <BlookArt
                            id={member.equippedBlookId || 'jester'}
                            className="w-full h-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-nunito font-black text-sm text-slate-800 truncate">
                              {member.username}
                            </span>
                            {member.achievements.includes('owner') && (
                              <span title="Owner Achievement">
                                <OwnerAchievementIcon className="w-4 h-4" />
                              </span>
                            )}
                            {member.achievements.includes('developer') && (
                              <span title="Developer Achievement">
                                <DeveloperAchievementIcon className="w-4 h-4" />
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-md font-nunito font-black text-[10px] ${
                                member.role === 'Leader'
                                  ? 'bg-amber-100 text-amber-800'
                                  : member.role === 'Officer'
                                  ? 'bg-sky-100 text-sky-700'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {member.role === 'Leader' && (
                                <Crown className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                              )}
                              {member.role}
                            </span>
                          </div>
                          <p className="font-nunito font-bold text-xs text-slate-500 mt-0.5">
                            {member.tokens.toLocaleString()} Tokens · {member.uniqueBlooksCount} Blooks
                          </p>
                        </div>
                      </div>

                      {isLeader && !isMe && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            title={member.role === 'Officer' ? 'Demote to Member' : 'Promote to Officer'}
                            onClick={() => handleToggleRole(member.id)}
                            className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 cursor-pointer"
                          >
                            {member.role === 'Officer' ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronUp className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Kick from Clan"
                            onClick={() => handleKickMember(member.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Clan Noticeboard / Chat */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-5 shadow-[0_8px_0_rgba(0,0,0,0.18)] flex flex-col">
              <h3 className="font-titan text-xl text-slate-800 border-b-2 border-slate-100 pb-3 mb-3">
                Clan Chat
              </h3>

              <div className="flex-1 flex flex-col gap-2 max-h-[300px] min-h-[200px] overflow-y-auto pr-1 mb-3">
                {myClan.messages.length === 0 ? (
                  <p className="font-nunito font-bold text-xs text-slate-400 text-center my-auto">
                    No messages yet. Say hello to your clan!
                  </p>
                ) : (
                  myClan.messages.map((m) => (
                    <div
                      key={m.id}
                      className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-nunito font-black text-xs text-[#dc2626]">
                          {m.username}
                        </span>
                        <span className="font-nunito font-bold text-[10px] text-slate-400">
                          {new Date(m.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="font-nunito font-bold text-xs text-slate-700 mt-0.5 break-words">
                        {m.text}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={200}
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Message your clan..."
                  className="flex-1 px-3.5 py-2 rounded-xl border-2 border-slate-200 font-nunito font-bold text-xs text-slate-800 focus:outline-none focus:border-[#dc2626]"
                />
                <button
                  type="submit"
                  disabled={!chatText.trim()}
                  className="p-2.5 rounded-xl bg-[#f87171] hover:brightness-105 text-white shadow-[0_3px_0_#dc2626] cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* BROWSE & CLAN LEADERBOARD */}
      {subTab === 'browse' && (
        <div className="flex flex-col gap-5">
          {/* Search Input */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clans by name, tag, or leader..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white font-nunito font-bold text-sm text-slate-800 shadow-[0_4px_0_rgba(0,0,0,0.14)] focus:outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className="bg-white/95 rounded-3xl p-10 text-center font-nunito font-extrabold text-slate-500 shadow-lg">
              Loading Clans...
            </div>
          ) : filteredClans.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center shadow-[0_8px_0_rgba(0,0,0,0.18)] flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-red-100 text-[#dc2626] flex items-center justify-center mb-3">
                <Shield className="w-8 h-8" />
              </div>
              <h2 className="font-titan text-2xl text-slate-800 mb-1">
                {clans.length === 0 ? 'No Clans Yet!' : 'No Matching Clans'}
              </h2>
              <p className="font-nunito font-bold text-sm text-slate-500 max-w-md mb-5">
                {clans.length === 0
                  ? 'Be the first player to found a Clicket Clan and recruit teammates!'
                  : 'Try a different search term or create your own clan.'}
              </p>
              {!myClan && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-2.5 rounded-xl bg-[#fbbf24] hover:brightness-105 shadow-[0_4px_0_#b45309] text-amber-950 font-titan text-base cursor-pointer flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>Create a Clan</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredClans.map((clan, idx) => {
                const isMember = clan.id === myClan?.id;
                return (
                  <div
                    key={clan.id}
                    className="bg-white rounded-3xl p-5 shadow-[0_8px_0_rgba(0,0,0,0.18)] flex flex-col justify-between gap-4 border-2 border-white"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="w-16 h-16 rounded-2xl p-2 shrink-0 flex items-center justify-center shadow-md relative"
                        style={{ backgroundColor: clan.bannerColor }}
                      >
                        <BlookArt id={clan.emblemBlookId} className="w-full h-full" />
                        <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-slate-900 text-white font-titan text-xs flex items-center justify-center border-2 border-white">
                          #{idx + 1}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="px-2 py-0.5 rounded-md font-titan text-xs text-white"
                            style={{ backgroundColor: clan.bannerColor }}
                          >
                            [{clan.tag}]
                          </span>
                          <h3 className="font-titan text-xl text-slate-800 truncate">
                            {clan.name}
                          </h3>
                        </div>
                        <p className="font-nunito font-bold text-xs text-slate-500 mt-1 line-clamp-2">
                          {clan.description}
                        </p>
                        <p className="font-nunito font-extrabold text-[11px] text-slate-400 mt-1.5">
                          Leader: {clan.leaderUsername} · {clan.memberCount}/30 Members
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t-2 border-slate-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 font-nunito font-black text-xs text-slate-600">
                        <span>Power: {clan.powerScore.toLocaleString()}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <BlooketTokenIcon className="w-4 h-4" />
                          {clan.totalTokens.toLocaleString()}
                        </span>
                      </div>

                      {isMember ? (
                        <button
                          type="button"
                          onClick={() => setSubTab('my-clan')}
                          className="px-4 py-1.5 rounded-xl bg-emerald-100 text-emerald-700 font-titan text-sm cursor-pointer"
                        >
                          View My Clan
                        </button>
                      ) : !myClan ? (
                        <button
                          type="button"
                          disabled={actionBusy || clan.memberCount >= 30}
                          onClick={() => handleJoinClan(clan.id)}
                          className="px-4 py-1.5 rounded-xl bg-[#f87171] hover:brightness-105 shadow-[0_3px_0_#dc2626] text-white font-titan text-sm cursor-pointer disabled:opacity-50"
                        >
                          {clan.memberCount >= 30 ? 'Full' : 'Join Clan'}
                        </button>
                      ) : (
                        <span className="font-nunito font-bold text-xs text-slate-400">
                          In [{myClan.tag}]
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREATE CLAN MODAL */}
      {showCreateModal && (
        <div
          onClick={() => setShowCreateModal(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl text-slate-800"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-titan text-2xl text-[#dc2626]">Create a Clan</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClan} className="flex flex-col gap-3.5">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-nunito font-black text-xs text-slate-500 mb-1">
                    CLAN NAME
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={24}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Circus Legends"
                    className="w-full px-3.5 py-2 rounded-xl border-2 border-slate-200 font-nunito font-bold text-sm focus:outline-none focus:border-[#dc2626]"
                  />
                </div>
                <div>
                  <label className="block font-nunito font-black text-xs text-slate-500 mb-1">
                    TAG (2-5)
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={5}
                    value={newTag}
                    onChange={(e) =>
                      setNewTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                    }
                    placeholder="CRCS"
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 font-titan text-sm uppercase text-center focus:outline-none focus:border-[#dc2626]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-nunito font-black text-xs text-slate-500 mb-1">
                  DESCRIPTION
                </label>
                <input
                  type="text"
                  maxLength={140}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Tell players what your clan is about..."
                  className="w-full px-3.5 py-2 rounded-xl border-2 border-slate-200 font-nunito font-bold text-sm focus:outline-none focus:border-[#dc2626]"
                />
              </div>

              <div>
                <label className="block font-nunito font-black text-xs text-slate-500 mb-1.5">
                  BANNER COLOR
                </label>
                <div className="flex items-center gap-2">
                  {BANNER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={`w-8 h-8 rounded-xl cursor-pointer transition-transform ${
                        newColor === c ? 'ring-3 ring-slate-900 scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-nunito font-black text-xs text-slate-500 mb-1.5">
                  CLAN EMBLEM
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {EMBLEM_BLOOK_IDS.map((bid) => {
                    const b = ALL_BLOOKS.find((item) => item.id === bid);
                    return (
                      <button
                        key={bid}
                        type="button"
                        title={b?.name || bid}
                        onClick={() => setNewEmblem(bid)}
                        className={`h-14 rounded-xl p-1.5 border-2 flex items-center justify-center cursor-pointer ${
                          newEmblem === bid
                            ? 'border-[#dc2626] bg-red-50'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        <BlookArt id={bid} className="w-full h-full" animated={false} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={actionBusy || newName.trim().length < 2 || newTag.trim().length < 2}
                className="mt-2 w-full py-3 rounded-2xl bg-[#f87171] hover:brightness-105 shadow-[0_5px_0_#dc2626] text-white font-titan text-lg cursor-pointer disabled:opacity-50"
              >
                {actionBusy ? 'Creating...' : 'Found Clan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CLAN MODAL (LEADER) */}
      {showEditModal && myClan && (
        <div
          onClick={() => setShowEditModal(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl text-slate-800"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-titan text-2xl text-[#dc2626]">Edit [{myClan.tag}] Clan</h2>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateClan} className="flex flex-col gap-3.5">
              <div>
                <label className="block font-nunito font-black text-xs text-slate-500 mb-1">
                  DESCRIPTION
                </label>
                <input
                  type="text"
                  maxLength={140}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border-2 border-slate-200 font-nunito font-bold text-sm focus:outline-none focus:border-[#dc2626]"
                />
              </div>

              <div>
                <label className="block font-nunito font-black text-xs text-slate-500 mb-1.5">
                  BANNER COLOR
                </label>
                <div className="flex items-center gap-2">
                  {BANNER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`w-8 h-8 rounded-xl cursor-pointer transition-transform ${
                        editColor === c ? 'ring-3 ring-slate-900 scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-nunito font-black text-xs text-slate-500 mb-1.5">
                  CLAN EMBLEM
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {EMBLEM_BLOOK_IDS.map((bid) => (
                    <button
                      key={bid}
                      type="button"
                      onClick={() => setEditEmblem(bid)}
                      className={`h-14 rounded-xl p-1.5 border-2 flex items-center justify-center cursor-pointer ${
                        editEmblem === bid
                          ? 'border-[#dc2626] bg-red-50'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <BlookArt id={bid} className="w-full h-full" animated={false} />
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={actionBusy}
                className="mt-2 w-full py-3 rounded-2xl bg-[#f87171] hover:brightness-105 shadow-[0_5px_0_#dc2626] text-white font-titan text-lg cursor-pointer disabled:opacity-50"
              >
                {actionBusy ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
