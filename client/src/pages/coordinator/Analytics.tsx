import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

const Analytics = () => {
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Connect to real /api/analytics endpoint later
    setTimeout(() => {
      setStats({
        totalApplications: 45,
        accepted: 18,
        pending: 22,
        rejected: 5,
        topSector: "Cybersecurity"
      });
      setLoading(false);
    }, 800);
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Internship Analytics</h1>

      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <div className="p-6">
              <p className="text-gray-500">Total Applications</p>
              <p className="text-5xl font-bold mt-4">{stats.totalApplications}</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <p className="text-gray-500">Accepted</p>
              <p className="text-5xl font-bold mt-4 text-emerald-600">{stats.accepted}</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <p className="text-gray-500">Pending</p>
              <p className="text-5xl font-bold mt-4 text-yellow-600">{stats.pending}</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <p className="text-gray-500">Top Sector</p>
              <p className="text-3xl font-bold mt-4">{stats.topSector}</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Analytics;
