import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/ai/image — sinh ảnh món ăn bằng AI, trả về dataURL
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prompt } = body
    if (!prompt) return NextResponse.json({ error: 'Thiếu prompt' }, { status: 400 })

    const zai = await ZAI.create()
    const response = await zai.images.generations.create({
      prompt: `Professional food photography, ${prompt}, on a wooden table, top-down view, warm cafe lighting, high quality, detailed, mouth-watering`,
      size: '1024x1024',
    })
    const base64 = response?.data?.[0]?.base64
    if (!base64) return NextResponse.json({ error: 'Không sinh được ảnh' }, { status: 500 })
    const dataUrl = `data:image/png;base64,${base64}`
    return NextResponse.json({ ok: true, imageUrl: dataUrl })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
