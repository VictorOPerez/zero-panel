import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Zero by NavApex",
  description:
    "Terms governing use of the Zero conversational AI platform offered by NavApex LLC.",
};

const EFFECTIVE_DATE = "May 1, 2026";

export default function TermsOfServicePage() {
  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Terms of Service</h1>
      <p style={{ color: "var(--text-3)", fontSize: 13, marginBottom: 28 }}>
        Effective date: {EFFECTIVE_DATE}
      </p>

      <P>
        These Terms of Service (&quot;Terms&quot;) form a binding agreement between{" "}
        <strong>NavApex LLC</strong> (&quot;NavApex&quot;, &quot;we&quot;, &quot;us&quot;)
        and the entity or individual that creates an account on Zero (&quot;Customer&quot;,
        &quot;you&quot;). By creating an account, connecting a WhatsApp Business account,
        connecting Google Calendar, or otherwise using the Service, you agree to these Terms.
        If you are agreeing on behalf of a company, you represent that you have authority to
        bind that company.
      </P>

      <H2>1. The Service</H2>
      <P>
        Zero is a multi-tenant conversational AI platform that connects to your WhatsApp
        Business account through the WhatsApp Business Platform (Cloud API) and to your
        Google Calendar to (a) automatically reply to end users on your behalf, (b) create
        and read calendar events, and (c) deliver an inbox dashboard at{" "}
        <strong>app.zero.navapex.com</strong> for human follow-up.
      </P>

      <H2>2. Account registration</H2>
      <Ul>
        <li>
          You must provide accurate information when you register and keep your account
          credentials secure.
        </li>
        <li>You are responsible for all activity that occurs under your account.</li>
        <li>
          You must be at least 18 years old and legally able to enter contracts in your
          jurisdiction.
        </li>
      </Ul>

      <H2>3. Customer responsibilities &amp; acceptable use</H2>
      <P>You agree that you will not, and will not allow others to:</P>
      <Ul>
        <li>
          Send messages that violate Meta&apos;s WhatsApp Business Messaging Policy, the
          WhatsApp Business Solution Terms, or the WhatsApp Commerce Policy.
        </li>
        <li>
          Send spam, deceptive, harassing, defamatory, or unlawful content; impersonate
          others; phish; or distribute malware.
        </li>
        <li>
          Use the Service to message users who have not opted in to receive messages from
          your business.
        </li>
        <li>
          Reverse-engineer the Service, scrape it, or attempt to bypass rate limits or
          access controls.
        </li>
        <li>
          Use the Service in industries restricted by Meta or by applicable law (e.g.,
          adult content, illegal goods, regulated firearms).
        </li>
      </Ul>
      <P>
        You are solely responsible for the lawfulness of the content you publish through Zero
        and for obtaining all consents required to message your end users.
      </P>

      <H2>4. Third-party services</H2>
      <P>
        The Service depends on third-party platforms including Meta (WhatsApp Business
        Cloud API), Google (Calendar API), Anthropic and OpenAI (LLM inference), Stripe
        (billing), Railway (hosting), and Vercel (dashboard hosting). Your use of those
        platforms is governed by their own terms. NavApex is not responsible for changes,
        outages, suspensions, or fees imposed by those third parties.
      </P>

      <H2>5. Fees, billing, and trials</H2>
      <Ul>
        <li>
          Subscription fees are displayed in the dashboard and processed by Stripe in
          U.S. dollars. By subscribing, you authorize recurring charges to your selected
          payment method.
        </li>
        <li>
          Free trials, if offered, automatically convert to paid subscriptions at the end of
          the trial unless cancelled.
        </li>
        <li>
          You may cancel at any time from the dashboard. Cancellations take effect at the
          end of the current billing period; we do not refund partial periods unless
          required by law.
        </li>
        <li>
          WhatsApp conversation fees charged by Meta to your WhatsApp Business Account are
          your direct responsibility and are not included in NavApex subscription fees.
        </li>
      </Ul>

      <H2>6. Intellectual property</H2>
      <P>
        NavApex retains all rights, title, and interest in and to the Service, including
        software, branding, and documentation. You retain ownership of the data and content
        you upload to the Service (&quot;Customer Content&quot;) and grant us a limited,
        worldwide, non-exclusive license to host, transmit, process, and display Customer
        Content solely to operate and improve the Service for you.
      </P>

      <H2>7. AI-generated content</H2>
      <P>
        The Service uses third-party large language models to generate replies. AI output may
        be inaccurate, incomplete, or unsuitable for your context. You are responsible for
        reviewing AI-generated content and should not rely on it for legal, medical,
        financial, or other professional advice. We do not warrant that AI replies will be
        free of errors or omissions.
      </P>

      <H2>8. Suspension &amp; termination</H2>
      <Ul>
        <li>
          We may suspend or terminate your account if you breach these Terms, if Meta or any
          other upstream provider requires us to, or to protect the integrity and security
          of the Service.
        </li>
        <li>
          You may terminate your account at any time by deleting it from the dashboard.
          Upon termination, your access ends and we will delete or anonymize your data per
          our Privacy Policy.
        </li>
      </Ul>

      <H2>9. Disclaimers</H2>
      <P style={{ textTransform: "none" }}>
        THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
        WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND UNINTERRUPTED OR ERROR-FREE
        OPERATION. WE DO NOT WARRANT THAT THE SERVICE WILL MEET YOUR REQUIREMENTS OR THAT ANY
        DATA WILL BE PRESERVED OR DELIVERED.
      </P>

      <H2>10. Limitation of liability</H2>
      <P>
        To the maximum extent permitted by law, NavApex&apos;s aggregate liability arising
        out of or relating to these Terms or the Service will not exceed the greater of
        (a) the fees paid by you to NavApex during the 12 months preceding the event giving
        rise to the claim or (b) one hundred U.S. dollars (US $100). NavApex will not be
        liable for indirect, incidental, special, consequential, or punitive damages, or for
        lost profits, lost revenue, or lost data.
      </P>

      <H2>11. Indemnification</H2>
      <P>
        You agree to defend, indemnify, and hold harmless NavApex, its officers, employees,
        and agents from any claim, demand, or damages (including reasonable attorneys&apos;
        fees) arising out of (a) your Customer Content, (b) your use of the Service, or
        (c) your violation of these Terms or applicable law (including Meta&apos;s
        WhatsApp Business policies).
      </P>

      <H2>12. Governing law &amp; venue</H2>
      <P>
        These Terms are governed by the laws of the State of Florida, United States, without
        regard to conflict-of-laws principles. The exclusive venue for any dispute is the
        state or federal courts located in Miami-Dade County, Florida, and the parties
        consent to personal jurisdiction there.
      </P>

      <H2>13. Changes</H2>
      <P>
        We may update these Terms from time to time. Material changes will be notified to
        you by email or through the dashboard. Continued use of the Service after the
        changes take effect constitutes acceptance.
      </P>

      <H2>14. Contact</H2>
      <P>
        NavApex LLC &mdash; <strong>victor@navapex.com</strong>
        <br />
        Website: https://navapex.com
      </P>
    </>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 10 }}>
      {children}
    </h2>
  );
}
function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ marginBottom: 14, color: "var(--text-1)", ...style }}>{children}</p>;
}
function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul
      style={{
        marginBottom: 14,
        paddingLeft: 20,
        color: "var(--text-1)",
        listStyleType: "disc",
      }}
    >
      {children}
    </ul>
  );
}
