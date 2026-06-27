'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useT } from '@/i18n/useT';

// ════════════════════════════════════════════════════════════════════════════
// ARMAGEDDON — SUPPORT TERMINAL
// ATLAS live chat agent with injection-hardened Cloudflare Worker backend
// ════════════════════════════════════════════════════════════════════════════

const API_URL = '/api/support-chat';
const MAX_CHARS = 2000;

const ESCALATION_KEYWORDS = [
  'billing', 'payment', 'invoice', 'refund', 'charge', 'subscription', 'plan',
  'upgrade', 'downgrade', 'cancel', 'renewal', 'stripe', 'receipt', 'past due',
  'trial', 'coupon', 'credit', 'failed payment',
  'privacy', 'gdpr', 'ccpa', 'personal data', 'delete my data', 'data request', 'data deletion',
];

const CLIENT_INJECTION_PATTERNS = [
  /ignore\s+(previous|prior|all)\s+(instructions?|rules?|prompts?)/i,
  /reveal\s+(your|the|system)\s+(prompt|instructions?)/i,
  /\bdan\b.*\bmode\b/i,
  /do\s+anything\s+now/i,
  /jailbreak/i,
  /developer\s+mode/i,
];

interface ChatMessage {
  id: string;
  role: 'agent' | 'user' | 'system' | 'error';
  text: string;
}

interface EscalationDraft {
  subject: string;
  body: string;
}

function clientGuard(text: string): boolean {
  return CLIENT_INJECTION_PATTERNS.some((re) => re.test(text));
}

function detectEscalation(text: string): string | null {
  const lower = text.toLowerCase();
  const isBilling = ['billing', 'payment', 'invoice', 'refund', 'charge', 'subscription',
    'plan', 'upgrade', 'downgrade', 'cancel', 'stripe', 'receipt', 'past due',
    'trial', 'coupon', 'credit'].some((k) => lower.includes(k));
  const isPrivacy = ['privacy', 'gdpr', 'ccpa', 'personal data', 'delete my data',
    'data request', 'data deletion'].some((k) => lower.includes(k));
  if (isBilling) return 'Billing/Subscription';
  if (isPrivacy) return 'Privacy/Data';
  return null;
}

function makeId() {
  return globalThis.crypto.randomUUID().slice(0, 8);
}

const ROLE_LABEL_CLASS: Record<ChatMessage['role'], string> = {
  agent: 'text-[var(--safe)]',
  user: 'text-[var(--signal-dim)]',
  system: 'text-[var(--aerospace)]',
  error: 'text-[var(--warning)]',
};

const ROLE_BODY_CLASS: Record<ChatMessage['role'], string> = {
  agent: 'text-[var(--safe)]',
  user: 'text-[var(--signal)] bg-white/[0.03] pl-3 border-l-2 border-white/[0.1] py-2 pr-3',
  system: 'text-[var(--aerospace)] text-xs',
  error: 'text-[var(--warning)] text-xs',
};

const ROLE_LABEL: Record<ChatMessage['role'], string> = {
  agent: 'ATLAS',
  user: 'YOU',
  system: 'SYSTEM',
  error: 'ERROR',
};

function getCharCountClass(len: number, max: number): string {
  if (len > max) return 'text-[var(--aerospace)]';
  if (len > 1800) return 'text-[var(--warning)]';
  return 'text-[var(--signal-dim)]/40';
}

