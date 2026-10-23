import { Armchair, Monitor, Package, Projector, Wifi, Zap, type LucideIcon } from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  'at-computer': Monitor,
  'at-projector': Projector,
  'at-furniture': Armchair,
  'at-electrical': Zap,
  'at-network': Wifi,
  'at-other': Package,
};

export default function AssetIcon({ id, size = 18 }: { id: string; size?: number }) {
  const Icon = icons[id] ?? Package;
  return <Icon size={size} strokeWidth={1.9} aria-hidden="true" />;
}
