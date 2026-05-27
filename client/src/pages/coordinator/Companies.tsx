import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { socket } from '../../App';

const CoordinatorCompanies = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'approved' | 'rejected'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/companies', { credentials: 'include' });
      const data = await res.json();
      setCompanies(data);
    } catch (err) {
      toast.error("Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();

    socket.on('postingApproved', fetchCompanies);
    socket.on('postingRejected', fetchCompanies);

    return () => {
      socket.off('postingApproved', fetchCompanies);
      socket.off('postingRejected', fetchCompanies);
    };
  }, []);

  const handleApprove = async (id: string) => {
    if (!confirm("Approve this posting and send notifications?")) return;
    
    setActionLoading(id);
    try {
      const res = await fetch(`/api/companies/${id}/approve`, {
        method: 'PATCH',
        credentials: 'include'
      });

      if (res.ok) {
        toast.success("✅ Posting approved successfully!");
        fetchCompanies();
      }
    } catch (err) {
      toast.error("Failed to approve");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredCompanies = companies.filter(c => filter === 'all' || c.postingStatus === filter);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Internship Postings</h1>
        <p className="text-gray-600">Manage and approve company postings</p>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompanies.map((company) => (
            <Card key={company._id}>
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-semibold">{company.name}</h3>
                  <StatusBadge status={company.postingStatus} />
                </div>

                <div className="mt-4 space-y-2 text-sm text-gray-600">
                  <p><strong>Sector:</strong> {company.sector}</p>
                  <p><strong>Contact:</strong> {company.contactPerson}</p>
                </div>
              </div>

              {company.postingStatus === 'draft' && (
                <div className="border-t p-6">
                  <Button
                    variant="success"
                    loading={actionLoading === company._id}
                    onClick={() => handleApprove(company._id)}
                    className="w-full"
                  >
                    ✅ Approve & Notify
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CoordinatorCompanies;
