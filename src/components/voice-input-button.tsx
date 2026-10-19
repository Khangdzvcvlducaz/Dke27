'use client'

import { useState, useRef } from 'react'
import { Mic, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void
}

export function VoiceInputButton({ onTranscript }: VoiceInputButtonProps) {
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function handleRecord() {
    if (recording) {
      stopRecording()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        await transcribe(blob)
      }
      mr.start()
      setRecording(true)
      toast.info('Đang ghi âm — nói tên món...')
    } catch (e) {
      toast.error('Trình duyệt không hỗ trợ ghi âm hoặc bị chặn')
    }
  }

  function stopRecording() {
    if (mediaRef.current && recording) {
      mediaRef.current.stop()
      setRecording(false)
    }
  }

  async function transcribe(blob: Blob) {
    setLoading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        try {
          const r = await fetch('/api/ai/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64 }),
          })
          const d = await r.json()
          if (!r.ok) throw new Error(d.error)
          if (d.text) {
            toast.success(`Heard: "${d.text}"`)
            onTranscript(d.text)
          } else {
            toast.info('Không nghe rõ, thử lại')
          }
        } catch (e) {
          toast.error((e as Error).message)
        } finally {
          setLoading(false)
        }
      }
      reader.readAsDataURL(blob)
    } catch (e) {
      toast.error('Không transcribe được audio')
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleRecord}
      disabled={loading}
      className={`shrink-0 ${recording ? 'bg-primary text-primary-foreground border-primary' : ''}`}
      title="Nhập đơn bằng giọng nói"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Mic className={`size-4 ${recording ? 'animate-pulse' : ''}`} />}
    </Button>
  )
}
