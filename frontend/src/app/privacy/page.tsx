import Link from "next/link";

export const metadata = { title: "Privacy Policy — Vox Populi" };

export default function PrivacyPage() {
  return (
    <article className="prose prose-sm max-w-3xl mx-auto dark:prose-invert">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Privacy Policy</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">Last updated: April 2026</p>

      <section className="mt-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">1. What Data We Collect</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">
            Vox Populi collects only the data necessary to operate the platform:
          </p>
          <ul className="mt-2 list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
            <li><strong>Account data:</strong> email address, username, and password hash — required to create and secure your account.</li>
            <li><strong>OAuth data:</strong> provider user ID and encrypted tokens if you sign in via Google, GitHub, or 42.</li>
            <li><strong>Activity data:</strong> bets placed, votes, and comments — required for platform operation.</li>
            <li><strong>Point ledger:</strong> Karma (KP), Betting Points (BP), and Truth Points (TP) transactions.</li>
            <li><strong>Session data:</strong> authentication tokens stored in secure, HTTP-only cookies.</li>
            <li><strong>Server logs:</strong> IP address and user agent, retained for 90 days for security purposes.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">2. How We Use Your Data</h2>
          <ul className="mt-2 list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
            <li>To provide and maintain the prediction market platform.</li>
            <li>To authenticate your identity and protect your account.</li>
            <li>To calculate and display reputation scores.</li>
            <li>To generate AI-powered market summaries (using anonymized excerpts, if you have not opted out).</li>
            <li>To send notifications about your bets and market activity.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">3. Third-Party Data Sharing</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">We share limited data with the following services:</p>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200 dark:border-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Service</th>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Data Shared</th>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700 text-gray-700 dark:text-gray-300">
                <tr><td className="px-4 py-2">Google OAuth</td><td className="px-4 py-2">Email, name</td><td className="px-4 py-2">Authentication</td></tr>
                <tr><td className="px-4 py-2">GitHub OAuth</td><td className="px-4 py-2">Email, username</td><td className="px-4 py-2">Authentication</td></tr>
                <tr><td className="px-4 py-2">42 School OAuth</td><td className="px-4 py-2">Email, login</td><td className="px-4 py-2">Authentication</td></tr>
                <tr><td className="px-4 py-2">OpenRouter (LLM)</td><td className="px-4 py-2">Anonymized comment excerpts</td><td className="px-4 py-2">Market summarization</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            We never share passwords, point balances, full discussion threads, or IP addresses with third parties.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">4. Data Retention</h2>
          <ul className="mt-2 list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
            <li><strong>Account data:</strong> retained until account deletion, plus 30 days.</li>
            <li><strong>Activity data:</strong> 3 years after your last activity.</li>
            <li><strong>Point ledger:</strong> 5 years (financial record-keeping).</li>
            <li><strong>Session data:</strong> access tokens expire in 15 minutes; refresh tokens in 7 days.</li>
            <li><strong>Server logs:</strong> automatically deleted after 90 days.</li>
            <li><strong>LLM inputs:</strong> processed transiently and never stored.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">5. Your Rights (GDPR)</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">Under the GDPR, you have the right to:</p>
          <ul className="mt-2 list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
            <li><strong>Access:</strong> export all your data from the Settings page.</li>
            <li><strong>Erasure:</strong> delete your account, which pseudonymizes your data to preserve platform integrity.</li>
            <li><strong>Rectification:</strong> update your username, email, and profile information.</li>
            <li><strong>Portability:</strong> download your data in JSON format.</li>
            <li><strong>Object:</strong> opt out of AI/LLM features in Settings.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">6. Cookies</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">
            Vox Populi uses only essential cookies:
          </p>
          <ul className="mt-2 list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
            <li><strong>refresh_token:</strong> HTTP-only, Secure, SameSite=Strict — 7 days — maintains your session.</li>
            <li><strong>access_token:</strong> HTTP-only, Secure, SameSite=Lax — 5 hours — authenticates API requests.</li>
          </ul>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            We do not use tracking cookies, analytics cookies, or third-party cookies.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">7. Contact</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">
            For privacy-related questions or to exercise your rights, please open an issue on our{" "}
            <a href="https://github.com/dajcs/transcendence" className="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noopener noreferrer">
              GitHub repository
            </a>.
          </p>
        </div>
      </section>

      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/terms" className="text-blue-600 hover:underline dark:text-blue-400">Terms of Service</Link>
        {" · "}
        <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">Back to Home</Link>
      </div>
    </article>
  );
}
