'use client'
// components/sidebar-admin.tsx

import Link from 'next/link'
import Image from 'next/image'
import { BookOpen } from '@phosphor-icons/react/BookOpen'
import { ChartLineUp } from '@phosphor-icons/react/ChartLineUp'
import { DotsSixVertical as GripVertical } from '@phosphor-icons/react/DotsSixVertical'
import { DotsThreeVertical as MoreVertical } from '@phosphor-icons/react/DotsThreeVertical'
import { FileText } from '@phosphor-icons/react/FileText'
import { House } from '@phosphor-icons/react/House'
import { Gear } from '@phosphor-icons/react/Gear'
import { useMentorshipNavigation, useMentorshipMobileNavigation, useMentorshipTheme } from '@/components/mentorship/shell'
import { Pencil } from '@phosphor-icons/react/Pencil'
import { Plus } from '@phosphor-icons/react/Plus'
import { Trash as Trash2 } from '@phosphor-icons/react/Trash'
import { Users } from '@phosphor-icons/react/Users'


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

type Page = {
  id: string
  title: string
  slug: string
  description?: string | null
  iconUrl?: string | null
  published: boolean
}

type SidebarItem = {
  id: string
  title: string
  subtitle: string
  href: string
  icon: ReactNode
}

type Props = {
  kurse: Kurs[]
  pages?: Page[]
  savedSidebarOrder?: string[] | null
  activeCourseId?: string | null
  isAdmin: boolean
  openCreateCourseModal?: boolean
  onNavigate?: () => void
}

