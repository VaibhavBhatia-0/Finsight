// src/components/ReportExportButton.tsx
import React, { useState } from "react";
import { ArrowDownCircle } from "lucide-react";

interface ReportExportButtonProps {
  /** API endpoint relative to /api/v1/reports/, e.g. "transactions/csv" or "summary/pdf" */
  endpoint: string;
  /** Suggested filename without extension, e.g. "transactions" */
  filename: string;
  /** Button label for accessibility */
  label: string;
}

export const ReportExportButton: React.FC<ReportExportButtonProps> = ({ endpoint, filename, label }) => {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleExport = async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const response = await fetch(`/api/v1/reports/${endpoint}`);
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      const disposition = response.headers.get("content-disposition");
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const blob = await response.blob();
      const ext = contentType.includes("pdf") ? "pdf" : "csv";
      const downloadName = `${filename}.${ext}`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      a.click();
      window.URL.revokeObjectURL(url);
      setStatus("success");
    } catch (e: any) {
      setErrorMsg(e.message || "Export failed");
      setStatus("error");
    }
  };

  const retry = () => {
    setStatus("idle");
    handleExport();
  };

  return (
    <div className="inline-flex items-center space-x-2">
      <button
        onClick={handleExport}
        disabled={status === "loading"}
        className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50"
        aria-label={label}
      >
        <ArrowDownCircle className="mr-2" size={20} />
        {label}
      </button>
      {status === "loading" && <span className="text-sm text-gray-600" role="status">Exporting…</span>}
      {status === "success" && <span className="text-sm text-green-600" role="status">Exported</span>}
      {status === "error" && (
        <span className="text-sm text-red-600" role="alert">
          {errorMsg}{" "}
          <button onClick={retry} className="underline text-sm">Retry</button>
        </span>
      )}
    </div>
  );
};

export default ReportExportButton;
