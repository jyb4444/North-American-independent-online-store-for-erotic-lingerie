import Link from 'next/link';

const tiers = [
  {
    name: 'Gold',
    price: '$39',
    description: 'A personalized monthly style pick for customers who want fit-guided discovery.',
    perks: [
      'Choose one member style each month',
      'Recommendations matched to your fit profile and style history',
      'AI try-on preview support before you decide',
      'Private wishlist and saved style references',
    ],
  },
  {
    name: 'Platinum',
    price: '$69',
    description: 'More flexibility for customers who browse often and want better monthly value.',
    perks: [
      'Everything in Gold',
      '10% off your first three additional items each month',
      'Early access to new monthly edits',
      'Priority fit-guided recommendations',
    ],
  },
  {
    name: 'Diamond',
    price: '$149',
    description: 'A premium styling and wellness tier for customers who want deeper support.',
    perks: [
      'Everything in Platinum',
      'One monthly 30-minute music-guided intimacy wellness session',
      'Priority monthly styling review',
      'Best for customers who want product guidance plus emotional support',
    ],
  },
];

export default function MembershipPage() {
  return (
    <main className="bg-wine-950 text-ivory">
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-gold-400">
            Velour Membership
          </p>
          <h1 className="mt-5 font-serif text-5xl font-light leading-tight text-ivory sm:text-6xl">
            Personalized lingerie, chosen around your body and preferences.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-ivory-muted">
            Membership is designed for customers who want more than a product catalog:
            monthly style discovery, fit-guided recommendations, AI preview support,
            and optional wellness care at the highest tier.
          </p>
        </div>
      </section>

      <section className="border-y border-gold-600/20 bg-wine-900/60">
        <div className="mx-auto grid max-w-7xl gap-px px-4 py-12 sm:px-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <article key={tier.name} className="border border-gold-600/20 bg-wine-950 p-7">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <h2 className="font-serif text-3xl font-light italic text-ivory">{tier.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-ivory-muted">{tier.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-light text-gold-400">{tier.price}</p>
                  <p className="text-[11px] uppercase tracking-widest text-ivory-dim">per month</p>
                </div>
              </div>

              <ul className="mt-8 space-y-3">
                {tier.perks.map((perk) => (
                  <li key={perk} className="flex gap-3 text-sm leading-6 text-ivory-muted">
                    <span className="mt-1 text-gold-400">✦</span>
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-gold-400">
            How it works
          </p>
          <h2 className="mt-4 font-serif text-4xl font-light text-ivory">
            A private styling flow, not a discount club.
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            'Create or update your fit profile.',
            'Review a monthly edit matched to your body profile and style history.',
            'Use AI preview when you want more confidence before choosing.',
            'Diamond members can book a music-guided intimacy wellness session.',
          ].map((step, index) => (
            <div key={step} className="border border-gold-600/20 p-5">
              <p className="text-xs uppercase tracking-widest text-gold-400">Step {index + 1}</p>
              <p className="mt-3 text-sm leading-6 text-ivory-muted">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="border border-gold-600/20 p-7 sm:flex sm:items-center sm:justify-between sm:gap-8">
          <div>
            <h2 className="font-serif text-3xl font-light text-ivory">Membership launch details are coming soon.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ivory-muted">
              For now, you can create an account and save styles privately. Full billing,
              monthly selection, and wellness booking flows will be added before launch.
            </p>
          </div>
          <Link
            href="/login?mode=signup"
            className="mt-6 inline-block border border-gold-400 px-6 py-3 text-xs font-medium uppercase tracking-[0.2em] text-gold-400 transition hover:bg-gold-400 hover:text-wine-950 sm:mt-0"
          >
            Join the list
          </Link>
        </div>
      </section>
    </main>
  );
}
