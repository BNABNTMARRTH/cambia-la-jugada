import type { Handler } from '@netlify/functions'

const SYSTEM_PURPOSE = `Eres un coach experto en liderazgo.
Tu tarea es sintetizar el propósito de liderazgo del participante a partir de sus 5 respuestas "Para Qué".
REGLAS ESTRICTAS:
- Usa EXCLUSIVAMENTE ideas presentes en sus respuestas. No inventes motivaciones, valores o conceptos no mencionados.
- No impongas frases preestablecidas como "amor", "legado", "servicio" si no aparecen naturalmente.
- Corrige gramática y hazlo sonar natural en español de México profesional y cercano.
- Debe empezar con "Lidero para..." y ser una sola frase de 15-28 palabras, clara y auténtica.
- No juzgues, no diagnostiques, no suene a eslogan corporativo.
- Ejemplo: si respuestas son "cumplir metas -> ser gran equipo -> confianza -> descubrir de qué son capaces -> crezcan aunque ya no trabajen conmigo" => "Lidero para ayudar a las personas a descubrir de qué son capaces y que sigan creciendo más allá de mi equipo."
Devuelve SOLO JSON: { "purpose": "Lidero para ..." }`

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
    const { para1, para2, para3, para4, para5 } = JSON.parse(event.body || '{}')
    const answers = [para1, para2, para3, para4, para5].filter(Boolean)
    if (answers.length < 2) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Se requieren al menos 2 respuestas' }) }
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || process.env.VITE_AI_API_KEY
    const model = process.env.AI_MODEL || 'gpt-4o-mini'

    // Fallback heurístico si no hay API key - con corrección gramatical básica
    function fallbackPurpose(ans: string[]){
      let deepest = ans[ans.length - 1].replace(/^(para|porque|quiero|lidero para)\s+/i, '').trim().replace(/\.$/, '')
      deepest = deepest.replace(/\bestarán\b/g,'estén').replace(/\bserán\b/g,'sean').replace(/\btendrán\b/g,'tengan')
      if(/^todos\b/i.test(deepest) && !/^que\s+/i.test(deepest)) deepest = 'que ' + deepest.charAt(0).toLowerCase() + deepest.slice(1)
      deepest = deepest.replace(/que todos en el equipo estarán/i,'que todos en el equipo estén')
      if(!deepest.startsWith('que ') && deepest.toLowerCase().startsWith('todos')) deepest = 'que ' + deepest
      return `Lidero para ${deepest.charAt(0).toLowerCase() + deepest.slice(1)}.`.replace('Lidero para que que','Lidero para que')
    }
    if (!apiKey) {
      const fallback = fallbackPurpose(answers)
      return { statusCode: 200, headers, body: JSON.stringify({ purpose: fallback, fallback: true }) }
    }

    const userPrompt = `Respuestas de los 5 Para Qué (en orden):
1. ${para1}
2. ${para2}
3. ${para3}
4. ${para4}
5. ${para5}

Genera el propósito sintetizado. Recuerda: solo usa ideas presentes, corrige gramática, una sola frase que empiece con "Lidero para...".`

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 120,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PURPOSE },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!resp.ok) {
      const err = await resp.text()
      console.error('OpenAI error', err)
      let deepest = answers[answers.length - 1].replace(/^(para|porque|quiero|lidero para)\s+/i, '').trim().replace(/\.$/, '')
      deepest = deepest.replace(/\bestarán\b/g,'estén').replace(/\bserán\b/g,'sean')
      if(/^todos\b/i.test(deepest) && !/^que\s+/i.test(deepest)) deepest = 'que ' + deepest.charAt(0).toLowerCase() + deepest.slice(1)
      const fallback = `Lidero para ${deepest.charAt(0).toLowerCase() + deepest.slice(1)}.`
      return { statusCode: 200, headers, body: JSON.stringify({ purpose: fallback, fallback: true, openai_error: err.slice(0,300) }) }
    }

    const data = await resp.json() as any
    let content = data.choices?.[0]?.message?.content || ''
    let purpose = ''
    try {
      const parsed = JSON.parse(content)
      purpose = parsed.purpose || content
    } catch {
      purpose = content.replace(/^```json|```$/g, '').trim()
      try { purpose = JSON.parse(purpose).purpose } catch { /* keep raw */ }
    }
    // limpieza
    purpose = purpose.replace(/^["“”']+|["“”']+$/g, '').trim()
    if (!purpose.toLowerCase().startsWith('lidero para')) {
      purpose = 'Lidero para ' + purpose.replace(/^(para|que|para que)\s+/i, '')
    }
    if (!purpose.endsWith('.')) purpose += '.'

    return { statusCode: 200, headers, body: JSON.stringify({ purpose, fallback: false }) }
  } catch (e: any) {
    console.error(e)
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }
  }
}
