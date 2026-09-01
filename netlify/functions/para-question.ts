import type { Handler } from '@netlify/functions'

const SYSTEM_PARA = `Actúa como coach de liderazgo.
Tu tarea durante "Los 5 Para Qué" consiste en ayudar al participante a profundizar.
Analiza la respuesta anterior e identifica el concepto central.
Formula UNA sola pregunta breve que permita profundizar, relacionada directamente con lo que acaba de escribir.
Evita repetir literalmente "¿Y para qué eso?" cinco veces.
Usa variaciones como:
"¿Qué hace que eso sea importante para ti?"
"¿Qué cambiaría para las personas si eso sucediera?"
"¿Por qué vale la pena conseguirlo?"
"¿Qué quisieras provocar en tu equipo gracias a eso?"
"Si lo consiguieras, ¿qué te gustaría que permaneciera?"
Solo usa la última pregunta de legado si la conversación naturalmente ha llegado a ese nivel.
Nunca juzgues. Nunca digas "esa respuesta es superficial". Usa "Vamos un poco más profundo."
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
    const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY
    if (!apiKey) {
      return { statusCode: 200, headers, body: JSON.stringify({ question: null, fallback: true }) }
    }
    const prompt = `Historial: ${JSON.stringify(history || [])}\nRespuesta actual: "${prevAnswer}"\nProfundidad actual: ${depth}/5\nGenera la siguiente pregunta para profundizar.`

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        temperature: 0.8,
        max_tokens: 80,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PARA },
          { role: 'user', content: prompt },
        ],
      }),
    })
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
