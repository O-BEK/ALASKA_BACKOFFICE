"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, MessageCircle, Send, X } from "lucide-react"
import { ChatMessage } from "./ChatMessage"

type Message = { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "Où en est-on par rapport à l'objectif ?",
  "Quel est mon food cost ce mois ?",
  "Quels sont mes jours les plus forts ?",
]

export function ChatBubble({ month }: { month?: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const send = async (text?: string) => {
    const messageText = text ?? input
    if (!messageText.trim() || loading) return

    const userMessage: Message = { role: "user", content: messageText }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          month: month ?? new Date().toISOString().slice(0, 7),
        }),
      })
      const data = await res.json()
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: data.reply ?? data.error ?? "Erreur inattendue." },
      ])
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Désolé, une erreur est survenue." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-alaska-sage rounded-full shadow-lg flex items-center justify-center text-white hover:bg-alaska-sage/90 transition-all"
        aria-label="Ouvrir l'assistant IA"
      >
        <MessageCircle size={24} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/30 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed bottom-0 right-0 z-50 w-full md:w-96 md:bottom-6 md:right-6 h-[85vh] md:h-[600px] bg-white md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-alaska-sage rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageCircle size={16} className="text-white" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-alaska-dark">Assistant Alaska</p>
                  <p className="text-xs text-alaska-muted">Posez vos questions financières</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition"
                aria-label="Fermer l'assistant"
              >
                <X size={18} className="text-alaska-muted" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-6 space-y-3">
                  <p className="text-sm font-medium text-alaska-dark">Bonjour ! Comment puis-je vous aider ?</p>
                  <div className="space-y-2">
                    {SUGGESTIONS.map(q => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="block w-full text-left px-3 py-2 bg-alaska-cream rounded-lg text-xs text-alaska-dark hover:bg-alaska-sage/10 transition"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <ChatMessage key={i} role={m.role} content={m.content} />
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-alaska-muted pl-1">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  En train de réfléchir...
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-gray-100 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="Posez une question..."
                  className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-alaska-sage"
                  aria-label="Message à l'assistant"
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || loading}
                  className="p-2 bg-alaska-sage rounded-lg text-white disabled:opacity-40 hover:bg-alaska-sage/90 transition"
                  aria-label="Envoyer"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
