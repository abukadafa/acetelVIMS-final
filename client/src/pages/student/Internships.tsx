import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { socket } from '../../App';

const StudentInternships = () => {
  const [internships, setInternships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const fetchApprovedInternships = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/companies?status=approved', { 
        credentials: 'include' 
      });
      const data = await res.json();
      setInternships(data);
    } catch {
      toast.error("Failed to load opportunities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovedInternships();

    socket.on('postingApproved', fetchApprovedInternships);

    return () => socket.off('postingApproved', fetchApprovedInternships);
  }, []);

  const handleApply = async (id: string, name: string) => {
    setApplyingId(id);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: id }),
        credentials: 'include'
      });

      if (res.ok) {
        toast.success(`Application to ${name} submitted successfully!`);
      } else {
        toast.error("Failed to submit application");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-2">Internship Opportunities</h1>
      <p className="text-gray-600 mb-8">Approved postings from partner companies</p>

      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {internships.map((company) => (
            <Card key={company._id}>
              <div className="p-8">
                <div className="flex justify-between">
                  <h3 className="text-2xl font-semibold">{company.name}</h3>
                  <StatusBadge status="approved" />
                </div>

                <div className="mt-6 space-y-3 text-gray-700">
                  <p><strong>Sector:</strong> {company.sector}</p>
                  <p><strong>Location:</strong> {company.state}</p>
                  <p><strong>Max Students:</strong> {company.maxStudents}</p>
                </div>

                <Button
                  variant="primary"
                  loading={applyingId === company._id}
                  onClick={() => handleApply(company._id, company.name)}
                  className="mt-8 w-full py-4"
                >
                  Apply Now
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentInternships;
