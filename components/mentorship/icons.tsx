import type { ComponentPropsWithoutRef } from 'react'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { House as PhosphorHouse } from '@phosphor-icons/react/dist/ssr/House'
import { BookOpen as PhosphorBookOpen } from '@phosphor-icons/react/dist/ssr/BookOpen'
import { BookBookmark as PhosphorBookBookmark } from '@phosphor-icons/react/dist/ssr/BookBookmark'
import { FileText as PhosphorFileText } from '@phosphor-icons/react/dist/ssr/FileText'
import { Chats as PhosphorUsers } from '@phosphor-icons/react/dist/ssr/Chats'
import { ChartLineUp as PhosphorChartLineUp } from '@phosphor-icons/react/dist/ssr/ChartLineUp'
import { Stack as PhosphorStack } from '@phosphor-icons/react/dist/ssr/Stack'
import { Strategy as PhosphorStrategy } from '@phosphor-icons/react/dist/ssr/Strategy'
import { SlidersHorizontal as PhosphorSlidersHorizontal } from '@phosphor-icons/react/dist/ssr/SlidersHorizontal'
import { ArrowUpRight as PhosphorArrowUpRight } from '@phosphor-icons/react/dist/ssr/ArrowUpRight'
import { ArrowRight as PhosphorArrowRight } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { ArrowLeft as PhosphorArrowLeft } from '@phosphor-icons/react/dist/ssr/ArrowLeft'
import { Sun as PhosphorSun } from '@phosphor-icons/react/dist/ssr/Sun'
import { Moon as PhosphorMoon } from '@phosphor-icons/react/dist/ssr/Moon'
import { List as PhosphorList } from '@phosphor-icons/react/dist/ssr/List'
import { X as PhosphorX } from '@phosphor-icons/react/dist/ssr/X'
import { MagnifyingGlass as PhosphorMagnifyingGlass } from '@phosphor-icons/react/dist/ssr/MagnifyingGlass'
import { CheckCircle as PhosphorCheckCircle } from '@phosphor-icons/react/dist/ssr/CheckCircle'
import { Check as PhosphorCheck } from '@phosphor-icons/react/dist/ssr/Check'
import { CaretRight as PhosphorCaretRight } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { CaretDown as PhosphorCaretDown } from '@phosphor-icons/react/dist/ssr/CaretDown'
import { Play as PhosphorPlay } from '@phosphor-icons/react/dist/ssr/Play'
import { Pause as PhosphorPause } from '@phosphor-icons/react/dist/ssr/Pause'
import { FastForward as PhosphorFastForward } from '@phosphor-icons/react/dist/ssr/FastForward'
import { Rewind as PhosphorRewind } from '@phosphor-icons/react/dist/ssr/Rewind'
import { Trash as PhosphorTrash } from '@phosphor-icons/react/dist/ssr/Trash'
import { WarningCircle as PhosphorWarningCircle } from '@phosphor-icons/react/dist/ssr/WarningCircle'
import { CalendarDots as PhosphorCalendarDots } from '@phosphor-icons/react/dist/ssr/CalendarDots'
import { Star as PhosphorStar } from '@phosphor-icons/react/dist/ssr/Star'
import { SidebarSimple as PhosphorSidebarSimple } from '@phosphor-icons/react/dist/ssr/SidebarSimple'
import { SquaresFour as PhosphorSquaresFour } from '@phosphor-icons/react/dist/ssr/SquaresFour'
import { ListBullets as PhosphorListBullets } from '@phosphor-icons/react/dist/ssr/ListBullets'
import { CreditCard as PhosphorCreditCard } from '@phosphor-icons/react/dist/ssr/CreditCard'
import { UserCircle as PhosphorUserCircle } from '@phosphor-icons/react/dist/ssr/UserCircle'

type IconProps = ComponentPropsWithoutRef<'svg'>

