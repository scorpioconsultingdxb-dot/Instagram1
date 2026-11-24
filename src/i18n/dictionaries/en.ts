import type { Dictionary } from '../types';

export const en: Dictionary = {
  brand: {
    name: 'Viewora',
    tagline: 'Explore More. Discover More.',
  },
  nav: {
    home: 'Home',
    tools: 'Free Tools',
    pricing: 'Pricing',
    dashboard: 'Dashboard',
    admin: 'Admin',
    signIn: 'Sign in',
    getStarted: 'Create account',
    language: 'Language',
    theme: 'Theme',
  },
  provenance: {
    live: 'Live Data',
    cached: 'Cached Snapshot',
    estimate: 'Estimate',
    demo: 'Demo Data',
    liveHint: 'Retrieved directly from an authorized live API.',
    cachedHint: 'Served from a licensed or permitted cached dataset.',
    estimateHint: 'Calculated using transparent public formulas and benchmarks.',
    demoHint: 'Labeled sample fixture for interface preview — not live Instagram data.',
  },
  trust: {
    publicOnlyTitle: 'Public & Authorized Data Only',
    publicOnlyBody:
      'Viewora never claims access to private Instagram accounts and never presents demo or estimated figures as live metrics.',
    demoPricingNotice:
      'Subscription prices are shown for demonstration purposes only. Live payments are currently disabled.',
    noPrivateAccess: 'Private Instagram accounts are never accessed or bypassed.',
  },
  home: {
    badge: 'Privacy-First Social Intelligence Platform',
    heroTitle: 'Explore More. Discover More.',
    heroSubtitle:
      'Explore publicly available Instagram content, discover profile insights and understand social media performance — without signing into Instagram.',
    searchPlaceholder: 'Enter @username or instagram.com/username',
    searchButton: 'Explore Profile',
    tryDemoLabel: 'Preview labeled demo profiles:',
    firstSearchNote:
      'First supported search requires no registration. Data source and freshness are always disclosed.',
    segmentsTitle: 'Designed for every workflow',
    segmentsSubtitle:
      'Whether you need quick public lookups, competitive benchmarks, or multi-client agency reporting.',
    personalTitle: 'Personal Users',
    personalDesc:
      'Clean public profile lookups, clear privacy boundaries, quick engagement checks, and easy-to-read summaries.',
    businessTitle: 'Business Teams',
    businessDesc:
      'Competitor benchmarking, content performance analysis, historical public trends, and structured AI recommendations.',
    agencyTitle: 'Marketing Agencies',
    agencyDesc:
      'Multiple client workspaces, team role access, advanced filtering, and client-ready CSV & PDF exports.',
    foundationStatusTitle: 'Modular Data Provider Layer Active',
    foundationStatusBody:
      'Supports Official Meta APIs, Authorized Connected-Account Insights, Licensed Providers, Permitted Public Datasets, and Labeled Demo Fixtures.',
  },
  footer: {
    description:
      'Viewora is a transparent Instagram analytics platform built for personal creators, businesses, and marketing agencies.',
    transparencyNote:
      'Not affiliated with Instagram or Meta. Viewora only surfaces legitimately available public data, authorized insights, or clearly labeled demos.',
    toolsHeading: 'Free Tools',
    productHeading: 'Platform',
    legalHeading: 'Trust & Policies',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    dataTransparency: 'Data Transparency',
    copyright: '© 2026 Viewora. All rights reserved.',
  },
};
