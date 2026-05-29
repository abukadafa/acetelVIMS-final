import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';

const CoordinatorApplications = () => {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/applications', { credentials: 'include' });
      const data = await res.json();
      setApplications(data);
    } catch {
      toast.error("Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const updateStatus = async (id: string, status: string, notes?: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/applications/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewNotes: notes }),
        credentials: 'include'
      });

      if (res.ok) {
        toast.success(`Application ${status}`);
        fetchApplications();
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Student Applications</h1>

      {loading ? <LoadingSpinner /> : (
        <div className="space-y-6">
          {applications.map((app) => (
            <Card key={app._id}>
              <div className="p-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold">{app.student?.user?.name || 'Student'}</h3>
                    <p className="text-gray-600">Applied to: <strong>{app.company?.name}</strong></p>
                  </div>
                  <StatusBadge status={app.status} />
                </div>

                <div className="mt-6 flex gap-3">
                  <Button 
                    variant="success"
                    loading={actionLoading === app._id}
                    onClick={() => updateStatus(app._id, 'accepted')}
                  >
                    Accept
                  </Button>
                  <Button 
                    variant="danger"
                    loading={actionLoading === app._id}
                    onClick={() => updateStatus(app._id, 'rejected')}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CoordinatorApplications;
