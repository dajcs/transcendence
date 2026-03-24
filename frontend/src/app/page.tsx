import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
      <h1 className="text-4xl font-bold text-gray-900">Vox Populi</h1>
      <p className="text-xl text-gray-600 max-w-lg">
        Bet on real-world outcomes, argue your position, and earn a verifiable reputation score
        — without real money.
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
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
        >
          Log In
        </Link>
      </div>
    </div>
  );
}
