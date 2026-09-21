// src/components/FreshnessBadge.tsx
import React from 'react';
import type { MarketFreshness } from '../api/contracts';
type Freshness = MarketFreshness | 'Historical' | 'Static' | 'Synthetic' | 'Live' | 'Delayed' | 'End-of-day';

interface Props {
  freshness: Freshness;
  timestamp?: string; // ISO string
}

export const FreshnessBadge: React.FC<Props> = ({ freshness, timestamp }) => {
  const title = timestamp ? `${freshness} (${new Date(timestamp).toLocaleString()})` : freshness;
  return (
    <span className={`freshness-badge freshness-${freshness.toLowerCase().replace(/[^a-z]+/g, '-')}`} title={title}>
      {freshness.toUpperCase()}
    </span>
  );
};

export default FreshnessBadge;
