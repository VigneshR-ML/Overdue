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
          viewBox="0 0 960 620"
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

          <ellipse cx="846" cy="335" rx="113" ry="174" fill="#e6eee8" />
          <path d="M700 467c64-49 116-40 157-5 30 26 47 24 76 1" fill="none" stroke="#97b09d" strokeWidth="2" />
          <rect x="31" y="119" width="351" height="435" rx="12" fill="#e2eae2" transform="rotate(-5 206 336)" />
          <rect x="48" y="107" width="351" height="435" rx="12" fill="#edf2ed" transform="rotate(-2 223 324)" />

          <g className={styles.invoice} filter="url(#signup-card-shadow)">
            <rect x="44" y="74" width="350" height="472" rx="13" fill="#ffffff" stroke="#dce4df" strokeWidth="2" />
            <text x="82" y="133" fill="#202b25" fontSize="34" fontFamily="Arial, sans-serif" fontWeight="700">Invoice</text>
            <text x="82" y="173" fill="#4d5c53" fontSize="18" fontFamily="Arial, sans-serif" fontWeight="600">Acme Studio</text>
            <text x="355" y="171" textAnchor="end" fill="#78857d" fontSize="14" fontFamily="monospace">INV-1042</text>
            <text x="355" y="194" textAnchor="end" fill="#78857d" fontSize="14" fontFamily="monospace">Aug 12, 2026</text>

            <rect x="82" y="218" width="135" height="12" rx="6" fill="#e7ebe8" />
            <rect x="82" y="246" width="204" height="12" rx="6" fill="#e7ebe8" />
            <rect x="82" y="274" width="168" height="12" rx="6" fill="#e7ebe8" />

            <line x1="82" y1="326" x2="355" y2="326" stroke="#e1e6e2" strokeWidth="2" />
            <text x="82" y="360" fill="#58675e" fontSize="15" fontFamily="Arial, sans-serif">Website redesign</text>
            <text x="355" y="360" textAnchor="end" fill="#3d4d43" fontSize="15" fontFamily="Arial, sans-serif">$3,000</text>
            <line x1="82" y1="378" x2="355" y2="378" stroke="#e8ece9" />
            <text x="82" y="412" fill="#58675e" fontSize="15" fontFamily="Arial, sans-serif">Design system</text>
            <text x="355" y="412" textAnchor="end" fill="#3d4d43" fontSize="15" fontFamily="Arial, sans-serif">$1,500</text>
            <line x1="82" y1="430" x2="355" y2="430" stroke="#e1e6e2" strokeWidth="2" />
            <text x="82" y="466" fill="#25342c" fontSize="17" fontFamily="Arial, sans-serif" fontWeight="700">Total</text>
            <text x="355" y="466" textAnchor="end" fill="#25342c" fontSize="20" fontFamily="Arial, sans-serif" fontWeight="700">$4,500</text>

            <rect x="82" y="490" width="174" height="34" rx="8" fill="#edf2ee" />
            <circle cx="99" cy="507" r="5" fill="#df8358" />
            <text x="114" y="512" fill="#43624f" fontSize="13" fontFamily="Arial, sans-serif" fontWeight="600">30 days overdue</text>
          </g>

          <path d="M416 303h42m-13-13 13 13-13 13" fill="none" stroke="#557663" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle className={styles.flowDotOne} cx="419" cy="303" r="5" fill="#2e6b5a" />

          <g className={styles.reminder} filter="url(#signup-card-shadow)">
            <rect x="474" y="127" width="238" height="354" rx="15" fill="#ffffff" stroke="#dce4df" strokeWidth="2" />
            <circle cx="516" cy="171" r="22" fill="#edf2ee" />
            <rect x="505" y="164" width="22" height="15" rx="2" fill="none" stroke="#28513f" strokeWidth="2" />
            <path d="m506 165 10 8 10-8" fill="none" stroke="#28513f" strokeWidth="2" strokeLinejoin="round" />
            <text x="502" y="222" fill="#25342c" fontSize="19" fontFamily="Arial, sans-serif" fontWeight="700">Gentle reminder</text>
            <rect x="502" y="242" width="174" height="9" rx="4.5" fill="#e6ebe7" />
            <rect x="502" y="260" width="145" height="9" rx="4.5" fill="#e6ebe7" />
            <text x="502" y="306" fill="#607067" fontSize="14" fontFamily="Arial, sans-serif">Hi there,</text>
            <text x="502" y="331" fill="#46574d" fontSize="14" fontFamily="Arial, sans-serif">Just checking in on</text>
            <text x="502" y="352" fill="#46574d" fontSize="14" fontFamily="Arial, sans-serif">invoice #1042 for $4,500.</text>
            <text x="502" y="383" fill="#46574d" fontSize="14" fontFamily="Arial, sans-serif">Let me know if you</text>
            <text x="502" y="404" fill="#46574d" fontSize="14" fontFamily="Arial, sans-serif">have any questions.</text>
            <rect x="502" y="429" width="182" height="36" rx="8" fill="#28513f" />
            <text x="593" y="452" textAnchor="middle" fill="#ffffff" fontSize="14" fontFamily="Arial, sans-serif" fontWeight="600">Send reminder</text>
          </g>

          <path d="M731 303h42m-13-13 13 13-13 13" fill="none" stroke="#557663" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle className={styles.flowDotTwo} cx="734" cy="303" r="5" fill="#2e6b5a" />

          <g className={styles.paid} filter="url(#signup-card-shadow)">
            <rect x="789" y="165" width="139" height="276" rx="15" fill="#ffffff" stroke="#dce4df" strokeWidth="2" />
            <circle cx="858" cy="231" r="31" fill="#e8f0ea" />
            <path d="m843 231 10 10 20-22" fill="none" stroke="#2e6b5a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M858 188v-9m-34 52h-9m84 0h-9" stroke="#7da08a" strokeWidth="2" strokeLinecap="round" />
            <text x="858" y="294" textAnchor="middle" fill="#25342c" fontSize="17" fontFamily="Arial, sans-serif" fontWeight="700">Invoice paid</text>
            <rect x="815" y="313" width="86" height="8" rx="4" fill="#e6ebe7" />
            <text x="858" y="367" textAnchor="middle" fill="#2e6b5a" fontSize="23" fontFamily="Arial, sans-serif" fontWeight="700">$4,500</text>
            <rect x="824" y="386" width="68" height="8" rx="4" fill="#e6ebe7" />
          </g>
        </svg>
      </div>
    </aside>
  )
}
