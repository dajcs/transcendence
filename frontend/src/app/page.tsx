import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
      <h1 className="text-4xl font-bold text-gray-900">Vox Populi</h1>
      <p className="text-xl text-gray-600 max-w-lg">
        A lightweight prediction market
        <span className="block">Reducing the distortions by money</span>
        <span className="block">Preserving truth-seeking and high-quality discussions</span>
      </p>
      <div className="flex gap-4">
        <Link
          href="/register"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Get Started
        </Link>
        <Link
          href="/login"
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-800"
        >
          Log In
        </Link>
      </div>
      <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
        <span>·</span>
        <Link href="/terms" className="hover:underline">Terms of Service</Link>
      </div>
    </div>
  );
}