// Official Phosphor Bold glyphs. Direct SSR imports also work in client components.
function Icon({ glyph: Glyph, ...props }: IconProps & { glyph: PhosphorIcon }) {
  return <Glyph size={24} weight="bold" focusable="false"
    aria-hidden={props['aria-label'] ? undefined : true}
    role={props['aria-label'] ? 'img' : undefined} {...props} />
}

export function House(props: IconProps) { return <Icon glyph={PhosphorHouse} {...props} /> }
export function BookOpen(props: IconProps) { return <Icon glyph={PhosphorBookOpen} {...props} /> }
export function BookBookmark(props: IconProps) { return <Icon glyph={PhosphorBookBookmark} {...props} /> }
export function FileText(props: IconProps) { return <Icon glyph={PhosphorFileText} {...props} /> }
export function Users(props: IconProps) { return <Icon glyph={PhosphorUsers} {...props} /> }
export function ChartLineUp(props: IconProps) { return <Icon glyph={PhosphorChartLineUp} {...props} /> }
export function Stack(props: IconProps) { return <Icon glyph={PhosphorStack} {...props} /> }
export function Strategy(props: IconProps) { return <Icon glyph={PhosphorStrategy} {...props} /> }
export function SlidersHorizontal(props: IconProps) { return <Icon glyph={PhosphorSlidersHorizontal} {...props} /> }
export function ArrowUpRight(props: IconProps) { return <Icon glyph={PhosphorArrowUpRight} {...props} /> }
export function ArrowRight(props: IconProps) { return <Icon glyph={PhosphorArrowRight} {...props} /> }
export function ArrowLeft(props: IconProps) { return <Icon glyph={PhosphorArrowLeft} {...props} /> }
export function Sun(props: IconProps) { return <Icon glyph={PhosphorSun} {...props} /> }
export function Moon(props: IconProps) { return <Icon glyph={PhosphorMoon} {...props} /> }
export function List(props: IconProps) { return <Icon glyph={PhosphorList} {...props} /> }
export function X(props: IconProps) { return <Icon glyph={PhosphorX} {...props} /> }
export function MagnifyingGlass(props: IconProps) { return <Icon glyph={PhosphorMagnifyingGlass} {...props} /> }
export function CheckCircle(props: IconProps) { return <Icon glyph={PhosphorCheckCircle} {...props} /> }
export function Check(props: IconProps) { return <Icon glyph={PhosphorCheck} {...props} /> }
export function CaretRight(props: IconProps) { return <Icon glyph={PhosphorCaretRight} {...props} /> }
export function CaretDown(props: IconProps) { return <Icon glyph={PhosphorCaretDown} {...props} /> }
export function Play(props: IconProps) { return <Icon glyph={PhosphorPlay} {...props} /> }
export function Pause(props: IconProps) { return <Icon glyph={PhosphorPause} {...props} /> }
export function FastForward(props: IconProps) { return <Icon glyph={PhosphorFastForward} {...props} /> }
export function Rewind(props: IconProps) { return <Icon glyph={PhosphorRewind} {...props} /> }
export function Trash(props: IconProps) { return <Icon glyph={PhosphorTrash} {...props} /> }
export function WarningCircle(props: IconProps) { return <Icon glyph={PhosphorWarningCircle} {...props} /> }
export function CalendarDots(props: IconProps) { return <Icon glyph={PhosphorCalendarDots} {...props} /> }
export function Star(props: IconProps) { return <Icon glyph={PhosphorStar} {...props} /> }
export function SidebarSimple(props: IconProps) { return <Icon glyph={PhosphorSidebarSimple} {...props} /> }
export function SquaresFour(props: IconProps) { return <Icon glyph={PhosphorSquaresFour} {...props} /> }
export function ListBullets(props: IconProps) { return <Icon glyph={PhosphorListBullets} {...props} /> }
export function CreditCard(props: IconProps) { return <Icon glyph={PhosphorCreditCard} {...props} /> }
export function UserCircle(props: IconProps) { return <Icon glyph={PhosphorUserCircle} {...props} /> }
