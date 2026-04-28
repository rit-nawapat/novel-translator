import { useState, useEffect } from 'react'
import axios from 'axios'

function App() {
  const [url, setUrl] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)

  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '')
  const [systemPrompt, setSystemPrompt] = useState(localStorage.getItem('system_prompt') || 'Translate this novel to Thai with professional literary style...')

  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey)
    localStorage.setItem('system_prompt', systemPrompt)
  }, [apiKey, systemPrompt])

  const handleTranslate = async () => {
    if (!url || !apiKey) return alert('โปรดใส่ URL และ API Key')
    setLoading(true)
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
      const res = await axios.get(proxyUrl)
      const parser = new DOMParser()
      const doc = parser.parseFromString(res.data.contents, 'text/html')

      const selectors = ['.entry-content', '.chapter-content', '.read-content', 'article']
      let rawText = ''
      for (const s of selectors) {
        const el = doc.querySelector(s)
        if (el) { rawText = el.textContent || ''; break; }
      }
      if (!rawText) rawText = doc.body.textContent || ''

      const apiRes = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        { contents: [{ parts: [{ text: `${systemPrompt}\n\nContent:\n${rawText.substring(0, 15000)}` }] }] }
      )
      setContent(apiRes.data.candidates[0].content.parts[0].text)
      setIsConfigOpen(false)
    } catch (err) {
      alert('Error: ตรวจสอบ API Key หรือ URL อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-gray-300 font-sans">

      {/* ---------------- พื้นที่อ่านนิยาย ---------------- */}
      <main className="max-w-3xl mx-auto px-6 pt-12 pb-48">
        {content ? (
          <article className="animate-in fade-in duration-700">
            <div className="text-lg md:text-xl leading-[2.2] tracking-wide whitespace-pre-wrap font-light">
              {content}
            </div>
          </article>
        ) : (
          <div className="h-[70vh] flex flex-col items-center justify-center opacity-20 border-2 border-dashed border-gray-800 rounded-3xl">
            <p className="font-mono text-sm tracking-[0.3em] uppercase">Ready for Command</p>
          </div>
        )}
      </main>

      {/* ---------------- แถบควบคุม (ปรับปรุง Hitbox และ Z-Index) ---------------- */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-[100]">
        <div className="bg-[#111111]/95 backdrop-blur-xl border border-gray-800 rounded-3xl shadow-2xl flex flex-col">

          {/* ส่วน Config ย่อ-ขยาย */}
          <div
            className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${isConfigOpen ? 'max-h-96 py-6 border-b border-gray-800 opacity-100' : 'max-h-0 py-0 opacity-0 pointer-events-none'
              }`}
          >
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">Gemini API Key</label>
                <input
                  type="password"
                  className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-3 text-xs font-mono text-[#deff9a] focus:border-[#deff9a] outline-none transition-colors"
                  value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">System Instruction (Gem)</label>
                <textarea
                  className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-3 text-xs text-gray-300 h-28 focus:border-[#deff9a] outline-none transition-colors resize-none leading-relaxed"
                  value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* แถบกดปุ่มหลัก (แก้ไข Hover แล้ว) */}
          <div className="p-2 flex items-center gap-2 relative z-10">
            <input
              type="text"
              placeholder="Paste novel URL here..."
              className="flex-1 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-gray-600"
              value={url} onChange={(e) => setUrl(e.target.value)}
              onFocus={() => setIsConfigOpen(false)}
            />

            <button
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className={`px-5 py-3 rounded-2xl text-[11px] font-bold tracking-wider transition-colors cursor-pointer ${isConfigOpen
                  ? 'bg-gray-200 text-black hover:bg-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
            >
              CONFIG
            </button>

            <button
              onClick={handleTranslate}
              disabled={loading}
              className="bg-[#deff9a] text-black font-bold px-8 py-3 rounded-2xl text-xs tracking-wider transition-colors hover:bg-white cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
            >
              {loading ? 'WAIT...' : 'EXECUTE'}
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

export default App