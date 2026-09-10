// src/components/FreshnessBadge.tsx
import React from 'react';
type Freshness = 'Live' | 'Delayed' | 'End-of-day' | 'Historical' | 'Static' | 'Synthetic';

interface Props {
  freshness: Freshness;
  timestamp?: string; // ISO string
}

const colorMap: Record<Freshness, string> = {
  Live: 'bg-green-500',
  Delayed: 'bg-yellow-500',
  'End-of-day': 'bg-blue-500',
  Historical: 'bg-gray-500',
  Static: 'bg-slate-500',
  Synthetic: 'bg-orange-600',
};

export const FreshnessBadge: React.FC<Props> = ({ freshness, timestamp }) => {
  const color = colorMap[freshness] ?? 'bg-gray-500';
  const title = timestamp ? `${freshness} (${new Date(timestamp).toLocaleString()})` : freshness;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${color} text-white`}
      title={title}
    >
      {freshness}
    </span>
  );
};

export default FreshnessBadge;
