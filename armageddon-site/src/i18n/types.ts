/**
 * Typed dictionary schema for the local i18n system. English
 * (`dictionaries/en.ts`) is the schema source of truth; every other locale's
 * dictionary must satisfy this exact shape (enforced by the `Dictionary`
 * type plus a key-parity unit test, since TypeScript structural typing alone
 * would not catch missing-but-optional-looking keys at the object level).
 *
 * Do not translate: brand/product names, battery ids (B01-B14), evidence
 * filenames (armageddon-report.json, armageddon-report.md, certificate.txt),
 * API paths, route paths, and security policy identifiers. Those are passed
 * through as plain strings or interpolation args, not dictionary keys.
 */

export interface CommonDictionary {
    readonly nav: {
        readonly home: string;
        readonly pricing: string;
        readonly docs: string;
        readonly privacy: string;
        readonly login: string;
        readonly signup: string;
        readonly logout: string;
        readonly loginAria: string;
        readonly signupAria: string;
        readonly logoutAria: string;
    };
    readonly languageSelector: {
        readonly label: string;
    };
    readonly footer: {
        readonly ctaHeadline: string;
        readonly ctaHeadlineHighlight: string;
        readonly ctaButtonLoggedIn: string;
        readonly ctaButtonLoggedOut: string;
        readonly tierLadder: string;
        readonly copyright: string;
        readonly deploymentIndicator: string;
        readonly poweredBy: string;
        readonly legalDisclaimer: string;
    };
    readonly pwa: {
        readonly dockLabel: string;
        readonly installButton: string;
        readonly installedButton: string;
        readonly addToHomeButton: string;
        readonly pwaReadyButton: string;
        readonly installAria: string;
        readonly installedAria: string;
        readonly iosHelpAria: string;
        readonly browserMenuAria: string;
        readonly iosHelpText: string;
        readonly unsupportedText: string;
    };
    readonly audio: {
        readonly anthemLabel: string;
        readonly playAria: string;
        readonly pauseAria: string;
        readonly muteAria: string;
        readonly unmuteAria: string;
        readonly statusLive: string;
        readonly statusPause: string;
        readonly statusStandby: string;
        readonly statusError: string;
        readonly loadError: string;
    };
}

export interface PricingDictionary {
    readonly headline: string;
    readonly subheadline: string;
    readonly safety: string;
    readonly groupBuild: string;
    readonly groupReview: string;
    readonly groupEnterprise: string;
    readonly guidanceStartHere: string;
    readonly guidanceBestForTeams: string;
    readonly guidanceReleaseGates: string;
    readonly checkoutPendingNote: string;
    readonly enterpriseLinkLabel: string;
    readonly plans: {
        readonly [planId in
            | 'self-serve'
            | 'pro'
            | 'team'
            | 'verified'
            | 'certified'
            | 'enterprise']: {
            readonly name: string;
            readonly tagline: string;
            readonly cadenceLabel: string;
            readonly features: readonly string[];
            readonly ctaLabel: string;
        };
    };
}

export interface OnboardingDictionary {
    readonly title: string;
    readonly planPrefix: string;
    readonly paymentPending: string;
    readonly fields: {
        readonly orgName: string;
        readonly contactEmail: string;
        readonly tier: string;
        readonly targetSystemName: string;
        readonly targetUrl: string;
        readonly environment: string;
    };
    readonly environmentOptions: {
        readonly local: string;
        readonly staging: string;
        readonly production: string;
    };
    readonly authorizationLabel: string;
    readonly acceptableUseLabel: string;
    readonly submit: string;
    readonly errors: {
        readonly orgName: string;
        readonly contactEmail: string;
        readonly targetSystemName: string;
        readonly targetUrl: string;
        readonly authorization: string;
        readonly acceptableUse: string;
    };
    readonly backendPending: {
        readonly title: string;
        readonly body: string;
        readonly viewPricing: string;
        readonly requestScopedRun: string;
    };
}