export default function SupportPage() {
  const { dictionary } = useT();
  const t = dictionary.support;
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'sys-init',
      role: 'system',
      text: t.systemInit,
    },
    {
      id: 'atlas-greeting',
      role: 'agent',
      text: t.greeting,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [escalation, setEscalation] = useState<EscalationDraft | null>(null);
  const [copyConfirm, setCopyConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Client-side rate limiter (secondary guard; worker is authoritative)
  const localRLRef = useRef<{ min: number[]; hour: number[] }>({ min: [], hour: [] });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  function clientRateCheck(): string | null {
    const now = Date.now();
    const rl = localRLRef.current;
    rl.min = rl.min.filter((t) => now - t < 60000);
    rl.hour = rl.hour.filter((t) => now - t < 3600000);
    if (rl.min.length >= 5) return 'Please wait a moment before sending another message.';
    if (rl.hour.length >= 30) return 'Hourly message limit reached. Please try again later.';
    rl.min.push(now);
    rl.hour.push(now);
    return null;
  }

  function appendMsg(role: ChatMessage['role'], text: string) {
    setMessages((prev) => [...prev, { id: makeId(), role, text }]);
  }

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const rlErr = clientRateCheck();
    if (rlErr) { appendMsg('system', `⚠ ${rlErr}`); return; }

    if (clientGuard(text)) {
      appendMsg('agent', 'I can only help with ARMAGEDDON Test Suite support. What issue are you seeing with the test suite?');
      setInput('');
      return;
    }

    if (text.length > MAX_CHARS) {
      appendMsg('system', `⚠ Message too long (${text.length}/${MAX_CHARS} chars). Please shorten it.`);
      return;
    }

    appendMsg('user', text);
    const nextHistory = [...history, { role: 'user', content: text }];
    setHistory(nextHistory);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: history.slice(-8) }),
      });

      if (res.status === 429) {
        const data = await res.json() as { message: string };
        appendMsg('system', `⚠ ${data.message}`);
        setIsLoading(false);
        return;
      }

      const data = await res.json() as { error: boolean; blocked?: boolean; message: string };

      if (data.blocked || data.error) {
        appendMsg(data.error ? 'error' : 'agent', data.message);
      } else {
        appendMsg('agent', data.message);
        setHistory((prev) => [...prev, { role: 'assistant', content: data.message }]);

        // Trigger escalation modal if keywords detected
        const escalationType = detectEscalation(text);
        if (escalationType) {
          setEscalation({
            subject: `[ARMAGEDDON Support] ${escalationType} Issue: Please provide your email`,
            body: `Hello APEX Team,\n\nI need help with a ${escalationType.toLowerCase()} issue for the ARMAGEDDON Test Suite.\n\n- GitHub username / email: [FILL IN]\n- Organization: [FILL IN]\n- Plan / tier: [FILL IN]\n- Issue summary: ${text}\n- When it occurred: ${new Date().toISOString()}\n- Additional context: [FILL IN]\n\nPlease advise.\n\nThank you,\n[Your name]`,
          });
        }
      }
    } catch {
      appendMsg('error', '⚠ Connection error. Please check your network and try again.');
    }

    setIsLoading(false);
  }, [input, isLoading, history]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  async function copyEmail() {
    if (!escalation) return;
    const full = `To: info-outreach@armageddontest.icu\nSubject: ${escalation.subject}\n\n${escalation.body}`;
    await navigator.clipboard.writeText(full);
    setCopyConfirm(true);
    setTimeout(() => setCopyConfirm(false), 3000);
  }

  function openMailApp() {
    if (!escalation) return;
    const to = encodeURIComponent('info-outreach@armageddontest.icu');
    const subject = encodeURIComponent(escalation.subject);
    const body = encodeURIComponent(escalation.body);
    globalThis.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }

  const charLen = input.length;
  const charClass = getCharCountClass(charLen, MAX_CHARS);

  return (
    <main className="relative min-h-screen bg-[var(--void)] text-[var(--signal)] flex flex-col">

      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5 border-b border-white/[0.06] bg-[var(--void)]/95 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-3">
          <picture>
            <source srcSet="/wordmark.avif" type="image/avif" />
            <img src="/wordmark.png" alt="ARMAGEDDON Test Suite" className="h-7 w-auto" />
          </picture>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/" className="mono-small text-[var(--signal-dim)] hover:text-[var(--signal)] transition-colors">{dictionary.common.nav.home}</Link>
          <Link href="/privacy" className="mono-small text-[var(--signal-dim)] hover:text-[var(--signal)] transition-colors">{dictionary.common.nav.privacy}</Link>
          <a href="https://github.com/apexbusiness-systems/armageddon-test-suite" target="_blank" rel="noopener noreferrer" className="mono-small text-[var(--signal-dim)] hover:text-[var(--signal)] transition-colors">{dictionary.common.nav.docs}</a>
        </div>
      </nav>

      {/* PAGE CONTENT */}
      <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto px-6 py-8 gap-6">

        {/* HEADER */}
        <div className="border-b border-white/[0.06] pb-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="mono-small text-[var(--aerospace)] border border-[var(--aerospace)]/30 px-2 py-0.5">SUPPORT</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--safe)] animate-pulse shadow-[0_0_6px_var(--safe)]" />
              <span className="mono-small text-[var(--safe)] uppercase">{t.statusOnline}</span>
            </span>
          </div>
          <h1 className="font-[var(--font-display)] text-2xl tracking-widest uppercase text-[var(--signal)] mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
            {t.title}
          </h1>
          <p className="mono-small text-[var(--signal-dim)] normal-case tracking-normal" style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', letterSpacing: '0.02em', textTransform: 'none' }}>
            {t.description}
          </p>
        </div>

        {/* SCOPE BADGES */}
        <div className="flex flex-wrap gap-2">
          {t.scopeBadges.map((label) => (
            <span key={label} className="mono-small text-[var(--signal-dim)] border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 tracking-wider">
              {label}
            </span>
          ))}
        </div>

        {/* TERMINAL WINDOW */}
        <div className="flex-1 flex flex-col border border-white/[0.1] bg-[#050505] min-h-[480px]">

          {/* CHROME BAR */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-[#0a0a0a]">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--aerospace)]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--warning)]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--safe)]" />
            <span className="flex-1 text-center mono-small text-[var(--signal-dim)]/60">ATLAS / ARMAGEDDON SUPPORT</span>
            <span className={`mono-small ${isLoading ? 'text-[var(--warning)]' : 'text-[var(--safe)]'}`}>
              {isLoading ? '● PROCESSING' : '● ONLINE'}
            </span>
          </div>

          {/* MESSAGES */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 scroll-smooth" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a2a2a transparent' }}>
            {messages.map((msg) => {
              const labelClass = ROLE_LABEL_CLASS[msg.role];
              const bodyClass = ROLE_BODY_CLASS[msg.role];
              const label = ROLE_LABEL[msg.role];
              return (
                <div key={msg.id} className="flex flex-col gap-1">
                  <span className={`mono-small ${labelClass}`}>{label}</span>
                  <span className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${bodyClass}`} style={{ fontFamily: 'var(--font-mono)' }}>
                    {msg.text}
                  </span>
                </div>
              );
            })}

            {/* TYPING INDICATOR */}
            {isLoading && (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-[var(--safe)]"
                      style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                    />
                  ))}
                </div>
                <span className="mono-small text-[var(--signal-dim)]/60">{t.processing}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* INPUT ROW */}
          <div className="border-t border-white/[0.06] bg-[#0a0a0a]">
            <div className="flex items-end">
              <span className="px-3 py-3.5 text-[var(--safe)] select-none border-r border-white/[0.06]" style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
                &gt;
              </span>
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={t.inputPlaceholder}
                rows={1}
                maxLength={MAX_CHARS}
                disabled={isLoading}
                aria-label="Support message"
                className="flex-1 bg-transparent border-none outline-none text-[var(--signal)] text-sm px-3.5 py-3.5 resize-none min-h-[50px] max-h-[160px] leading-relaxed placeholder-[var(--signal-dim)]/20 disabled:opacity-50"
                style={{ fontFamily: 'var(--font-mono)', caretColor: 'var(--safe)' }}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-[var(--aerospace)] hover:bg-[var(--aerospace-dark)] disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-xs tracking-widest uppercase px-5 py-3.5 self-stretch transition-colors"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {t.sendButton}
              </button>
            </div>
            <div className="flex justify-between px-3.5 pb-2 pt-1">
              <span className="mono-small text-[var(--signal-dim)]/30">{t.enterToSend}</span>
              <span className={`mono-small ${charClass}`}>{charLen} / {MAX_CHARS}</span>
            </div>
          </div>

        </div>{/* /terminal */}
      </div>

      {/* ESCALATION EMAIL MODAL */}
      {escalation && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-6"
        >
          <dialog
            open
            aria-label="Escalation email draft"
            onKeyDown={(e) => { if (e.key === 'Escape') setEscalation(null); }}
            className="bg-[#0a0a0a] border border-white/[0.12] max-w-lg w-full max-h-[80vh] overflow-y-auto m-0 p-0"
            style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.12)', color: 'inherit' }}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-[#050505]">
              <span className="mono-small text-[var(--warning)]">⚑ ESCALATION / EMAIL DRAFT</span>
              <button onClick={() => setEscalation(null)} className="text-[var(--signal-dim)] hover:text-[var(--signal)] transition-colors px-2" aria-label={t.escalation.closeButton}>✕</button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="text-xs text-[var(--signal-dim)]" style={{ fontFamily: 'var(--font-body)' }}>
                {t.escalation.modalIntro}
              </p>
              <div>
                <label htmlFor="escalation-to" className="mono-small text-[var(--signal-dim)]/60 block mb-1.5">{t.escalation.toLabel}</label>
                <input
                  id="escalation-to"
                  readOnly
                  value="info-outreach@armageddontest.icu"
                  className="w-full bg-[#050505] border border-white/[0.08] text-[var(--signal)] text-xs px-3 py-2 outline-none"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
              <div>
                <label htmlFor="escalation-subject" className="mono-small text-[var(--signal-dim)]/60 block mb-1.5">{t.escalation.subjectLabel}</label>
                <input
                  id="escalation-subject"
                  value={escalation.subject}
                  onChange={(e) => setEscalation((prev) => prev ? { ...prev, subject: e.target.value } : null)}
                  className="w-full bg-[#050505] border border-white/[0.08] text-[var(--signal)] text-xs px-3 py-2 outline-none focus:border-white/[0.2]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
              <div>
                <label htmlFor="escalation-body" className="mono-small text-[var(--signal-dim)]/60 block mb-1.5">{t.escalation.bodyLabel}</label>
                <textarea
                  id="escalation-body"
                  value={escalation.body}
                  onChange={(e) => setEscalation((prev) => prev ? { ...prev, body: e.target.value } : null)}
                  rows={10}
                  className="w-full bg-[#050505] border border-white/[0.08] text-[var(--signal)] text-xs px-3 py-2 outline-none focus:border-white/[0.2] resize-y"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
              <div className="flex gap-3 flex-wrap">
                <button onClick={copyEmail} className="bg-[var(--aerospace)] hover:bg-[var(--aerospace-dark)] text-white mono-small px-4 py-2.5 transition-colors">
                  {t.escalation.copyButton}
                </button>
                <button onClick={openMailApp} className="border border-white/[0.12] text-[var(--signal-dim)] hover:text-[var(--signal)] hover:border-white/[0.25] mono-small px-4 py-2.5 transition-colors">
                  {t.escalation.openMailButton}
                </button>
                <button onClick={() => setEscalation(null)} className="border border-white/[0.12] text-[var(--signal-dim)] hover:text-[var(--signal)] hover:border-white/[0.25] mono-small px-4 py-2.5 transition-colors">
                  {t.escalation.closeButton}
                </button>
              </div>
              {copyConfirm && (
                <p className="mono-small text-[var(--safe)] uppercase">✓ {t.escalation.copiedConfirm}</p>
              )}
            </div>
          </dialog>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-white/[0.06] px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-3">
        <span className="mono-small text-[var(--signal-dim)]/40">© 2026 APEX BUSINESS SYSTEMS LTD.</span>
        <div className="flex gap-5">
          <Link href="/privacy" className="mono-small text-[var(--signal-dim)]/40 hover:text-[var(--signal-dim)] transition-colors">{dictionary.privacy.title}</Link>
          <a href="mailto:info-outreach@armageddontest.icu" className="mono-small text-[var(--signal-dim)]/40 hover:text-[var(--signal-dim)] transition-colors">Email Support</a>
          <Link href="/" className="mono-small text-[var(--signal-dim)]/40 hover:text-[var(--signal-dim)] transition-colors">{dictionary.common.nav.home}</Link>
        </div>
      </footer>

    </main>
  );
}
