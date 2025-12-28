'use client'

// components/module-card.tsx
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Trash2, Edit } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { useState } from 'react'

function formatModuleDuration(totalSeconds: number | null | undefined) {
  if (!totalSeconds || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return '—'

  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60

  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}



type Props = {
    modul: {
      id: string
      name: string
      description?: string | null
      imageUrl?: string | null 
      chapters: { length: number }[]
      totalDurationSeconds?: number | null
    }
    progress?: {
      percent: number
      completedLessons: number
      totalLessons: number
    } | null
}

export function ModuleCard({ modul, progress = null }: Props) {
    const router = useRouter()
    const { toast } = useToast()
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const { user, isLoaded } = useUser()
    const isAdmin = isLoaded && user?.organizationMemberships?.some(m => m.role === 'org:admin')
  
    const handleEdit = async (formData: FormData) => {
      setLoading(true)
      try {
        const res = await fetch(`/api/modules/${modul.id}`, {
          method: 'PATCH',
          body: formData,
        })
        if (!res.ok) throw new Error()
        router.refresh()  // List neu laden (Server-Component)
        setEditOpen(false)
        toast({ title: 'Modul aktualisiert!' })
      } catch {
        toast({ variant: 'destructive', title: 'Fehler beim Speichern' })
      } finally {
        setLoading(false)
      }
    }
  
    const handleDelete = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/modules/${modul.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error()
        router.refresh()
        setDeleteOpen(false)
        toast({ title: 'Modul gelöscht!' })
      } catch {
        toast({ variant: 'destructive', title: 'Fehler beim Löschen' })
      } finally {
        setLoading(false)
      }
    }

  
    return (
        <div className="relative group w-full">  {/* group für Hover */}
            <Card className="overflow-hidden h-full flex flex-col transition-all border-gray-200 hover:border-gray-500/50 cursor-pointer" onClick={() => router.push(`/mentorship/${modul.id}`)}>
            {/* 3-Punkte-Menü – unverändert */}
            {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute top-2 right-2 z-10 h-8 w-8 rounded-corner opacity-0 bg-gray-200/50 backdrop-blur-sm group-hover:opacity-100 transition-opacity border-gray-500/50"  // ← Hover-only sichtbar!
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Menü öffnen</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* onSelect → onClick für FULL Stop! */}
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Bearbeiten
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteOpen(true);
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}
            {/* Bild oben */}
            <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-primary/10 overflow-hidden flex items-center justify-center cursor-pointer">
                {modul.imageUrl ? (
                    <Image 
                    src={modul.imageUrl} 
                    alt={`${modul.name} Thumbnail`}
                    fill 
                    className="object-cover cursor-pointer"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    priority={false}  // Nicht für LCP, da viele Cards
                    />
                ) : (
                    <span className="text-5xl z-10 cursor-pointer">📚</span>  // z-10 über Image falls nötig
                )}
            </div>
      
            <CardContent className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-md font-semibold mb-1 leading-tight">{modul.name}</h3>
                <p className="text-sm font-light text-muted-foreground mb-6 line-clamp-3 leading-relaxed">
                  {modul.description || ''}
                </p>

                {!isAdmin ? (
                  <div className="mb-5">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-xs text-muted-foreground">
                        {progress ? (
                          <>
                            zu{' '}
                            <span className="font-medium text-foreground">
                              {progress.percent}%
                            </span>{' '}
                            komplettiert
                          </>
                        ) : (
                          'Fortschritt wird geladen...'
                        )}
                      </p>
                      {progress ? (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {progress.completedLessons}/{progress.totalLessons}
                        </p>
                      ) : null}
                    </div>
                    <Progress
                      value={progress?.percent ?? 0}
                      className={`h-2.5 ${progress ? '' : 'animate-pulse opacity-60'}`}
                    />
                  </div>
                ) : null}

                <div className="text-xs text-gray-500 flex items-center justify-between gap-3">
                  <span>{modul.chapters.length} Kapitel</span>
                  <span>{formatModuleDuration(modul.totalDurationSeconds ?? null)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
      
          {/* Modals außerhalb – safe */}
          {isAdmin && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Modul bearbeiten</DialogTitle>
                <DialogDescription>Ändere Name & Beschreibung.</DialogDescription>
                </DialogHeader>
                <form action={handleEdit} className="space-y-4">
                    <Input name="name" defaultValue={modul.name} required placeholder="Modul-Name" />
                    <Textarea name="description" defaultValue={modul.description || ''} placeholder="Beschreibung (optional)" />

                    {/* Cover Section – Preview + Upload (einmalig!) */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium block">Modul-Cover (optional)</label>
                        
                        {/* Preview wenn vorhanden */}
                        {modul.imageUrl && (
                        <div className="flex items-start space-x-3 p-3 border rounded-md bg-muted/30">
                            <Image 
                            src={modul.imageUrl} 
                            alt="Aktuelles Cover"
                            width={100}
                            height={60}
                            className="object-cover rounded flex-shrink-0"
                            />
                            <div className="min-w-0">
                            <p className="text-xs font-mono truncate bg-background px-2 py-1 rounded text-muted-foreground max-w-[200px]">
                                {modul.imageUrl.split('/').pop()}
                            </p>
                            <p className="text-xs text-muted-foreground">Neues hochladen → ersetzt automatisch.</p>
                            </div>
                        </div>
                        )}
                        
                        {/* EIN File Input */}
                        <Input 
                        type="file" 
                        name="image" 
                        accept="image/jpeg,image/png,image/webp" 
                        className="file:mr-4 file:py-2.5 file:px-4 
                                    file:rounded-full file:border-0 
                                    file:text-xs file:font-semibold 
                                    file:bg-primary file:text-primary-foreground 
                                    hover:file:bg-primary/90 cursor-pointer w-full"
                        />
                        <p className="text-xs text-muted-foreground">JPG/PNG/WebP, max 5MB, 16:9 ideal</p>
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={loading}>Speichern</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
            </Dialog>
            )}
          {isAdmin && (
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Modul löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                    {modul.name} und alle Chapters/Videos werden **komplett gelöscht**. Unwiderruflich!
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={loading}>
                    Löschen
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>
            )}
        </div>
      )
}