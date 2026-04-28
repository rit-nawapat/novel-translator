import { useState, useEffect } from 'react'
import axios from 'axios'

// Helper functions for API Key Obfuscation (Base64)
const obfuscateKey = (key: string) => btoa(key);
const deobfuscateKey = (obfuscated: string) => {
  if (!obfuscated) return '';
  try {
    return atob(obfuscated);
  } catch (e) {
    return '';
  }
};


function App() {
  const [url, setUrl] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Reading Settings
  const [fontSize, setFontSize] = useState(parseInt(localStorage.getItem('font_size') || '18'))
  const [lineHeight, setLineHeight] = useState(parseFloat(localStorage.getItem('line_height') || '1.8'))
  const [nextUrl, setNextUrl] = useState<string | null>(null)

  // Glossary State (Term Consistency)
  const [glossary, setGlossary] = useState<{ src: string, dest: string }[]>(() => {
    const saved = localStorage.getItem('novel_glossary')
    return saved ? JSON.parse(saved) : []
  })

  // Helper: Clean raw text to save tokens
  const cleanText = (text: string) => {
    return text
      .replace(/(\n\s*){2,}/g, '\n\n') // ยุบย่อการขึ้นบรรทัดใหม่ที่เยอะเกินไป
      .replace(/[ \t]+/g, ' ')         // ยุบย่อช่องว่างแนวนอน
      .trim();
  }

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // โหลดค่า Theme จาก LocalStorage (Default เป็น Dark ตามสไตล์ NOC)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true
  })

  // Persistence Logic สำหรับ API Key และ Prompt (ถอดรหัสออกมาใช้งานใน State)
  const [apiKey, setApiKey] = useState(() => {
    const saved = localStorage.getItem('gemini_api_key')
    return saved ? deobfuscateKey(saved) : ''
  })

  const [systemPrompt, setSystemPrompt] = useState(localStorage.getItem('system_prompt') || 'Translate this novel to Thai with professional literary style...')

  // จัดการ Side Effects: บันทึกข้อมูลและเปลี่ยน Class ของ HTML สำหรับ Dark Mode
  useEffect(() => {
    localStorage.setItem('gemini_api_key', obfuscateKey(apiKey))
    localStorage.setItem('system_prompt', systemPrompt)
    localStorage.setItem('novel_glossary', JSON.stringify(glossary))
    localStorage.setItem('font_size', fontSize.toString())
    localStorage.setItem('line_height', lineHeight.toString())

    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [apiKey, systemPrompt, darkMode, glossary, fontSize, lineHeight])

  const handleTranslate = async () => {
    if (!url || !apiKey) return showToast('โปรดใส่ URL และ API Key', 'error')
    setLoading(true)
    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`
      const res = await axios.get(proxyUrl)
      const parser = new DOMParser()
      const doc = parser.parseFromString(res.data.contents, 'text/html')

      // Smart Navigation Logic: ค้นหาปุ่ม "ตอนต่อไป"
      const links = Array.from(doc.querySelectorAll('a'));
      const nextMatch = links.find(l => {
        const text = (l.textContent || '').toLowerCase();
        return text.includes('next') || text.includes('下一章') || text.includes('ตอนต่อไป');
      });

      if (nextMatch) {
        let href = nextMatch.getAttribute('href');
        if (href && !href.startsWith('http')) {
          const origin = new URL(url).origin;
          href = new URL(href, origin).href;
        }
        setNextUrl(href);
      } else {
        setNextUrl(null);
      }

      const selectors = ['.entry-content', '.chapter-content', '.read-content', 'article']
      let rawText = ''
      for (const s of selectors) {
        const el = doc.querySelector(s)
        if (el) { rawText = el.textContent || ''; break; }
      }
      if (!rawText) rawText = doc.body.textContent || ''

      // Clean text before sending to AI
      const cleanedText = cleanText(rawText);

      // Check Cache (ถ้าเคยแปล URL นี้แล้วให้ดึงจากเครื่องเลย)
      const cacheKey = `cached_trans_${encodeURIComponent(url).slice(-50)}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setContent(cached);
        showToast('โหลดข้อมูลจากหน่วยความจำ (Cache)', 'info');
        setLoading(false);
        return;
      }

      // Merge Glossary into Prompt
      const glossaryContext = glossary.length > 0
        ? `\n\n[GLOSSARY - MUST FOLLOW]:\n${glossary.map(g => `${g.src} -> ${g.dest}`).join('\n')}`
        : '';

      const apiRes = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`, // เปลี่ยนจาก 2.5 เป็น 2.0
        { contents: [{ parts: [{ text: `${systemPrompt}${glossaryContext}\n\n[Content to translate]:\n${cleanedText.substring(0, 15000)}` }] }] },
        { headers: { 'x-goog-api-key': apiKey } }
      )

      const translated = apiRes.data.candidates[0].content.parts[0].text;
      setContent(translated);
      localStorage.setItem(cacheKey, translated); // Save to cache
      setIsConfigOpen(false)
      showToast('แปลเนื้อหาเรียบร้อยแล้ว', 'success')
    } catch (err) {
      // ป้องกันการรั่วไหลของ Error วัตถุดิบลง Console โดยใช้ Custom Message
      showToast('ขออภัย! เกิดข้อผิดพลาดในการแปล: โปรดตรวจสอบ API Key หรือการเชื่อมต่ออินเทอร์เน็ตของคุณ', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen transition-colors duration-500 bg-white dark:bg-[#050505] text-gray-900 dark:text-gray-300 font-sans">

      {/* ---------------- CUSTOM TOAST ---------------- */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-3 rounded-2xl backdrop-blur-xl border flex items-center gap-3 shadow-2xl ${toast.type === 'error'
            ? 'bg-red-500/10 border-red-500/20 text-red-500'
            : toast.type === 'success'
              ? 'bg-[#deff9a]/10 border-[#deff9a]/20 text-[#deff9a]'
              : 'bg-white/10 border-white/20 text-white'
            }`}>
            {toast.type === 'error' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
            <span className="text-sm font-bold tracking-wide">{toast.message}</span>
          </div>
        </div>
      )}

      {/* ---------------- NAVIGATION / LOGO ---------------- */}
      <nav className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 sm:px-8 z-[90] bg-white/50 dark:bg-black/50 backdrop-blur-md border-b border-gray-100 dark:border-gray-900">
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
            <div
              style={{ fontSize: `${fontSize}px`, lineHeight: lineHeight }}
              className="tracking-wide whitespace-pre-wrap font-light"
            >
              {content}
            </div>

            {/* Next Chapter Button */}
            {nextUrl && (
              <div className="mt-16 flex justify-center">
                <button
                  onClick={() => { setUrl(nextUrl); handleTranslate(); }}
                  className="group flex items-center gap-3 px-8 py-4 bg-gray-100 dark:bg-white/5 hover:bg-black dark:hover:bg-[#deff9a] text-gray-600 dark:text-gray-400 hover:text-white dark:hover:text-black rounded-2xl transition-all duration-300 font-bold text-sm tracking-widest"
                >
                  NEXT CHAPTER
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </div>
            )}
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
          <div className={`px-4 sm:px-8 overflow-y-auto transition-all duration-500 ease-in-out ${isConfigOpen ? 'max-h-[70vh] py-8 border-b border-gray-100 dark:border-gray-800' : 'max-h-0 py-0 opacity-0 pointer-events-none'}`}>
            <div className="grid grid-cols-1 gap-6 custom-scrollbar">

              {/* Reading Settings Slider */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold ml-1">Font Size: {fontSize}px</label>
                  <input
                    type="range" min="12" max="32" step="1"
                    className="w-full accent-[#deff9a]"
                    value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold ml-1">Line Height: {lineHeight}</label>
                  <input
                    type="range" min="1.2" max="3" step="0.1"
                    className="w-full accent-[#deff9a]"
                    value={lineHeight} onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                  />
                </div>
              </div>

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

              {/* Glossary Manager */}
              <div className="space-y-3">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Glossary (Dictionary)</label>
                  <button
                    onClick={() => setGlossary([...glossary, { src: '', dest: '' }])}
                    className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-1 rounded-md hover:bg-blue-500/20 transition-all"
                  >
                    + Add Term
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {glossary.map((g, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50/50 dark:bg-white/5 p-2 rounded-xl">
                      <div className="flex gap-2 w-full items-center">
                        <input
                          placeholder="Original"
                          className="flex-1 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg p-2 text-[11px] outline-none"
                          value={g.src} onChange={(e) => {
                            const newG = [...glossary]; newG[idx].src = e.target.value; setGlossary(newG);
                          }}
                        />
                        <span className="text-gray-400 hidden sm:inline">→</span>
                        <input
                          placeholder="Thai"
                          className="flex-1 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg p-2 text-[11px] outline-none"
                          value={g.dest} onChange={(e) => {
                            const newG = [...glossary]; newG[idx].dest = e.target.value; setGlossary(newG);
                          }}
                        />
                        <button
                          onClick={() => setGlossary(glossary.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-500 p-1"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                  {glossary.length === 0 && <p className="text-[10px] text-gray-500 italic text-center py-2">No terms added yet</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Input Section (Main Bar) */}
          <div className="p-2 sm:p-3 flex items-center gap-2 sm:gap-3">
            <input
              type="text"
              placeholder="Paste novel link here..."
              className="flex-1 min-w-0 bg-transparent px-3 sm:px-5 py-3 text-sm outline-none placeholder:text-gray-400 font-medium"
              value={url} onChange={(e) => setUrl(e.target.value)}
              onFocus={() => setIsConfigOpen(false)}
            />

            <button
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className={`p-3 sm:p-3.5 rounded-full transition-all active:scale-95 flex-shrink-0 ${isConfigOpen ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg' : 'bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            </button>

            <button
              onClick={handleTranslate}
              disabled={loading}
              className="bg-black dark:bg-[#deff9a] text-white dark:text-black font-black px-4 sm:px-8 py-3.5 rounded-[1.8rem] text-[10px] sm:text-xs tracking-wider sm:tracking-widest hover:shadow-xl active:scale-95 transition-all disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
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