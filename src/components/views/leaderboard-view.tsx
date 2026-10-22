'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { fmtVND } from '@/lib/format'
import { useCafeStore } from '@/store/cafe-store'
import { Crown, ChevronDown, ChevronUp } from 'lucide-react'

interface RankedStaff {
  name: string
  points: number
  breakdown: { action: string; pts: number; count: number }[]
  role: string
  view: string
}

const PERIODS = [
  { id: 'today', label: 'Hôm nay' },
  { id: 'week', label: 'Tuần' },
  { id: 'all', label: 'TOP' },
]

export function LeaderboardView() {
  const user = useCafeStore((s) => s.user)
  const [ranked, setRanked] = useState<RankedStaff[]>([])
  const [period, setPeriod] = useState('today')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    void load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [period])

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`/api/leaderboard?period=${period}`)
      const d = await r.json()
      setRanked(d.ranked || [])
    } catch {
      toast.error('Không tải được xếp hạng')
    } finally {
      setLoading(false)
    }
  }

  const top3 = ranked.slice(0, 3)
  const rest = ranked.slice(3)
  const maxPoints = ranked[0]?.points || 1

  return (
    <div className="rounded-3xl overflow-hidden bg-gradient-to-b from-primary to-primary/80 shadow-2xl">
      <div className="p-5 sm:p-6">
        {/* Header */}
        <h2 className="text-center text-white text-lg font-bold uppercase tracking-[3px] mb-4" style={{ fontFamily: 'var(--font-oswald)' }}>
          Leaderboard
        </h2>

        {/* Tab navigation — pill buttons */}
        <div className="flex justify-center gap-2 mb-6">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                period === p.id
                  ? 'bg-amber-400 text-primary shadow-md'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shimmer h-14 rounded-2xl"></div>
            ))}
          </div>
        ) : ranked.length === 0 ? (
          <div className="text-center text-white/60 py-12 text-sm">
            Chưa có dữ liệu xếp hạng.
          </div>
        ) : (
          <>
            {/* Podium Top 3 */}
            {top3.length > 0 && (
              <div className="flex items-end justify-center gap-2 sm:gap-4 mb-6">
                {/* 2nd place */}
                {top3[1] && (
                  <PodiumCard staff={top3[1]} rank={2} maxPoints={maxPoints} isMe={top3[1].name === user?.name} />
                )}
                {/* 1st place */}
                {top3[0] && (
                  <PodiumCard staff={top3[0]} rank={1} maxPoints={maxPoints} isMe={top3[0].name === user?.name} />
                )}
                {/* 3rd place */}
                {top3[2] && (
                  <PodiumCard staff={top3[2]} rank={3} maxPoints={maxPoints} isMe={top3[2].name === user?.name} />
                )}
              </div>
            )}

            {/* List — ranks 4+ */}
            {rest.length > 0 && (
              <div className="bg-white/95 dark:bg-card rounded-2xl p-2 space-y-1">
                {rest.map((s, i) => {
                  const rank = i + 4
                  const isMe = s.name === user?.name
                  const isExpanded = expanded === s.name
                  return (
                    <div key={s.name}>
                      <div
                        onClick={() => setExpanded(isExpanded ? null : s.name)}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-all ${
                          isMe ? 'bg-amber-50 dark:bg-amber-950/30 ring-1 ring-primary' : 'hover:bg-muted/50'
                        }`}
                      >
                        <span className="text-sm font-bold text-muted-foreground w-5 text-center" style={{ fontFamily: 'var(--font-oswald)' }}>
                          {rank}
                        </span>
                        {/* Avatar circle */}
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0">
                          <span className="text-white text-xs font-bold">{s.name.charAt(0)}</span>
                        </div>
                        <span className="flex-1 text-sm font-semibold truncate">{s.name}</span>
                        {isMe && <span className="bg-primary text-primary-foreground text-[10px] px-1.5 rounded-full shrink-0">Bạn</span>}
                        <b className="text-amber-600 text-sm whitespace-nowrap" style={{ fontFamily: 'var(--font-oswald)' }}>
                          {s.points}
                          <span className="text-xs text-muted-foreground ml-1">pts</span>
                        </b>
                        {isExpanded
                          ? <ChevronUp className="size-4 text-muted-foreground shrink-0" />
                          : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
                      </div>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="ml-8 mr-3 mb-1 space-y-0.5">
                              {s.breakdown.map((b, j) => (
                                <div key={j} className="flex justify-between text-xs text-muted-foreground py-1 border-b border-dashed border-border last:border-0">
                                  <span>{b.action} ({b.count}×)</span>
                                  <b className={b.pts >= 0 ? 'text-primary' : 'text-destructive'}>
                                    {b.pts >= 0 ? '+' : ''}{b.pts}
                                  </b>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** Podium card for Top 3 — circular avatar, crown for #1, medal gradient */
function PodiumCard({ staff, rank, maxPoints, isMe }: { staff: RankedStaff; rank: number; maxPoints: number; isMe: boolean }) {
  // Sizes: rank 1 = largest, rank 2/3 = smaller
  const avatarSize = rank === 1 ? 'w-20 h-20 sm:w-24 sm:h-24' : 'w-16 h-16 sm:w-20 sm:h-20'
  const scoreSize = rank === 1 ? 'text-2xl' : 'text-xl'
  const crown = rank === 1
  const rankLabel = rank === 1 ? '' : `${rank}`

  // Order: 2 - 1 - 3
  const order = rank === 1 ? 1 : rank === 2 ? 0 : 2

  // Avatar gradient: gold for 1, silver for 2, bronze for 3
  const gradients = [
    '',
    'from-amber-400 to-yellow-600', // gold
    'from-gray-300 to-gray-500',     // silver
    'from-amber-600 to-amber-800',  // bronze
  ]
  const gradient = rank === 1 ? gradients[1] : rank === 2 ? gradients[2] : gradients[3]

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.15, type: 'spring', stiffness: 200, damping: 20 }}
      className="flex flex-col items-center"
      style={{ order }}
    >
      {/* Crown for #1 */}
      {crown && (
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 15 }}
        >
          <Crown className="size-6 text-amber-300 mb-1" fill="currentColor" />
        </motion.div>
      )}

      {/* Rank number for 2/3 */}
      {!crown && (
        <div className="text-white/80 text-xs font-bold mb-1" style={{ fontFamily: 'var(--font-oswald)' }}>
          {rankLabel}
        </div>
      )}

      {/* Avatar circle */}
      <div
        className={`${avatarSize} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg ${
          isMe ? 'ring-2 ring-white ring-offset-2 ring-offset-primary' : ''
        } ${crown ? 'glow' : ''}`}
      >
        <span className="text-white text-lg font-bold" style={{ fontFamily: 'var(--font-oswald)' }}>
          {staff.name.charAt(0)}
        </span>
      </div>

      {/* Name */}
      <span className="text-white text-xs font-semibold mt-1.5 max-w-[80px] truncate">
        {staff.name}
      </span>

      {/* Score */}
      <b className={`text-amber-300 ${scoreSize} mt-0.5`} style={{ fontFamily: 'var(--font-oswald)' }}>
        {staff.points}
      </b>
      <span className="text-white/50 text-[10px]">pts</span>
    </motion.div>
  )
}
