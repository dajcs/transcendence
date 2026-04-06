import Link from "next/link";

export const metadata = { title: "Terms of Service — Vox Populi" };

export default function TermsPage() {
  return (
    <article className="prose prose-sm max-w-3xl mx-auto dark:prose-invert">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Terms of Service</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">Last updated: April 2026</p>

      <section className="mt-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">1. Acceptable Use</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">By using Vox Populi, you agree to:</p>
          <ul className="mt-2 list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
            <li>Use the platform for its intended purpose: participating in reputation-based prediction markets.</li>
            <li>Not use automated tools, bots, or scripts to interact with the platform.</li>
            <li>Not attempt to circumvent platform mechanisms or exploit vulnerabilities.</li>
            <li>Not impersonate other users or create multiple accounts to manipulate outcomes.</li>
            <li>Respect other users in discussions and comments.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">2. Virtual Points</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">
            Vox Populi uses virtual points (Karma Points, Betting Points, Truth Points) that have
            <strong> no monetary value</strong>. Points cannot be purchased, sold, transferred outside
            the platform, or exchanged for real money or goods. We reserve the right to adjust point
            balances to maintain platform integrity.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">3. Market Content Rules</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">Markets must not:</p>
          <ul className="mt-2 list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
            <li>Involve illegal activities or encourage harm to individuals or groups.</li>
            <li>Contain personally identifiable information about private individuals without consent.</li>
            <li>Constitute harassment, hate speech, or discrimination.</li>
            <li>Relate to events where the outcome could be influenced by participants (insider trading).</li>
          </ul>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            We reserve the right to remove markets that violate these rules and suspend accounts of repeat offenders.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">4. Account Suspension and Deletion</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">
            We may suspend or terminate accounts that violate these terms. You may delete your account
            at any time from the Settings page. Upon deletion, your personal data is pseudonymized as
            described in our <Link href="/privacy" className="text-blue-600 hover:underline dark:text-blue-400">Privacy Policy</Link>.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">5. AI Features</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">
            Vox Populi uses AI/LLM services to generate market summaries and resolution suggestions.
            These are provided as informational aids only. AI outputs do not constitute financial,
            legal, or professional advice. You may opt out of AI features in your Settings.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">6. Disclaimer</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">
            Vox Populi is provided &ldquo;as is&rdquo; without warranties of any kind. We do not
            guarantee the accuracy of market resolutions, AI-generated content, or user-submitted
            information. This platform does not provide financial advice. Participation in prediction
            markets on this platform is for entertainment and educational purposes only.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">7. Limitation of Liability</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">
            To the maximum extent permitted by law, Vox Populi and its contributors shall not be liable
            for any indirect, incidental, or consequential damages arising from your use of the platform.
            As all points are virtual and have no monetary value, no financial damages can arise from
            platform use.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">8. Changes to These Terms</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">
            We may update these terms from time to time. Continued use of the platform after changes
            constitutes acceptance of the updated terms. Significant changes will be communicated
            via platform notifications.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">9. Governing Law</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">
            These terms are governed by French law. Any disputes shall be subject to the exclusive
            jurisdiction of the courts of Paris, France.
          </p>
        </div>
      </section>

      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/privacy" className="text-blue-600 hover:underline dark:text-blue-400">Privacy Policy</Link>
        {" · "}
        <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">Back to Home</Link>
      </div>
    </article>
  );
}
