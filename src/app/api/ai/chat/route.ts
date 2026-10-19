import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const maxDuration = 60

function pad2(n: number) { return n < 10 ? `0${n}` : `${n}` }
function dayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// POST /api/ai/chat — trợ lý quán: gợi ý món, phân tích doanh thu
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, history = [] } = body
    if (!message) return NextResponse.json({ error: 'Thiếu nội dung' }, { status: 400 })

    // Build context: menu + today's report
    const menu = await db.menuItem.findMany({ orderBy: { sortOrder: 'asc' } })
    const today = dayStr()
    const paidOrders = await db.order.findMany({
      where: { status: 'paid', paidAt: { not: null } },
      include: { items: true },
    })
    const todaysPaid = paidOrders.filter((o) => o.paidAt && dayStr(new Date(o.paidAt)) === today)
    const revenue = todaysPaid.reduce((s, o) => s + o.total, 0)
    const cups = todaysPaid.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.qty, 0), 0)

    const topMap: Record<string, number> = {}
    for (const o of todaysPaid) {
      for (const it of o.items) {
        const key = `${it.icon} ${it.name}`
        topMap[key] = (topMap[key] || 0) + it.qty
      }
    }
    const topItems = Object.entries(topMap).sort((a, b) => b[1] - a[1]).slice(0, 5)

    const system = `Bạn là "Đông Không Em? Assistant" — trợ lý AI thân thiện cho quán cà phê "Đông Không Em?". Trả lời ngắn gọn, thân thiện bằng TIẾNG VIỆT.

Thông tin quán hôm nay (${today}):
- Doanh thu: ${revenue.toLocaleString('vi-VN')}₫ từ ${todaysPaid.length} đơn
- Số ly / món đã bán: ${cups}
- Top 5 món bán chạy: ${topItems.length ? topItems.map(([n, q]) => `${n} (${q})`).join(', ') : 'chưa có'}

Menu hiện có (${menu.length} món):
${menu.map((m) => `- ${m.icon} ${m.name}: ${m.price.toLocaleString('vi-VN')}₫${m.available ? '' : ' (đang hết)'}`).join('\n')}

Khả năng của bạn:
1. Phân tích doanh thu, gợi ý combo, món nên đẩy mạnh
2. Trả lời thắc mắc về giá, món
3. Đề xuất cách tăng doanh thu
4. Đề xuất lời chào khách

Hãy trả lời tự nhiên, dùng emoji phù hợp, ngắn gọn 2-4 câu.`

    const zai = await ZAI.create()
    const messages: { role: 'assistant' | 'user'; content: string }[] = [
      { role: 'assistant', content: system },
      ...history.slice(-6).map((m: { role: 'user' | 'assistant'; content: string }) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ]

    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    })

    const reply = completion.choices?.[0]?.message?.content || 'Xin lỗi, tôi chưa hiểu câu hỏi.'
    return NextResponse.json({ ok: true, reply })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
