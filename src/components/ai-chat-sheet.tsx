'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sparkles, Send, X, Loader2 } from 'lucide-react'

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

interface AiChatSheetProps {
  open: boolean
  onOpenChange: (b: boolean) => void
}

const SUGGESTIONS = [
  'Món nào bán chạy nhất hôm nay?',
  'Đề xuất combo tăng doanh thu',
  'Gợi ý lời chào khách',
  'Phân tích doanh thu hôm nay',
]

export function AiChatSheet({ open, onOpenChange }: AiChatSheetProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'assistant', content: '👋 Chào bạn! Tôi là trợ lý AI của quán Đông Không Em?. Hỏi tôi về doanh thu, gợi ý món, combo hoặc cách tăng doanh thu nhé!' }])
    }
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, 100)
  }, [open, messages])

  async function send(text?: string) {
    const msg = (text || input).trim()
    if (!msg || loading) return
    const newMessages = [...messages, { role: 'user' as const, content: msg }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: newMessages.slice(-6) }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setMessages((m) => [...m, { role: 'assistant', content: d.reply }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `❌ Lỗi: ${(e as Error).message}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b border-border flex-row items-center justify-between">
          <SheetTitle className="uppercase tracking-wide flex items-center gap-2" style={{ fontFamily: 'var(--font-oswald)' }}>
            <Sparkles className="size-4 text-primary" /> Trợ lý AI
          </SheetTitle>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 py-3">
          <div ref={scrollRef} className="space-y-3">
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-card border border-border rounded-bl-md'
                  }`}
                >
                  {m.content}
                </div>
              </motion.div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl rounded-bl-md px-3 py-2 text-sm flex items-center gap-2">
                  <Loader2 className="size-3 animate-spin" /> Đang nghĩ...
                </div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs text-left p-2 rounded-lg border border-border bg-card hover:bg-accent/40 transition-colors"
                >
                  💡 {s}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t border-border p-3 flex gap-2 pb-safe">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Hỏi trợ lý AI..."
            onKeyDown={(e) => e.key === 'Enter' && send()}
            disabled={loading}
          />
          <Button onClick={() => send()} disabled={loading || !input} className="btn-push shrink-0">
            <Send className="size-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
