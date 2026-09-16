import { PageHeader } from "@/components/app-shell/page-header"
import { SmartCsvImporter } from "@/components/tools/smart-csv-importer"

export const metadata = { title: "Smart CSV import" }

export const dynamic = "force-dynamic"

export default function SmartCsvPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Workspace · Smart import"
        title="Smart CSV import"
        description="Upload any invoice spreadsheet — messy, renamed or collapsed columns welcome. AI maps the columns and extracts overdue insights, then imports cleanly to your ledger."
      />
      <SmartCsvImporter />
    </div>
  )
}
