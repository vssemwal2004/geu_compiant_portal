import { Armchair, Monitor, Package, Projector, Wifi, Zap, type LucideIcon } from 'lucide-react';
import { assetTypes } from '../../data/referenceData';

const icons: Record<string, LucideIcon> = {
  COMP: Monitor,
  PROJ: Projector,
  FURN: Armchair,
  ELEC: Zap,
  NET: Wifi,
  OTHER: Package,
};

export default function AssetIcon({ id, size = 18 }: { id: string; size?: number }) {
  const asset = assetTypes.find(a => a.id === id);
  const code = asset?.code.toUpperCase() || '';
  const Icon = icons[code] || (asset?.name.toLowerCase().includes('computer') ? Monitor : asset?.name.toLowerCase().includes('projector') ? Projector : Package);
  return <Icon size={size} strokeWidth={1.9} aria-hidden="true" />;
}
