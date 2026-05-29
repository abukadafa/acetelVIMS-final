import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { saveLogbookOffline, isOnline } from '../lib/offline';
import { toast } from 'react-hot-toast';
import { Send, Save, CloudOff, CloudCheck, X, RefreshCw, Camera as CameraIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

interface Props {
  onComplete: () => void;
  editEntry?: any;
  onCancel?: () => void;
}

export default function LogbookForm({ onComplete, editEntry, onCancel }: Props) {
  const [activities, setActivities] = useState('');
  const [toolsUsed, setToolsUsed] = useState('');
  const [skills, setSkills] = useState('');
  const [challenges, setChallenges] = useState('');
  const [solutions, setSolutions] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [attachments, setAttachments] = useState<FileList | null>(null);
  const [nativePhotos, setNativePhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editEntry) {
      setActivities(editEntry.activities || '');
      setToolsUsed(editEntry.toolsUsed || '');
      setSkills(editEntry.skillsLearned || '');
      setChallenges(editEntry.challenges || '');
      setSolutions(editEntry.solutions || '');
      setEntryDate(new Date(editEntry.entryDate).toISOString().split('T')[0]);
    }
  }, [editEntry]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append('entryDate', entryDate);
    formData.append('activities', activities);
    formData.append('toolsUsed', toolsUsed);
    formData.append('skillsLearned', skills);
    formData.append('challenges', challenges);
    formData.append('solutions', solutions);
    formData.append('weekNumber', String(Math.ceil(new Date(entryDate).getDate() / 7)));
    
    if (attachments) {
      Array.from(attachments).forEach(file => {
        formData.append('attachments', file);
      });
    }

    if (nativePhotos.length > 0) {
      // Convert native base64 photos to Blob and append
      for (let i = 0; i < nativePhotos.length; i++) {
        const response = await fetch(nativePhotos[i]);
        const blob = await response.blob();
        formData.append('attachments', blob, `photo_${Date.now()}_${i}.jpeg`);
      }
    }

    if (isOnline()) {
      try {
        if (editEntry) {
          await api.put(`/logbook/${editEntry._id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          toast.success('Logbook entry updated and resubmitted!');
        } else {
          await api.post('/logbook', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          toast.success('Logbook entry submitted successfully!');
        }
        resetForm();
        onComplete();
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Failed to submit logbook');
      } finally {
        setLoading(false);
      }
    } else {
      if (editEntry) {
        toast.error('Editing entries is currently only supported in online mode.');
        setLoading(false);
        return;
      }
      const offlineData = {
        id: uuidv4(),
        entryDate, 
        activities, 
        toolsUsed, 
        skillsLearned: skills, 
        challenges, 
        solutions,
        weekNumber: Math.ceil(new Date(entryDate).getDate() / 7)
      };
      saveLogbookOffline(offlineData);
      toast.success('Offline! Entry saved locally and will sync when online.');
      resetForm();
      setLoading(false);
      onComplete();
    }
  }

  function resetForm() {
    setActivities(''); setToolsUsed(''); setSkills(''); setChallenges(''); setSolutions('');
    setAttachments(null);
    setNativePhotos([]);
  }

  async function handleTakePhoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera
      });
      if (image.webPath) {
        setNativePhotos(prev => [...prev, image.webPath!]);
      }
    } catch (error) {
      console.error('Camera error', error);
      toast.error('Could not capture photo');
    }
  }

  return (
    <div className="card" style={{ border: editEntry ? '2px solid var(--primary)' : '1px solid var(--border)' }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 className="card-title">
            {editEntry ? 'Update & Resubmit Entry' : 'Ultimate Daily Logbook Entry'}
          </h3>
          {editEntry && <span className="badge badge-amber">Revision Mode</span>}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isOnline() ? (
            <div className="badge badge-green"><CloudCheck size={14} /> Online</div>
          ) : (
            <div className="badge badge-amber"><CloudOff size={14} /> Offline Mode</div>
          )}
          {onCancel && (
            <button className="btn btn-xs btn-ghost btn-icon" onClick={onCancel}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-group" style={{ gap: '20px', padding: '20px' }}>
        <div className="form-row">
           <div className="form-group">
            <label className="form-label">Entry Date</label>
            <input 
              type="date" 
              className="form-control" 
              value={entryDate} 
              disabled={!!editEntry}
              max={new Date().toISOString().split('T')[0]} 
              onChange={e => setEntryDate(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Tools/Languages Used</label>
            <input 
              className="form-control" 
              placeholder="e.g. Python, Wireshark, VS Code..." 
              value={toolsUsed} 
              onChange={e => setToolsUsed(e.target.value)} 
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Major Activities Carried Out</label>
          <textarea 
            className="form-control" 
            placeholder="Detailed technical description of your work today..." 
            value={activities} 
            onChange={e => setActivities(e.target.value)} 
            required 
            style={{ minHeight: '120px' }}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Challenges Encountered</label>
            <textarea 
              className="form-control" 
              placeholder="Blockers or complex issues..." 
              value={challenges} 
              onChange={e => setChallenges(e.target.value)} 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Solutions Implemented</label>
            <textarea 
              className="form-control" 
              placeholder="How did you resolve the issues?" 
              value={solutions} 
              onChange={e => setSolutions(e.target.value)} 
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Evidence / Attachments</label>
          {Capacitor.isNativePlatform() ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button type="button" className="btn btn-outline" onClick={handleTakePhoto} style={{ width: 'fit-content' }}>
                <CameraIcon size={18} /> Take Photo ({nativePhotos.length}/5)
              </button>
              {nativePhotos.length > 0 && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {nativePhotos.map((photo, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img src={photo} alt={`Attached ${idx}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
                      <button type="button" onClick={() => setNativePhotos(prev => prev.filter((_, i) => i !== idx))}
                        style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'red', color: 'white', borderRadius: '50%', border: 'none', cursor: 'pointer', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <input 
              type="file" 
              multiple 
              accept="image/*,application/pdf"
              className="form-control"
              onChange={e => setAttachments(e.target.files)}
            />
          )}
          {editEntry && editEntry.attachments?.length > 0 && (
            <p className="form-hint" style={{ marginTop: '8px' }}>
              Note: Uploading new files will replace current attachments.
            </p>
          )}
        </div>

        <div className="modal-footer" style={{ padding: '0', marginTop: '10px' }}>
          {onCancel && (
            <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
          )}
          {!editEntry && (
            <button type="button" className="btn btn-ghost" onClick={resetForm}>Clear</button>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <div className="spinner" /> : (
              editEntry ? <><RefreshCw size={18} /> Update & Resubmit</> : (
                isOnline() ? <><Send size={18} /> Submit Entry</> : <><Save size={18} /> Save Offline</>
              )
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
