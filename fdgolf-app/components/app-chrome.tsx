// AppChrome — persistent header shell rendered on every authenticated page.
// Server Component: no "use client" directive.

export function AppChrome() {
  return (
    <header
      style={{ backgroundColor: '#0e2818' }}
      className="w-full flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8"
      role="banner"
    >
      {/* Left: FDgolf brand mark */}
      <div className="flex items-center gap-2">
        <span
          className="text-xl font-bold tracking-tight leading-none"
          aria-label="FDgolf"
        >
          <span style={{ color: '#6ee7a0' }}>FD</span>
          <span className="text-white">golf</span>
        </span>
      </div>

      {/* Right: AI/RUN tagline badge */}
      <div className="flex items-center gap-2">
        <span className="text-white text-xs opacity-70 hidden sm:inline">
          built with
        </span>
        <span
          className="text-xs font-semibold tracking-widest uppercase px-2 py-0.5 rounded border border-white/30 text-white"
          aria-label="AI/RUN"
        >
          AI/RUN
        </span>
      </div>
    </header>
  )
}