export interface SupportDictionary {
    readonly title: string;
    readonly statusOnline: string;
    readonly description: string;
    readonly scopeBadges: readonly string[];
    readonly systemInit: string;
    readonly greeting: string;
    readonly inputPlaceholder: string;
    readonly sendButton: string;
    readonly enterToSend: string;
    readonly processing: string;
    readonly escalation: {
        readonly modalIntro: string;
        readonly toLabel: string;
        readonly subjectLabel: string;
        readonly bodyLabel: string;
        readonly copyButton: string;
        readonly openMailButton: string;
        readonly closeButton: string;
        readonly copiedConfirm: string;
    };
}

export interface PrivacyDictionary {
    readonly title: string;
    readonly effectiveDateLine: string;
    readonly translationNotice: string;
    readonly sectionTitles: {
        readonly overview: string;
        readonly infoWeCollect: string;
        readonly howWeUse: string;
        readonly dataWeDontCollect: string;
        readonly thirdPartyServices: string;
        readonly dataRetention: string;
        readonly yourRights: string;
        readonly security: string;
        readonly cookies: string;
        readonly changes: string;
        readonly contact: string;
    };
}

export interface HomeDictionary {
    readonly batteryGrid: {
        readonly eyebrow: string;
        readonly title: string;
        readonly description: string;
        readonly statTotalBatteries: string;
        readonly statRealAdversarialEngine: string;
        readonly statEscapeThreshold: string;
        readonly statConcurrency: string;
    };
    readonly certificationSeal: {
        readonly eyebrow: string;
        readonly title: string;
        readonly description: string;
        readonly metadataLabel: string;
        readonly hoverHint: string;
        readonly artifactReportJsonDesc: string;
        readonly artifactReportMdDesc: string;
        readonly artifactCertificateDesc: string;
    };
    readonly console: {
        readonly batteryConfigLabel: string;
        readonly lockedLabel: string;
        readonly customBatterySelection: string;
        readonly requiresVerifiedTier: string;
        readonly viewPricing: string;
        readonly backendNotConnectedLabel: string;
        readonly noLiveBackendDesc: string;
        readonly configStateNotice: string;
        readonly requestAccess: string;
        readonly initiateSequence: string;
        readonly reinitiateSequence: string;
        readonly executingLabel: string;
        readonly exportJsonEvidence: string;
        readonly consoleLabel: string;
        readonly statusOnline: string;
        readonly statusStandby: string;
        readonly threatMatrixLabel: string;
        readonly secureSectorsLabel: string;
        readonly targetConfig: {
            readonly stepLabel: string;
            readonly noTargetTitle: string;
            readonly noTargetDesc: string;
            readonly setTarget: string;
            readonly targetNameLabel: string;
            readonly targetUrlLabel: string;
            readonly environmentLabel: string;
            readonly authorizationStatusLabel: string;
            readonly authorizedConfirmed: string;
            readonly authorizationRequired: string;
            readonly editTarget: string;
        };
        readonly readiness: {
            readonly title: string;
            readonly allReady: string;
            readonly blockedPrefix: string;
            readonly targetMissingReason: string;
            readonly targetInvalidReason: string;
            readonly completeItemsFirstPrefix: string;
            readonly runBlockedPrefix: string;
            readonly noRunStarted: string;
            readonly targetMissingFatal: string;
            readonly workflowStartedAgainst: string;
            readonly items: {
                readonly target: { readonly label: string; readonly detailReady: string; readonly detailNotReady: string };
                readonly authorization: { readonly label: string; readonly detailReady: string; readonly detailNotReady: string };
                readonly organization: { readonly label: string; readonly detailReady: string; readonly detailNotReady: string };
                readonly backend: { readonly label: string; readonly detailReady: string; readonly detailNotReady: string };
                readonly batteryAccess: { readonly label: string; readonly detailReady: string; readonly detailNotReady: string };
            };
        };
    };
}

export interface Dictionary {
    readonly common: CommonDictionary;
    readonly pricing: PricingDictionary;
    readonly onboarding: OnboardingDictionary;
    readonly support: SupportDictionary;
    readonly privacy: PrivacyDictionary;
    readonly home: HomeDictionary;
}
