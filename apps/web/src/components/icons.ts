/**
 * Semantic icon vocabulary for Campus Walk.
 *
 * App code imports icons from here by what they MEAN (Icons.building,
 * Icons.condition.poor), never from lucide-react directly. That keeps one
 * place to swap an icon, and lets the /design page render the whole set.
 *
 * Conventions:
 *  - Lucide only. Custom SVGs, if ever needed, are added here on the same
 *    24px grid / 2px stroke and exported like any other entry.
 *  - Two sizes: `size-4` inline and in buttons (shadcn default),
 *    `size-5` in navigation and list rows.
 *  - Condition icons always ship with a color token AND a text label; the
 *    shape carries meaning, color reinforces it.
 *  - Icon-only buttons need an aria-label.
 */
import {
  AirVent,
  Armchair,
  ArrowRightLeft,
  Building,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleMinus,
  CircleQuestionMark,
  CircleX,
  ClipboardCheck,
  ClockArrowLeft,
  CloudCheck,
  CloudOff,
  CloudUpload,
  DoorOpen,
  Droplets,
  EllipsisVertical,
  Fan,
  Flame,
  Footprints,
  Funnel,
  Image,
  ImagePlus,
  Layers,
  Lightbulb,
  LogOut,
  MapPin,
  Menu,
  Monitor,
  NotebookPen,
  Package,
  Paperclip,
  Pencil,
  Plug,
  Plus,
  Printer,
  Projector,
  QrCode,
  RefreshCw,
  School,
  Search,
  Settings,
  ShieldAlert,
  Thermometer,
  Trash,
  TriangleAlert,
  User,
  WifiOff,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

export type { LucideIcon };

export const Icons = {
  // ---- Hierarchy: where things are
  campus: School,
  building: Building,
  floor: Layers,
  room: DoorOpen,
  location: MapPin,
  walk: Footprints,

  // ---- Assets: what is being assessed
  asset: Package,
  /** Asset categories. Extend as the data model settles. */
  assetCategory: {
    furniture: Armchair,
    technology: Monitor,
    av: Projector,
    lighting: Lightbulb,
    hvac: AirVent,
    electrical: Plug,
    plumbing: Droplets,
    fireSafety: Flame,
    climate: Thermometer,
    ventilation: Fan,
    printer: Printer,
    other: Wrench,
  },

  // ---- Assessment: condition and quality
  assessment: ClipboardCheck,
  /** Pair with a status color token and a visible label. */
  condition: {
    good: CircleCheck,
    fair: TriangleAlert,
    poor: CircleX,
    notApplicable: CircleMinus,
    unknown: CircleQuestionMark,
  },
  flagged: ShieldAlert,

  // ---- Actions on assets
  move: ArrowRightLeft,
  moveHistory: ClockArrowLeft,
  photo: Image,
  addPhoto: ImagePlus,
  camera: Camera,
  note: NotebookPen,
  attachment: Paperclip,
  scan: QrCode,

  // ---- Sync: offline-first states
  sync: {
    offline: WifiOff,
    pending: CloudUpload,
    syncing: RefreshCw,
    synced: CloudCheck,
    error: CloudOff,
  },

  // ---- Generic UI
  ui: {
    add: Plus,
    edit: Pencil,
    delete: Trash,
    confirm: Check,
    close: X,
    search: Search,
    filter: Funnel,
    more: EllipsisVertical,
    settings: Settings,
    user: User,
    signOut: LogOut,
    menu: Menu,
    chevronRight: ChevronRight,
    chevronDown: ChevronDown,
    back: ChevronLeft,
  },
} as const;
