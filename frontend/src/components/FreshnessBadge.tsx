// src/components/FreshnessBadge.tsx
import React from 'react';
type Freshness = 'Live' | 'Delayed' | 'End-of-day' | 'Historical' | 'Static' | 'Synthetic';

interface Props {
  freshness: Freshness;
  timestamp?: string; // ISO string
}

export const FreshnessBadge: React.FC<Props> = ({ freshness, timestamp }) => {
  const title = timestamp ? `${freshness} (${new Date(timestamp).toLocaleString()})` : freshness;
  return (
    <span className={`freshness-badge freshness-${freshness.toLowerCase().replace(/[^a-z]+/g, '-')}`} title={title}>
      {freshness}
    </span>
  );
};

export default FreshnessBadge;
