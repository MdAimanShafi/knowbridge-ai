import React, { useState } from 'react';
import { Modal } from './Modal.tsx';
import { useProject } from '../../context/ProjectContext.tsx';
import { FolderPlus } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const NewProjectModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { createProject } = useProject();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Core Services');
  const [description, setDescription] = useState('');
  const [departingMemberName, setDepartingMemberName] = useState('');
  const [departingMemberRole, setDepartingMemberRole] = useState('');
  const [successorName, setSuccessorName] = useState('');
  const [targetHandoverDate, setTargetHandoverDate] = useState('2026-12-01');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await createProject({
        name,
        code: code || name.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase(),
        category,
        description,
        departingMemberName,
        departingMemberRole,
        successorName,
        targetHandoverDate,
      });

      if (created) {
        setName('');
        setCode('');
        setDescription('');
        onClose();
      }
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Knowledge Handover Workspace"
      subtitle="Establish a new project continuity workspace for departing and incoming team members"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="font-semibold text-slate-200 block mb-1">Project Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Distributed Payments Modernization"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-200 block mb-1">Project Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. PAY-MOD"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 font-mono uppercase focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-200 block mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-sky-500"
            >
              <option value="Core Services">Core Services</option>
              <option value="Cloud Infrastructure">Cloud Infrastructure</option>
              <option value="Security & Compliance">Security & Compliance</option>
              <option value="Data Engineering">Data Engineering</option>
              <option value="Mobile & Frontend">Mobile & Frontend</option>
            </select>
          </div>
        </div>

        <div>
          <label className="font-semibold text-slate-200 block mb-1">Description & Scope</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief scope, target deliverables, and architecture purpose..."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800">
          <div>
            <label className="font-semibold text-slate-200 block mb-1">Departing Member Name</label>
            <input
              type="text"
              value={departingMemberName}
              onChange={(e) => setDepartingMemberName(e.target.value)}
              placeholder="e.g. Sarah Lin"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-200 block mb-1">Incoming Successor</label>
            <input
              type="text"
              value={successorName}
              onChange={(e) => setSuccessorName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div>
          <label className="font-semibold text-slate-200 block mb-1">Target Handover Date</label>
          <input
            type="date"
            value={targetHandoverDate}
            onChange={(e) => setTargetHandoverDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-white bg-sky-600 hover:bg-sky-500 font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <FolderPlus className="w-4 h-4" />
            <span>{isSubmitting ? 'Creating...' : 'Create Workspace'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
