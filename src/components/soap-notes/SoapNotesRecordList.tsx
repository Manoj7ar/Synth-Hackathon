'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type SoapNotesRecord = {
  id: string
  visitId: string
  patientName: string
  summary: string
  updatedAt: string
}

interface SoapNotesRecordListProps {
  initialRecords: SoapNotesRecord[]
}

interface SoapNotesRecordRowProps {
  record: SoapNotesRecord
  onDeleted: (visitId: string) => void
}

function SoapNotesRecordRow({ record, onDeleted }: SoapNotesRecordRowProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [, startTransition] = useTransition()

  const handleDelete = async () => {
    setDeleting(true)
    setError('')

    try {
      const response = await fetch(`/api/soap-notes/${record.visitId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || 'Failed to delete note')
      }

      onDeleted(record.visitId)
      setDialogOpen(false)
      startTransition(() => {
        router.refresh()
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete note')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="group relative">
      <Link
        href={`/soap-notes/${record.visitId}`}
        className="block rounded-2xl border border-[#eadfcd] bg-white/80 px-4 py-4 pr-24 transition hover:bg-white sm:pr-32"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-slate-900">{record.patientName}</p>
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">
              {record.summary.replace(/\n+/g, ' ').slice(0, 180)}
            </p>
          </div>
          <div className="shrink-0 text-xs font-medium text-slate-500">
            {new Date(record.updatedAt).toLocaleString()}
          </div>
        </div>
      </Link>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-3 top-3 z-10 h-9 gap-1.5 rounded-full border border-[#eadfcd] bg-white/95 px-3 text-slate-500 shadow-sm opacity-100 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:opacity-100 sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100"
        onClick={() => {
          setDialogOpen(true)
        }}
      >
        <Trash2 size={15} />
        Delete
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-[#eadfcd] bg-[#fffaf1] text-slate-900">
          <DialogHeader>
            <DialogTitle>Delete this case?</DialogTitle>
            <DialogDescription className="text-slate-600">
              This permanently deletes the SOAP note, transcript, artifacts, generated actions,
              and related visit data for {record.patientName}.
            </DialogDescription>
          </DialogHeader>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDialogOpen(false)
                setError('')
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={16} className="mr-2" />
                  Delete note
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function SoapNotesRecordList({ initialRecords }: SoapNotesRecordListProps) {
  const [records, setRecords] = useState(initialRecords)

  const handleDeleted = (visitId: string) => {
    setRecords((current) => current.filter((record) => record.visitId !== visitId))
  }

  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-[#eadfcd] bg-white/80 px-4 py-6 text-sm text-slate-600">
        No saved transcriptions yet. Record and save one from the Transcribe page.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {records.map((record) => (
        <SoapNotesRecordRow key={record.id} record={record} onDeleted={handleDeleted} />
      ))}
    </div>
  )
}
