export function TypingIndicator() {
  return (
    <div
      className="flex items-center gap-1 px-4 py-3"
      role="status"
      aria-label="Assistant is typing"
    >
      <div className="flex items-center gap-1 rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-700">
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-500"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-500"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-500"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  )
}
