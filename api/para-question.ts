export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { prevAnswer, depth, history } = body || {}
    const apiKey = process.env.NVIDIA_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY
    const apiUrl = process.env.AI_API_URL || 'https://integrate.api.nvidia.com/v1/chat/completions'
    if (!apiKey) return res.status(200).json({ question: null, fallback: true })
    const SYSTEM_PARA = `Actúa como coach. Todas las preguntas deben ser "¿Para qué...?" gramaticalmente completas. Si el concepto empieza con subjuntivo (trabajen, logren, estén), usa "¿Para qué quieres que ...?" nunca "¿Para qué trabajen...?" solo. Si es infinitivo, usa "¿Para qué quieres lograr ...?" Devuelve SOLO JSON: { "question": "...?" }`
    const prompt = `Historial: ${JSON.stringify(history || [])}\nRespuesta actual: "${prevAnswer}"\nProfundidad: ${depth}/5`
    const controller = new AbortController()
    const to = setTimeout(() => controller.abort(), 10000)
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'meta/llama-3.2-11b-vision-instruct',
        temperature: 0.8,
        max_tokens: 80,
        messages: [
          { role: 'system', content: SYSTEM_PARA },
          { role: 'user', content: prompt },
        ],
      }),
    })
    clearTimeout(to)
    if (!resp.ok) {
      const t = await resp.text()
      return res.status(200).json({ question: null, fallback: true, error: t.slice(0, 200) })
    }
    const data: any = await resp.json()
    let content = data.choices?.[0]?.message?.content || ''
    let q = ''
    try { q = JSON.parse(content).question } catch { q = content }
    q = q.replace(/^["“”']+|["“”']+$/g, '').trim()
    if (/^¿Para qué (trabajen|logren|estén|sean|crezcan|tengan|hagan|puedan)\b/i.test(q) && !/quieres que|es importante/i.test(q)) {
      q = q.replace(/^¿Para qué/i, '¿Para qué quieres que')
    }
    return res.status(200).json({ question: q, fallback: false })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
}
