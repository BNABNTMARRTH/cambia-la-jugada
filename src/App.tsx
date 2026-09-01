import { useState, useEffect, useRef } from 'react'
import jsPDF from 'jspdf'

// Palette
const C = {
  navy: '#071D49',
  azul: '#1466B8',
  rojo: '#D71920',
  verde: '#178A3B',
  dorado: '#D99A16',
  bg: '#F7F9FC',
  white: '#FFFFFF',
}

type Answers = {
  q1: string
  q2_dejar: string
  q2_empezar: string
  q3: string
  q4: string
  q5: string
  q6: string
  q6b: string
  q7: string
  q8: string
  q9_valor: 'Humildad' | 'Generosidad' | 'Ambos' | ''
  q9_porQue: string
  q10: string
  q11_accion: string
  q11_quien: string
  q11_cuando: string
  q11_evidencia: string
  nombre: string
  anonimo: boolean
}

type Assessment = {
  indice_yen: number
  nivel: number
  nombre_nivel: string
  subnivel: string
  scores: { yo: number; ellos: number; nosotros: number; ejecucion: number }
  diagnostico: string
  fortalezas: { titulo: string; explicacion: string; evidencia: string }[]
  alertas: { titulo: string; explicacion: string }[]
  dejar_de: string[]
  empezar_a: string[]
  siguiente_nivel: { nivel: string; explicacion: string; clave: string }
  reto_7_dias: { titulo: string; accion: string; momento: string; evidencia: string }
  playbook: { yo: string; ellos: string; nosotros: string; jugada: string }
  frase_final: string
  evolution: number // 1,2,3
}

const genericPhrases = [
  'comunicar mejor', 'ser mejor líder', 'apoyar al equipo', 'trabajar mejor',
  'esforzarse más', 'comprometerse más', 'ser más responsable', 'motivación',
  'motivarlo', 'hay que mejorar', 'todo bien', 'ninguna', 'no sé', 'x',
]

function isGeneric(s: string) {
  const l = s.toLowerCase().trim()
  if (l.length < 12) return true
  if (['no se', 'no sé', 'x', 'todo', 'nada'].includes(l)) return true
  return genericPhrases.some(p => l.includes(p) && l.length < 40)
}

function scoreText(text: string, keywords: string[], anti: string[] = []) {
  const t = text.toLowerCase()
  let score = 0
  if (text.trim().length < 10) return 0
  if (text.trim().length < 20) score += 1
  else if (text.trim().length < 50) score += 2
  else if (text.trim().length < 100) score += 3
  else score += 4

  const concrete = ['voy a', 'cuando', 'con ', 'pregunta', 'escuchar', 'propuesta', 'reunión', 'lunes', 'martes', 'semana', 'equipo', 'alex']
  let kwHits = 0
  keywords.forEach(k => { if (t.includes(k)) kwHits++ })
  score += Math.min(3, kwHits)

  concrete.forEach(c => { if (t.includes(c)) score += 0.3 })

  anti.forEach(a => { if (t.includes(a)) score -= 1 })

  if (isGeneric(text)) score -= 2

  // count questions ?
  if (text.includes('?')) score += 1

  return Math.max(0, Math.min(5, Math.round(score)))
}

