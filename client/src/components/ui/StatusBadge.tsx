import React from 'react';

type Status = 'draft' | 'pending' | 'approved' | 'rejected';

const statusConfig = {
  draft: { label: 'Draft', className: 'bg-gray-500' },
  pending: { label: 'Pending', className: 'bg-yellow-500' },
  approved: { label: 'Approved', className: 'bg-emerald-500' },
  rejected: { label: 'Rejected', className: 'bg-red-500' },
};

export const StatusBadge: React.FC<{ status: Status; className?: string }> = ({ status, className = '' }) => {
  const config = statusConfig[status] || statusConfig.draft;
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${config.className} ${className}`}>
      {config.label}
    </span>
  );
};
