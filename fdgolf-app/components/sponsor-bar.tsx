export interface SponsorLogo {
  name: string
  slug: string
  url: string
}

interface SponsorBarProps {
  sponsorLogos: SponsorLogo[] | null
}

export function SponsorBar({ sponsorLogos }: SponsorBarProps) {
  if (!sponsorLogos?.length) return null

  return (
    <div
      className="flex items-center justify-center gap-6 py-4 px-6 bg-[#0e2818]"
      data-testid="sponsor-bar"
    >
      {sponsorLogos.map((s) => (
        <img key={s.slug} src={s.url} alt={s.name} className="h-12 w-auto" />
      ))}
    </div>
  )
}
