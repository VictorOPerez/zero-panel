import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Zero by NavApex",
  description:
    "How NavApex LLC collects, uses, and protects information through the Zero conversational AI platform.",
};

const EFFECTIVE_DATE = "May 1, 2026";

export default function PrivacyPolicyPage() {
  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Privacy Policy</h1>
      <p style={{ color: "var(--text-3)", fontSize: 13, marginBottom: 28 }}>
        Effective date: {EFFECTIVE_DATE}
      </p>

      <P>
        This Privacy Policy describes how <strong>NavApex LLC</strong> (&quot;NavApex&quot;,
        &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, stores, and discloses
        information when business customers use the Zero conversational AI platform
        (&quot;Zero&quot; or the &quot;Service&quot;) and when end users interact with bots powered
        by Zero through messaging channels such as the WhatsApp Business Platform (Cloud API),
        Google Calendar, and the Zero web dashboard hosted at{" "}
        <strong>app.zero.navapex.com</strong>.
      </P>

      <H2>1. Who we are</H2>
      <P>
        NavApex LLC is the data controller of personal data processed through the Zero web
        dashboard and is a data processor on behalf of business customers (&quot;Customers&quot;)
        when handling end-user messaging data on their behalf. Our registered business contact
        is <strong>victor@navapex.com</strong>.
      </P>

      <H2>2. Information we collect</H2>
      <H3>2.1 Information you provide as a business Customer</H3>
      <Ul>
        <li>
          Account information: name, email address, hashed password, business name, business
          category, country, and time zone.
        </li>
        <li>
          Business configuration: bot persona, services list, business hours, and any
          descriptive content you upload through the dashboard.
        </li>
        <li>
          Payment metadata: customer ID and subscription status returned by Stripe. We do not
          store full credit card numbers — Stripe handles all payment processing.
        </li>
      </Ul>

      <H3>2.2 Information collected when you connect your WhatsApp Business account</H3>
      <Ul>
        <li>
          WhatsApp Business Account ID, phone number ID, business portfolio ID, display name,
          and an encrypted system-user access token returned by Meta&apos;s Embedded Signup flow.
        </li>
        <li>
          Webhook events delivered by Meta when an end user messages your business: message
          content (text, media references, audio transcriptions), sender phone number,
          timestamp, and message status updates.
        </li>
      </Ul>

      <H3>2.3 Information collected when you connect Google Calendar</H3>
      <Ul>
        <li>
          OAuth refresh and access tokens (encrypted at rest), the ID and time zone of the
          calendar you authorized, and metadata of the events Zero creates, modifies, or reads
          on your behalf.
        </li>
      </Ul>

      <H3>2.4 Information generated during conversations</H3>
      <Ul>
        <li>
          End-user messages and bot replies, conversation transcripts, structured
          intent/entity data, and tool-call traces used by the AI orchestrator to answer.
        </li>
        <li>
          Booking details such as appointment time, service requested, and the end user&apos;s
          phone number — only when an end user voluntarily requests a booking.
        </li>
      </Ul>

      <H3>2.5 Technical information</H3>
      <Ul>
        <li>IP address, user agent, and timestamps of dashboard logins.</li>
        <li>
          Diagnostic logs, error reports, and rate-limit counters used to operate and secure
          the Service.
        </li>
      </Ul>

      <H2>3. How we use information</H2>
      <Ul>
        <li>
          <strong>Operate the Service:</strong> route incoming WhatsApp messages to the
          correct Customer tenant, generate AI responses, deliver replies through the
          WhatsApp Cloud API, schedule events on Google Calendar, and surface
          conversations on the dashboard.
        </li>
        <li>
          <strong>Improve product quality:</strong> aggregate, de-identified analytics
          (response latency, tool-call success rate, error rates) — we do not use end-user
          message content to train any model.
        </li>
        <li>
          <strong>Account &amp; billing:</strong> authenticate logins, enforce plan limits,
          process subscriptions through Stripe, and contact Customers about service or
          security matters.
        </li>
        <li>
          <strong>Security and abuse prevention:</strong> detect spam, abuse, and policy
          violations; comply with Meta&apos;s WhatsApp Business Solution Terms.
        </li>
      </Ul>

      <H2>4. Legal bases (EEA / UK)</H2>
      <P>
        Where the EU/UK General Data Protection Regulation applies, we rely on (a) performance
        of a contract with the Customer, (b) compliance with legal obligations, and (c) our
        legitimate interest in operating, securing, and improving the Service. End-user data
        is processed on the Customer&apos;s legal basis as the data controller of their
        customer relationships.
      </P>

      <H2>5. How we share information</H2>
      <P>
        We do not sell personal information. We share data only with the following processors,
        strictly to operate the Service:
      </P>
      <Ul>
        <li>
          <strong>Meta Platforms, Inc.</strong> — WhatsApp Business Cloud API (message
          delivery and webhook reception).
        </li>
        <li>
          <strong>Google LLC</strong> — Google Calendar API (creating and reading events on
          the Customer&apos;s authorized calendar).
        </li>
        <li>
          <strong>Anthropic, PBC</strong> and <strong>OpenAI, Inc.</strong> — large language
          model inference for generating bot responses. Inference requests are sent under
          zero-data-retention agreements where available.
        </li>
        <li>
          <strong>Stripe, Inc.</strong> — subscription and payment processing.
        </li>
        <li>
          <strong>Railway Corp.</strong> — backend hosting and PostgreSQL (Neon) database
          provider.
        </li>
        <li>
          <strong>Vercel Inc.</strong> — hosting of the Zero web dashboard.
        </li>
      </Ul>
      <P>
        We may also disclose information when required by law, to enforce our terms, or to
        protect the rights, property, or safety of NavApex, our Customers, or others.
      </P>

      <H2>6. International transfers</H2>
      <P>
        Our processors operate from the United States and the European Union. Where required,
        transfers from the EEA, UK, or Switzerland rely on the European Commission&apos;s
        Standard Contractual Clauses or equivalent safeguards.
      </P>

      <H2>7. Data retention</H2>
      <Ul>
        <li>
          Conversation transcripts and bot replies: retained while the Customer&apos;s account
          is active and for up to 12 months thereafter, unless the Customer requests earlier
          deletion.
        </li>
        <li>
          Account and billing records: retained for the period required by applicable tax,
          accounting, and legal obligations (typically up to 7 years).
        </li>
        <li>
          OAuth tokens and channel credentials: retained while the connection is active; on
          disconnect they are revoked and removed from production within 30 days.
        </li>
        <li>
          Diagnostic logs: retained for up to 30 days.
        </li>
      </Ul>

      <H2>8. Security</H2>
      <P>
        We use TLS in transit, encryption at rest for sensitive credentials (OAuth tokens,
        WhatsApp access tokens), bcrypt-hashed passwords, role-based access control, and
        audit logging. We restrict production access to authorized engineers under
        confidentiality obligations. No method of transmission or storage is 100% secure;
        Customers are responsible for safeguarding their dashboard credentials.
      </P>

      <H2>9. Your rights</H2>
      <P>
        Depending on your jurisdiction, you may have the right to access, correct, delete, or
        export your personal data, to object to or restrict certain processing, and to lodge a
        complaint with your local data protection authority. Customers can exercise most
        rights directly through the dashboard. To request assistance — including end-user
        deletion requests — contact <strong>victor@navapex.com</strong>. We will respond
        within 30 days.
      </P>

      <H2>10. End users on WhatsApp</H2>
      <P>
        When you message a business that uses Zero, your messages are processed on behalf of
        that business. The business is the controller of your data. Refer to the privacy
        notice provided by the business you contacted for details on their use of your
        information. You can stop receiving automated messages at any time by replying
        &quot;STOP&quot; or by contacting the business directly.
      </P>

      <H2>11. Children</H2>
      <P>
        Zero is not directed to children under 13 (or under 16 in the EEA). We do not
        knowingly collect personal data from children. If you believe a child has provided us
        information, contact us and we will delete it.
      </P>

      <H2>12. Changes to this Policy</H2>
      <P>
        We may update this Policy from time to time. Material changes will be communicated to
        Customers by email and published here with a revised effective date.
      </P>

      <H2>13. Contact</H2>
      <P>
        NavApex LLC &mdash; <strong>victor@navapex.com</strong>
        <br />
        Website: https://navapex.com
      </P>
    </>
  );
}

// ─── Reusable typography helpers ──────────────────────────────────
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 10 }}>
      {children}
    </h2>
  );
}
function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 14,
        fontWeight: 600,
        marginTop: 18,
        marginBottom: 6,
        color: "var(--text-1)",
      }}
    >
      {children}
    </h3>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ marginBottom: 14, color: "var(--text-1)" }}>{children}</p>;
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