function evaluate(answers: Answers): Assessment {
  // YO: q1,q2,q3
  const yoScores = [
    scoreText(answers.q1, ['dependencia', 'control', 'resolver', 'yo', 'decide', 'deja', 'confianza', 'ego'], ['ellos no', 'culpa']),
    scoreText(answers.q2_dejar + ' ' + answers.q2_empezar, ['dejar de controlar', 'preguntar', 'escuchar', 'delegar', 'acompañar', 'confiar'], []),
    scoreText(answers.q3, ['ego', 'control', 'miedo', 'confianza', 'hábito', 'presión', 'rapidez', 'seguridad'], []),
  ]
  const yoAvg = yoScores.reduce((a,b)=>a+b,0)/yoScores.length
  const yo = Math.round((yoAvg/5)*100)

  const ellosScores = [
    scoreText(answers.q4, ['comprender', 'escuchar', 'motiva', 'saber', 'qué necesita', 'historia', 'contexto', 'pregunta'], ['juzgar', 'floj']),
    scoreText(answers.q5, ['miedo', 'confianza', 'bloqueo', 'motiv', 'reconocimiento', 'claridad', 'espacio', 'inseguro'], []),
    scoreText(answers.q6, ['qué opinas', 'cómo', 'qué necesitas', 'cuéntame', 'te escucho', 'pregunta', 'ayudar'], ['ordeno', 'tienes que']),
    scoreText(answers.q6b, ['motiva', 'qué te', 'disfrutas', 'importa', 'gusta', 'pregunta', '?'], []),
  ]
  const ellosAvg = ellosScores.reduce((a,b)=>a+b,0)/ellosScores.length
  const ellos = Math.round((ellosAvg/5)*100)

  const nosotrosScores = [
    scoreText(answers.q7, ['nosotros', 'acuerdo', 'propuesta', 'regla', 'juntos', 'antes de escalar', 'colabor'], []),
    scoreText(answers.q8, ['acordar', 'seguimiento', 'recordar', 'ejemplo', 'facilitar', 'coherencia', 'sostener', 'equipo'], []),
    scoreText(answers.q9_porQue, ['humildad', 'generosidad', 'confianza', 'compartir', 'aprender', 'equipo'], []),
    scoreText(answers.q10, ['equipo', 'juntos', 'autonomía', 'crecer', 'capaz', 'aprender', 'resolver juntos', 'propósito'], ['resolver yo', 'controlar']),
  ]
  const nosotrosAvg = nosotrosScores.reduce((a,b)=>a+b,0)/nosotrosScores.length
  const nosotros = Math.round((nosotrosAvg/5)*100)

  const ejec = (() => {
    let s = 0
    if (answers.q11_accion.length > 12) s += 1.5
    if (answers.q11_quien.length > 3) s += 1
    if (answers.q11_cuando.length > 5) s += 1
    if (answers.q11_evidencia.length > 10) s += 1.5
    if (isGeneric(answers.q11_accion)) s -= 1
    return Math.round((Math.max(0, Math.min(5, s))/5)*100)
  })()

  // penalize humildad/generosidad not chosen? small bonus if Ambos
  let nosAdj = nosotros
  if (answers.q9_valor === 'Ambos') nosAdj = Math.min(100, nosAdj + 4)

  const yen = Math.round(yo*0.30 + ellos*0.30 + nosAdj*0.30 + ejec*0.10)

  // determine level
  let nivel = 1
  let nombre = 'YO'
  if (yo >= 60 && ellos >= 65 && nosAdj >= 70) { nivel = 3; nombre = 'NOSOTROS' }
  else if (yo >= 55 && ellos >= 60 && nosAdj >= 50) { nivel = 2; nombre = 'ELLOS' }
  // override if ellos very low
  if (ellos < 55 || nosAdj < 50) { if (nivel !== 1) { nivel = 1; nombre = 'YO' } }

  // subnivel
  const avgForSub = nivel===1 ? yo : nivel===2 ? ellos : nosAdj
  let subnivel = 'Emergente'
  if (avgForSub >= 75) subnivel = 'Consistente'
  else if (avgForSub >= 60) subnivel = 'En desarrollo'

  // diagnostico personalizado
  let diagnostico = ''
  if (nivel===1) diagnostico = `Tus respuestas muestran que hoy tu liderazgo se concentra principalmente en resolver y asegurar resultados. Tiendes a tomar el control cuando aparece presión. Reconoces parte de esa dependencia (${answers.q1.slice(0,70)}...), pero todavía aparece la idea de que avanzar es más rápido si tú intervienes.`
  else if (nivel===2) diagnostico = `Has comenzado a dejar atrás el liderazgo basado solo en control. Destacan tus intentos por comprender a Alex y preguntar antes de actuar. Tu fortaleza está en la escucha y la conversación. La oportunidad es transformar esas conversaciones en acuerdos colectivos y reglas que sostengan al equipo sin depender de que tú estés presente.`
  else diagnostico = `Tu forma de plantear la situación muestra un liderazgo que multiplica. Hablas de reglas de equipo, propósito compartido y autonomía. Ya no se trata de resolver por otros, sino de construir condiciones para que el equipo piense y decida junto. El reto es sostener esa cultura con coherencia diaria.`

  // fortalezas
  const fortalezas = []
  if (yo > 60) fortalezas.push({titulo:'Autocrítica responsable', explicacion:'Reconoces tu parte en la dependencia del equipo y no culpabilizas solo a los demás.', evidencia:`"${answers.q1.slice(0,90)}..."`})
  else fortalezas.push({titulo:'Intención de mejorar', explicacion:'Muestras apertura para mirar tu propio comportamiento, base para crecer.', evidencia:`"${answers.q3.slice(0,90)}..."`})

  if (ellos > 60) fortalezas.push({titulo:'Buscas comprender antes de corregir', explicacion:'Propones preguntar y escuchar a Alex en lugar de juzgarlo directamente.', evidencia:`"${answers.q4.slice(0,90)}..."`})
  else if (answers.q6.length>20) fortalezas.push({titulo:'Conversación con intención', explicacion:'Intentas abrir diálogo con Alex usando un lenguaje cercano.', evidencia:`"${answers.q6.slice(0,90)}..."`})
  else fortalezas.push({titulo:'Empatía emergente', explicacion:'Hay interés en entender bloqueos, aunque aún puede hacerse más concreto.', evidencia:`"${answers.q5.slice(0,80)}..."`})

  if (nosAdj > 60) fortalezas.push({titulo:'Visión de equipo', explicacion:'Planteas una regla colectiva y visualizas un objetivo de autonomía.', evidencia:`"${answers.q7.slice(0,90)}..."`})
  else if (ejec>60) fortalezas.push({titulo:'Orientación a la acción', explicacion:'Tu jugada de la semana es específica y con evidencia observable.', evidencia:`"${answers.q11_accion.slice(0,80)}..."`})
  else fortalezas.push({titulo:'Búsqueda de acuerdos', explicacion:'Aparece la idea de construir juntos, siguiente paso es hacerla regla viva.', evidencia:`"${answers.q7.slice(0,80)}..."`})

  const alertas = []
  if (yo < 55) alertas.push({titulo:'Resolver demasiado rápido', explicacion:'Cuando la urgencia aparece, la tentación de tomar la decisión tú puede frenar el aprendizaje del equipo.'})
  else alertas.push({titulo:'Control sutil', explicacion:'Aunque delegas, aún puede quedar supervisión muy cercana que genera dependencia.'})
  if (ellos < 60) alertas.push({titulo:'Suponer en lugar de preguntar', explicacion:'Si no exploras el mundo de Alex, es fácil interpretar su silencio como falta de compromiso.'})
  else alertas.push({titulo:'Conversar sin acordar', explicacion:'Las buenas conversaciones individuales no siempre se convierten en compromisos colectivos.'})
  if (nosAdj < 65) alertas.push({titulo:'Reglas sin seguimiento', explicacion:'Definir “a partir de ahora nosotros...” requiere sostenerla con ejemplo y recordatorios.'})
  else alertas.push({titulo:'Diluir el propósito', explicacion:'El ritmo operativo puede hacer que el propósito compartido pierda foco.'})

  const dejarDe = [
    'Dar la solución antes de haber hecho al menos dos preguntas.',
    'Hacer seguimiento preguntando “¿ya quedó?” en lugar de “¿qué necesitas para avanzar?”.',
    'Corregir en público sin antes haber comprendido el contexto.',
  ]
  const empezarA = [
    'Abrir cada reunión preguntando “¿qué opciones ven ustedes?” antes de proponer la tuya.',
    `Tener una conversación 1:1 con ${answers.q11_quien || 'Alex'} esta semana para entender qué lo motiva y qué bloquea.`,
    `Sostener la regla “${answers.q7.slice(0,60)}...” recordándola al inicio y cierre de cada reunión.`,
  ]

  let siguiente_expl = ''
  let clave = ''
  if (nivel===1) { siguiente_expl = 'Tu siguiente evolución es pasar de resolver a desarrollar. Necesitas dejar de ser quien tiene la respuesta y empezar a hacer preguntas que hagan pensar al equipo.'; clave='Haz dos preguntas antes de dar una respuesta.' }
  else if (nivel===2) { siguiente_expl = 'Ya escuchas y comprendes. Ahora necesitas convertir esas conversaciones en acuerdos colectivos que generen autonomía.'; clave='Transforma conversaciones en reglas.' }
  else { siguiente_expl = 'Estás construyendo autonomía. Tu reto es cuidar la cultura para que el equipo funcione bien incluso cuando tú no estés.'; clave='Sostén la cultura con coherencia.' }

  const reto = {
    titulo: 'Tu reto de esta semana',
    accion: answers.q11_accion || 'En la próxima reunión presenta el problema sin solución y pide tres propuestas.',
    momento: answers.q11_cuando || 'Próxima reunión de equipo',
    evidencia: answers.q11_evidencia || 'Tener al menos tres propuestas escritas antes de decidir.'
  }

  const playbook = {
    yo: `Dejar de ${answers.q2_dejar || 'controlar cada detalle'} y empezar a ${answers.q2_empezar || 'preguntar y confiar'}. Reconocer que el ego y la urgencia te llevan a resolver tú.`,
    ellos: `Conversar con ${answers.q11_quien || 'Alex'} preguntando "${answers.q6b || '¿Qué es lo que más te motiva de tu trabajo?'}" y explorando bloqueos: ${answers.q5.slice(0,80)}...`,
    nosotros: `Regla viva: "${answers.q7}" — sostenerla con: ${answers.q8.slice(0,100)}... Valor clave: ${answers.q9_valor} porque ${answers.q9_porQue.slice(0,80)}...`,
    jugada: `${answers.q11_accion} con ${answers.q11_quien} el ${answers.q11_cuando}. Evidencia: ${answers.q11_evidencia}`
  }

  const frases: Record<number,string> = {
    1: 'No necesitas tener todas las respuestas. Necesitas aprender a hacer mejores preguntas.',
    2: 'Cuando entiendes su mundo, cambia la conversación.',
    3: 'El liderazgo alcanza su máximo nivel cuando deja de depender del líder.',
  }

  const evolution = nivel === 1 ? (yo > 60 ? 1.5 : 1) : nivel === 2 ? 2 : 3

  return {
    indice_yen: yen,
    nivel, nombre_nivel: nombre, subnivel,
    scores: { yo, ellos: ellos, nosotros: nosAdj, ejecucion: ejec },
    diagnostico,
    fortalezas: fortalezas.slice(0,3),
    alertas: alertas.slice(0,3),
    dejar_de: dejarDe,
    empezar_a: empezarA,
    siguiente_nivel: { nivel: nivel===3 ? 'LEGADO' : nivel===2 ? 'NOSOTROS' : 'ELLOS', explicacion: siguiente_expl, clave },
    reto_7_dias: reto,
    playbook,
    frase_final: frases[nivel],
    evolution
  }
}

