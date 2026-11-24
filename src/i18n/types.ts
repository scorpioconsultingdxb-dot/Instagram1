export interface Dictionary {
  brand: {
    name: string;
    tagline: string;
  };
  nav: {
    home: string;
    tools: string;
    pricing: string;
    dashboard: string;
    admin: string;
    signIn: string;
    getStarted: string;
    language: string;
    theme: string;
  };
  provenance: {
    live: string;
    cached: string;
    estimate: string;
    demo: string;
    liveHint: string;
    cachedHint: string;
    estimateHint: string;
    demoHint: string;
  };
  trust: {
    publicOnlyTitle: string;
    publicOnlyBody: string;
    demoPricingNotice: string;
    noPrivateAccess: string;
  };
  home: {
    badge: string;
    heroTitle: string;
    heroSubtitle: string;
    searchPlaceholder: string;
    searchButton: string;
    tryDemoLabel: string;
    firstSearchNote: string;
    segmentsTitle: string;
    segmentsSubtitle: string;
    personalTitle: string;
    personalDesc: string;
    businessTitle: string;
    businessDesc: string;
    agencyTitle: string;
    agencyDesc: string;
    foundationStatusTitle: string;
    foundationStatusBody: string;
  };
  footer: {
    description: string;
    transparencyNote: string;
    toolsHeading: string;
    productHeading: string;
    legalHeading: string;
    privacyPolicy: string;
    termsOfService: string;
    dataTransparency: string;
    copyright: string;
  };
}
