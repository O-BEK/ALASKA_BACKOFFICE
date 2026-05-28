export function ChatMessage({ role, content }: { role: "user" | "assistant"; content: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-alaska-sage text-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-alaska-dark whitespace-pre-wrap">
        {content}
      </div>
    </div>
  )
}
