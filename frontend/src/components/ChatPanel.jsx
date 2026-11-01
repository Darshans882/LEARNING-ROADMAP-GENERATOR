import { useCallback, useEffect, useRef, useState } from 'react'
import { useAssistant } from '../context/AssistantContext'
import { useAuth } from '../context/AuthContext'
import api, { errorMessage, relativeTime } from '../api/client'
import { Badge, Button, Spinner, StatusBadge } from './ui'
import Markdown from './Markdown'
import {
  Bot, CheckCircle2, ExternalLink, History, MessageSquarePlus, Send, Sparkles, Trash2, User, X, ShieldAlert,
} from 'lucide-react'
import toast from 'react-hot-toast'

const WELCOME_SUGGESTIONS = [
  'What should I study next?',
  'Explain my biggest skill gap',
  'Plan my week',
  'How ready am I for my target role?',
]

function SourceList({ sources = [] }) {
  if (!sources.length) return null
  return (
    <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sources from your catalogue</p>
      {sources.map((source, index) => (
        <a
          key={`${source.url}-${index}`}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex items-start gap-1.5 text-xs text-brand-600 hover:text-brand-800"
        >
          {source.verified ? (
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
          ) : (
            <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
          )}
          <span className="flex-1 underline decoration-brand-200 underline-offset-2">{source.title}</span>
          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
        </a>
      ))}
    </div>
  )
}

function Bubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-slate-200 text-slate-600' : 'bg-brand-600 text-white'
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </span>
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm ${
            isUser
              ? 'rounded-tr-sm bg-brand-600 text-white'
              : 'rounded-tl-sm border border-slate-200 bg-white text-slate-700 shadow-sm'
          }`}
        >
          {isUser ? <p className="whitespace-pre-wrap">{message.content}</p> : <Markdown>{message.content}</Markdown>}
          {!isUser ? <SourceList sources={message.sources} /> : null}
        </div>
        {message.created_at ? (
          <p className={`mt-1 text-[10px] text-slate-400 ${isUser ? 'text-right' : ''}`}>
            {relativeTime(message.created_at)}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default function ChatPanel({ full = false, onClose, conversationId: externalConversationId = null }) {
  const { user } = useAuth()
  const { selectedNode, setSelectedNode } = useAssistant()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState(externalConversationId)
  const [suggestions, setSuggestions] = useState(WELCOME_SUGGESTIONS)
  const [conversations, setConversations] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const scrollRef = useRef(null)

  const loadConversations = useCallback(async () => {
    if (!full) return
    setLoadingHistory(true)
    try {
      const { data } = await api.get('/chat/conversations')
      setConversations(data)
    } catch {
      /* history is non-critical */
    } finally {
      setLoadingHistory(false)
    }
  }, [full])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    setConversationId(externalConversationId)
    if (!externalConversationId) {
      setMessages([])
      setSuggestions(WELCOME_SUGGESTIONS)
      return
    }
    let cancelled = false
    async function load() {
      try {
        const { data } = await api.get(`/chat/conversations/${externalConversationId}`)
        if (!cancelled) {
          setMessages(data.messages || [])
          setSuggestions(WELCOME_SUGGESTIONS)
        }
      } catch (error) {
        toast.error(errorMessage(error))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [externalConversationId])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, sending])

  async function send(text) {
    const message = (text ?? input).trim()
    if (!message || sending) return
    setInput('')
    const optimistic = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    }
    setMessages((current) => [...current, optimistic])
    setSending(true)
    try {
      const { data } = await api.post('/chat', {
        message,
        conversation_id: conversationId || null,
        node_key: selectedNode?.node_key || null,
      })
      setConversationId(data.conversation_id)
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          sources: data.sources || [],
          created_at: new Date().toISOString(),
        },
      ])
      setSuggestions(data.suggested_prompts?.length ? data.suggested_prompts : WELCOME_SUGGESTIONS)
      if (full) loadConversations()
    } catch (error) {
      toast.error(errorMessage(error, 'The assistant could not answer right now.'))
      setMessages((current) => current.filter((m) => m.id !== optimistic.id))
    } finally {
      setSending(false)
    }
  }

  function reset() {
    setMessages([])
    setConversationId(null)
    setSuggestions(WELCOME_SUGGESTIONS)
    if (onClose && !full) onClose()
  }

  async function deleteConversation(id) {
    try {
      await api.delete(`/chat/conversations/${id}`)
      setConversations((current) => current.filter((c) => c.id !== id))
      if (id === conversationId) reset()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const historyPanel = full ? (
    <div className="flex w-full flex-col border-slate-200 bg-slate-50/80 lg:w-72 lg:border-r">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <History className="h-4 w-4" /> Conversations
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-brand-600"
          title="New chat"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto p-2 lg:max-h-none lg:flex-1">
        {loadingHistory ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : conversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-slate-400">No conversations yet.</p>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`group mb-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs ${
                conversationId === conversation.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() => setConversationId(conversation.id)}
                className="flex-1 truncate text-left"
                title={conversation.title}
              >
                {conversation.title}
                <span className="ml-1 text-[10px] text-slate-400">({conversation.message_count})</span>
              </button>
              <button
                type="button"
                onClick={() => deleteConversation(conversation.id)}
                className="hidden text-slate-400 hover:text-rose-600 group-hover:block"
                aria-label="Delete conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  ) : null

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden bg-slate-50 ${full ? 'h-full rounded-2xl border border-slate-200 bg-white lg:flex-row' : 'h-full rounded-2xl border border-slate-200 bg-white shadow-2xl'}`}>
      <div className={full ? 'flex min-h-0 flex-1 flex-col lg:flex-row' : 'flex min-h-0 flex-1 flex-col'}>
        {historyPanel}
        <div className="flex min-h-0 flex-1 flex-col bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
                <Bot className="h-5 w-5" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">SmartLearn Assistant</p>
                <p className="text-[11px] text-slate-500">
                  Grounded in your profile, roadmap and catalogue
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                title="New chat"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </button>
              {!full && onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close assistant"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {selectedNode ? (
            <div className="flex items-center gap-2 border-b border-brand-100 bg-brand-50/70 px-4 py-2 text-xs text-brand-700">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="flex-1 truncate">
                Focused on: <strong>{selectedNode.title || selectedNode.node_key}</strong>
              </span>
              <button type="button" onClick={() => setSelectedNode(null)} className="text-brand-500 hover:text-brand-800">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          <div ref={scrollRef} className={`flex-1 space-y-4 overflow-y-auto px-4 py-4 ${full ? 'min-h-[360px]' : ''}`}>
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <Sparkles className="h-7 w-7" />
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Hi {user?.full_name?.split(' ')[0] || 'there'} 👋
                </h3>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Ask about your next step, a skill gap, a course, a project or how to plan your week.
                  I only use your stored data and the verified catalogue.
                </p>
                <div className="mt-5 grid w-full max-w-md gap-2 sm:grid-cols-2">
                  {WELCOME_SUGGESTIONS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => send(prompt)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => <Bubble key={message.id} message={message} />)
            )}
            {sending ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Bot className="h-4 w-4" />
                </span>
                <span className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-3 py-2">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400" />
                </span>
              </div>
            ) : null}
          </div>

          {messages.length > 0 && suggestions.length ? (
            <div className="flex gap-1.5 overflow-x-auto border-t border-slate-100 px-4 py-2">
              {suggestions.slice(0, 4).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => send(prompt)}
                  className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 hover:border-brand-200 hover:text-brand-700"
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault()
              send()
            }}
            className="border-t border-slate-100 p-3"
          >
            <div className="flex items-end gap-2 rounded-xl border border-slate-300 px-3 py-2 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    send()
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder="Ask about your roadmap, skills, courses…"
                className="max-h-28 min-h-[24px] flex-1 resize-none border-0 bg-transparent py-1 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
              >
                {sending ? <Spinner className="h-4 w-4 text-white" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-400">
              Never invents links, prices or progress. Always verify course details on the provider page.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
