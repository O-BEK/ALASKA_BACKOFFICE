import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { ImportType } from "@/lib/types"

const POS_IMPORTS_BUCKET = "pos-imports"

type ArchiveImportSourceInput = {
  importType: ImportType
  filename: string
  body: string | ArrayBuffer | Uint8Array | Buffer
  contentType?: string
  startDate?: string | null
  endDate?: string | null
}

function safeFilename(filename: string) {
  const basename = filename.split(/[\\/]/).pop() || "import-source"
  return basename.replace(/[^a-zA-Z0-9._-]+/g, "_")
}

function toStorageBody(body: ArchiveImportSourceInput["body"]) {
  if (typeof body === "string") return Buffer.from(body, "utf8")
  if (body instanceof ArrayBuffer) return Buffer.from(body)
  return Buffer.from(body)
}

export async function archiveImportSource({
  importType,
  filename,
  body,
  contentType = "application/octet-stream",
  startDate,
  endDate,
}: ArchiveImportSourceInput) {
  const supabase = createAdminClient()
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const dateRange = startDate && endDate ? `${startDate}_${endDate}` : "unknown-range"
  const storagePath = `${importType}/${dateRange}/${timestamp}_${safeFilename(filename)}`

  const { error } = await supabase.storage
    .from(POS_IMPORTS_BUCKET)
    .upload(storagePath, toStorageBody(body), {
      contentType,
      upsert: false,
    })

  if (error) {
    throw new Error(error.message)
  }

  return storagePath
}
