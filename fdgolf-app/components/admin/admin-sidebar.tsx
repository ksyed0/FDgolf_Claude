'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { label: 'Dashboard', href: '/admin/dashboard', group: 'operational' },
  { label: 'Tournaments', href: '/admin/tournaments', group: 'operational' },
  { label: 'Players', href: '/admin/players', group: 'operational' },
  { label: 'Teams', href: '/admin/teams', group: 'operational' },
  { label: 'Scores', href: '/admin/scores', group: 'operational' },
  { label: 'Courses', href: '/admin/venues', group: 'setup' },
  { label: 'Clubs', href: '/admin/clubs', group: 'setup' },
  { label: 'Stats', href: '/admin/stats', group: 'setup' },
] as const

export function AdminSidebar() {
  const pathname = usePathname()
  return (
    <nav className="w-52 min-h-screen bg-slate-900 text-white p-4 flex flex-col gap-1">
      <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Operational</p>
      {ITEMS.filter((i) => i.group === 'operational').map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={`rounded px-3 py-2 text-sm ${
            pathname.startsWith(item.href) ? 'bg-green-800 font-bold' : 'hover:bg-slate-800'
          }`}
        >
          {item.label}
        </Link>
      ))}
      <p className="text-xs uppercase tracking-wide text-slate-500 mt-4 mb-2">Setup</p>
      {ITEMS.filter((i) => i.group === 'setup').map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={`rounded px-3 py-2 text-sm ${
            pathname.startsWith(item.href) ? 'bg-green-800 font-bold' : 'hover:bg-slate-800'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
