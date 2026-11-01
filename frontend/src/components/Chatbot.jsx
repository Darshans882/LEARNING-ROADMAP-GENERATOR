import { useAssistant } from '../context/AssistantContext'
import ChatPanel from './ChatPanel'
import { Bot, X } from 'lucide-react'

export default function Chatbot() {
  const { open, setOpen } = useAssistant()

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-violet-600 text-white shadow-xl shadow-brand-600/30 transition hover:scale-105 hover:shadow-brand-600/40 focus:outline-none focus:ring-4 focus:ring-brand-500/30"
        aria-label="Open SmartLearn AI assistant"
      >
        <Bot className="h-6 w-6" />
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
        </span>
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px] sm:hidden"
        aria-label="Close assistant overlay"
      />
      <div className="fixed bottom-4 right-4 z-50 flex h-[min(78vh,42rem)] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-2xl shadow-2xl sm:bottom-5 sm:right-5">
        <ChatPanel onClose={() => setOpen(false)} />
      </div>
    </>
  )
}
