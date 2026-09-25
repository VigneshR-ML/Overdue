import styles from "./signup-motion-panel.module.css"

export function SignupMotionPanel() {
  return (
    <aside className={styles.panel} aria-label="How Overdue helps invoices get paid">
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.content}>
        <div className={styles.eyebrow}>
          <span className={styles.brandMark} aria-hidden="true">O</span>
          A clearer way to get paid
        </div>
        <h2 className={styles.heading}>
          From <em>overdue</em> to paid.
          <span>Without the awkward follow-up.</span>
        </h2>

        <svg
          className={styles.scene}
          viewBox="0 0 760 500"
          role="img"
          aria-labelledby="signup-scene-title signup-scene-description"
        >
          <title id="signup-scene-title">An invoice moves through a calm recovery workflow</title>
          <desc id="signup-scene-description">
            Overdue keeps reminders organized, pauses when a customer replies, and marks the invoice paid.
          </desc>
          <defs>
            <linearGradient id="orbit-stroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#a7c4b2" stopOpacity=".08" />
              <stop offset=".52" stopColor="#a7c4b2" stopOpacity=".48" />
              <stop offset="1" stopColor="#d6b66c" stopOpacity=".14" />
            </linearGradient>
            <linearGradient id="invoice-glow" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#fffdf7" />
              <stop offset="1" stopColor="#e9eee8" />
            </linearGradient>
            <filter id="card-shadow" x="-30%" y="-30%" width="160%" height="180%">
              <feDropShadow dx="0" dy="16" stdDeviation="17" floodColor="#06140f" floodOpacity=".28" />
            </filter>
          </defs>

          <ellipse cx="383" cy="257" rx="282" ry="192" fill="none" stroke="url(#orbit-stroke)" strokeDasharray="3 9" />
          <ellipse cx="383" cy="257" rx="214" ry="145" fill="none" stroke="#b8cfc2" strokeOpacity=".09" />

          <path className={styles.pathGlow} d="M157 294 C218 294 233 226 288 226" fill="none" stroke="#8eb2a0" strokeOpacity=".48" strokeWidth="2" />
          <path className={styles.pathGlow} d="M466 226 C528 226 522 294 591 294" fill="none" stroke="#d8bd79" strokeOpacity=".6" strokeWidth="2" />
          <circle className={styles.flowDotOne} cx="0" cy="0" r="5" fill="#b6d3c3" />
          <circle className={styles.flowDotTwo} cx="0" cy="0" r="5" fill="#e5cc8b" />

          <g className={styles.messageCard} filter="url(#card-shadow)">
            <rect x="48" y="240" width="180" height="108" rx="15" fill="#f8f7f1" />
            <circle cx="70" cy="265" r="9" fill="#dce9df" />
            <path d="M66 265h8m-4-4v8" stroke="#2f5d50" strokeWidth="1.6" strokeLinecap="round" />
            <text x="88" y="269" fill="#77786f" fontSize="10" fontFamily="monospace" letterSpacing="1.1">GENTLE REMINDER</text>
            <rect x="67" y="287" width="135" height="5" rx="2.5" fill="#deded5" />
            <rect x="67" y="300" width="117" height="5" rx="2.5" fill="#e7e6de" />
            <rect x="67" y="319" width="70" height="15" rx="7.5" fill="#e6eee7" />
            <text x="77" y="329.5" fill="#2f5d50" fontSize="8" fontFamily="monospace">SENT · DAY 3</text>
          </g>

          <g className={styles.invoiceCard} filter="url(#card-shadow)">
            <rect x="274" y="133" width="220" height="244" rx="20" fill="url(#invoice-glow)" />
            <rect x="296" y="156" width="34" height="34" rx="10" fill="#e2ebe3" />
            <path d="M306 165h14v17l-7-4-7 4z" fill="none" stroke="#2f5d50" strokeWidth="1.5" strokeLinejoin="round" />
            <text x="342" y="169" fill="#7a7b71" fontSize="9" fontFamily="monospace" letterSpacing="1.2">INVOICE · #2148</text>
            <text x="342" y="184" fill="#31352f" fontSize="11" fontFamily="sans-serif" fontWeight="600">Northwind Studio</text>
            <line x1="296" y1="207" x2="472" y2="207" stroke="#dedfd7" />
            <text x="296" y="234" fill="#85867c" fontSize="9" fontFamily="monospace" letterSpacing="1.2">AMOUNT DUE</text>
            <text x="295" y="271" fill="#202920" fontSize="32" fontFamily="sans-serif" fontWeight="600">$2,400</text>
            <text x="296" y="291" fill="#85867c" fontSize="10" fontFamily="sans-serif">Due 16 days ago</text>
            <rect x="296" y="319" width="176" height="34" rx="9" fill="#e9eee8" />
            <circle cx="311" cy="336" r="4" fill="#3e765d" />
            <text x="322" y="340" fill="#315c49" fontSize="10" fontFamily="sans-serif" fontWeight="600">Follow-up is on track</text>
          </g>

          <g className={styles.paidCard} filter="url(#card-shadow)">
            <rect x="530" y="240" width="183" height="108" rx="15" fill="#fbfaf5" />
            <circle cx="555" cy="271" r="12" fill="#e2eee4" />
            <path d="m550 271 3.5 3.5 7-7" fill="none" stroke="#2f6a4d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <text x="576" y="269" fill="#397051" fontSize="9" fontFamily="monospace" letterSpacing="1.1">PAYMENT RECEIVED</text>
            <text x="551" y="305" fill="#242b25" fontSize="19" fontFamily="sans-serif" fontWeight="600">$2,400.00</text>
            <text x="551" y="327" fill="#85867c" fontSize="10" fontFamily="sans-serif">Invoice settled · today</text>
          </g>

          <g className={styles.replyChip}>
            <rect x="503" y="97" width="152" height="34" rx="17" fill="#29483c" stroke="#8bb19b" strokeOpacity=".36" />
            <circle cx="521" cy="114" r="4" fill="#b3d0bd" />
            <text x="533" y="118" fill="#dce9df" fontSize="10" fontFamily="sans-serif">Reply received · paused</text>
          </g>

          <g className={styles.sparkle} fill="#dcc37e">
            <path d="M222 124v12m-6-6h12" stroke="#dcc37e" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M641 183v9m-4.5-4.5h9" stroke="#dcc37e" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="135" cy="174" r="2" />
            <circle cx="595" cy="389" r="2" />
          </g>
        </svg>

        <div className={styles.footer} aria-hidden="true">
          <span>Remind</span><i /><span>Listen</span><i /><span className={styles.footerActive}>Get paid</span>
        </div>
      </div>
    </aside>
  )
}