function downloadPDF(assessment: Assessment, answers: Answers){
  const doc = new jsPDF({unit:'mm', format:'a4'})
  const pageW = 210
  const margin = 14
  let y = 14
  const colNavy = [7,29,73] as [number,number,number]
  const colAzul = [20,102,184] as [number,number,number]
  const lineH = 5

  function checkPage(need=20){
    if(y+need > 282){ doc.addPage(); y=14 }
  }
  function titleBar(text:string){
    checkPage(10)
    doc.setFillColor(colNavy[0],colNavy[1],colNavy[2])
    doc.rect(margin, y, pageW - margin*2, 9, 'F')
    doc.setTextColor(255,255,255)
    doc.setFont('helvetica','bold'); doc.setFontSize(9)
    doc.text(text.toUpperCase(), margin+3, y+6)
    y+=13
    doc.setTextColor(30,30,30)
  }
  function h2(text:string){
    checkPage(7)
    doc.setFont('helvetica','bold'); doc.setFontSize(10)
    doc.setTextColor(colNavy[0],colNavy[1],colNavy[2])
    doc.text(text, margin, y)
    y+=6
    doc.setTextColor(30,30,30)
  }
  function p(text:string, size=8, bold=false){
    doc.setFont('helvetica', bold ? 'bold':'normal'); doc.setFontSize(size)
    const lines = doc.splitTextToSize(text, pageW - margin*2)
    // @ts-ignore
    const h = lines.length * lineH
    checkPage(h)
    doc.text(lines, margin, y)
    y+= h + 2
  }
  function bullet(text:string){
    checkPage(8)
    doc.setFont('helvetica','normal'); doc.setFontSize(8)
    const lines = doc.splitTextToSize('• ' + text, pageW - margin*2 - 4)
    doc.text(lines, margin+4, y)
    y+= lines.length*lineH +1
  }

  // Header
  doc.setFillColor(7,29,73)
  doc.rect(0,0,pageW,28,'F')
  doc.setTextColor(255,255,255)
  doc.setFont('helvetica','bold'); doc.setFontSize(16)
  doc.text('CAMBIA LA JUGADA', margin, 13)
  doc.setFontSize(8); doc.setFont('helvetica','normal')
  doc.text('Diagnostico practico de liderazgo  —  Modelo Y.E.N.   |   De experto que resuelve a lider que hace crecer', margin, 19)
  doc.setFontSize(7)
  doc.text(`${answers.anonimo ? 'Participante anonimo' : (answers.nombre || 'Participante')}  •  ${new Date().toLocaleDateString('es-MX')}  •  Herramienta formativa`, margin, 24)
  y=34

  titleBar(`Indice Y.E.N.  ${assessment.indice_yen} / 100   —   Nivel ${assessment.nivel} — ${assessment.nombre_nivel}  (${assessment.subnivel})`)
  h2('Gráfica Y.E.N.')
  p(`YO: ${assessment.scores.yo}   |   ELLOS: ${assessment.scores.ellos}   |   NOSOTROS: ${assessment.scores.nosotros}   |   EJECUCIÓN: ${assessment.scores.ejecucion}`, 8, true)
  h2('Interpretación personalizada')
  p(assessment.diagnostico, 8)
  h2('Lo que ya estás haciendo bien')
  assessment.fortalezas.forEach((f,i)=>{
    p(`${i+1}. ${f.titulo} — ${f.explicacion}`, 8, true)
    p(`Evidencia: ${f.evidencia}`, 7)
  })
  h2('Cuidado con estas jugadas')
  assessment.alertas.forEach(a=> bullet(`${a.titulo}: ${a.explicacion}`))
  h2('Deja de / Empieza a')
  p('DEJA DE:', 8, true)
  assessment.dejar_de.forEach(d=> bullet(d))
  p('EMPIEZA A:', 8, true)
  assessment.empezar_a.forEach(d=> bullet(d))

  titleBar('Tu evolución: de la dependencia a la autonomía')
  p(`Estás en: ${assessment.nivel===1 ? 'RESOLVER' : assessment.nivel===2 ? 'HACER CRECER' : 'CONSTRUIR AUTONOMÍA'}  •  Siguiente nivel: ${assessment.siguiente_nivel.nivel}`, 8, true)
  p(assessment.siguiente_nivel.explicacion, 8)
  p(`Clave: ${assessment.siguiente_nivel.clave}`, 8, true)

  h2('Tu reto de 7 días')
  p(`${assessment.reto_7_dias.titulo}: ${assessment.reto_7_dias.accion}`, 8, true)
  p(`Momento: ${assessment.reto_7_dias.momento}   |   Persona: ${answers.q11_quien}   |   Evidencia: ${assessment.reto_7_dias.evidencia}`, 7)
  h2('Playbook personal')
  p(`YO: ${assessment.playbook.yo}`, 7)
  p(`ELLOS: ${assessment.playbook.ellos}`, 7)
  p(`NOSOTROS: ${assessment.playbook.nosotros}`, 7)
  p(`MI JUGADA (7 días): ${assessment.playbook.jugada}`, 7)

  titleBar('Frase final')
  doc.setFont('helvetica','bold'); doc.setFontSize(10)
  doc.setTextColor(colAzul[0],colAzul[1],colAzul[2])
  const q = `"${assessment.frase_final}"`
  const qLines = doc.splitTextToSize(q, pageW - margin*2)
  checkPage(qLines.length*6 + 10)
  doc.text(qLines, pageW/2, y, {align:'center'})
  y+= qLines.length*6 + 4
  doc.setFontSize(8); doc.setTextColor(colNavy[0],colNavy[1],colNavy[2])
  doc.text('LA VIDA ES UN DEPORTE DE EQUIPO.', pageW/2, y, {align:'center'})
  y+=6
  doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor(120,120,120)
  doc.text('Herramienta formativa Y.E.N. — Totalplay San Luis • Desarrollo de Liderazgo — No es evaluacion psicologica, clinica ni psicometrica.', pageW/2, y, {align:'center'})

  doc.save(`CambiaLaJugada_YEN_${assessment.indice_yen}_${assessment.nombre_nivel}.pdf`)
}

