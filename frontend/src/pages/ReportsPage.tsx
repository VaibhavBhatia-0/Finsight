// src/pages/ReportsPage.tsx
import React from "react";
import ReportExportButton from "../components/ReportExportButton";

const ReportsPage: React.FC = () => {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Reports</h1>
      <section className="space-y-4">
        <ReportExportButton
          endpoint="transactions/csv"
          filename="transactions"
          label="Export Transactions (CSV)"
        />
        <ReportExportButton
          endpoint="summary/pdf"
          filename="summary"
          label="Export Summary (PDF)"
        />
      </section>
    </main>
  );
};

export default ReportsPage;
