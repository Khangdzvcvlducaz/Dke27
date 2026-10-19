import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/ai/voice — nhận base64 audio, trả về text đã transcribe
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { audio } = body
    if (!audio) return NextResponse.json({ error: 'Thiếu audio base64' }, { status: 400 })

    const zai = await ZAI.create()
    const response = await zai.audio.asr.create({ file_base64: audio })
    const text = response?.text || ''
    return NextResponse.json({ ok: true, text })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
