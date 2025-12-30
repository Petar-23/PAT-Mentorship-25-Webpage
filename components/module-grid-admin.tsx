'use client'

import { useState } from 'react'
import { ModuleCard } from './module-card'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { upload } from '@vercel/blob/client'
import Image from 'next/image'
import { Grip } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Props = {
  modules: Array<{
    id: string
    name: string
    description: string | null
    imageUrl: string | null
    chaptersCount: number
    totalDurationSeconds: number | null
  }>
  playlistId: string
  playlistName?: string
  mobileCoursesDrawer?: ReactNode
}

export function ModuleGridAdmin({ modules, playlistId, playlistName, mobileCoursesDrawer }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [items, setItems] = useState(modules.map((m) => m.id))
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Für Bild-Vorschau im Modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.indexOf(active.id as string)
    const newIndex = items.indexOf(over.id as string)
    const newItems = arrayMove(items, oldIndex, newIndex)
    setItems(newItems)

    try {
      const res = await fetch('/api/modules/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleIds: newItems, playlistId }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Reihenfolge gespeichert!' })
    } catch {
      toast({ variant: 'destructive', title: 'Fehler beim Speichern' })
    }
  }

  // Optimistische Anzeige: Module in der Reihenfolge von `items` sortieren
  const sortedModules = [...modules].sort((a, b) => {
    const aIndex = items.indexOf(a.id)
    const bIndex = items.indexOf(b.id)
    return aIndex - bIndex
  })

  // Neues Modul mit optionalem Bild hochladen
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Name ist erforderlich' })
      return
    }

    setIsUploading(true)

    let imageUrl: string | null = null
    const file = formData.get('image') as File | null

    if (file && file.size > 0) {
      try {
        const newBlob = await upload(`modules/${file.name}`, file, {
          access: 'public',
          handleUploadUrl: '/api/modul-upload',
        })
        imageUrl = newBlob.url
      } catch (error) {
        console.error('Bild-Upload fehlgeschlagen:', error)
        toast({ variant: 'destructive', title: 'Bild konnte nicht hochgeladen werden' })
        setIsUploading(false)
        return
      }
    }

    try {
      const res = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: (formData.get('description') as string)?.trim() || null,
          imageUrl,
          playlistId,
        }),
      })

      if (!res.ok) throw new Error()

      router.refresh()
      toast({ title: 'Modul erfolgreich erstellt!' })
      setIsModalOpen(false)
      setPreviewUrl(null)
      ;(e.target as HTMLFormElement).reset()
    } catch {
      toast({ variant: 'destructive', title: 'Fehler beim Speichern des Moduls' })
    } finally {
      setIsUploading(false)
    }
  }

  // Neue kleine Komponente – nur für Drag & Drop
  function SortableModuleCard({ modul }: { modul: Props['modules'][0] }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: modul.id,
    })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.7 : 1,
      zIndex: isDragging ? 10 : 0,
    }

    return (
      <div ref={setNodeRef} style={style} className="relative group w-full">
        {/* Grip-Icon – draggable Handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 z-20 p-1.5 rounded-md opacity-0 group-hover:opacity-100 bg-gray-200/50 backdrop-blur-sm border-gray-500 transition-all cursor-grab active:cursor-grabbing"
        >
          <Grip className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="h-full">
          <ModuleCard modul={modul} />
        </div>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={rectSortingStrategy}>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="mb-8 flex items-center gap-2">
            {mobileCoursesDrawer}
            <h1 className="text-lg font-semibold text-foreground">{playlistName || 'Module'}</h1>
          </div>

          <div className="grid w-full max-w-[1920px] grid-cols-1 md:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-4 gap-6 auto-rows-fr">
            {sortedModules.map((modul) => (
              <SortableModuleCard key={modul.id} modul={modul} />
            ))}

            {/* + Kachel */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Card className="h-full w-full flex flex-col items-center justify-center cursor-pointer border border-gray-300 hover:border-gray-500/50 transition-all group bg-muted/30">
                  <CardContent className="flex-1 p-8 flex flex-col items-center justify-center text-center">
                    <div className="text-2xl mb-6 text-muted-foreground">+</div>
                    <h3 className="text-md font-semibold mb-1">Neues Modul</h3>
                    <p className="text-sm text-muted-foreground">Anlegen mit Titelbild</p>
                  </CardContent>
                </Card>
              </DialogTrigger>

              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Neues Modul zu {playlistId || 'Playlist'}</DialogTitle>
                  <DialogDescription>
                    Name, Beschreibung und Titelbild direkt hochladen.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <input type="hidden" name="playlistId" value={playlistId} />

                  <div className="space-y-2">
                    <Label htmlFor="name">Modul-Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="z. B. Modul 1: Einstieg"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Beschreibung (optional)</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Kurze Beschreibung..."
                      rows={3}
                    />
                  </div>

                  {/* Bild-Upload mit Vorschau */}
                  <div className="space-y-2">
                    <Label htmlFor="image">Titelbild (optional)</Label>
                    <Input
                      id="image"
                      name="image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) setPreviewUrl(URL.createObjectURL(file))
                        else setPreviewUrl(null)
                      }}
                    />

                    {previewUrl && (
                      <div className="relative aspect-video rounded-lg overflow-hidden border">
                        <Image src={previewUrl} alt="Vorschau" fill className="object-cover" />
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button type="submit" disabled={isUploading} className="w-full">
                      {isUploading ? 'Wird erstellt...' : 'Modul erstellen'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </SortableContext>
    </DndContext>
  )
}


