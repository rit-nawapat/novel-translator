import { useState, useEffect } from 'react'
import axios from 'axios'

function App() {
  const [url, setUrl] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)

  // โหลดค่า Theme จาก LocalStorage (Default เป็น Dark ตามสไตล์ NOC)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true
  })

  // Persistence Logic สำหรับ API Key และ Prompt
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '')
  const [systemPrompt, setSystemPrompt] = useState(localStorage.getItem('system_prompt') || 'Translate this novel to Thai with professional literary style...')

  // จัดการ Side Effects: บันทึกข้อมูลและเปลี่ยน Class ของ HTML สำหรับ Dark Mode
  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey)
    localStorage.setItem('system_prompt', systemPrompt)

    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [apiKey, systemPrompt, darkMode])

  const handleTranslate = async () => {
    if (!url || !apiKey) return alert('โปรดใส่ URL และ API Key')
    setLoading(true)
    try {
      const proxyUrl = `https://cors-anywhere.azm.workers.dev/${url}`
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
    <div className="min-h-screen transition-colors duration-500 bg-white dark:bg-[#050505] text-gray-900 dark:text-gray-300 font-sans">

      {/* ---------------- NAVIGATION / LOGO ---------------- */}
      <nav className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-8 z-[90] bg-white/50 dark:bg-black/50 backdrop-blur-md border-b border-gray-100 dark:border-gray-900">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black dark:bg-[#deff9a] rounded-lg flex items-center justify-center transition-transform hover:scale-105 cursor-default">
            <span className="text-white dark:text-black font-black text-lg italic">N</span>
          </div>
          <span className="text-xs font-bold tracking-[0.3em] uppercase hidden sm:block opacity-70">Novel Hub</span>
        </div>

        {/* ปุ่มสลับโหมด Dark/Light */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-all active:scale-90"
          title="Toggle Dark Mode"
        >
          {darkMode ? (
            <svg className="w-5 h-5 text-[#deff9a]" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" /></svg>
          ) : (
            <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
          )}
        </button>
      </nav>

      {/* ---------------- READING AREA ---------------- */}
      <main className="max-w-3xl mx-auto px-6 pt-24 pb-48">
        {content ? (
          <article className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="text-lg md:text-xl leading-[2.2] tracking-wide whitespace-pre-wrap font-light">
              {content}
            </div>
          </article>
        ) : (
          <div className="h-[60vh] flex flex-col items-center justify-center opacity-30">
            <div className="w-16 h-1 bg-gray-400 dark:bg-[#deff9a] mb-8 rounded-full"></div>
            <p className="font-mono text-xs tracking-[0.4em] uppercase">Awaiting Transmission</p>
          </div>
        )}
      </main>

      {/* ---------------- FLOATING CONTROL BAR ---------------- */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-[100]">
        <div className="bg-white/80 dark:bg-[#111111]/90 backdrop-blur-2xl border border-gray-200 dark:border-gray-800 rounded-[2.5rem] shadow-2xl overflow-hidden transition-all duration-300">

          {/* Config Section (Expandable) */}
          <div className={`px-8 overflow-hidden transition-all duration-500 ease-in-out ${isConfigOpen ? 'max-h-96 py-8 border-b border-gray-100 dark:border-gray-800' : 'max-h-0 py-0 opacity-0 pointer-events-none'}`}>
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold ml-1">Gemini API Key</label>
                <input
                  type="password"
                  className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-3.5 text-xs font-mono dark:text-[#deff9a] focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold ml-1">System Gem</label>
                <textarea
                  className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-3.5 text-xs text-gray-500 dark:text-gray-400 h-24 focus:ring-1 focus:ring-blue-500 outline-none resize-none transition-all"
                  value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Input Section (Main Bar) */}
          <div className="p-3 flex items-center gap-3">
            <input
              type="text"
              placeholder="Paste novel link here..."
              className="flex-1 bg-transparent px-5 py-3 text-sm outline-none placeholder:text-gray-400 font-medium"
              value={url} onChange={(e) => setUrl(e.target.value)}
              onFocus={() => setIsConfigOpen(false)}
            />

            <button
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className={`p-3.5 rounded-full transition-all active:scale-95 ${isConfigOpen ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg' : 'bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            </button>

            <button
              onClick={handleTranslate}
              disabled={loading}
              className="bg-black dark:bg-[#deff9a] text-white dark:text-black font-black px-8 py-3.5 rounded-[1.8rem] text-xs tracking-widest hover:shadow-xl active:scale-95 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
            >
              {loading ? '...' : 'TRANSLATE'}
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

export default App