"use client"

import { useState } from "react"
import {
  Upload,
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// ProductsImportDialog — paste-or-upload CSV bulk importer
//
// Recognized columns (header row, case-insensitive):
//   name (required), brand, category, sku, price, sale_price, currency,
//   description, image_url, external_url, sizes ("S,M,L"), in_stock,
//   stock_quantity
//
// "Upsert by SKU" mode: rows with sku update existing products; rows without
// always insert. "Solo insertar" mode always inserts.
// ---------------------------------------------------------------------------

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

interface ImportSummary {
  success: boolean
  inserted?: number
  updated?: number
  skipped?: number
  errors?: { row: number; error: string }[]
  error?: string
}

const EXPECTED_HEADERS = [
  "name",
  "brand",
  "category",
  "sku",
  "price",
  "sale_price",
  "currency",
  "description",
  "image_url",
  "external_url",
  "sizes",
  "in_stock",
  "stock_quantity",
]

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []

  // Very small CSV parser supporting quoted commas. Not bullet-proof
  // but handles spreadsheet-typical CSV from Excel/Numbers/Google Sheets.
  const parseLine = (line: string): string[] => {
    const out: string[] = []
    let cur = ""
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (ch === '"') {
          inQ = false
        } else {
          cur += ch
        }
      } else {
        if (ch === ",") {
          out.push(cur)
          cur = ""
        } else if (ch === '"' && cur.length === 0) {
          inQ = true
        } else {
          cur += ch
        }
      }
    }
    out.push(cur)
    return out.map((c) => c.trim())
  }

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    if (cols.every((c) => c === "")) continue
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? ""
    })
    rows.push(obj)
  }
  return rows
}

export function ProductsImportDialog({
  open,
  onClose,
  onSuccess,
}: ImportDialogProps) {
  const [csvText, setCsvText] = useState("")
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [mode, setMode] = useState<"upsert" | "insert">("upsert")
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportSummary | null>(null)
  const [dragOver, setDragOver] = useState(false)

  if (!open) return null

  const handleFile = async (file: File) => {
    setParsing(true)
    try {
      const text = await file.text()
      setCsvText(text)
      setPreview(parseCsv(text).slice(0, 8))
    } finally {
      setParsing(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  const handlePaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setCsvText(text)
    setPreview(parseCsv(text).slice(0, 8))
  }

  const handleImport = async () => {
    const rows = parseCsv(csvText)
    if (rows.length === 0) {
      setResult({ success: false, error: "CSV vacio o sin encabezado valido" })
      return
    }
    setUploading(true)
    setResult(null)
    try {
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, mode }),
      })
      const data = (await res.json()) as ImportSummary
      setResult(data)
      if (data.success) onSuccess?.()
    } catch (e) {
      console.error(e)
      setResult({ success: false, error: "Error de conexion" })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-veloce-600" />
            Importar productos desde CSV
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Headers expected */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <p className="font-medium mb-1">Columnas esperadas (la primera fila):</p>
            <p className="font-mono leading-relaxed">
              {EXPECTED_HEADERS.join(", ")}
            </p>
            <p className="mt-2">
              <strong>name</strong> es obligatorio. <em>sizes</em> separadas por
              coma: <span className="font-mono">S,M,L</span>.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-5 text-center transition-colors",
              dragOver
                ? "border-veloce-500 bg-veloce-50"
                : "border-gray-300 bg-gray-50"
            )}
          >
            <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-2">
              Arrastra tu archivo CSV aqui, o
            </p>
            <label className="inline-block">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleFile(file)
                }}
              />
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium cursor-pointer hover:bg-gray-50">
                <Upload className="w-3.5 h-3.5" />
                Seleccionar archivo
              </span>
            </label>
          </div>

          {/* Or paste */}
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
              ...o pegar texto CSV manualmente
            </summary>
            <textarea
              value={csvText}
              onChange={handlePaste}
              rows={6}
              placeholder="name,brand,category,price,..."
              className="mt-2 w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-veloce-500"
            />
          </details>

          {/* Preview */}
          {parsing ? (
            <div className="text-center py-6 text-xs text-gray-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Procesando...
            </div>
          ) : preview.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">
                Vista previa (primeras {preview.length} filas):
              </p>
              <div className="overflow-x-auto max-h-[200px] border border-gray-200 rounded">
                <table className="text-xs w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {Object.keys(preview[0]).map((h) => (
                        <th
                          key={h}
                          className="text-left px-2 py-1 font-medium text-gray-500 border-b border-gray-200"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        {Object.values(row).map((v, i) => (
                          <td
                            key={i}
                            className="px-2 py-1 text-gray-700 truncate max-w-[140px]"
                          >
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Mode selector */}
          {preview.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-600">Modo</label>
              <div className="mt-1 flex gap-2">
                <button
                  onClick={() => setMode("upsert")}
                  className={cn(
                    "flex-1 px-3 py-2 text-xs rounded-lg border",
                    mode === "upsert"
                      ? "bg-veloce-50 border-veloce-300 text-veloce-800"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  Upsert por SKU
                  <p className="text-[10px] text-gray-500 font-normal mt-0.5">
                    Si el SKU ya existe, actualiza; si no, crea.
                  </p>
                </button>
                <button
                  onClick={() => setMode("insert")}
                  className={cn(
                    "flex-1 px-3 py-2 text-xs rounded-lg border",
                    mode === "insert"
                      ? "bg-veloce-50 border-veloce-300 text-veloce-800"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  Solo insertar
                  <p className="text-[10px] text-gray-500 font-normal mt-0.5">
                    Siempre crea filas nuevas, ignora coincidencias.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div
              className={cn(
                "rounded-lg border p-3 text-sm",
                result.success
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              )}
            >
              {result.success ? (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Importado correctamente</p>
                    <p className="text-xs mt-1">
                      {result.inserted ?? 0} insertados ·{" "}
                      {result.updated ?? 0} actualizados ·{" "}
                      {result.skipped ?? 0} saltados
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{result.error}</p>
                    {result.errors && result.errors.length > 0 && (
                      <ul className="text-xs mt-1 list-disc pl-4">
                        {result.errors.slice(0, 5).map((e, i) => (
                          <li key={i}>
                            Fila {e.row}: {e.error}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Cerrar
          </button>
          <button
            onClick={handleImport}
            disabled={uploading || preview.length === 0}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg text-white",
              uploading || preview.length === 0
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-veloce-500 hover:bg-veloce-600"
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Importar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
