import styles from "./signup-motion-panel.module.css"

export function SignupMotionPanel() {
  return (
    <aside className={styles.panel} aria-label="Automated invoice follow-ups">
      <div className={styles.content}>
        <div className={styles.copy}>
          <p className={styles.kicker}>Automated invoice follow-ups</p>
          <h2 className={styles.heading}>From overdue to paid, effortlessly.</h2>
          <p className={styles.description}>
            Overdue sends polite, effective follow-ups so you can spend less time chasing payments and more time growing your business.
          </p>
        </div>

        <svg
          className={styles.scene}
          viewBox="0 0 980 560"
          role="img"
          aria-labelledby="signup-scene-title signup-scene-description"
        >
          <title id="signup-scene-title">An overdue invoice becomes paid</title>
          <desc id="signup-scene-description">
            Overdue follows up with a polite reminder and records the invoice once payment arrives.
          </desc>
          <defs>
            <filter id="signup-card-shadow" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#294337" floodOpacity=".08" />
            </filter>
          </defs>

          <ellipse cx="819" cy="310" rx="132" ry="153" fill="#e6eee8" />
          <rect x="38" y="144" width="320" height="383" rx="12" fill="#e2eae2" transform="rotate(-5 198 335)" />
          <rect x="48" y="128" width="320" height="383" rx="12" fill="#edf2ed" transform="rotate(-2 208 319)" />

          <g className={styles.invoice} filter="url(#signup-card-shadow)">
            <rect x="50" y="100" width="320" height="390" rx="12" fill="#ffffff" stroke="#dce4df" strokeWidth="2" />
            <text x="80" y="145" fill="#202b25" fontSize="29" fontFamily="Arial, sans-serif" fontWeight="700">Invoice</text>
            <text x="80" y="178" fill="#4d5c53" fontSize="16" fontFamily="Arial, sans-serif" fontWeight="600">Acme Studio</text>
            <text x="340" y="177" textAnchor="end" fill="#78857d" fontSize="12" fontFamily="monospace">INV-1042</text>
            <text x="340" y="197" textAnchor="end" fill="#78857d" fontSize="12" fontFamily="monospace">Aug 12, 2026</text>
            <rect x="80" y="218" width="137" height="11" rx="5.5" fill="#e7ebe8" />
            <rect x="80" y="240" width="215" height="11" rx="5.5" fill="#e7ebe8" />
            <rect x="80" y="262" width="182" height="11" rx="5.5" fill="#e7ebe8" />
            <line x1="80" y1="304" x2="340" y2="304" stroke="#e1e6e2" strokeWidth="2" />
            <text x="80" y="333" fill="#58675e" fontSize="13" fontFamily="Arial, sans-serif">Website redesign</text>
            <text x="340" y="333" textAnchor="end" fill="#3d4d43" fontSize="13" fontFamily="Arial, sans-serif">$3,000</text>
            <line x1="80" y1="350" x2="340" y2="350" stroke="#e8ece9" />
            <text x="80" y="379" fill="#58675e" fontSize="13" fontFamily="Arial, sans-serif">Design system</text>
            <text x="340" y="379" textAnchor="end" fill="#3d4d43" fontSize="13" fontFamily="Arial, sans-serif">$1,500</text>
            <line x1="80" y1="396" x2="340" y2="396" stroke="#e1e6e2" strokeWidth="2" />
            <text x="80" y="426" fill="#25342c" fontSize="15" fontFamily="Arial, sans-serif" fontWeight="700">Total</text>
            <text x="340" y="426" textAnchor="end" fill="#25342c" fontSize="17" fontFamily="Arial, sans-serif" fontWeight="700">$4,500</text>
            <text x="80" y="460" fill="#78857d" fontSize="12" fontFamily="Arial, sans-serif">Due Mar 1, 2026</text>
            <rect x="244" y="441" width="96" height="25" rx="6" fill="#f9e8df" />
            <text x="292" y="458" textAnchor="middle" fill="#bd563d" fontSize="11" fontFamily="Arial, sans-serif" fontWeight="600">30 days overdue</text>
          </g>

          <path d="M389 286h26m-9-9 9 9-9 9" fill="none" stroke="#557663" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle className={styles.flowDotOne} cx="390" cy="286" r="4.5" fill="#2e6b5a" />

          <g className={styles.reminder} filter="url(#signup-card-shadow)">
            <rect x="423" y="161" width="239" height="254" rx="14" fill="#ffffff" stroke="#dce4df" strokeWidth="2" />
            <circle cx="458" cy="198" r="20" fill="#edf2ee" />
            <rect x="448" y="192" width="20" height="13" rx="2" fill="none" stroke="#28513f" strokeWidth="1.8" />
            <path d="m449 193 9 7 9-7" fill="none" stroke="#28513f" strokeWidth="1.8" strokeLinejoin="round" />
            <text x="486" y="203" fill="#25342c" fontSize="15" fontFamily="Arial, sans-serif" fontWeight="700">Gentle reminder</text>
            <text x="445" y="249" fill="#607067" fontSize="13" fontFamily="Arial, sans-serif">Hi there,</text>
            <text x="445" y="271" fill="#46574d" fontSize="13" fontFamily="Arial, sans-serif">Just a friendly reminder that</text>
            <text x="445" y="290" fill="#46574d" fontSize="13" fontFamily="Arial, sans-serif">invoice #1042 for $4,500 is</text>
            <text x="445" y="309" fill="#46574d" fontSize="13" fontFamily="Arial, sans-serif">still outstanding.</text>
            <text x="445" y="339" fill="#46574d" fontSize="13" fontFamily="Arial, sans-serif">Let me know if you have any</text>
            <text x="445" y="358" fill="#46574d" fontSize="13" fontFamily="Arial, sans-serif">questions — happy to help!</text>
            <rect x="445" y="380" width="192" height="7" rx="3.5" fill="#e6ebe7" />
          </g>

          <path d="M680 286h25m-9-9 9 9-9 9" fill="none" stroke="#557663" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle className={styles.flowDotTwo} cx="681" cy="286" r="4.5" fill="#2e6b5a" />

          <path d="M350 465c66 45 135 46 198 25 34-11 64-24 107-42" fill="none" stroke="#8fa996" strokeWidth="2" />
          <g className={styles.paid} filter="url(#signup-card-shadow)">
            <rect x="714" y="142" width="218" height="297" rx="14" fill="#ffffff" stroke="#dce4df" strokeWidth="2" />
            <circle cx="754" cy="187" r="20" fill="#e8f0ea" />
            <path d="m745 187 7 7 13-15" fill="none" stroke="#2e6b5a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="838" y="169" width="68" height="30" rx="8" fill="#e7f0e8" />
            <text x="872" y="189" textAnchor="middle" fill="#2e6b5a" fontSize="13" fontFamily="Arial, sans-serif" fontWeight="700">Paid</text>
            <text x="739" y="236" fill="#25342c" fontSize="15" fontFamily="Arial, sans-serif" fontWeight="600">Invoice #1042</text>
            <rect x="739" y="253" width="166" height="8" rx="4" fill="#e6ebe7" />
            <rect x="739" y="270" width="112" height="8" rx="4" fill="#e6ebe7" />
            <line x1="739" y1="293" x2="906" y2="293" stroke="#e1e6e2" />
            <text x="739" y="318" fill="#58675e" fontSize="11" fontFamily="Arial, sans-serif">Website redesign</text>
            <text x="906" y="318" textAnchor="end" fill="#3d4d43" fontSize="11" fontFamily="Arial, sans-serif">$3,000</text>
            <text x="739" y="342" fill="#58675e" fontSize="11" fontFamily="Arial, sans-serif">Design system</text>
            <text x="906" y="342" textAnchor="end" fill="#3d4d43" fontSize="11" fontFamily="Arial, sans-serif">$1,500</text>
            <line x1="739" y1="357" x2="906" y2="357" stroke="#e1e6e2" />
            <text x="739" y="382" fill="#25342c" fontSize="12" fontFamily="Arial, sans-serif" fontWeight="700">Total</text>
            <text x="906" y="382" textAnchor="end" fill="#25342c" fontSize="15" fontFamily="Arial, sans-serif" fontWeight="700">$4,500</text>
            <text x="739" y="417" fill="#46805b" fontSize="11" fontFamily="Arial, sans-serif" fontWeight="600">Paid today</text>
          </g>

          <g className={styles.paymentMark}>
            <circle cx="588" cy="482" r="31" fill="#2e6b5a" />
            <text x="588" y="493" textAnchor="middle" fill="#ffffff" fontSize="29" fontFamily="Arial, sans-serif" fontWeight="500">$</text>
            <path d="M588 439v-9m0 104v-9m-44-43h-9m106 0h-9" stroke="#20382d" strokeWidth="2" strokeLinecap="round" />
          </g>
        </svg>
      </div>
    </aside>
  )
}
