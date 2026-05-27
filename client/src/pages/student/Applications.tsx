import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';

const StudentApplications = () => {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/applications/my', { credentials: 'include' });
      const data = await res.json();
      setApplications(data);
    } catch (err) {
      toast.error("Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">My Applications</h1>

      {loading ? <LoadingSpinner /> : (
        <div className="space-y-6">
          {applications.map((app) => (
            <Card key={app._id}>
              <div className="p-8 flex flex-col md:flex-row justify-between items-start">
                <div>
                  <h3 className="text-2xl font-semibold">{app.company?.name}</h3>
                  <p className="text-gray-600 mt-1">{app.company?.sector}</p>
                </div>
                <StatusBadge status={app.status} />
              </div>

              {app.reviewNotes && (
                <div className="border-t p-8 bg-gray-50">
                  <strong>Coordinator Feedback:</strong>
                  <p className="mt-2">{app.reviewNotes}</p>
                </div>
              )}
            </Card>
          ))}

          {applications.length === 0 && (
            <p className="text-center text-gray-500 py-12">You haven't applied to any internships yet.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentApplications;
