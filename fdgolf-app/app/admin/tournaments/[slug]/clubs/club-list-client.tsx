'use client'

import { useState, useTransition, useMemo } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  reorderClubsAction,
  toggleClubActiveAction,
  updateClubAction,
  deleteClubAction,
  type ClubRow,
} from '@/lib/actions/clubs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function SortableClubRow({
  club,
  tournamentId,
  onToggle,
  onNameBlur,
  onLoftBlur,
  onDeleteClick,
}: {
  club: ClubRow
  tournamentId: string
  onToggle: () => void
  onNameBlur: (name: string, onSuccess: () => void, onError: () => void) => void
  onLoftBlur: (loft: string, onSuccess: () => void, onError: () => void) => void
  onDeleteClick: () => void
}) {
  const [name, setName] = useState(club.display_name)
  const [loft, setLoft] = useState(club.default_loft_degrees?.toString() ?? '')

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: club.club_id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleNameBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newName = e.target.value
    onNameBlur(
      newName,
      () => {
        // on success, keep the new name
      },
      () => {
        // on error, revert to original
        setName(club.display_name)
      }
    )
  }

  const handleLoftBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newLoft = e.target.value
    onLoftBlur(
      newLoft,
      () => {
        // on success, keep the new loft
      },
      () => {
        // on error, revert to original
        setLoft(club.default_loft_degrees?.toString() ?? '')
      }
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 border rounded px-3 py-2 bg-white ${
        !club.is_active ? 'opacity-50' : ''
      }`}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab text-gray-400 select-none"
        aria-label="drag handle"
      >
        ⠿
      </span>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleNameBlur}
        className="flex-1 h-8 text-sm"
        aria-label="club name"
      />
      <Input
        value={loft}
        onChange={(e) => setLoft(e.target.value)}
        placeholder="Loft°"
        onBlur={handleLoftBlur}
        className="w-20 h-8 text-sm"
        aria-label="loft"
        type="number"
        step="0.5"
      />
      <label className="flex items-center gap-1 text-xs text-gray-500">
        <input type="checkbox" checked={club.is_active} onChange={onToggle} className="w-4 h-4" />
        Active
      </label>
      <button
        type="button"
        onClick={onDeleteClick}
        className="text-xs text-red-500 hover:text-red-700"
        aria-label="delete"
      >
        Delete
      </button>
    </div>
  )
}

export function ClubListClient({
  clubs: initialClubs,
  tournamentId,
}: {
  clubs: ClubRow[]
  tournamentId: string
}) {
  const [clubs, setClubs] = useState(initialClubs)
  const [serverOrder, setServerOrder] = useState(initialClubs)
  const [deleteTarget, setDeleteTarget] = useState<ClubRow | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [blurError, setBlurError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = clubs.findIndex((c) => c.club_id === active.id)
    const newIndex = clubs.findIndex((c) => c.club_id === over.id)
    const reordered = arrayMove(clubs, oldIndex, newIndex)
    setClubs(reordered) // optimistic

    startTransition(async () => {
      const result = await reorderClubsAction(
        tournamentId,
        reordered.map((c) => c.club_id)
      )
      if (result.error) {
        setClubs(serverOrder) // revert
      } else {
        setServerOrder(reordered)
      }
    })
  }

  async function handleToggle(clubId: string, current: boolean) {
    setToggleError(null)
    const result = await toggleClubActiveAction(clubId, tournamentId, !current)
    if (result.error) {
      setToggleError(result.error)
    } else {
      setClubs((prev) =>
        prev.map((c) => (c.club_id === clubId ? { ...c, is_active: !current } : c))
      )
    }
  }

  async function handleNameBlur(
    clubId: string,
    newName: string,
    onSuccess: () => void,
    onError: () => void
  ) {
    setBlurError(null)
    const result = await updateClubAction(clubId, { display_name: newName })
    if (result.error) {
      setBlurError(result.error)
      onError()
      return
    }
    setClubs((prev) =>
      prev.map((c) => (c.club_id === clubId ? { ...c, display_name: newName } : c))
    )
    onSuccess()
  }

  async function handleLoftBlur(
    clubId: string,
    loftStr: string,
    onSuccess: () => void,
    onError: () => void
  ) {
    setBlurError(null)
    const default_loft_degrees = loftStr ? parseFloat(loftStr) : null
    const result = await updateClubAction(clubId, { default_loft_degrees })
    if (result.error) {
      setBlurError(result.error)
      onError()
      return
    }
    setClubs((prev) => prev.map((c) => (c.club_id === clubId ? { ...c, default_loft_degrees } : c)))
    onSuccess()
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    const result = await deleteClubAction(deleteTarget.club_id)
    if (!result.error) {
      setClubs((prev) => prev.filter((c) => c.club_id !== deleteTarget.club_id))
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Clubs</h2>
      {toggleError && (
        <p role="alert" className="text-sm text-red-600">
          {toggleError}
        </p>
      )}
      {blurError && (
        <p role="alert" className="text-sm text-red-600">
          {blurError}
        </p>
      )}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={clubs.map((c) => c.club_id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {clubs.map((club) => (
              <SortableClubRow
                key={club.club_id}
                club={club}
                tournamentId={tournamentId}
                onToggle={() => handleToggle(club.club_id, club.is_active)}
                onNameBlur={(name, onSuccess, onError) =>
                  handleNameBlur(club.club_id, name, onSuccess, onError)
                }
                onLoftBlur={(loft, onSuccess, onError) =>
                  handleLoftBlur(club.club_id, loft, onSuccess, onError)
                }
                onDeleteClick={() => setDeleteTarget(club)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h2 className="font-semibold">Are you sure?</h2>
            <p className="text-sm text-gray-600">
              Delete <strong>{deleteTarget.display_name}</strong>? This removes it from all
              tournaments.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
