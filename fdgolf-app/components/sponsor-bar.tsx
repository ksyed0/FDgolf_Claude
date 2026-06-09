const CIBC_SLUGS = new Set(['cibc-granite-ridge-2026'])

interface SponsorBarProps {
  slug: string
}

export function SponsorBar({ slug }: SponsorBarProps) {
  if (!CIBC_SLUGS.has(slug)) return null

  return (
    <div className="flex items-center justify-center gap-6 py-4 px-6 bg-[#0e2818]" data-testid="sponsor-bar">
      {/* First Derivative */}
      <img
        src="/sponsors/firstderivative.svg"
        alt="First Derivative"
        width={160}
        height={48}
        className="h-12 w-auto"
      />
      {/* AI/RUN */}
      <img
        src="/sponsors/airun.svg"
        alt="AI / RUN"
        width={112}
        height={48}
        className="h-12 w-auto"
      />
    </div>
  )
}