const EMPTY_PAGES: Page[] = []
const STATIC_SIDEBAR_ITEM_IDS = new Set(['discord', 'indicators'])

  function SortableItem({ item, activeItemId, isAdmin, onNavigate, onEditPage, onEditCourse, onDeletePage, onDeleteCourse }: {
  item: SidebarItem
  activeItemId: string | null
  isAdmin: boolean
  onNavigate?: () => void
  onEditPage: (id: string) => void
  onEditCourse: (id: string) => void
  onDeletePage: (id: string) => void
  onDeleteCourse: (id: string) => void
}) {
    const { container: portalContainer } = useMentorshipMobileNavigation()
    const theme = useMentorshipTheme()
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
            'm-admin-nav-row',
            item.id === activeItemId && 'is-active'
          )}
        >
          {/* Drag-Handle – nur für Admin */}
          {isAdmin && (
            <button type="button"
              {...attributes} {...listeners}
              className="m-admin-drag" aria-label={`${item.title} verschieben`}
            >
              <GripVertical className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          {/* Klickbarer Bereich */}
          <Link
            href={item.href}
            prefetch={false}
            className="m-admin-nav-link" onClick={onNavigate}
            aria-current={item.id === activeItemId ? 'page' : undefined}
          >
            <div
              className="m-admin-nav-icon"
            >
              {item.icon}
            </div>

            <div className="flex-1 min-w-0">
              <p className="m-admin-nav-title">{item.title}</p>
              <p className="m-admin-nav-detail">{item.subtitle}</p>
            </div>
          </Link>

          {/* 3-Dots Menü – nur Admin */}
          {isAdmin && !STATIC_SIDEBAR_ITEM_IDS.has(item.id) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="m-admin-menu"
                  aria-label={`Aktionen für ${item.title}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              {item.id.startsWith('page:') ? (
                <DropdownMenuContent container={portalContainer} data-theme={theme} align="end" className="mentorship-portal m-admin-popover w-44">
                  <DropdownMenuItem className="gap-2" onSelect={() => onEditPage(item.id.replace('page:', ''))}>
                    <Pencil className="h-4 w-4" />
                    Bearbeiten
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 text-destructive focus:text-destructive"
                    onSelect={() => onDeletePage(item.id.replace('page:', ''))}
                  >
                    <Trash2 className="h-4 w-4" />
                    Seite löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              ) : (
                <DropdownMenuContent container={portalContainer} data-theme={theme} align="end" className="mentorship-portal m-admin-popover w-44">
                  <DropdownMenuItem className="gap-2" onSelect={() => onEditCourse(item.id)}>
                    <Pencil className="h-4 w-4" />
                    Bearbeiten
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 text-destructive focus:text-destructive"
                    onSelect={() => onDeleteCourse(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Kurs löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              )}
            </DropdownMenu>
          )}
        </div>
      </div>
    )
  }


export function SidebarAdmin({
  kurse,
  pages = EMPTY_PAGES,
  savedSidebarOrder,
  activeCourseId,
  isAdmin,
  openCreateCourseModal,
  onNavigate,
}: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const isMentorship = pathname?.startsWith('/mentorship')
  const { container: portalContainer } = useMentorshipMobileNavigation()
  const theme = useMentorshipTheme()
  const lastAdminControl = useRef<HTMLButtonElement | null>(null)
  const captureAdminControl = (event: React.SyntheticEvent<HTMLElement>) => {
    const trigger = (event.target as HTMLElement).closest('button.m-admin-menu')
    if (trigger instanceof HTMLButtonElement) lastAdminControl.current = trigger
  }
  const restoreAdminFocus = (event: Event) => {
    event.preventDefault()
    if (lastAdminControl.current?.isConnected) lastAdminControl.current.focus()
  }
  const navigationOpen = useMentorshipNavigation()
  const hidden = isMentorship && !onNavigate && !navigationOpen
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

  // Page modal state
  const [isPageModalOpen, setIsPageModalOpen] = useState(false)
  const [pageModalMode, setPageModalMode] = useState<'create' | 'edit'>('create')
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [pageName, setPageName] = useState('')
  const [pageDescription, setPageDescription] = useState('')
  const [existingPageIconUrl, setExistingPageIconUrl] = useState<string | null>(null)
  const [removePageIcon, setRemovePageIcon] = useState(false)
  const [pageIconFile, setPageIconFile] = useState<File | null>(null)
  const [pageIconPreviewUrl, setPageIconPreviewUrl] = useState<string | null>(null)
  const [isSavingPage, setIsSavingPage] = useState(false)
  const [deletingPageId, setDeletingPageId] = useState<string | null>(null)
  const [isDeletingPage, setIsDeletingPage] = useState(false)
  const [localPages, setLocalPages] = useState<Page[]>(pages)
  const deleteCourseAbortRef = useRef<AbortController | null>(null)
  const saveCourseAbortRef = useRef<AbortController | null>(null)
  const savePageAbortRef = useRef<AbortController | null>(null)
  const deletePageAbortRef = useRef<AbortController | null>(null)
  const sidebarOrderAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      deleteCourseAbortRef.current?.abort()
      saveCourseAbortRef.current?.abort()
      savePageAbortRef.current?.abort()
      deletePageAbortRef.current?.abort()
      sidebarOrderAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl)
    }
  }, [iconPreviewUrl])

  useEffect(() => {
    return () => {
      if (pageIconPreviewUrl) URL.revokeObjectURL(pageIconPreviewUrl)
    }
  }, [pageIconPreviewUrl])

  const resetPageModal = () => {
    if (pageIconPreviewUrl) URL.revokeObjectURL(pageIconPreviewUrl)
    setEditingPageId(null)
    setPageModalMode('create')
    setPageName('')
    setPageDescription('')
    setExistingPageIconUrl(null)
    setRemovePageIcon(false)
    setPageIconFile(null)
    setPageIconPreviewUrl(null)
    setIsSavingPage(false)
  }

  const closePageModal = () => {
    if (isSavingPage) return
    setIsPageModalOpen(false)
    resetPageModal()
  }

  const openCreatePageDialog = () => {
    resetPageModal()
    setPageModalMode('create')
    setIsPageModalOpen(true)
  }

  const openEditPageDialog = (pageId: string) => {
    const page = localPages.find((p) => p.id === pageId)
    resetPageModal()
    setPageModalMode('edit')
    setEditingPageId(pageId)
    setPageName(page?.title ?? '')
    setPageDescription(page?.description ?? '')
    setExistingPageIconUrl(page?.iconUrl ?? null)
    setIsPageModalOpen(true)
  }

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
    if (pathname?.startsWith('/mentorship/indicators')) return 'indicators'
    if (activeCourseId) return activeCourseId

    // Check if on a page route
    const pageMatch = pathname?.match(/^\/mentorship\/page\/([^/]+)$/)
    if (pageMatch) {
      const slug = pageMatch[1]
      const page = localPages.find((p) => p.slug === slug)
      if (page) return `page:${page.id}`
    }

    const match = pathname?.match(/^\/mentorship\/([^/]+)$/)
    return match?.[1] ?? null
  }, [pathname, activeCourseId, localPages])

  async function confirmDeleteCourse(courseId: string) {
    setIsDeletingCourse(true)
    deleteCourseAbortRef.current?.abort()
    const controller = new AbortController()
    deleteCourseAbortRef.current = controller

    toast({
      title: 'Lösche Kurs...',
      description: 'Bitte einen Moment.',
    })

    try {
      const res = await fetch(`/api/playlists/${courseId}`, {
        method: 'DELETE',
        signal: controller.signal,
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

      if (controller.signal.aborted) return

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
      if (controller.signal.aborted) return

      const message = error instanceof Error ? error.message : String(error)
      toast({
        variant: 'destructive',
        title: 'Fehler beim Löschen',
        description: message,
      })
    } finally {
      if (deleteCourseAbortRef.current === controller) deleteCourseAbortRef.current = null
      if (!controller.signal.aborted) {
        setIsDeletingCourse(false)
        setDeleteCourseId(null)
      }
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
    saveCourseAbortRef.current?.abort()
    const controller = new AbortController()
    saveCourseAbortRef.current = controller

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
          abortSignal: controller.signal,
        })
        if (controller.signal.aborted) return

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
        signal: controller.signal,
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
      if (controller.signal.aborted) return

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
      if (controller.signal.aborted) return

      const message = error instanceof Error ? error.message : String(error)
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: message,
      })
    } finally {
      if (saveCourseAbortRef.current === controller) saveCourseAbortRef.current = null
      if (!controller.signal.aborted) setIsSavingCourse(false)
    }
  }

  async function handleSavePage() {
    const title = pageName.trim()
    if (!title) {
      toast({ variant: 'destructive', title: 'Titel ist erforderlich' })
      return
    }

    setIsSavingPage(true)
    savePageAbortRef.current?.abort()
    const controller = new AbortController()
    savePageAbortRef.current = controller

    toast({
      title: pageModalMode === 'create' ? 'Seite wird erstellt...' : 'Seite wird gespeichert...',
      description: 'Bitte einen Moment.',
    })

    try {
      const description = pageDescription.trim() || null
      let iconUrl: string | null = existingPageIconUrl

      if (pageIconFile && pageIconFile.size > 0) {
        const newBlob = await upload(`page-icons/${pageIconFile.name}`, pageIconFile, {
          access: 'public',
          handleUploadUrl: '/api/page-icon-upload',
          abortSignal: controller.signal,
        })
        if (controller.signal.aborted) return

        iconUrl = newBlob.url
      } else if (removePageIcon) {
        iconUrl = null
      }

      const url = pageModalMode === 'create' ? '/api/pages' : `/api/pages/${editingPageId}`
      const method = pageModalMode === 'create' ? 'POST' : 'PATCH'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ title, description, iconUrl }),
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

      const savedPage = (await res.json()) as { id: string; title: string; slug: string; description: string | null; iconUrl: string | null; published: boolean }
      if (controller.signal.aborted) return

      toast({
        title: pageModalMode === 'create' ? 'Seite erstellt' : 'Seite gespeichert',
        description: pageModalMode === 'create' ? 'Die Seite wurde angelegt.' : 'Änderungen übernommen.',
      })

      setIsPageModalOpen(false)
      resetPageModal()

      if (pageModalMode === 'create') {
        setLocalPages((prev) => [...prev, savedPage])
        router.push(`/mentorship/page/${savedPage.slug}`)
      } else {
        setLocalPages((prev) => prev.map((p) => p.id === savedPage.id ? savedPage : p))
        router.refresh()
      }
    } catch (error: unknown) {
      if (controller.signal.aborted) return

      const message = error instanceof Error ? error.message : String(error)
      toast({ variant: 'destructive', title: 'Fehler', description: message })
    } finally {
      if (savePageAbortRef.current === controller) savePageAbortRef.current = null
      if (!controller.signal.aborted) setIsSavingPage(false)
    }
  }

  // Alle Nav-Items: Discord fest + Kurse
  const staticItems = useMemo<SidebarItem[]>(
    () => [
      {
        id: 'discord',
        title: 'Discord Community',
        subtitle: 'Live Streams & Chat',
        href: '/mentorship/discord',
        icon: <Users className="h-5 w-5" />,
      },
      {
        id: 'indicators',
        title: 'Indikatoren',
        subtitle: 'TradingView Claims',
        href: '/mentorship/indicators',
        icon: <ChartLineUp className="h-5 w-5" />,
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
          <BookOpen className="h-5 w-5" />
        ),
      })),
      ...localPages.map((page) => ({
        id: `page:${page.id}`,
        title: page.title,
        subtitle: page.description ?? 'Seite',
        href: `/mentorship/page/${page.slug}`,
        icon: page.iconUrl ? (
          <div className="relative w-full h-full">
            <Image
              src={page.iconUrl}
              alt={`${page.title} Icon`}
              fill
              sizes="40px"
              className="object-cover"
              quality={70}
            />
          </div>
        ) : (
          <FileText className="h-5 w-5" />
        ),
      })),
    ],
    [kurse, localPages]
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

  // Sync localPages when pages prop changes
  useEffect(() => {
    setLocalPages(pages)
  }, [pages])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!isAdmin || !over || active.id === over.id || sidebarOrderAbortRef.current) return
    const oldIndex = items.findIndex(item => item.id === active.id)
    const newIndex = items.findIndex(item => item.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const previous = items
    const next = arrayMove(items, oldIndex, newIndex)
    const controller = new AbortController()
    sidebarOrderAbortRef.current = controller
    setItems(next)
    try {
      const response = await fetch('/api/admin-settings/sidebar-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: controller.signal, body: JSON.stringify({ order: next.map(item => item.id) }),
      })
      if (controller.signal.aborted) return
      if (!response.ok) throw new Error('Sortierung konnte nicht gespeichert werden.')
      toast({ title: 'Reihenfolge gespeichert', duration: 3000 })
    } catch {
      if (controller.signal.aborted) return
      setItems(previous)
      toast({ title: 'Reihenfolge nicht gespeichert', description: 'Die bisherige Sortierung wurde wiederhergestellt. Bitte erneut versuchen.', variant: 'destructive' })
    } finally {
      if (sidebarOrderAbortRef.current === controller) sidebarOrderAbortRef.current = null
    }
  }

  return (
    <aside className="m-sidebar m-admin-sidebar" onPointerDownCapture={captureAdminControl} onKeyDownCapture={captureAdminControl}
      id={onNavigate ? undefined : 'mentorship-desktop-navigation'}
      aria-label="Mentorship-Verwaltung" aria-hidden={hidden || undefined}
      ref={element => { if (element) element.inert = hidden }}>
      <Link href="/mentorship" prefetch={false} className="m-nav-link m-nav-home" onClick={onNavigate}
        aria-current={pathname === '/mentorship' ? 'page' : undefined}>
        <House aria-hidden="true" /><span>Übersicht</span>
      </Link>

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
        <DialogContent closeLabel="Schließen" container={portalContainer} data-theme={theme} onCloseAutoFocus={restoreAdminFocus} className="mentorship-typography m-admin-dialog sm:max-w-lg">
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
                    <Image
                      src={iconPreviewUrl}
                      alt="Icon Vorschau"
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
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

      <div className="m-admin-nav-heading">
        <p className="m-nav-label">Inhalte verwalten</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="m-admin-menu" aria-label="Inhalt anlegen">
              <Plus aria-hidden="true" className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent container={portalContainer} data-theme={theme} align="end" className="mentorship-portal m-admin-popover">
            <DropdownMenuItem onSelect={openCreateCourseDialog}><BookOpen className="mr-2 h-4 w-4" />Kurs erstellen</DropdownMenuItem>
            <DropdownMenuItem onSelect={openCreatePageDialog}><FileText className="mr-2 h-4 w-4" />Seite erstellen</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <nav className="m-admin-nav-scroll" aria-label="Kurse und Seiten">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
            {items.map(item => (
              <SortableItem key={item.id} item={item} activeItemId={activeItemId} isAdmin={isAdmin}
                onNavigate={onNavigate} onEditPage={openEditPageDialog} onEditCourse={openEditCourseDialog}
                onDeletePage={setDeletingPageId} onDeleteCourse={setDeleteCourseId} />
            ))}
          </SortableContext>
        </DndContext>
      </nav>
      <div className="m-sidebar-footer">
        <Link href="/owner" prefetch={false} className="m-account-link" onClick={onNavigate}>
          <Gear aria-hidden="true" /><span>Verwaltung</span>
        </Link>
        <ManageSubscriptionButton variant="ghost" label="Mitgliedschaft" className="m-account-link" />
      </div>

      <AlertDialog
        open={deleteCourseId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteCourseId(null)
        }}
      >
        <AlertDialogContent container={portalContainer} data-theme={theme} onCloseAutoFocus={restoreAdminFocus} className="mentorship-typography m-admin-dialog">
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

      {/* Page Delete Confirmation */}
      <AlertDialog
        open={deletingPageId !== null}
        onOpenChange={(open) => { if (!open) setDeletingPageId(null) }}
      >
        <AlertDialogContent container={portalContainer} data-theme={theme} onCloseAutoFocus={restoreAdminFocus} className="mentorship-typography m-admin-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Seite löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Seite &quot;
              {localPages.find((p) => p.id === deletingPageId)?.title ?? 'Seite'}&quot; wird dauerhaft gelöscht.
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPage}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingPage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deletingPageId) return
                const pageId = deletingPageId
                deletePageAbortRef.current?.abort()
                const controller = new AbortController()
                deletePageAbortRef.current = controller

                setIsDeletingPage(true)
                toast({ title: 'Lösche Seite...', description: 'Bitte einen Moment.' })
                try {
                  const res = await fetch(`/api/pages/${pageId}`, {
                    method: 'DELETE',
                    signal: controller.signal,
                  })
                  if (!res.ok) throw new Error('Löschen fehlgeschlagen')
                  if (controller.signal.aborted) return

                  setLocalPages((prev) => prev.filter((p) => p.id !== pageId))
                  setItems((prev) => prev.filter((i) => i.id !== `page:${pageId}`))
                  toast({ title: 'Seite gelöscht', description: 'Die Seite wurde entfernt.' })
                  if (pathname === `/mentorship/page/${localPages.find((p) => p.id === pageId)?.slug}`) {
                    router.push('/mentorship')
                  } else {
                    router.refresh()
                  }
                } catch (err: unknown) {
                  if (controller.signal.aborted) return

                  const message = err instanceof Error ? err.message : String(err)
                  toast({ variant: 'destructive', title: 'Fehler', description: message })
                } finally {
                  if (deletePageAbortRef.current === controller) deletePageAbortRef.current = null
                  if (!controller.signal.aborted) {
                    setIsDeletingPage(false)
                    setDeletingPageId(null)
                  }
                }
              }}
            >
              {isDeletingPage ? 'Lösche...' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Page Create/Edit Modal */}
      <Dialog open={isPageModalOpen} onOpenChange={(open) => { if (!open) closePageModal() }}>
        <DialogContent className="mentorship-typography sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pageModalMode === 'create' ? 'Neue Seite erstellen' : 'Seite bearbeiten'}</DialogTitle>
            <DialogDescription>
              {pageModalMode === 'create' ? 'Erstelle eine neue Rich-Text-Seite.' : 'Bearbeite die Seitendetails.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); void handleSavePage() }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="page-title">Titel *</Label>
              <Input
                id="page-title"
                value={pageName}
                onChange={(e) => setPageName(e.target.value)}
                placeholder="z.B. Glossar, FAQ, Leitfaden..."
                required
                disabled={isSavingPage}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="page-description">Beschreibung</Label>
              <Textarea
                id="page-description"
                value={pageDescription}
                onChange={(e) => setPageDescription(e.target.value)}
                placeholder="Kurze Beschreibung der Seite..."
                rows={3}
                disabled={isSavingPage}
              />
            </div>

            {/* Icon Upload */}
            <div className="space-y-2">
              <Label>Icon (optional)</Label>
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-700/80 to-emerald-600/70 flex items-center justify-center overflow-hidden flex-shrink-0 border">
                  {pageIconPreviewUrl ? (
                    <Image src={pageIconPreviewUrl} alt="Vorschau" fill sizes="40px" className="object-cover" unoptimized />
                  ) : existingPageIconUrl && !removePageIcon ? (
                    <Image src={existingPageIconUrl} alt="Aktuelles Icon" fill sizes="40px" className="object-cover" unoptimized />
                  ) : (
                    <FileText className="h-5 w-5 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isSavingPage}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (pageIconPreviewUrl) URL.revokeObjectURL(pageIconPreviewUrl)
                      setPageIconFile(file)
                      setPageIconPreviewUrl(URL.createObjectURL(file))
                      setRemovePageIcon(false)
                    }}
                    className="text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                  />
                </div>
              </div>

              {(existingPageIconUrl || pageIconFile) && !removePageIcon && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSavingPage}
                  onClick={() => {
                    setRemovePageIcon(true)
                    setExistingPageIconUrl(null)
                    if (pageIconPreviewUrl) URL.revokeObjectURL(pageIconPreviewUrl)
                    setPageIconPreviewUrl(null)
                    setPageIconFile(null)
                  }}
                >
                  Icon entfernen
                </Button>
              )}
              {pageIconFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSavingPage}
                  onClick={() => {
                    if (pageIconPreviewUrl) URL.revokeObjectURL(pageIconPreviewUrl)
                    setPageIconPreviewUrl(null)
                    setPageIconFile(null)
                  }}
                >
                  Auswahl zurücksetzen
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Tipp: Quadratische Bilder sehen am besten aus.</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closePageModal} disabled={isSavingPage}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSavingPage}>
                {isSavingPage
                  ? pageModalMode === 'create' ? 'Erstelle...' : 'Speichere...'
                  : pageModalMode === 'create' ? 'Seite erstellen' : 'Speichern'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
