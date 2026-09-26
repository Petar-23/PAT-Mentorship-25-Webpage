import type { ComponentPropsWithoutRef } from 'react'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { ArrowClockwise as PhosphorArrowClockwise } from '@phosphor-icons/react/dist/ssr/ArrowClockwise'
import { ArrowRight as PhosphorArrowRight } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { ArrowUpRight as PhosphorArrowUpRight } from '@phosphor-icons/react/dist/ssr/ArrowUpRight'
import { CheckCircle as PhosphorCheckCircle } from '@phosphor-icons/react/dist/ssr/CheckCircle'
import { FileText as PhosphorFileText } from '@phosphor-icons/react/dist/ssr/FileText'
import { House as PhosphorHouse } from '@phosphor-icons/react/dist/ssr/House'
import { Info as PhosphorInfo } from '@phosphor-icons/react/dist/ssr/Info'
import { List as PhosphorList } from '@phosphor-icons/react/dist/ssr/List'
import { Moon as PhosphorMoon } from '@phosphor-icons/react/dist/ssr/Moon'
import { SidebarSimple as PhosphorSidebarSimple } from '@phosphor-icons/react/dist/ssr/SidebarSimple'
import { Sun as PhosphorSun } from '@phosphor-icons/react/dist/ssr/Sun'
import { Tag as PhosphorTag } from '@phosphor-icons/react/dist/ssr/Tag'
import { UserCircle as PhosphorUserCircle } from '@phosphor-icons/react/dist/ssr/UserCircle'
import { WarningCircle as PhosphorWarningCircle } from '@phosphor-icons/react/dist/ssr/WarningCircle'
import { X as PhosphorX } from '@phosphor-icons/react/dist/ssr/X'

// Eigene Icon-Datei für PAT Research, gleiche Darstellung wie
// components/mentorship/icons.tsx (Phosphor Bold, 24 px, dekorativ ohne Label).
// Research importiert bewusst NICHT die Mentorship-Sammeldatei: Nutzt eine
// Research-Clientkomponente dort ein Icon, das die Mentorship im Browser nicht
// braucht, markiert Webpacks Tree-Shaking es als benutzt und es landet im
// Mentorship-Bundle.

type IconProps = ComponentPropsWithoutRef<'svg'>

function Icon({ glyph: Glyph, ...props }: IconProps & { glyph: PhosphorIcon }) {
  return <Glyph size={24} weight="bold" focusable="false"
    aria-hidden={props['aria-label'] ? undefined : true}
    role={props['aria-label'] ? 'img' : undefined} {...props} />
}

export function ArrowClockwise(props: IconProps) { return <Icon glyph={PhosphorArrowClockwise} {...props} /> }
export function ArrowRight(props: IconProps) { return <Icon glyph={PhosphorArrowRight} {...props} /> }
export function ArrowUpRight(props: IconProps) { return <Icon glyph={PhosphorArrowUpRight} {...props} /> }
export function CheckCircle(props: IconProps) { return <Icon glyph={PhosphorCheckCircle} {...props} /> }
export function FileText(props: IconProps) { return <Icon glyph={PhosphorFileText} {...props} /> }
export function House(props: IconProps) { return <Icon glyph={PhosphorHouse} {...props} /> }
export function Info(props: IconProps) { return <Icon glyph={PhosphorInfo} {...props} /> }
export function List(props: IconProps) { return <Icon glyph={PhosphorList} {...props} /> }
export function Moon(props: IconProps) { return <Icon glyph={PhosphorMoon} {...props} /> }
export function SidebarSimple(props: IconProps) { return <Icon glyph={PhosphorSidebarSimple} {...props} /> }
export function Sun(props: IconProps) { return <Icon glyph={PhosphorSun} {...props} /> }
export function Tag(props: IconProps) { return <Icon glyph={PhosphorTag} {...props} /> }
export function UserCircle(props: IconProps) { return <Icon glyph={PhosphorUserCircle} {...props} /> }
export function WarningCircle(props: IconProps) { return <Icon glyph={PhosphorWarningCircle} {...props} /> }
export function X(props: IconProps) { return <Icon glyph={PhosphorX} {...props} /> }
