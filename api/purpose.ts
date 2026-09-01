export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
  try {
    const { para1, para2, para3, para4, para5 } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const answers = [para1, para2, para3, para4, para5].filter(Boolean)
    if (answers.length < 2) return res.status(400).json({ error: 'Se requieren al menos 2 respuestas' })

    const apiKey = process.env.NVIDIA_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY
    const model = process.env.AI_MODEL || 'meta/llama-3.2-11b-vision-instruct'
    const apiUrl = process.env.AI_API_URL || 'https://integrate.api.nvidia.com/v1/chat/completions'

    function fallbackPurpose(ans: string[]) {
      let deepest = ans[ans.length - 1].replace(/^(para|porque|quiero|lidero para)\s+/i, '').trim().replace(/\.$/, '')
      deepest = deepest.replace(/\bestarán\b/g, 'estén').replace(/\bserán\b/g, 'sean').replace(/\btendrán\b/g, 'tengan')
      if (/^todos\b/i.test(deepest) && !/^que\s+/i.test(deepest)) deepest = 'que ' + deepest.charAt(0).toLowerCase() + deepest.slice(1)
      deepest = deepest.replace(/que todos en el equipo estarán/i, 'que todos en el equipo estén')
      return `Lidero para ${deepest.charAt(0).toLowerCase() + deepest.slice(1)}.`.replace('Lidero para que que', 'Lidero para que')
    }

    if (!apiKey) {
      return res.status(200).json({ purpose: fallbackPurpose(answers), fallback: true })
    }

    const SYSTEM_PURPOSE = `Eres un coach experto en liderazgo. Sintetiza el propósito a partir de las 5 respuestas. Usa EXCLUSIVAMENTE ideas presentes. Corrige gramática, español México. Empieza con "Lidero para..." una frase 15-28 palabras. Devuelve SOLO JSON: { "purpose": "Lidero para ..." }`

    const userPrompt = `Respuestas:\n1. ${para1}\n2. ${para2}\n3. ${para3}\n4. ${para4}\n5. ${para5}\nGenera el propósito.`

    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 12000)
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 120,
        messages: [
          { role: 'system', content: SYSTEM_PURPOSE },
          { role: 'user', content: userPrompt },
        ],
      }),
    })
    clearTimeout(t)

    if (!resp.ok) {
      const err = await resp.text()
      return res.status(200).json({ purpose: fallbackPurpose(answers), fallback: true, openai_error: err.slice(0, 300) })
    }
    const data: any = await resp.json()
    let content = data.choices?.[0]?.message?.content || ''
    let purpose = ''
    try {
      const parsed = JSON.parse(content)
      purpose = parsed.purpose || content
    } catch {
      purpose = content.replace(/^```json|```$/g, '').trim()
      try { purpose = JSON.parse(purpose).purpose } catch {}
    }
    purpose = purpose.replace(/^["“”']+|["“”']+$/g, '').trim()
    if (!purpose.toLowerCase().startsWith('lidero para')) purpose = 'Lidero para ' + purpose.replace(/^(para|que|para que)\s+/i, '')
    if (!purpose.endsWith('.')) purpose += '.'
    return res.status(200).json({ purpose, fallback: false })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
}
