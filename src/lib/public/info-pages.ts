export type InfoPageSlug =
  | 'about'
  | 'contact'
  | 'faq'
  | 'blog'
  | 'resources'
  | 'glossary'
  | 'privacy'
  | 'terms'
  | 'cookies'
  | 'data-transparency'
  | 'responsible-use';

export interface InfoPageDefinition {
  slug: InfoPageSlug;
  title: string;
  description: string;
  badge: string;
  isLegalDraft?: boolean;
  sections: Array<{ heading: string; body: string }>;
}

export const PUBLIC_INFO_PAGES: Record<InfoPageSlug, InfoPageDefinition> = {
  about: {
    slug: 'about',
    title: 'About Viewora',
    description:
      'Learn how Viewora builds privacy-first Instagram intelligence with transparent data sourcing and honest analytics.',
    badge: 'Company',
    sections: [
      {
        heading: 'Our Mission — Explore More. Discover More.',
        body: 'Viewora is built to replace opaque, fragile social media utilities with a fast, transparent, privacy-first analytics platform for personal users, growing brands, and marketing agencies.',
      },
      {
        heading: 'What Sets Viewora Apart',
        body: 'Every data point in Viewora carries explicit provenance (LIVE, CACHED, ESTIMATED, DEMO, or UNAVAILABLE). We never invent missing numbers, never request Instagram passwords, and never access private accounts.',
      },
    ],
  },
  contact: {
    slug: 'contact',
    title: 'Contact Viewora',
    description:
      'Reach the Viewora team for customer support, agency onboarding, privacy requests, or licensed data partnerships.',
    badge: 'Support & Partnerships',
    sections: [
      {
        heading: 'Direct Support & Privacy Inquiries',
        body: 'Use the validated form below to reach our team. Please never include Instagram passwords or sensitive credentials in support messages.',
      },
    ],
  },
  faq: {
    slug: 'faq',
    title: 'Frequently Asked Questions',
    description:
      'Clear answers about Viewora’s public data sources, privacy boundaries, free tools, and subscription tiers.',
    badge: 'Help Center',
    sections: [
      {
        heading: 'Does Viewora require my Instagram password?',
        body: 'Never. Free calculators and public lookups require zero Instagram credentials. Connecting an Instagram Business or Creator account uses official Meta OAuth.',
      },
      {
        heading: 'Can Viewora access private Instagram accounts?',
        body: 'No. Viewora strictly respects Instagram privacy settings and refuses access to private profiles.',
      },
      {
        heading: 'Are subscription payments active right now?',
        body: 'No. Pricing plans and billing discounts are currently displayed for demonstration while live Stripe integration remains disabled pending authorization.',
      },
      {
        heading: 'How does Viewora label demo vs. live information?',
        body: 'Every profile card, chart, and export displays a provenance badge (LIVE, CACHED, ESTIMATED, DEMO, or UNAVAILABLE) alongside source and timestamp metadata.',
      },
    ],
  },
  blog: {
    slug: 'blog',
    title: 'Viewora Social Intelligence Guides',
    description:
      'Original guides on Instagram engagement benchmarks, public profile analytics, creator vetting, and social media privacy.',
    badge: 'Educational Resources',
    sections: [
      {
        heading: '1. Understanding Engagement Rate by Reach vs. Followers',
        body: 'Engagement Rate by Followers (ERF) enables apples-to-apples public benchmarking across accounts, while Engagement Rate by Reach (ERR) reveals true creative resonance among viewers who actually saw a post. Tracking save rate (>=2%) and share rate (>=1%) exposes distribution quality faster than likes alone.',
      },
      {
        heading: '2. How Official Meta Business Discovery Works (and Its Limits)',
        body: 'Meta’s Instagram Graph API Business Discovery endpoint lets authorized business apps query public metadata for public Business and Creator accounts. Personal accounts and third-party Stories are intentionally excluded by Meta to protect user privacy.',
      },
      {
        heading: '3. Evaluating Creators Beyond Vanity Follower Counts',
        body: 'Before sponsoring an influencer, compare creator tier benchmarks (Nano through Mega), publishing consistency, comment-to-like ratios, and rolling 90-day audience velocity rather than relying on total followers alone.',
      },
      {
        heading: '4. Privacy-First Analytics: Why Provenance Matters',
        body: 'Trustworthy analytics platforms clearly separate live API measurements, cached licensed snapshots, mathematical estimates, and demo fixtures so teams never make budget decisions on fabricated numbers.',
      },
    ],
  },
  resources: {
    slug: 'resources',
    title: 'Viewora Resource Center',
    description:
      'Actionable playbooks, deterministic calculation guides, and workflow templates for personal creators, brand teams, and marketing agencies.',
    badge: 'Resource Center',
    sections: [
      {
        heading: 'Creator & Personal Research Playbook',
        body: 'Combine the Engagement Rate Calculator, Bio Readiness Analyzer, and Hashtag Mix Planner to establish a repeatable monthly baseline without sharing Instagram passwords or relying on speculative metrics.',
      },
      {
        heading: 'Brand Competitor Benchmarking Workflow',
        body: 'Save eligible public competitor profiles into dedicated research folders, attach private strategic notes (strictly isolated via PostgreSQL Row-Level Security), and compare engagement deltas side-by-side inside Competitor Comparison Studio with RFC-4180 CSV export.',
      },
      {
        heading: 'Agency Multi-Client Reporting Standards',
        body: 'Separate each client into its own workspace, stamp every PDF/CSV brief with explicit data provenance (LIVE, CACHED, ESTIMATED, or DEMO), and document metric methodology alongside recommendations.',
      },
    ],
  },
  glossary: {
    slug: 'glossary',
    title: 'Social Intelligence & Provenance Glossary',
    description:
      'Standardized definitions of Instagram analytics metrics, engagement formulas, creator tiers, and Viewora data provenance badges.',
    badge: 'Analytics Glossary',
    sections: [
      {
        heading: 'Engagement Rate by Followers (ERF)',
        body: 'Calculated as ((Average Likes + Average Comments + Optional Saves/Shares) / Total Followers) × 100. Useful for apples-to-apples benchmarking across public accounts when private impression counts are unavailable.',
      },
      {
        heading: 'Engagement Rate by Reach (ERR)',
        body: 'Calculated as (Total Interactions / Unique Reach) × 100. Requires first-party connected insights via official Meta OAuth and reflects how strongly content resonates with people who actually saw it.',
      },
      {
        heading: 'Posting Cadence & Follower Velocity',
        body: 'Posting Cadence tracks average weekly publishing frequency across recent posts. Follower Velocity measures net follower change over a rolling window (e.g., 30-day growth rate and annualized trajectory).',
      },
      {
        heading: 'Creator Tier Classification',
        body: 'Standard industry segmentation: Nano (1K–10K), Micro (10K–50K), Mid-Tier (50K–250K), Macro (250K–1M), and Mega (1M+ followers). Smaller tiers typically exhibit higher ERF benchmarks.',
      },
      {
        heading: 'Data Provenance Badges (LIVE / CACHED / ESTIMATED / DEMO / UNAVAILABLE)',
        body: 'Viewora’s transparency standard guaranteeing that live authorized API responses, cached licensed snapshots, mathematical formulas, isolated demo fixtures, and unavailable states are never mixed or disguised.',
      },
    ],
  },
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy (Draft)',
    description:
      'Viewora’s draft privacy policy covering data minimization, GDPR, LGPD, and UAE PDPL considerations.',
    badge: 'Legal Draft',
    isLegalDraft: true,
    sections: [
      {
        heading: 'Data Minimization & Account Privacy',
        body: 'Viewora collects only the minimum account information required to authenticate users, enforce workspace entitlements, and deliver opted-in notifications. Searched usernames and private research notes are excluded from third-party product analytics.',
      },
      {
        heading: 'Regional Data Rights (GDPR, LGPD & UAE PDPL)',
        body: 'Users in the European Economic Area (GDPR), Brazil (LGPD), and the United Arab Emirates (UAE Federal Decree-Law No. 45 of 2021 — PDPL) can exercise access, portability, correction, consent withdrawal, and deletion directly from Account Settings via personal data export and account deletion workflows.',
      },
    ],
  },
  terms: {
    slug: 'terms',
    title: 'Terms of Service (Draft)',
    description:
      'Draft terms governing lawful use of Viewora’s public analytics tools, dashboards, and future subscriptions.',
    badge: 'Legal Draft',
    isLegalDraft: true,
    sections: [
      {
        heading: 'Permitted Commercial & Personal Use',
        body: 'Viewora may be used exclusively for legitimate public analytics, authorized first-party account insights, creator research, and competitive benchmarking. Harassment, stalking, or attempting to bypass platform access controls is strictly prohibited.',
      },
      {
        heading: 'Subscription & Demo Pricing Disclosure',
        body: 'Displayed subscription tiers represent proposed commercial pricing for demonstration. No charges occur while payments remain disabled.',
      },
    ],
  },
  cookies: {
    slug: 'cookies',
    title: 'Cookie Policy (Draft)',
    description:
      'How Viewora uses essential security cookies and optional consent-gated product analytics.',
    badge: 'Legal Draft',
    isLegalDraft: true,
    sections: [
      {
        heading: 'Essential Cookies',
        body: 'Used strictly for secure HttpOnly authentication sessions, locale persistence (`viewora_locale`), and free visitor rate limiting.',
      },
      {
        heading: 'Optional Analytics Cookies',
        body: 'Disabled until you opt in via the consent banner. Viewora never transmits searched Instagram usernames, private notes, or report bodies to analytics providers.',
      },
    ],
  },
  'data-transparency': {
    slug: 'data-transparency',
    title: 'Data Transparency & Provenance Standards',
    description:
      'How Viewora sources, caches, labels, and limits Instagram data across its modular provider architecture.',
    badge: 'Trust Center',
    sections: [
      {
        heading: 'Five Explicit Provenance States',
        body: 'Every result is tagged LIVE (official authorized API), CACHED (licensed/permitted snapshot), ESTIMATED (deterministic formula), DEMO (isolated preview fixture), or UNAVAILABLE (honest empty state when no provider covers the request).',
      },
      {
        heading: 'Supported Provider Channels Only',
        body: 'Viewora integrates Official Meta Graph APIs, Authorized Connected-Account OAuth insights, vetted Licensed Data Providers, User-Provided Data calculators, and clearly labeled Demo fixtures. Prohibited scraping and private-account bypasses are never implemented.',
      },
    ],
  },
  'responsible-use': {
    slug: 'responsible-use',
    title: 'Responsible Use Policy',
    description:
      'Viewora’s safeguards preventing harassment, invasive personal surveillance, and unauthorized access.',
    badge: 'Safety & Ethics',
    sections: [
      {
        heading: 'Zero Tolerance for Surveillance or Harassment',
        body: 'Viewora does not reconstruct private user interactions, hidden relationship graphs, or private account content. Automated monitoring is restricted strictly to authorized professional accounts and legitimate public creator/business analytics.',
      },
    ],
  },
};

export function getAllInfoPageSlugs(): InfoPageSlug[] {
  return Object.keys(PUBLIC_INFO_PAGES) as InfoPageSlug[];
}

export function getInfoPageBySlug(slug: string): InfoPageDefinition | undefined {
  return PUBLIC_INFO_PAGES[slug as InfoPageSlug];
}
