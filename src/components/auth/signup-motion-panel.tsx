import styles from "./signup-motion-panel.module.css"

export function SignupMotionPanel() {
  return (
    <aside className={styles.panel} aria-label="Overdue invoice recovery illustration">
      <svg
        className={styles.scene}
        viewBox="0 0 960 620"
        role="img"
        aria-labelledby="signup-scene-title signup-scene-description"
      >
        <title id="signup-scene-title">From overdue invoice to payment received</title>
        <desc id="signup-scene-description">
          An invoice is followed by a friendly reminder, then marked paid when the payment arrives.
        </desc>

        <defs>
          <filter id="signup-card-shadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#294337" floodOpacity=".08" />
          </filter>
        </defs>

        <g className={styles.invoice} filter="url(#signup-card-shadow)">
          <rect x="44" y="74" width="350" height="472" rx="13" fill="#ffffff" stroke="#dce4df" strokeWidth="2" />
          <path d="M347 74v40a13 13 0 0 0 13 13h34" fill="#f0f3f1" stroke="#dce4df" strokeWidth="2" />
          <text x="84" y="133" fill="#25342c" fontSize="34" fontFamily="Arial, sans-serif" fontWeight="700">Invoice</text>
          <text x="84" y="173" fill="#4d5c53" fontSize="18" fontFamily="Arial, sans-serif" fontWeight="600">Acme Co</text>
          <text x="354" y="171" textAnchor="end" fill="#78857d" fontSize="14" fontFamily="monospace">INV-1042</text>
          <text x="354" y="194" textAnchor="end" fill="#78857d" fontSize="14" fontFamily="monospace">Aug 12, 2026</text>

          <rect x="84" y="218" width="135" height="12" rx="6" fill="#e7ebe8" />
          <rect x="84" y="246" width="204" height="12" rx="6" fill="#e7ebe8" />
          <rect x="84" y="274" width="168" height="12" rx="6" fill="#e7ebe8" />

          <line x1="84" y1="326" x2="354" y2="326" stroke="#e1e6e2" strokeWidth="2" />
          <text x="84" y="360" fill="#58675e" fontSize="15" fontFamily="Arial, sans-serif">Design work</text>
          <text x="354" y="360" textAnchor="end" fill="#3d4d43" fontSize="15" fontFamily="Arial, sans-serif">$2,400</text>
          <line x1="84" y1="378" x2="354" y2="378" stroke="#e8ece9" />
          <text x="84" y="412" fill="#58675e" fontSize="15" fontFamily="Arial, sans-serif">Development</text>
          <text x="354" y="412" textAnchor="end" fill="#3d4d43" fontSize="15" fontFamily="Arial, sans-serif">$1,600</text>
          <line x1="84" y1="430" x2="354" y2="430" stroke="#e1e6e2" strokeWidth="2" />
          <text x="84" y="466" fill="#25342c" fontSize="17" fontFamily="Arial, sans-serif" fontWeight="700">Total</text>
          <text x="354" y="466" textAnchor="end" fill="#25342c" fontSize="20" fontFamily="Arial, sans-serif" fontWeight="700">$4,000</text>

          <rect x="84" y="490" width="174" height="34" rx="8" fill="#edf2ee" />
          <circle cx="101" cy="507" r="5" fill="#df8358" />
          <text x="116" y="512" fill="#43624f" fontSize="13" fontFamily="Arial, sans-serif" fontWeight="600">Payment overdue</text>
        </g>

        <path d="M416 303h42m-13-13 13 13-13 13" fill="none" stroke="#557663" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle className={styles.flowDotOne} cx="419" cy="303" r="5" fill="#2e6b5a" />

        <g className={styles.reminder} filter="url(#signup-card-shadow)">
          <rect x="474" y="127" width="238" height="354" rx="15" fill="#ffffff" stroke="#dce4df" strokeWidth="2" />
          <circle cx="516" cy="171" r="22" fill="#edf2ee" />
          <rect x="505" y="164" width="22" height="15" rx="2" fill="none" stroke="#28513f" strokeWidth="2" />
          <path d="m506 165 10 8 10-8" fill="none" stroke="#28513f" strokeWidth="2" strokeLinejoin="round" />
          <text x="502" y="222" fill="#25342c" fontSize="19" fontFamily="Arial, sans-serif" fontWeight="700">A friendly reminder</text>
          <rect x="502" y="242" width="174" height="9" rx="4.5" fill="#e6ebe7" />
          <rect x="502" y="260" width="145" height="9" rx="4.5" fill="#e6ebe7" />
          <text x="502" y="306" fill="#607067" fontSize="14" fontFamily="Arial, sans-serif">Hi there,</text>
          <text x="502" y="331" fill="#46574d" fontSize="14" fontFamily="Arial, sans-serif">Just checking in on</text>
          <text x="502" y="352" fill="#46574d" fontSize="14" fontFamily="Arial, sans-serif">invoice INV-1042.</text>
          <text x="502" y="383" fill="#46574d" fontSize="14" fontFamily="Arial, sans-serif">Let us know if you</text>
          <text x="502" y="404" fill="#46574d" fontSize="14" fontFamily="Arial, sans-serif">need anything!</text>
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
          <text x="858" y="367" textAnchor="middle" fill="#2e6b5a" fontSize="23" fontFamily="Arial, sans-serif" fontWeight="700">$4,000</text>
          <rect x="824" y="386" width="68" height="8" rx="4" fill="#e6ebe7" />
        </g>
      </svg>
    </aside>
  )
}
