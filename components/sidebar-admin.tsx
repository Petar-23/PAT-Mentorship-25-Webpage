'use client'
// components/sidebar-admin.tsx

import Link from 'next/link'
import Image from 'next/image'
import {
  BookOpen,
  Users,
  GripVertical,
  Plus,
  MoreVertical,
  Trash2,
  Pencil,
  SquareKanban,
} from 'lucide-react'
import { UserButton, useUser } from '@clerk/nextjs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { upload } from '@vercel/blob/client'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ManageSubscriptionButton } from '@/components/ui/manage-subscription'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { usePathname, useRouter } from 'next/navigation'

type Kurs = {
  id: string
  name: string
  slug: string
  modulesLength: number
  description?: string | null
  iconUrl?: string | null
}

type SidebarItem = {
  id: string
  title: string
  subtitle: string
  href: string
  icon: ReactNode
  iconBg: string
}

type Props = {
  kurse: Kurs[]
  savedSidebarOrder?: string[] | null
  activeCourseId?: string | null
  isAdmin: boolean
  openCreateCourseModal?: boolean
}

export function SidebarAdmin({
  kurse,
  savedSidebarOrder,
  activeCourseId,
  isAdmin,
  openCreateCourseModal,
}: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const isMentorship = pathname?.startsWith('/mentorship')
  const { user, isLoaded } = useUser()
  const [isDeletingCourse, setIsDeletingCourse] = useState(false)

  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false)
  const [courseModalMode, setCourseModalMode] = useState<'create' | 'edit'>('create')
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)
  const [courseName, setCourseName] = useState('')
  const [courseDescription, setCourseDescription] = useState('')
  const [existingIconUrl, setExistingIconUrl] = useState<string | null>(null)
  const [removeIcon, setRemoveIcon] = useState(false)
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null)
  const [isSavingCourse, setIsSavingCourse] = useState(false)

  const resetCourseModal = () => {
    if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl)
    setEditingCourseId(null)
    setCourseModalMode('create')
    setCourseName('')
    setCourseDescription('')
    setExistingIconUrl(null)
    setRemoveIcon(false)
    setIconFile(null)
    setIconPreviewUrl(null)
    setIsSavingCourse(false)
  }

  const closeCourseModal = () => {
    if (isSavingCourse) return
    setIsCourseModalOpen(false)
    resetCourseModal()
  }

  const openCreateCourseDialog = () => {
    resetCourseModal()
    setCourseModalMode('create')
    setIsCourseModalOpen(true)
  }

  const openEditCourseDialog = (courseId: string) => {
    const kurs = kurse.find((k) => k.id === courseId)
    resetCourseModal()
    setCourseModalMode('edit')
    setEditingCourseId(courseId)
    setCourseName(kurs?.name ?? '')
    setCourseDescription(kurs?.description ?? '')
    setExistingIconUrl(kurs?.iconUrl ?? null)
    setIsCourseModalOpen(true)
  }

  const openedFromQueryRef = useRef(false)
  useEffect(() => {
    if (!openCreateCourseModal) return
    if (openedFromQueryRef.current) return
    openedFromQueryRef.current = true

    // Direkt öffnen (ohne Funktions-Dependencies), damit ESLint Hook-Regeln sauber bleiben.
    if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl)
    setEditingCourseId(null)
    setCourseModalMode('create')
    setCourseName('')
    setCourseDescription('')
    setExistingIconUrl(null)
    setRemoveIcon(false)
    setIconFile(null)
    setIconPreviewUrl(null)
    setIsSavingCourse(false)
    setIsCourseModalOpen(true)

    // Query-Param aus der URL entfernen, damit es beim Refresh nicht wieder automatisch öffnet
    router.replace('/mentorship', { scroll: false })
  }, [openCreateCourseModal, iconPreviewUrl, router])

  const activeItemId = useMemo(() => {
    if (pathname?.startsWith('/mentorship/discord')) return 'discord'
    if (activeCourseId) return activeCourseId

    const match = pathname?.match(/^\/mentorship\/([^/]+)$/)
    return match?.[1] ?? null
  }, [pathname, activeCourseId])

  async function confirmDeleteCourse(courseId: string) {
    setIsDeletingCourse(true)

    toast({
      title: 'Lösche Kurs...',
      description: 'Bitte einen Moment.',
    })

    try {
      const res = await fetch(`/api/playlists/${courseId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        type ApiError = { error?: unknown }
        const data: unknown = await res.json().catch(() => null)

        let message = 'Kurs konnte nicht gelöscht werden.'
        if (data && typeof data === 'object' && 'error' in data) {
          const err = (data as ApiError).error
          if (typeof err === 'string') message = err
        }

        throw new Error(message)
      }

      // Sidebar sofort aktualisieren
      setItems((prev) => prev.filter((i) => i.id !== courseId))

      toast({
        title: 'Kurs gelöscht',
        description: 'Der Kurs wurde dauerhaft entfernt.',
      })

      // Wenn du gerade auf diesem Kurs bist: zurück zur Übersicht
      if (pathname === `/mentorship/${courseId}`) {
        router.push('/mentorship')
      } else {
        router.refresh()
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      toast({
        variant: 'destructive',
        title: 'Fehler beim Löschen',
        description: message,
      })
    } finally {
      setIsDeletingCourse(false)
      setDeleteCourseId(null)
    }
  }

  const [deleteCourseId, setDeleteCourseId] = useState<string | null>(null)

  async function handleSaveCourse() {
    const name = courseName.trim()
    if (!name) {
      toast({ variant: 'destructive', title: 'Name ist erforderlich' })
      return
    }

    if (courseModalMode === 'edit' && !editingCourseId) {
      toast({ variant: 'destructive', title: 'Kein Kurs ausgewählt' })
      return
    }

    setIsSavingCourse(true)
    toast({
      title: courseModalMode === 'create' ? 'Kurs wird erstellt...' : 'Kurs wird gespeichert...',
      description: 'Bitte einen Moment.',
    })

    try {
      const descriptionTrimmed = courseDescription.trim()
      const description = descriptionTrimmed.length > 0 ? descriptionTrimmed : null

      let iconUrl: string | null = existingIconUrl

      if (iconFile && iconFile.size > 0) {
        const newBlob = await upload(`course-icons/${iconFile.name}`, iconFile, {
          access: 'public',
          handleUploadUrl: '/api/course-icon-upload',
        })
        iconUrl = newBlob.url
      } else if (removeIcon) {
        iconUrl = null
      }

      const url =
        courseModalMode === 'create' ? '/api/playlists' : `/api/playlists/${editingCourseId}`
      const method = courseModalMode === 'create' ? 'POST' : 'PATCH'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, iconUrl }),
      })

      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null)
        let message = 'Speichern fehlgeschlagen.'
        if (data && typeof data === 'object' && 'error' in data) {
          const err = (data as { error?: unknown }).error
          if (typeof err === 'string') message = err
        }
        throw new Error(message)
      }

      const playlist = (await res.json()) as { id: string; name: string }

      toast({
        title: courseModalMode === 'create' ? 'Kurs erstellt' : 'Kurs gespeichert',
        description: courseModalMode === 'create' ? 'Der Kurs wurde angelegt.' : 'Änderungen übernommen.',
      })

      setIsCourseModalOpen(false)
      resetCourseModal()

      if (courseModalMode === 'create') {
        router.push(`/mentorship/${playlist.id}`)
      } else {
        router.refresh()
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: message,
      })
    } finally {
      setIsSavingCourse(false)
    }
  }

  const displayName =
    user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Mitglied'
  const email = user?.primaryEmailAddress?.emailAddress ?? ''

  // Alle Nav-Items: Discord fest + Kurse
  const staticItems = useMemo<SidebarItem[]>(
    () => [
      {
        id: 'discord',
        title: 'Discord Community',
        subtitle: 'Live Streams & Chat',
        href: '/mentorship/discord',
        icon: <Users className="h-6 w-6 text-white" />,
        iconBg: 'from-indigo-700/80 to-indigo-600/70',
      },
      ...kurse.map((kurs) => ({
        id: kurs.id,
        title: kurs.name,
        subtitle: `${kurs.modulesLength} ${kurs.modulesLength === 1 ? 'Modul' : 'Module'}`,
        href: `/mentorship/${kurs.id}`,
        icon: kurs.iconUrl ? (
          <div className="relative w-full h-full">
            <Image
              src={kurs.iconUrl}
              alt={`${kurs.name} Icon`}
              fill
              sizes="40px"
              className="object-cover"
              quality={70}
            />
          </div>
        ) : (
          <BookOpen className="h-6 w-6 text-white" />
        ),
        iconBg: 'from-slate-700/80 to-slate-600/70',
      })),
    ],
    [kurse]
  )

  const initialItems = useMemo<SidebarItem[]>(() => {
    if (savedSidebarOrder) {
      const orderMap = new Map(savedSidebarOrder.map((id, index) => [id, index]))
      return [...staticItems].sort((a, b) => {
        const posA = orderMap.get(a.id) ?? staticItems.length
        const posB = orderMap.get(b.id) ?? staticItems.length
        return posA - posB
      })
    }
    return staticItems
  }, [savedSidebarOrder, staticItems])

  const [items, setItems] = useState<SidebarItem[]>(initialItems)

  // Wichtig: Wenn neue Kurse dazukommen/editiert werden und Server-Props sich ändern,
  // muss die Sidebar-Liste mitsynchronisieren (sonst bleibt der alte State hängen).
  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setItems((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      const newOrder = arrayMove(items, oldIndex, newIndex)

      // Speichere neue Reihenfolge in DB (nur für Admin)
      if (isAdmin) {
        const orderIds = newOrder.map((item) => item.id)
        fetch('/api/admin-settings/sidebar-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: orderIds }),
        }).then((res) => {
          if (res.ok) {
            toast({
              title: 'Reihenfolge gespeichert!',
              description: 'Deine Navigation ist jetzt so sortiert.',
              duration: 3000,
            })
          } else {
            toast({
              title: 'Fehler beim Speichern',
              description: 'Versuche es nochmal.',
              variant: 'destructive',
              duration: 5000,
            })
          }
        })
      }

      return newOrder
    })
  }

  // Sortierbare Item-Komponente (nur für Admin)
  function SortableItem({ item }: { item: SidebarItem }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: item.id,
    })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    return (
      <div ref={setNodeRef} style={style} className="relative">
        <div
          className={cn(
            'flex items-center gap-2 py-2 px-2 rounded-lg transition-colors border border-border group cursor-pointer',
            item.id === activeItemId
              ? 'bg-gray-200/50 dark:bg-gray-800/40 border-l-4 border-gray-200 dark:border-gray-400 border-l-gray-400 dark:border-l-gray-400'
              : 'hover:bg-gray-200/50 dark:hover:bg-gray-800/30'
          )}
        >
          {/* Drag-Handle – nur für Admin */}
          {isAdmin && (
            <div
              {...attributes}
              {...listeners}
              className="w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing flex-shrink-0"
            >
              <GripVertical className="h-4 w-4 text-base" />
            </div>
          )}

          {/* Klickbarer Bereich */}
          <Link
            href={item.href}
            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
            aria-current={item.id === activeItemId ? 'page' : undefined}
          >
            <div
              className={`w-10 h-10 border bg-gradient-to-br ${item.iconBg} rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden`}
            >
              {item.icon}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.subtitle}</p>
            </div>
          </Link>

          {/* 3-Dots Menü – nur Admin */}
          {isAdmin && item.id !== 'discord' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  aria-label="Kurs Aktionen"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem className="gap-2" onSelect={() => openEditCourseDialog(item.id)}>
                  <Pencil className="h-4 w-4" />
                  Bearbeiten
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 text-destructive focus:text-destructive"
                  onSelect={() => setDeleteCourseId(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Kurs löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'w-full lg:w-80 border-r border-border p-4 flex flex-col h-full min-h-0',
        isMentorship ? 'bg-gray-100/50' : 'bg-muted/40'
      )}
    >
      <div className="relative mb-1 -mx-4 -mt-4 h-48 overflow-hidden">
        <Image
          src="/images/pat-banner.jpeg"
          alt="PAT Mentorship 2026 Banner"
          fill
          className="object-cover"
          sizes="320px"
          quality={70}
        />
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white to-transparent opacity-80" />
        <div className="absolute inset-x-0 bottom-0 pb-2 flex justify-center">
          <div className="inline-block px-6 py-2 mx-auto bg-white/20 backdrop-blur-md rounded-lg border border-white/30">
            <h2 className="text-xl font-bold text-white drop-shadow-md">PAT Mentorship 2026</h2>
          </div>
        </div>
      </div>

      <Dialog
        open={isCourseModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeCourseModal()
            return
          }
          setIsCourseModalOpen(true)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {courseModalMode === 'create' ? 'Neuen Kurs anlegen' : 'Kurs bearbeiten'}
            </DialogTitle>
            <DialogDescription>
              Name, Beschreibung und ein kleines Icon-Bild.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSaveCourse()
            }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <Label htmlFor="course-name">Kursname *</Label>
              <Input
                id="course-name"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="z. B. PAT Model Series 2026"
                required
                disabled={isSavingCourse}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="course-description">Beschreibung (optional)</Label>
              <Textarea
                id="course-description"
                value={courseDescription}
                onChange={(e) => setCourseDescription(e.target.value)}
                placeholder="Kurze Beschreibung..."
                rows={3}
                disabled={isSavingCourse}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="course-icon">Icon (optional)</Label>
              <Input
                id="course-icon"
                type="file"
                accept="image/*"
                disabled={isSavingCourse}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setRemoveIcon(false)
                  setIconFile(file)

                  if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl)
                  setIconPreviewUrl(file ? URL.createObjectURL(file) : null)
                }}
              />

              <div className="flex items-start gap-4">
                <div className="relative h-20 w-20 rounded-lg overflow-hidden border bg-muted/30 flex-shrink-0">
                  {iconPreviewUrl ? (
                    <Image src={iconPreviewUrl} alt="Icon Vorschau" fill className="object-cover" />
                  ) : existingIconUrl && !removeIcon ? (
                    <Image
                      src={existingIconUrl}
                      alt="Aktuelles Icon"
                      fill
                      sizes="80px"
                      className="object-cover"
                      quality={70}
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                      {removeIcon ? 'Wird entfernt' : 'Kein Icon'}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  {existingIconUrl && courseModalMode === 'edit' ? (
                    <div className="flex flex-wrap gap-2">
                      {!removeIcon ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isSavingCourse}
                          onClick={() => setRemoveIcon(true)}
                        >
                          Icon entfernen
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isSavingCourse}
                          onClick={() => setRemoveIcon(false)}
                        >
                          Entfernen rückgängig
                        </Button>
                      )}
                    </div>
                  ) : null}

                  {iconPreviewUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSavingCourse}
                      onClick={() => {
                        if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl)
                        setIconPreviewUrl(null)
                        setIconFile(null)
                      }}
                    >
                      Auswahl zurücksetzen
                    </Button>
                  ) : null}

                  <p className="text-xs text-muted-foreground">
                    Tipp: Quadratische Bilder sehen am besten aus.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeCourseModal}
                disabled={isSavingCourse}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSavingCourse}>
                {isSavingCourse
                  ? courseModalMode === 'create'
                    ? 'Erstelle...'
                    : 'Speichere...'
                  : courseModalMode === 'create'
                    ? 'Kurs erstellen'
                    : 'Speichern'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex-1 min-h-0 mt-1 overflow-y-auto">
        <Accordion type="single" collapsible defaultValue="mentorship">
          <AccordionItem value="mentorship">
            <AccordionTrigger className="text-gray-400 font-medium py-3 px-4 hover:text-black rounded-lg transition-colors [&&]:hover:no-underline justify-between">
              <span>PAT Mentorship 2026</span>

              {/* Plus-Button – nur für Admin */}
              {isAdmin && (
                <div
                  className="h-5 w-5 border border-gray-300 rounded flex items-center justify-center hover:bg-gray-200 cursor-pointer transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    openCreateCourseDialog()
                  }}
                  title="Neuen Kurs anlegen"
                >
                  <Plus className="h-4 w-4 text-gray-500 hover:text-foreground" />
                </div>
              )}
            </AccordionTrigger>

            <AccordionContent className="px-1">
              <div className="space-y-2 pt-4">
                {isAdmin ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={items.map((i) => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {items.map((item) => (
                        <SortableItem key={item.id} item={item} />
                      ))}
                    </SortableContext>
                  </DndContext>
                ) : (
                  items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="block"
                      aria-current={item.id === activeItemId ? 'page' : undefined}
                    >
                      <div
                        className={cn(
                          'flex items-center space-x-4 py-2 px-2 rounded-lg transition-colors cursor-pointer border border-border',
                          item.id === activeItemId
                            ? 'bg-gray-200/50 dark:bg-gray-800/40 border-l-4 border-gray-200 dark:border-gray-700 border-l-gray-400 dark:border-l-gray-400'
                            : 'hover:bg-gray-200/50 dark:hover:bg-gray-800/30'
                        )}
                      >
                        <div
                          className={`w-10 h-10 border bg-gradient-to-br ${item.iconBg} rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden`}
                        >
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {isMentorship ? (
        <div className="mt-4 pt-4 border-gray-300 -mx-4 px-4 pb-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full px-0 justify-start gap-3 text-xs text-gray-900 hover:bg-gray-200"
          >
            <Link href="/mentorship">
              <span className="flex items-center justify-center shrink-0 w-8">
                <SquareKanban className="!h-5 !w-5" />
              </span>
              <span>Dashboard</span>
            </Link>
          </Button>

          <ManageSubscriptionButton
            variant="ghost"
            size="sm"
            label="Abo verwalten"
            iconWrapperClassName="w-8"
            iconClassName="!h-5 !w-5"
            className="px-0 justify-start gap-3 text-xs text-gray-900 hover:bg-gray-200"
          />

          <div className="mt-3 flex items-center gap-3">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'w-8 h-8',
                },
              }}
            />

            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight truncate">
                {isLoaded ? displayName : '...'}
              </p>
              <p className="text-xs text-muted-foreground truncate">{isLoaded ? email : ''}</p>
            </div>
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={deleteCourseId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteCourseId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kurs löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Kurs &quot;
              {items.find((i) => i.id === deleteCourseId)?.title ?? 'Kurs'}&quot; und alle
              Module, Kapitel und Videos (inkl. Bunny.net) werden dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCourse}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteCourseId) return
                void confirmDeleteCourse(deleteCourseId)
              }}
              disabled={isDeletingCourse}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingCourse ? 'Lösche...' : 'Kurs löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


