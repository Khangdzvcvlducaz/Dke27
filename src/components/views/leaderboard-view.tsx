'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { fmtVND } from '@/lib/format'
import { useCafeStore } from '@/store/cafe-store'
import { Trophy, Crown, Medal, ChevronDown, ChevronUp } from 'lucide-react'

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
  { id: 'month', label: 'Tháng' },
  { id: 'all', label: 'Tất cả' },
]

const MEDALS = ['🥇', '🥈', '🥉']
const MEDAL_COLORS = [
  'from-amber-400 to-yellow-500',
  'from-gray-300 to-gray-400',
  'from-amber-600 to-amber-700',
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
    <div className="space-y-4">
      <h2 className="text-xl font-semibold uppercase tracking-wide flex items-center gap-2" style={{ fontFamily: 'var(--font-oswald)' }}>
        <Trophy className="size-5 text-amber-500" /> Xếp hạng
      </h2>

      {/* Period filter */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${period === p.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-card text-muted-foreground'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="shimmer h-16 rounded-2xl"></div>
          ))}
        </div>
      ) : ranked.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 text-sm border border-dashed border-border rounded-2xl">
          Chưa có dữ liệu xếp hạng cho kỳ này.
        </div>
      ) : (
        <>
          {/* Podium — Top 3 */}
          {top3.length > 0 && (
            <div className="flex items-end justify-center gap-2 sm:gap-4 py-4">
              {/* 2nd place */}
              {top3[1] && (
                <PodiumCard staff={top3[1]} rank={1} maxPoints={maxPoints} isMe={top3[1].name === user?.name} />
              )}
              {/* 1st place */}
              {top3[0] && (
                <PodiumCard staff={top3[0]} rank={0} maxPoints={maxPoints} isMe={top3[0].name === user?.name} />
              )}
              {/* 3rd place */}
              {top3[2] && (
                <PodiumCard staff={top3[2]} rank={2} maxPoints={maxPoints} isMe={top3[2].name === user?.name} />
              )}
            </div>
          )}

          {/* Rest of ranking */}
          {rest.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground uppercase font-semibold px-2" style={{ fontFamily: 'var(--font-oswald)' }}>
                Bảng xếp hạng
              </div>
              {rest.map((s, i) => {
                const rank = i + 4
                const isMe = s.name === user?.name
                const isExpanded = expanded === s.name
                return (
                  <div key={s.name}>
                    <motion.div
                      layout
                      onClick={() => setExpanded(isExpanded ? null : s.name)}
                      className={`flex items-center gap-3 rounded-xl p-3 border cursor-pointer transition-all ${isMe ? 'border-primary bg-accent/40' : 'border-border bg-card'} hover:border-primary/50`}
                    >
                      <span className="text-sm font-bold text-muted-foreground w-6 text-center" style={{ fontFamily: 'var(--font-oswald)' }}>
                        {rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <b className="text-sm">{s.name}</b>
                        {isMe && <span className="ml-2 bg-primary text-primary-foreground text-[10px] px-1.5 rounded-full">Bạn</span>}
                      </div>
                      <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden hidden sm:block">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(s.points / maxPoints) * 100}%` }}></div>
                      </div>
                      <b className="text-primary text-sm w-16 text-right" style={{ fontFamily: 'var(--font-oswald)' }}>
                        {s.points}
                      </b>
                      {isExpanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                    </motion.div>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="ml-9 mr-3 mb-2 space-y-1">
                            {s.breakdown.map((b, j) => (
                              <div key={j} className="flex justify-between text-xs text-muted-foreground py-1 border-b border-dashed border-border last:border-0">
                                <span>{b.action} ({b.count} lần)</span>
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
  )
}

function PodiumCard({ staff, rank, maxPoints, isMe }: { staff: RankedStaff; rank: number; maxPoints: number; isMe: boolean }) {
  const heights = ['h-32', 'h-24', 'h-20']
  const order = rank === 0 ? 1 : rank === 1 ? 0 : 2

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.15, type: 'spring', stiffness: 200, damping: 20 }}
      className="flex flex-col items-center"
      style={{ order }}
    >
      <div className="text-3xl mb-1">{MEDALS[rank]}</div>
      <div className={`relative ${heights[rank]} w-20 sm:w-28 rounded-t-xl bg-gradient-to-b ${MEDAL_COLORS[rank]} flex flex-col items-center justify-start pt-2 px-1 ${isMe ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
        <b className="text-sm truncate w-full text-center text-white" style={{ fontFamily: 'var(--font-oswald)' }}>
          {staff.name}
        </b>
        <b className="text-lg text-white mt-1" style={{ fontFamily: 'var(--font-oswald)' }}>
          {staff.points}
        </b>
        <span className="text-[10px] text-white/80">pts</span>
      </div>
    </motion.div>
  )
}