export default function App(){
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({
    q1:'', q2_dejar:'', q2_empezar:'', q3:'', q4:'', q5:'', q6:'', q6b:'',
    q7:'', q8:'', q9_valor:'', q9_porQue:'', q10:'', q11_accion:'', q11_quien:'', q11_cuando:'', q11_evidencia:'', nombre:'', anonimo:false
  })
  const [showConcrete, setShowConcrete] = useState(false)
  const [concreteMsg, setConcreteMsg] = useState('')
  const [assessment, setAssessment] = useState<Assessment|null>(null)
  const [calculating, setCalculating] = useState(false)
  const [progressPhrase, setProgressPhrase] = useState(0)
  const mainRef = useRef<HTMLDivElement>(null)

  useEffect(()=>{ mainRef.current?.scrollTo(0,0); window.scrollTo(0,0) },[step])

  const totalQuestions = 13 // for progress
  const currentQIndex = (() => {
    if (step<=1) return 0
    if (step===2) return 1
    if (step===3) return 2
    if (step===4) return 3
    if (step===5) return 4
    if (step===6) return 5
    if (step===7) return 6
    if (step===8) return 7
    if (step===9) return 8
    if (step===10) return 9
    if (step===11) return 10
    if (step===12) return 11
    if (step===13) return 12
    return 13
  })()

  const phase = (() => {
    if (step<=1) return 'inicio'
    if (step<=4) return 'YO'
    if (step<=8) return 'ELLOS'
    if (step<=12) return 'NOSOTROS'
    if (step===13) return 'JUGADA'
    return 'RESULTADOS'
  })()

  const canNext = (() => {
    if (step===2) return answers.q1.trim().length>=10
    if (step===3) return answers.q2_dejar.trim().length>=3 && answers.q2_empezar.trim().length>=3
    if (step===4) return answers.q3.trim().length>=10
    if (step===5) return answers.q4.trim().length>=10
    if (step===6) return answers.q5.trim().length>=10
    if (step===7) return answers.q6.trim().length>=10
    if (step===8) return answers.q6b.trim().length>=8
    if (step===9) return answers.q7.trim().length>=12
    if (step===10) return answers.q8.trim().length>=10
    if (step===11) return answers.q9_valor!=='' && answers.q9_porQue.trim().length>=10
    if (step===12) return answers.q10.trim().length>=10
    if (step===13) return answers.q11_accion.trim().length>=10 && answers.q11_quien.trim().length>=2 && answers.q11_cuando.trim().length>=4 && answers.q11_evidencia.trim().length>=8
    return true
  })()

  function handleNext(){
    // adaptive check
    const fieldsToCheck: Record<number, {val:string, msg:string}> = {
      2: { val: answers.q1, msg: 'Hazlo más concreto: ¿qué comportamiento exacto y en qué momento lo ves?' },
      4: { val: answers.q3, msg: 'Profundiza: ¿qué miedo o hábito crees que hay detrás? ¿Qué gana el líder al no soltar?' },
      5: { val: answers.q4, msg: 'Concreta: ¿qué le preguntarías a Alex para entender su mundo?' },
      9: { val: answers.q7, msg: 'Haz la regla observable: “A partir de ahora, nosotros...” con verbo y momento.' },
      13: { val: answers.q11_accion, msg: 'Concreta la acción con verbo observable: ¿qué harás exactamente?' },
    }
    const check = fieldsToCheck[step]
    if (check && isGeneric(check.val)) {
      setConcreteMsg(check.msg)
      setShowConcrete(true)
      return
    }

    if (step===13){
      // calculate
      setCalculating(true)
      setProgressPhrase(0)
      const interval = setInterval(()=> setProgressPhrase(p=> p<3 ? p+1 : p), 700)
      setTimeout(()=>{
        clearInterval(interval)
        const res = evaluate(answers)
        setAssessment(res)
        setCalculating(false)
        setStep(14)
      }, 3000)
      return
    }
    setStep(s=> s+1)
  }

  function pct() {
    if (phase==='inicio') return 5
    return Math.round((currentQIndex/totalQuestions)*100)
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-slate-200">
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-[13px]" style={{background: C.navy}}>YEN</div>
            <div>
              <div className="font-extrabold leading-none text-[13px] tracking-wide" style={{color:C.navy}}>CAMBIA LA JUGADA</div>
              <div className="text-[11px] tracking-[0.12em] text-slate-500 font-semibold">MODELO Y.E.N.</div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold tracking-widest">
            <span className={`px-2 py-1 rounded-full ${phase==='YO'?'text-white': 'text-slate-400'}`} style={{background: phase==='YO'?C.azul: 'transparent'}}>YO</span>
            <span className="text-slate-300">→</span>
            <span className={`px-2 py-1 rounded-full ${phase==='ELLOS'?'text-white': 'text-slate-400'}`} style={{background: phase==='ELLOS'?C.rojo: 'transparent'}}>ELLOS</span>
            <span className="text-slate-300">→</span>
            <span className={`px-2 py-1 rounded-full ${phase==='NOSOTROS'?'text-white': 'text-slate-400'}`} style={{background: phase==='NOSOTROS'?C.verde: 'transparent'}}>NOSOTROS</span>
            <span className="text-slate-300">→</span>
            <span className={`px-2 py-1 rounded-full ${phase==='JUGADA'?'text-white': 'text-slate-400'}`} style={{background: phase==='JUGADA'?C.dorado: 'transparent'}}>ACCIÓN</span>
          </div>
          <div className="text-[11px] text-slate-500 hidden md:block">8–12 min • Diagnóstico formativo</div>
        </div>
        {/* progress */}
        <div className="h-[4px] bg-slate-100">
          <div className="h-full transition-all duration-700" style={{width: `${pct()}%`, background: phase==='YO'?C.azul:phase==='ELLOS'?C.rojo:phase==='NOSOTROS'?C.verde:phase==='JUGADA'?C.dorado:C.navy}}/>
        </div>
      </header>

      <main ref={mainRef} className="max-w-[860px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* STEP 0 INICIO */}
        {step===0 && (
          <div className="space-y-6 animate-[pulse-soft_1s]">
            <div className="bg-white rounded-[28px] p-6 sm:p-10 shadow-[0_12px_40px_rgba(7,29,73,0.08)] border border-slate-100 overflow-hidden relative">
              <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full opacity-[0.07]" style={{background: C.azul}}/>
              <div className="absolute -right-6 top-16 w-40 h-40 rounded-full opacity-[0.06]" style={{background: C.rojo}}/>
              <div className="inline-flex items-center gap-2 bg-[#F7F9FC] border border-slate-200 rounded-full px-3 py-1 text-[11px] font-bold tracking-widest text-slate-600">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{background:C.verde}}/> EXPERIENCIA INTERACTIVA
              </div>
              <h1 className="text-[34px] sm:text-[54px] font-black leading-[0.9] mt-4" style={{color:C.navy}}>
                CAMBIA<br/>LA JUGADA
              </h1>
              <p className="text-[18px] sm:text-[22px] font-semibold mt-3" style={{color:C.azul}}>De experto que resuelve<br/>a líder que hace crecer.</p>
              <p className="text-slate-600 mt-4 max-w-[560px] leading-relaxed">
                En los próximos minutos enfrentarás una situación real de liderazgo.<br/>
                <span className="font-semibold text-slate-800">No buscamos respuestas perfectas.</span> Queremos descubrir cómo estás jugando hoy y cuál puede ser tu siguiente nivel.
              </p>

              <div className="flex flex-wrap gap-3 mt-6">
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-2 text-xs font-semibold shadow-sm">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px]" style={{background:C.azul}}>YO</span> Autoconocimiento
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-2 text-xs font-semibold shadow-sm">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px]" style={{background:C.rojo}}>EL</span> Empatía
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-2 text-xs font-semibold shadow-sm">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px]" style={{background:C.verde}}>NOS</span> Equipo
                </div>
              </div>

              <div className="bg-[#F7F9FC] rounded-2xl p-4 mt-6 flex flex-col sm:flex-row gap-4">
                <input placeholder="Tu nombre (opcional)" value={answers.nombre} onChange={e=> setAnswers({...answers, nombre:e.target.value})} className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1466B8] focus:ring-2 focus:ring-[#1466B8]/10"/>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                  <input type="checkbox" checked={answers.anonimo} onChange={e=> setAnswers({...answers, anonimo:e.target.checked})} className="w-4 h-4"/> Participar anónimo
                </label>
              </div>

              <div className="flex items-center gap-4 mt-8">
                <button onClick={()=> setStep(1)} className="flex-1 sm:flex-none bg-[#071D49] hover:bg-[#0a2a6b] text-white font-black tracking-widest text-sm px-8 py-4 rounded-2xl shadow-lg shadow-[#071D49]/20 transition">COMENZAR EL RETO →</button>
                <span className="text-xs text-slate-500">Duración 8–12 min</span>
              </div>

              <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">Herramienta formativa Y.E.N. • Totalplay San Luis • Desarrollo de Liderazgo. No es evaluación psicológica ni psicométrica.</p>
            </div>

            {/* footer mini */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {n:'YO', d:'Si tú no creces, tu equipo no crece.', c:C.azul},
                {n:'ELLOS', d:'No puedes motivar desde lo que te motiva a ti.', c:C.rojo},
                {n:'NOSOTROS', d:'El equipo por encima del ego.', c:C.verde},
              ].map(x=>(
                <div key={x.n} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-xs" style={{background:x.c}}>{x.n[0]}</div>
                  <div className="font-black text-xs mt-2" style={{color:x.c}}>{x.n}</div>
                  <div className="text-[11px] text-slate-500 leading-snug mt-1">{x.d}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 1 CASO */}
        {step===1 && (
          <div className="space-y-6">
            <div className="bg-white rounded-[28px] overflow-hidden shadow-[0_12px_40px_rgba(7,29,73,0.08)] border border-slate-100">
              <div className="h-2 w-full" style={{background:`linear-gradient(90deg, ${C.azul}, ${C.rojo}, ${C.verde})`}}/>
              <div className="p-6 sm:p-10">
                <div className="inline-flex items-center gap-2 text-[11px] font-black tracking-widest text-white px-3 py-1 rounded-full" style={{background:C.navy}}>EL PARTIDO • EL CASO</div>
                <h2 className="text-[28px] font-black mt-4" style={{color:C.navy}}>El equipo espera que tú resuelvas.</h2>
                <div className="grid sm:grid-cols-[1.2fr_0.8fr] gap-6 mt-6">
                  <div className="bg-[#F7F9FC] rounded-2xl p-5 leading-relaxed text-[15px] text-slate-700 border border-slate-100">
                    <p>Eres responsable de un equipo <span className="font-bold">técnicamente capaz.</span></p>
                    <p className="mt-3">Cuando aparece un problema importante, <span className="font-bold">todos esperan que tú decidas qué hacer.</span></p>
                    <p className="mt-3">Tú terminas resolviendo, corrigiendo y dando seguimiento.</p>
                    <div className="mt-4 bg-white rounded-xl p-3 border border-slate-200 text-sm">
                      <div className="flex items-center gap-2 font-bold" style={{color:C.navy}}>Resultados salen... pero:</div>
                      <ul className="mt-2 space-y-1 text-slate-600 list-disc list-inside">
                        <li>Tú trabajas más. Ellos deciden menos.</li>
                        <li>El equipo aprende lentamente.</li>
                        <li>Aparecen frustración, errores y menor compromiso.</li>
                      </ul>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-[#071D49] rounded-2xl p-5 text-white relative overflow-hidden">
                      <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-white/10"/>
                      <div className="text-xs tracking-widest opacity-70">METÁFORA</div>
                      <div className="font-black text-lg leading-none mt-2">¿Seguirías<br/>resolviendo el partido tú...</div>
                      <div className="font-black text-lg leading-none mt-2" style={{color:C.dorado}}>o cambiarías la forma<br/>de jugar?</div>
                      <div className="mt-4 flex gap-2">
                        <span className="px-2 py-1 bg-white/15 rounded-full text-[11px]">🏟️ Cancha</span>
                        <span className="px-2 py-1 bg-white/15 rounded-full text-[11px]">🤝 Equipo</span>
                        <span className="px-2 py-1 bg-white/15 rounded-full text-[11px]">🎯 Propósito</span>
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center">💡</div>
                      <div className="text-xs text-amber-800 leading-snug"><span className="font-bold">Pista:</span> Pasar de ser el experto que resuelve todo a ser el líder que hace crecer.</div>
                    </div>
                  </div>
                </div>
                <button onClick={()=> setStep(2)} className="w-full sm:w-auto mt-8 bg-[#D99A16] hover:bg-[#c78d13] text-white font-black tracking-widest text-sm px-8 py-4 rounded-2xl shadow-lg transition">CAMBIAR LA JUGADA →</button>
              </div>
            </div>
          </div>
        )}

        {/* GENERIC MODAL */}
        {showConcrete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#071D49]/60 backdrop-blur" onClick={()=> setShowConcrete(false)}/>
            <div className="relative bg-white rounded-[24px] p-6 max-w-[520px] w-full shadow-2xl border border-slate-200">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black" style={{background:C.dorado}}>!</div>
              <h3 className="font-black text-lg mt-3" style={{color:C.navy}}>Hazlo más concreto</h3>
              <p className="text-sm text-slate-600 mt-2">{concreteMsg}</p>
              <p className="text-xs text-slate-500 mt-3 bg-[#F7F9FC] border border-slate-200 rounded-xl p-3">Ejemplo: <span className="font-semibold">“En la próxima reunión escucharé las propuestas del equipo antes de presentar mi solución.”</span></p>
              <button onClick={()=> setShowConcrete(false)} className="mt-5 w-full bg-[#071D49] text-white font-bold py-3 rounded-xl">Entendido, mejorar mi respuesta</button>
            </div>
          </div>
        )}

        {/* Q1 */}
        {step===2 && (
          <QuestionCard
            phase="YO" color={C.azul} stepLabel="NIVEL Y — YO" title="Antes de intentar cambiar al equipo, mírate a ti."
            question="¿Qué comportamiento del líder está provocando que el equipo dependa demasiado de él?"
            hint="Piensa en acciones observables: resolver, decidir por otros, corregir, dar seguimiento excesivo..."
            value={answers.q1} onChange={v=> setAnswers({...answers, q1:v})} placeholder="Ej. Tomo todas las decisiones finales y corrijo el trabajo sin preguntar antes..."
            onNext={handleNext} canNext={canNext} progress={`${currentQIndex}/${totalQuestions}`}
          />
        )}
        {step===3 && (
          <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow-[0_12px_40px_rgba(7,29,73,0.06)] border border-slate-100">
            <PhaseHeader color={C.azul} label="NIVEL Y — YO" title="Hazlo visible: lo que dejas y lo que empiezas." />
            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              <div>
                <label className="text-xs font-black tracking-widest" style={{color:C.azul}}>DEJAR DE:</label>
                <textarea value={answers.q2_dejar} onChange={e=> setAnswers({...answers, q2_dejar:e.target.value})} rows={4} placeholder="Ej. Dejar de dar la respuesta inmediata..." className="mt-2 w-full bg-[#F7F9FC] border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:border-[#1466B8] focus:ring-2 focus:ring-[#1466B8]/10"/>
                <div className="text-[11px] text-slate-400 mt-1">{answers.q2_dejar.length} caracteres</div>
              </div>
              <div>
                <label className="text-xs font-black tracking-widest" style={{color:C.verde}}>EMPEZAR A:</label>
                <textarea value={answers.q2_empezar} onChange={e=> setAnswers({...answers, q2_empezar:e.target.value})} rows={4} placeholder="Ej. Empezar a preguntar: ¿qué opción proponen ustedes?" className="mt-2 w-full bg-[#F7F9FC] border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:border-[#178A3B] focus:ring-2 focus:ring-[#178A3B]/10"/>
                <div className="text-[11px] text-slate-400 mt-1">{answers.q2_empezar.length} caracteres</div>
              </div>
            </div>
            <NavButtons onBack={()=> setStep(2)} onNext={handleNext} canNext={canNext}/>
          </div>
        )}
        {step===4 && (
          <QuestionCard
            phase="YO" color={C.azul} stepLabel="NIVEL Y — YO" title="¿Por qué te cuesta soltar?"
            question="¿Por qué crees que al líder le cuesta dejar de resolver personalmente los problemas?"
            hint="Puede ser ego, control, miedo, rapidez, falta de confianza, hábito, presión..."
            value={answers.q3} onChange={v=> setAnswers({...answers, q3:v})} placeholder="Ej. Por miedo a que el error afecte el resultado y por la costumbre de ser el experto..."
            onNext={handleNext} canNext={canNext} progress={`${currentQIndex}/${totalQuestions}`}
          />
        )}

        {/* ELLOS */}
        {step===5 && (
          <div className="space-y-4">
            <div className="bg-[#D71920] rounded-2xl p-4 text-white flex gap-4 items-center">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-xl">👤</div>
              <div>
                <div className="font-black">ALEX • TU COLABORADOR</div>
                <div className="text-xs opacity-90">Capacidad técnica alta. Participa poco. Espera instrucciones. Cumple pero no propone.</div>
              </div>
            </div>
            <QuestionCard
              phase="ELLOS" color={C.rojo} stepLabel="NIVEL E — ELLOS" title="Ahora deja de mirar el problema desde tu mundo."
              question="Antes de juzgar a Alex: ¿Qué intentarías comprender de él?"
              hint="No juzgues aún. ¿Qué historia, motivaciones o contexto explorarías?"
              value={answers.q4} onChange={v=> setAnswers({...answers, q4:v})} placeholder="Ej. Quisiera entender qué le importa, cómo ve su rol, qué le preocupa..."
              onNext={handleNext} canNext={canNext} progress={`${currentQIndex}/${totalQuestions}`}
            />
          </div>
        )}
        {step===6 && (
          <QuestionCard
            phase="ELLOS" color={C.rojo} stepLabel="NIVEL E — ELLOS" title="Lo que bloquea no siempre es lo que parece."
            question="¿Qué podría estar bloqueando su participación?"
            hint="Piensa en confianza, claridad, reconocimiento, miedo al error, falta de espacio..."
            value={answers.q5} onChange={v=> setAnswers({...answers, q5:v})} placeholder="Ej. Tal vez siente que sus ideas no serán tomadas en cuenta o teme equivocarse..."
            onNext={handleNext} canNext={canNext} progress={`${currentQIndex}/${totalQuestions}`}
          />
        )}
        {step===7 && (
          <QuestionCard
            phase="ELLOS" color={C.rojo} stepLabel="NIVEL E — ELLOS" title="Conversación que abre, no que cierra."
            question='Escribe cómo iniciarías una conversación con Alex. "Líder:"'
            hint='Empieza con pregunta abierta, no con instrucción. Ej. "Alex, me gustaría escuchar cómo estás viendo..."'
            value={answers.q6} onChange={v=> setAnswers({...answers, q6:v})} placeholder='Líder: Alex, he notado que últimamente participas menos y quiero entender cómo lo estás viviendo...'
            onNext={handleNext} canNext={canNext} progress={`${currentQIndex}/${totalQuestions}`}
          />
        )}
        {step===8 && (
          <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow border border-slate-100">
            <div className="bg-gradient-to-r from-[#071D49] to-[#1466B8] rounded-2xl p-5 text-white text-center">
              <div className="text-[11px] tracking-widest opacity-70">RECUERDA EL EFECTO LUIS MIGUEL</div>
              <div className="font-black text-lg mt-1">“No puedes motivar a otros a partir de lo que te motiva a ti.</div>
              <div className="font-bold" style={{color: C.dorado}}>Tienes que motivar a partir de SU mundo.”</div>
            </div>
            <PhaseHeader color={C.rojo} label="ELLOS — MOTIVACIÓN" title="Entra en su mundo." />
            <div className="mt-6">
              <label className="font-bold text-slate-800">¿Qué pregunta le harías a Alex para conocer mejor qué lo motiva?</label>
              <textarea value={answers.q6b} onChange={e=> setAnswers({...answers, q6b:e.target.value})} rows={3} placeholder="Ej. ¿Qué parte de tu trabajo disfrutas más y qué te gustaría hacer más?" className="mt-3 w-full bg-[#F7F9FC] border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:border-[#D71920] focus:ring-2 focus:ring-[#D71920]/10"/>
              <div className="text-xs text-slate-500 mt-2">Tip: una gran pregunta contiene “qué” + “te” + verbo.</div>
            </div>
            <NavButtons onBack={()=> setStep(7)} onNext={handleNext} canNext={canNext}/>
          </div>
        )}

        {step===9 && (
          <QuestionCard
            phase="NOSOTROS" color={C.verde} stepLabel="NIVEL N — NOSOTROS" title="El objetivo ya no es que tú tengas la respuesta. Es que el equipo pueda construirla."
            question='Completa: "A partir de ahora, nosotros..."'
            hint='Crea una regla de equipo observable. Ej. "...antes de escalar un problema llegaremos con al menos una propuesta."'
            value={answers.q7} onChange={v=> setAnswers({...answers, q7:v})} placeholder="A partir de ahora, nosotros... antes de pedir decisión, traeremos opciones con pros y contras."
            onNext={handleNext} canNext={canNext} progress={`${currentQIndex}/${totalQuestions}`}
          />
        )}
        {step===10 && (
          <QuestionCard
            phase="NOSOTROS" color={C.verde} stepLabel="NIVEL N — NOSOTROS" title="Las reglas no viven en carteles. Viven en comportamientos."
            question="¿Qué debería hacer el líder para que esa regla realmente se convierta en una forma de trabajar?"
            hint="Piensa en ejemplo, recordatorios, seguimiento, coherencia..."
            value={answers.q8} onChange={v=> setAnswers({...answers, q8:v})} placeholder="Ej. Modelarla yo primero, recordarla al inicio de cada reunión y reconocer cuando alguien la usa..."
            onNext={handleNext} canNext={canNext} progress={`${currentQIndex}/${totalQuestions}`}
          />
        )}
        {step===11 && (
          <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow border border-slate-100">
            <PhaseHeader color={C.verde} label="NIVEL N — NOSOTROS" title="El valor que sostiene la jugada." />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
              {(['Humildad','Generosidad','Ambos'] as const).map(v=>(
                <button key={v} onClick={()=> setAnswers({...answers, q9_valor:v})}
                  className={`p-4 rounded-2xl border-2 text-left transition ${answers.q9_valor===v ? 'border-[#178A3B] bg-[#178A3B]/5' : 'border-slate-200 bg-[#F7F9FC] hover:border-slate-300'}`}>
                  <div className="font-black text-sm" style={{color: answers.q9_valor===v? C.verde : C.navy}}>{v.toUpperCase()}</div>
                  <div className="text-xs text-slate-500 mt-1">{v==='Humildad'?'Reconocer que no tienes todas las respuestas.':v==='Generosidad'?'Compartir protagonismo y crédito.':'Ambas son necesarias.'}</div>
                </button>
              ))}
            </div>
            <div className="mt-6">
              <label className="font-bold text-sm text-slate-800">¿Por qué?</label>
              <textarea value={answers.q9_porQue} onChange={e=> setAnswers({...answers, q9_porQue:e.target.value})} rows={3} placeholder="Explica por qué ese valor es clave para tu equipo ahora..." className="mt-2 w-full bg-[#F7F9FC] border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:border-[#178A3B] focus:ring-2 focus:ring-[#178A3B]/10"/>
            </div>
            <NavButtons onBack={()=> setStep(10)} onNext={handleNext} canNext={canNext}/>
          </div>
        )}
        {step===12 && (
          <QuestionCard
            phase="NOSOTROS" color={C.verde} stepLabel="MACRO-OBJETIVO" title="¿Cuál es el verdadero objetivo?"
            question="¿Cuál debería ser el verdadero objetivo del líder con este equipo?"
            hint="¿Resolver? ¿Controlar? ¿Desarrollar personas? ¿Construir equipo autónomo?"
            value={answers.q10} onChange={v=> setAnswers({...answers, q10:v})} placeholder="Ej. Construir un equipo capaz de resolver, aprender y mejorar juntos sin depender de mí..."
            onNext={handleNext} canNext={canNext} progress={`${currentQIndex}/${totalQuestions}`}
          />
        )}
        {step===13 && (
          <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow border border-slate-100">
            <PhaseHeader color={C.dorado} label="LA JUGADA — ACCIÓN" title="Convierte la reflexión en comportamiento." />
            <p className="text-sm text-slate-600 mt-2">Define tu jugada con 4 elementos obligatorios: <span className="font-bold">ACCIÓN + PERSONA + MOMENTO + EVIDENCIA</span></p>
            <div className="space-y-4 mt-6">
              <div>
                <label className="text-xs font-black tracking-widest" style={{color:C.navy}}>ESTA SEMANA VOY A...</label>
                <textarea value={answers.q11_accion} onChange={e=> setAnswers({...answers, q11_accion:e.target.value})} rows={2} placeholder="Ej. Pedir tres propuestas antes de dar mi opinión en la reunión..." className="mt-2 w-full bg-[#F7F9FC] border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:border-[#D99A16] focus:ring-2 focus:ring-[#D99A16]/10"/>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black tracking-widest text-slate-600">¿CON QUIÉN?</label>
                  <input value={answers.q11_quien} onChange={e=> setAnswers({...answers, q11_quien:e.target.value})} placeholder="Ej. Alex / Equipo de operaciones" className="mt-2 w-full bg-[#F7F9FC] border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:border-[#D99A16]"/>
                </div>
                <div>
                  <label className="text-xs font-black tracking-widest text-slate-600">¿CUÁNDO?</label>
                  <input value={answers.q11_cuando} onChange={e=> setAnswers({...answers, q11_cuando:e.target.value})} placeholder="Ej. Lunes 9am, reunión semanal" className="mt-2 w-full bg-[#F7F9FC] border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:border-[#D99A16]"/>
                </div>
              </div>
              <div>
                <label className="text-xs font-black tracking-widest text-slate-600">¿CÓMO SABRÁS QUE LO HICISTE? (EVIDENCIA)</label>
                <input value={answers.q11_evidencia} onChange={e=> setAnswers({...answers, q11_evidencia:e.target.value})} placeholder="Ej. Tendré 3 propuestas escritas en el pizarrón antes de decidir" className="mt-2 w-full bg-[#F7F9FC] border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:border-[#D99A16]"/>
              </div>
            </div>
            <NavButtons onBack={()=> setStep(12)} onNext={handleNext} canNext={canNext} nextLabel="VER MI DIAGNÓSTICO →"/>
          </div>
        )}

        {/* CALCULATING */}
        {calculating && (
          <div className="bg-white rounded-[28px] p-8 sm:p-12 shadow border border-slate-100 text-center">
            <div className="w-16 h-16 mx-auto rounded-full border-4 border-slate-100 border-t-[#071D49] animate-spin"/>
            <h3 className="font-black text-xl mt-6" style={{color:C.navy}}>Calculando tu forma de jugar...</h3>
            <div className="mt-4 space-y-2 text-sm text-slate-600 max-w-[420px] mx-auto">
              <div className={progressPhrase>=0 ? 'font-bold text-[#071D49]' : 'opacity-50'}>1. Analizando tus decisiones</div>
              <div className={progressPhrase>=1 ? 'font-bold text-[#071D49]' : 'opacity-50'}>2. Identificando patrones de liderazgo</div>
              <div className={progressPhrase>=2 ? 'font-bold text-[#071D49]' : 'opacity-50'}>3. Construyendo tu Playbook personal</div>
              <div className={progressPhrase>=3 ? 'font-bold text-[#071D49]' : 'opacity-50'}>4. Descubriendo tu siguiente nivel</div>
            </div>
            <div className="mt-6 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#071D49] transition-all duration-700" style={{width:`${(progressPhrase+1)*25}%`}}/>
            </div>
          </div>
        )}

        {/* RESULTADOS */}
        {step===14 && assessment && (
          <div className="space-y-6 pb-10">
            {/* Marcador */}
            <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow border border-slate-100 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1" style={{background:`linear-gradient(90deg, ${C.azul}, ${C.rojo}, ${C.verde}, ${C.dorado})`}}/>
              <div className="text-center">
                <div className="text-[11px] tracking-[0.2em] font-black text-slate-500">TU MARCADOR</div>
                <div className="mt-4 flex justify-center">
                  <div className="w-[160px] h-[160px] rounded-full border-[8px] flex flex-col items-center justify-center relative" style={{borderColor: C.navy}}>
                    <div className="text-[48px] font-black leading-none" style={{color:C.navy}}>{assessment.indice_yen}</div>
                    <div className="text-[11px] tracking-widest font-black text-slate-500">ÍNDICE Y.E.N.</div>
                    <div className="absolute -bottom-3 bg-[#071D49] text-white text-[10px] font-black tracking-widest px-3 py-1 rounded-full">/ 100</div>
                  </div>
                </div>
                <div className="mt-6">
                  <div className="text-xs tracking-widest font-bold text-slate-500">TU NIVEL ACTUAL</div>
                  <div className="inline-flex items-center gap-2 mt-2 bg-[#F7F9FC] border border-slate-200 rounded-full px-4 py-2">
                    <span className="w-3 h-3 rounded-full" style={{background: assessment.nivel===1?C.azul:assessment.nivel===2?C.rojo:C.verde}}/>
                    <span className="font-black text-sm" style={{color:C.navy}}>NIVEL {assessment.nivel} — {assessment.nombre_nivel}</span>
                    <span className="text-xs bg-white border border-slate-200 rounded-full px-2 py-0.5">{assessment.subnivel}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-3 max-w-[520px] mx-auto">
                    {assessment.nivel===1 && 'Estás construyendo tu base como líder. Tu siguiente evolución es dejar de ser quien tiene las respuestas.'}
                    {assessment.nivel===2 && 'Estás aprendiendo a liderar desde el mundo de las personas.'}
                    {assessment.nivel===3 && 'Tu liderazgo comienza a multiplicarse. Construyes autonomía.'}
                  </p>
                  <div className="mt-3 text-[11px] text-slate-400">Puedes tener buena puntuación y aún tener un siguiente nivel por desarrollar.</div>
                </div>
              </div>
            </div>

            {/* Gráfica */}
            <div className="bg-white rounded-[28px] p-6 shadow border border-slate-100">
              <h3 className="font-black" style={{color:C.navy}}>Tu gráfica Y.E.N.</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                {[
                  {label:'YO', val:assessment.scores.yo, c:C.azul, desc:'Autoconocimiento'},
                  {label:'ELLOS', val:assessment.scores.ellos, c:C.rojo, desc:'Empatía'},
                  {label:'NOSOTROS', val:assessment.scores.nosotros, c:C.verde, desc:'Equipo'},
                  {label:'EJECUCIÓN', val:assessment.scores.ejecucion, c:C.dorado, desc:'Acción'},
                ].map(s=>(
                  <div key={s.label} className="bg-[#F7F9FC] rounded-2xl p-4 text-center border border-slate-100">
                    <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-white font-black text-xl relative" style={{background: s.c}}>
                      {s.val}
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 44 44">
                        <circle cx="22" cy="22" r="18" fill="none" stroke="white" strokeOpacity="0.25" strokeWidth="3"/>
                        <circle cx="22" cy="22" r="18" fill="none" stroke="white" strokeWidth="3" strokeDasharray={`${(s.val/100)*113} 113`} strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div className="font-black text-xs mt-2 tracking-widest" style={{color:s.c}}>{s.label}</div>
                    <div className="text-[11px] text-slate-500">{s.desc}</div>
                  </div>
                ))}
              </div>
              {/* radar simple */}
              <div className="mt-6 flex justify-center">
                <Radar scores={assessment.scores}/>
              </div>
            </div>

            {/* Diagnóstico */}
            <div className="bg-[#071D49] rounded-[28px] p-6 sm:p-8 text-white relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-white/5"/>
              <div className="text-[11px] tracking-widest opacity-60 font-black">INTERPRETACIÓN PERSONALIZADA</div>
              <p className="mt-3 leading-relaxed text-[15px] opacity-95">{assessment.diagnostico}</p>
              {answers.nombre && <div className="mt-4 text-xs opacity-70">— Para {answers.anonimo ? 'participante anónimo' : answers.nombre}</div>}
            </div>

            {/* Fortalezas */}
            <div className="bg-white rounded-[28px] p-6 shadow border border-slate-100">
              <h3 className="font-black flex items-center gap-2" style={{color:C.verde}}><span className="w-8 h-8 rounded-full bg-[#178A3B] text-white flex items-center justify-center">✓</span> LO QUE YA ESTÁS HACIENDO BIEN</h3>
              <div className="grid sm:grid-cols-3 gap-3 mt-4">
                {assessment.fortalezas.map((f,i)=>(
                  <div key={i} className="bg-[#F7F9FC] border border-slate-200 rounded-2xl p-4">
                    <div className="text-xs font-black" style={{color:C.navy}}>0{i+1} {f.titulo}</div>
                    <div className="text-xs text-slate-600 mt-2 leading-snug">{f.explicacion}</div>
                    <div className="text-[11px] text-slate-500 mt-2 italic bg-white border border-slate-200 rounded-xl p-2">{f.evidencia}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alertas */}
            <div className="bg-white rounded-[28px] p-6 shadow border border-slate-100">
              <h3 className="font-black flex items-center gap-2" style={{color:C.rojo}}><span className="w-8 h-8 rounded-full bg-[#D71920] text-white flex items-center justify-center">!</span> CUIDADO CON ESTAS JUGADAS</h3>
              <div className="grid sm:grid-cols-3 gap-3 mt-4">
                {assessment.alertas.map((a,i)=>(
                  <div key={i} className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <div className="text-xs font-black text-amber-800">{a.titulo}</div>
                    <div className="text-xs text-amber-900/70 mt-2 leading-snug">{a.explicacion}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Deja de / Empieza a */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-[28px] p-6 border border-slate-100 shadow">
                <h4 className="font-black text-sm flex items-center gap-2" style={{color:C.rojo}}><span className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">✕</span> DEJA DE</h4>
                <ul className="mt-3 space-y-2">
                  {assessment.dejar_de.map((d,i)=>(
                    <li key={i} className="flex gap-2 text-sm bg-red-50 border border-red-100 rounded-xl p-3">
                      <span className="font-black text-red-500">{i+1}.</span> <span className="text-slate-700 leading-snug">{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-[28px] p-6 border border-slate-100 shadow">
                <h4 className="font-black text-sm flex items-center gap-2" style={{color:C.verde}}><span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">＋</span> EMPIEZA A</h4>
                <ul className="mt-3 space-y-2">
                  {assessment.empezar_a.map((d,i)=>(
                    <li key={i} className="flex gap-2 text-sm bg-green-50 border border-green-100 rounded-xl p-3">
                      <span className="font-black text-green-600">{i+1}.</span> <span className="text-slate-700 leading-snug">{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Evolución */}
            <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow border border-slate-100">
              <h3 className="font-black text-center" style={{color:C.navy}}>TU EVOLUCIÓN COMO LÍDER</h3>
              <p className="text-center text-xs text-slate-500 mt-1">De la dependencia a la autonomía</p>
              <div className="mt-6 relative">
                <div className="absolute left-[16%] right-[16%] top-[28px] h-[4px] bg-slate-200 rounded-full hidden sm:block"/>
                <div className="absolute left-[16%] h-[4px] bg-gradient-to-r from-[#1466B8] via-[#D99A16] to-[#178A3B] rounded-full hidden sm:block" style={{width: assessment.evolution===1 ? '0%' : assessment.evolution===1.5 ? '25%' : assessment.evolution===2 ? '50%' : '84%', top:'28px'}}/>
                <div className="grid sm:grid-cols-3 gap-6 relative">
                  {[
                    {t:'RESOLVER', d:'Hoy el equipo depende de ti para resolver. Tú decides, ellos consultan.', c:C.azul, icon:'🛠️'},
                    {t:'HACER CRECER', d:'Tu siguiente nivel: que dependa de ti para crecer. Tú preguntas, ellos proponen.', c:C.dorado, icon:'🌱'},
                    {t:'CONSTRUIR AUTONOMÍA', d:'Objetivo final: ya no depende de ti para funcionar. Equipo autónomo.', c:C.verde, icon:'🏆'},
                  ].map((e,idx)=>{
                    const isHere = (assessment.evolution===1 && idx===0) || (assessment.evolution===1.5 && idx===0) || (assessment.evolution===2 && idx===1) || (assessment.evolution===3 && idx===2)
                    return (
                      <div key={e.t} className={`rounded-2xl p-5 border-2 text-center relative ${isHere?'bg-[#071D49] text-white border-[#071D49] shadow-xl scale-[1.03]':'bg-[#F7F9FC] border-slate-200'}`}>
                        {isHere && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#D99A16] text-white text-[10px] font-black tracking-widest px-3 py-1 rounded-full">ESTÁS AQUÍ</div>}
                        <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center text-xl border" style={{background: isHere? 'white' : e.c, color: isHere? C.navy : 'white', borderColor: 'transparent'}}>{e.icon}</div>
                        <div className="font-black text-xs tracking-widest mt-3" style={{color: isHere? 'white' : e.c}}>{e.t}</div>
                        <div className={`text-xs mt-2 leading-snug ${isHere?'text-white/80':'text-slate-600'}`}>{e.d}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="mt-6 bg-[#F7F9FC] border border-slate-200 rounded-2xl p-4 text-center">
                <div className="text-xs font-black" style={{color:C.navy}}>Para avanzar, tu siguiente jugada es…</div>
                <div className="text-sm font-bold mt-1" style={{color:C.dorado}}>{assessment.siguiente_nivel.clave}</div>
                <div className="text-xs text-slate-600 mt-1">{assessment.siguiente_nivel.explicacion}</div>
              </div>
            </div>

            {/* Siguiente nivel */}
            <div className="bg-white rounded-[28px] p-6 shadow border border-slate-100 flex flex-col sm:flex-row gap-6 items-center">
              <div className="flex-1">
                <div className="text-[11px] tracking-widest font-black text-slate-500">TU SIGUIENTE NIVEL</div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="px-3 py-2 rounded-xl bg-[#F7F9FC] border border-slate-200 text-xs font-black" style={{color:C.navy}}>ESTÁS AQUÍ: {assessment.nombre_nivel}</div>
                  <span>→</span>
                  <div className="px-3 py-2 rounded-xl text-white text-xs font-black" style={{background:C.verde}}>SIGUIENTE: {assessment.siguiente_nivel.nivel}</div>
                </div>
                <div className="text-xs text-slate-600 mt-3">{assessment.siguiente_nivel.explicacion}</div>
              </div>
              <div className="w-full sm:w-40 h-24 bg-gradient-to-br from-[#071D49] to-[#1466B8] rounded-2xl flex items-center justify-center text-white font-black text-center p-3">YO → ELLOS → NOSOTROS</div>
            </div>

            {/* Reto 7 días */}
            <div className="bg-gradient-to-br from-[#D99A16] to-[#c78d13] rounded-[28px] p-6 sm:p-8 text-white relative overflow-hidden">
              <div className="absolute -right-12 -top-12 w-40 h-40 bg-white/10 rounded-full"/>
              <div className="text-[11px] tracking-widest font-black opacity-80">TU RETO DE ESTA SEMANA</div>
              <h3 className="font-black text-xl mt-2">{assessment.reto_7_dias.titulo}</h3>
              <div className="mt-4 bg-white rounded-2xl p-4 text-slate-800">
                <div className="font-bold" style={{color:C.navy}}>{assessment.reto_7_dias.accion}</div>
                <div className="grid sm:grid-cols-3 gap-3 mt-3 text-xs">
                  <div className="bg-[#F7F9FC] border border-slate-200 rounded-xl p-3"><div className="font-black text-slate-500">DÍA / MOMENTO</div><div className="font-bold mt-1">{assessment.reto_7_dias.momento}</div></div>
                  <div className="bg-[#F7F9FC] border border-slate-200 rounded-xl p-3"><div className="font-black text-slate-500">PERSONA</div><div className="font-bold mt-1">{answers.q11_quien}</div></div>
                  <div className="bg-[#F7F9FC] border border-slate-200 rounded-xl p-3"><div className="font-black text-slate-500">EVIDENCIA</div><div className="font-bold mt-1">{assessment.reto_7_dias.evidencia}</div></div>
                </div>
                <label className="flex items-center gap-2 mt-4 font-bold text-sm cursor-pointer"><input type="checkbox" className="w-5 h-5"/> ACEPTO EL RETO</label>
              </div>
            </div>

            {/* Playbook */}
            <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow border border-slate-100">
              <h3 className="font-black flex items-center gap-2" style={{color:C.navy}}><span className="w-8 h-8 rounded-full bg-[#071D49] text-white flex items-center justify-center">📖</span> MI PLAYBOOK DE LIDERAZGO</h3>
              <div className="grid sm:grid-cols-2 gap-4 mt-6">
                <PlayCard title="YO" subtitle="Lo que debo trabajar en mí" text={assessment.playbook.yo} color={C.azul}/>
                <PlayCard title="ELLOS" subtitle="Cómo conversar" text={assessment.playbook.ellos} color={C.rojo}/>
                <PlayCard title="NOSOTROS" subtitle="Qué construir con el equipo" text={assessment.playbook.nosotros} color={C.verde}/>
                <PlayCard title="MI JUGADA" subtitle="Próximos 7 días" text={assessment.playbook.jugada} color={C.dorado}/>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button onClick={()=> downloadPDF(assessment, answers)} className="flex-1 bg-[#071D49] hover:bg-[#0a2a6b] text-white font-black py-3 rounded-xl shadow">📄 DESCARGAR PDF COMPLETO</button>
                <button onClick={()=> window.print()} className="flex-1 bg-white border border-slate-300 font-bold py-3 rounded-xl">Imprimir</button>
                <button onClick={()=> {navigator.clipboard.writeText(window.location.href); alert('Link copiado')}} className="flex-1 bg-white border border-slate-300 font-bold py-3 rounded-xl">Compartir</button>
              </div>
              <div className="text-[11px] text-slate-400 text-center mt-2">Se descarga un documento A4 con todo tu diagnóstico, playbook y reto de 7 días.</div>
            </div>

            {/* Frase final */}
            <div className="bg-[#071D49] rounded-[28px] p-8 text-center text-white relative overflow-hidden">
              <div className="absolute inset-0 opacity-10" style={{background:`radial-gradient(circle at 50% 0%, ${C.dorado}, transparent 60%)`}}/>
              <div className="relative">
                <div className="text-[11px] tracking-widest opacity-60">FRASE PARA TU NIVEL</div>
                <div className="font-black text-xl sm:text-2xl mt-3 leading-tight">“{assessment.frase_final}”</div>
                <div className="mt-6 font-bold tracking-[0.2em] text-sm" style={{color:C.dorado}}>LA VIDA ES UN DEPORTE DE EQUIPO.</div>
                <div className="mt-2 text-xs opacity-60">No se trata de que el equipo necesite menos liderazgo. Se trata de construir un liderazgo que haga al equipo cada vez más capaz.</div>
                <button onClick={()=> {setStep(0); setAssessment(null); setAnswers({q1:'',q2_dejar:'',q2_empezar:'',q3:'',q4:'',q5:'',q6:'',q6b:'',q7:'',q8:'',q9_valor:'',q9_porQue:'',q10:'',q11_accion:'',q11_quien:'',q11_cuando:'',q11_evidencia:'', nombre:'', anonimo:false})}} className="mt-6 bg-white text-[#071D49] font-black px-6 py-3 rounded-xl">Repetir experiencia</button>
              </div>
            </div>

            <div className="text-center text-[11px] text-slate-400 px-4">Herramienta formativa Y.E.N. • Totalplay San Luis • No es evaluación psicológica ni psicométrica.</div>
          </div>
        )}
      </main>

      {/* sticky nav helper */}
      {(step>=2 && step<=13) && !calculating && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-xl rounded-full px-4 py-2 flex items-center gap-3 text-xs font-bold">
          <span className="hidden sm:inline text-slate-500">{currentQIndex} / {totalQuestions}</span>
          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[#071D49] transition-all" style={{width:`${(currentQIndex/totalQuestions)*100}%`}}/></div>
          <span className="text-[#071D49]">{phase}</span>
        </div>
      )}
    </div>
  )
}

function PhaseHeader({color, label, title}:{color:string, label:string, title:string}){
  return (
    <div>
      <div className="inline-flex items-center gap-2 text-[11px] font-black tracking-widest text-white px-3 py-1 rounded-full" style={{background: color}}>{label}</div>
      <h2 className="font-black text-[18px] mt-3" style={{color:'#071D49'}}>{title}</h2>
    </div>
  )
}
function QuestionCard({phase, color, stepLabel, title, question, hint, value, onChange, placeholder, onNext, canNext, progress}:{phase:string, color:string, stepLabel:string, title:string, question:string, hint:string, value:string, onChange:(v:string)=>void, placeholder:string, onNext:()=>void, canNext:boolean, progress:string}){
  return (
    <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow-[0_12px_40px_rgba(7,29,73,0.06)] border border-slate-100">
      <PhaseHeader color={color} label={stepLabel} title={title}/>
      <div className="mt-6">
        <label className="font-bold text-slate-800">{question}</label>
        {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
        <textarea value={value} onChange={e=> onChange(e.target.value)} rows={4} placeholder={placeholder} className="mt-3 w-full bg-[#F7F9FC] border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:border-transparent" style={{focusedBorder: color} as any}/>
        <div className="flex justify-between mt-2">
          <span className={`text-[11px] ${value.length<10?'text-red-500':'text-slate-400'}`}>{value.length <10 ? `Mínimo 10 caracteres (${value.length}/10)` : `${value.length} caracteres`}</span>
          <span className="text-[11px] text-slate-400">{progress}</span>
        </div>
      </div>
      <NavButtons onBack={undefined} onNext={onNext} canNext={canNext} hideBack={phase==='YO' && progress==='1/13' ? false : undefined}/>
    </div>
  )
}
function NavButtons({onBack, onNext, canNext, nextLabel, hideBack}:{onBack?:()=>void, onNext:()=>void, canNext:boolean, nextLabel?:string, hideBack?:boolean}){
  return (
    <div className="flex gap-3 mt-6">
      {onBack && !hideBack && <button onClick={onBack} className="px-6 py-3 rounded-xl border border-slate-200 bg-white font-bold text-sm">← Atrás</button>}
      <button onClick={onNext} disabled={!canNext} className={`flex-1 font-black tracking-widest text-sm px-6 py-3 rounded-xl transition ${canNext? 'bg-[#071D49] text-white hover:bg-[#0a2a6b] shadow' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>{nextLabel || 'Continuar →'}</button>
    </div>
  )
}
function PlayCard({title, subtitle, text, color}:{title:string, subtitle:string, text:string, color:string}){
  return (
    <div className="bg-[#F7F9FC] border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-xs" style={{background: color}}>{title[0]}</div>
        <div>
          <div className="font-black text-xs" style={{color}}>{title}</div>
          <div className="text-[11px] text-slate-500">{subtitle}</div>
        </div>
      </div>
      <div className="text-xs text-slate-700 leading-relaxed mt-3 bg-white border border-slate-200 rounded-xl p-3">{text}</div>
    </div>
  )
}
function Radar({scores}:{scores:{yo:number, ellos:number, nosotros:number, ejecucion:number}}){
  const vals = [scores.yo, scores.ellos, scores.nosotros, scores.ejecucion]
  const max = 100
  const cx=60, cy=60, r=50
  const points = vals.map((v,i)=>{
    const angle = (Math.PI*2 * i / vals.length) - Math.PI/2
    const rad = (v/max)*r
    return `${cx + Math.cos(angle)*rad},${cy + Math.sin(angle)*rad}`
  }).join(' ')
  const grid = [25,50,75,100].map(p=>{
    const pts = vals.map((_,i)=>{
      const a = (Math.PI*2 * i / vals.length) - Math.PI/2
      const rad = (p/max)*r
      return `${cx + Math.cos(a)*rad},${cy + Math.sin(a)*rad}`
    }).join(' ')
    return <polygon key={p} points={pts} fill="none" stroke="#E2E8F0" strokeWidth="0.8"/>
  })
  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 120 120">
        {grid}
        <polygon points={points} fill="rgba(7,29,73,0.12)" stroke="#071D49" strokeWidth="2"/>
        {vals.map((_,i)=>{
          const a = (Math.PI*2 * i / vals.length) - Math.PI/2
          const x = cx + Math.cos(a)*r
          const y = cy + Math.sin(a)*r
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#CBD5E1" strokeWidth="0.8"/>
        })}
      </svg>
      <div className="flex gap-3 text-[10px] font-bold tracking-widest mt-1">
        <span style={{color:'#1466B8'}}>YO {scores.yo}</span>
        <span style={{color:'#D71920'}}>ELLOS {scores.ellos}</span>
        <span style={{color:'#178A3B'}}>NOS {scores.nosotros}</span>
        <span style={{color:'#D99A16'}}>EJEC {scores.ejecucion}</span>
      </div>
    </div>
  )
}
