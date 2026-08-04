import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import {
  Activity,
  Aperture,
  Archive,
  ArrowLeft,
  ArrowRight,
  Award,
  Calendar,
  Camera,
  CameraOff,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  CirclePause,
  CirclePlus,
  CircleX,
  Clock,
  Cloud,
  CloudSun,
  CloudUpload,
  Droplet,
  Ellipsis,
  EllipsisVertical,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Gift,
  Globe,
  Grid2x2,
  HardDrive,
  Image,
  Inbox,
  Info,
  Layers,
  List,
  MapPin,
  Maximize,
  Menu,
  Minus,
  Moon,
  Package,
  PenLine,
  Pencil,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Syringe,
  Target,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Type,
  User,
  WifiOff,
  Wind,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';

/**
 * App-wide icon adapter backed by lucide-react-native.
 *
 * Historically the app used `<Feather name="…" />` from @expo/vector-icons.
 * This component keeps that same string-name API — so data-driven usages
 * (calendar cells, action-sheet rows, tab configs that store an icon name as
 * data) keep working — while rendering the visually-equivalent Lucide glyph.
 *
 * Lucide is itself a fork of Feather, so most names map 1:1; the map below
 * covers the handful Lucide has since renamed (e.g. `alert-circle` →
 * `CircleAlert`, `more-vertical` → `EllipsisVertical`).
 */
const ICON_MAP = {
  'activity': Activity,
  'alert-circle': CircleAlert,
  'alert-triangle': TriangleAlert,
  'aperture': Aperture,
  'archive': Archive,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'award': Award,
  'calendar': Calendar,
  'camera': Camera,
  'camera-off': CameraOff,
  'check': Check,
  'check-circle': CircleCheck,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'circle': Circle,
  'clock': Clock,
  'cloud': Cloud,
  'cloud-sun': CloudSun,
  'droplet': Droplet,
  'edit-2': Pencil,
  'edit-3': PenLine,
  'external-link': ExternalLink,
  'eye': Eye,
  'eye-off': EyeOff,
  'file-text': FileText,
  'gift': Gift,
  'globe': Globe,
  'grid': Grid2x2,
  'hard-drive': HardDrive,
  'image': Image,
  'inbox': Inbox,
  'info': Info,
  'layers': Layers,
  'list': List,
  'map-pin': MapPin,
  'maximize': Maximize,
  'menu': Menu,
  'minus': Minus,
  'minus-circle': CircleMinus,
  'moon': Moon,
  'more-horizontal': Ellipsis,
  'more-vertical': EllipsisVertical,
  'package': Package,
  'pause-circle': CirclePause,
  'plus': Plus,
  'plus-circle': CirclePlus,
  'refresh-cw': RefreshCw,
  'rotate-cw': RotateCw,
  'search': Search,
  'shield': Shield,
  'shield-check': ShieldCheck,
  'sliders': SlidersHorizontal,
  'sun': Sun,
  'syringe': Syringe,
  'target': Target,
  'trash-2': Trash2,
  'trending-up': TrendingUp,
  'type': Type,
  'upload-cloud': CloudUpload,
  'user': User,
  'wifi-off': WifiOff,
  'wind': Wind,
  'x': X,
  'x-circle': CircleX,
  'zap': Zap,
} satisfies Record<string, LucideIcon>;

/** Kebab-case icon name (Feather-compatible) accepted by {@link Icon}. */
export type IconName = keyof typeof ICON_MAP;

export interface IconProps {
  name: IconName;
  /** Glyph size in px. Matches the Feather default. */
  size?: number;
  color?: string;
  /** Lucide stroke width; defaults to Lucide's own default (2). */
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

export function Icon({ name, size = 24, color, strokeWidth, style }: IconProps) {
  const Glyph = ICON_MAP[name];
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} style={style} />;
}
