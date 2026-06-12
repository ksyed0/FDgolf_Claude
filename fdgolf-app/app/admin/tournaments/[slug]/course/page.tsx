import Link from 'next/link'

export default function CourseSetupRedirectPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <h1 className="text-xl font-semibold mb-4">Course setup has moved</h1>
      <p className="text-gray-600 mb-6">
        Hole editing and course configuration now live under <strong>Venues → Courses</strong>.
      </p>
      <Link
        href="/admin/venues"
        className="inline-block bg-green-800 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        Go to Venues
      </Link>
    </div>
  )
}
