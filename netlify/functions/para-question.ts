import type { Handler } from '@netlify/functions'

const SYSTEM_PARA = `Actúa como coach de liderazgo.
Tu tarea durante "Los 5 Para Qué" es encontrar la causa principal por la que el participante lidera a su equipo.
REGLA ESTRICTA: TODAS las preguntas deben ser variaciones de "¿Para qué...?" (técnica de los 5 Para Qué).
Analiza la respuesta anterior, identifica el concepto central y formula UNA sola pregunta breve que profundice usando SIEMPRE "¿Para qué...?".
Ejemplos válidos:
"¿Para qué es importante para ti que eso suceda?"
"¿Y para qué es importante para ti \\"concepto\\"?",
"¿Para qué quieres lograr \\"concepto\\"?",
"¿Para qué es realmente importante para ti \\"concepto\\" más allá del resultado?",
"¿Para qué te gustaría que eso trascienda en tu equipo si lo logras?"
Nunca uses "¿Qué hace...?" o "¿Qué cambiaría...?" sin "para qué". Nunca juzgues. Usa "Vamos un poco más profundo." si es necesario.
Devuelve SOLO JSON: { "question": "...?" }`

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST required' }) }

  try {
    const { prevAnswer, depth, history } = JSON.parse(event.body || '{}')
    const apiKey = process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_API_KEY
    const apiUrl = process.env.AI_API_URL || 'https://integrate.api.nvidia.com/v1/chat/completions'
    if (!apiKey) {
      return { statusCode: 200, headers, body: JSON.stringify({ question: null, fallback: true }) }
    }
    const prompt = `Historial: ${JSON.stringify(history || [])}\nRespuesta actual: "${prevAnswer}"\nProfundidad actual: ${depth}/5\nGenera la siguiente pregunta para profundizar.`

    const controller = new AbortController()
    const to = setTimeout(()=> controller.abort(), 10000)
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
      return { statusCode: 200, headers, body: JSON.stringify({ question: null, fallback: true, error: t.slice(0,200) }) }
    }
    const data = await resp.json() as any
    let content = data.choices?.[0]?.message?.content || ''
    let q = ''
    try { q = JSON.parse(content).question } catch { q = content }
    q = q.replace(/^["“”']+|["“”']+$/g, '').trim()
    return { statusCode: 200, headers, body: JSON.stringify({ question: q, fallback: false }) }
  } catch (e: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }
  }
}
