import React, { useState } from 'react';
import { Modal } from './Modal.tsx';
import { useProject } from '../../context/ProjectContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  FolderPlus,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Calendar,
  Users,
  Code2,
  AlertTriangle,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react';
import { TeamMemberConfig, ProjectDeadline } from '../../types/index.ts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: (projectId: string) => void;
}

export const NewProjectWizardModal: React.FC<Props> = ({ isOpen, onClose, onProjectCreated }) => {
  const { createProject } = useProject();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Core Details & Objectives
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Cloud Infrastructure & Core Services');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'HANDOVER_IN_PROGRESS' | 'HANDOVER_COMPLETE'>('ACTIVE');

  // Step 2: Timeline & Handover Transition
  const [startDate, setStartDate] = useState('2026-09-01');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('2026-12-15');
  const [departingMemberName, setDepartingMemberName] = useState('Sarah Lin');
  const [departingMemberRole, setDepartingMemberRole] = useState('Staff Platform Architect');
  const [successorName, setSuccessorName] = useState('Alex Rivera');
  const [targetHandoverDate, setTargetHandoverDate] = useState('2026-11-15');

  // Step 3: Team Members & Responsibilities
  const [teamMembers, setTeamMembers] = useState<TeamMemberConfig[]>([
    {
      name: 'Sarah Lin',
      email: 'sarah.lin@phoenix-retail.com',
      role: 'Staff Architect (Departing)',
      responsibilities: 'Core microservices, Kafka event mesh, PostgreSQL database migration, and Redis caching topology.',
    },
    {
      name: 'Alex Rivera',
      email: 'alex.rivera@phoenix-retail.com',
      role: 'Senior Platform Engineer (Successor)',
      responsibilities: 'Assuming ownership of microservices deployment, webhook idempotency, and GKE cluster management.',
    },
  ]);

  // Step 4: Tech Stack, Deadlines, Dependencies & Risks
  const [techStackInput, setTechStackInput] = useState('Go, Node.js, TypeScript, PostgreSQL 16, Kubernetes, Redis, Istio, Terraform');
  const [deadlines, setDeadlines] = useState<ProjectDeadline[]>([
    { title: 'Debezium CDC Migration Cutover', date: '2026-11-12', owner: 'Sarah Lin' },
    { title: 'PCI-DSS Compliance Audit Window', date: '2026-11-18', owner: 'Payment Squad' },
  ]);
  const [knownRisks, setKnownRisks] = useState<string[]>([
    'Payment webhook signature validation failing under high-concurrency gateway retries.',
    'Search indexing worker memory leak in Elasticsearch cluster causes OOM kills every 72 hours.',
  ]);
  const [existingDependencies, setExistingDependencies] = useState<string[]>([
    'ERP SAP connector API v2 delivery by vendor team (scheduled Oct 30).',
    'Customer-identity service token issuance must sign with RS256 for Istio mTLS sidecars.',
  ]);

  // Step 5: Initial Documentation Notes
  const [docNotes, setDocNotes] = useState(
    'Initial documentation consists of Architecture Specification v3.pdf and Payment Integration Notes. Authorised repository phoenix-retail/ecommerce-core is ready for sync.'
  );

  const handleAddMember = () => {
    setTeamMembers([
      ...teamMembers,
      { name: '', email: '', role: 'Engineer', responsibilities: '' },
    ]);
  };

  const handleRemoveMember = (idx: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== idx));
  };

  const handleMemberChange = (idx: number, field: keyof TeamMemberConfig, val: string) => {
    const updated = [...teamMembers];
    updated[idx][field] = val;
    setTeamMembers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const techArray = techStackInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const created = await createProject({
        name,
        code: code || name.replace(/[^A-Za-z0-9]/g, '').substring(0, 5).toUpperCase(),
        category,
        description,
        objectives,
        status,
        startDate,
        expectedCompletionDate,
        departingMemberName,
        departingMemberRole,
        successorName,
        targetHandoverDate,
        teamMembers,
        techStack: techArray,
        importantDeadlines: deadlines,
        knownRisks,
        existingDependencies,
        projectDocumentationNotes: docNotes,
        setupCompleted: false,
        currentSetupStep: 1,
      });

      if (created) {
        onClose();
        if (onProjectCreated) {
          onProjectCreated(created.id);
        }
      }
    } catch (err) {
      console.error('Project creation failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Project Knowledge Wizard"
      subtitle="Define project parameters with separated provenance: user-entered information is explicitly isolated from source-derived facts."
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6 text-xs text-slate-200">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          {[
            { num: 1, label: 'Details & Objectives' },
            { num: 2, label: 'Timeline & People' },
            { num: 3, label: 'Team Responsibilities' },
            { num: 4, label: 'Tech & Risks' },
            { num: 5, label: 'Review & Initialize' },
          ].map((s) => (
            <button
              type="button"
              key={s.num}
              onClick={() => setStep(s.num)}
              className={`flex items-center gap-1.5 transition-colors ${
                step === s.num
                  ? 'text-sky-400 font-bold border-b-2 border-sky-500 pb-1 -mb-3.5'
                  : step > s.num
                  ? 'text-emerald-400 font-medium'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                  step === s.num
                    ? 'bg-sky-600 text-white'
                    : step > s.num
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {step > s.num ? '✓' : s.num}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>

        {/* STEP 1: Details & Objectives */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="font-semibold text-slate-200 block mb-1">Project Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. HealthBridge Telehealth Gateway v2.4"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-200 block mb-1">Project Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. HLT-GW"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono uppercase focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-200 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="Cloud Infrastructure & Core Services">Cloud Infrastructure & Core Services</option>
                  <option value="Healthcare & Regulatory">Healthcare & Regulatory</option>
                  <option value="Payments & Financial Engineering">Payments & Financial Engineering</option>
                  <option value="Machine Learning & Data Intelligence">Machine Learning & Data Intelligence</option>
                  <option value="Enterprise Security & Auth">Enterprise Security & Auth</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-200 block mb-1">Project Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a comprehensive operational scope of the project..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-200 block mb-1">Core Objectives</label>
              <textarea
                rows={2}
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
                placeholder="1. Zero data-loss database cutover; 2. PCI-DSS compliance sign-off; 3. Establish clear successor ownership..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        )}

        {/* STEP 2: Timeline & Handover Transition */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-200 block mb-1">Project Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-200 block mb-1">Expected Completion Date</label>
                <input
                  type="date"
                  value={expectedCompletionDate}
                  onChange={(e) => setExpectedCompletionDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
              <div className="font-bold text-sky-400 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>Knowledge Handover Roles</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Departing Member (Handover Source)</label>
                  <input
                    type="text"
                    value={departingMemberName}
                    onChange={(e) => setDepartingMemberName(e.target.value)}
                    placeholder="e.g. Sarah Lin"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Departing Role / Specialty</label>
                  <input
                    type="text"
                    value={departingMemberRole}
                    onChange={(e) => setDepartingMemberRole(e.target.value)}
                    placeholder="e.g. Staff Architect & Lead"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Incoming Successor (Handover Target)</label>
                  <input
                    type="text"
                    value={successorName}
                    onChange={(e) => setSuccessorName(e.target.value)}
                    placeholder="e.g. Alex Rivera"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Target Handover Date</label>
                  <input
                    type="date"
                    value={targetHandoverDate}
                    onChange={(e) => setTargetHandoverDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Team Members & Responsibilities */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-200">Team Members & Responsibilities</div>
                <div className="text-[11px] text-slate-400">Explicitly document who owned which system prior to handover.</div>
              </div>
              <button
                type="button"
                onClick={handleAddMember}
                className="px-2.5 py-1 bg-sky-600/20 text-sky-400 border border-sky-500/40 rounded-lg hover:bg-sky-600/30 flex items-center gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Member</span>
              </button>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {teamMembers.map((member, idx) => (
                <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={member.name}
                      onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={member.email}
                      onChange={(e) => handleMemberChange(idx, 'email', e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100"
                    />
                    <input
                      type="text"
                      placeholder="Role (e.g. Lead Engineer)"
                      value={member.role}
                      onChange={(e) => handleMemberChange(idx, 'role', e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100"
                    />
                    {teamMembers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Assigned technical responsibilities, domains, and subsystem ownership..."
                      value={member.responsibilities}
                      onChange={(e) => handleMemberChange(idx, 'responsibilities', e.target.value)}
                      className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100 text-[11px]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: Tech Stack, Deadlines, Dependencies & Risks */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className="font-semibold text-slate-200 block mb-1">Technology Stack (Comma separated)</label>
              <input
                type="text"
                value={techStackInput}
                onChange={(e) => setTechStackInput(e.target.value)}
                placeholder="e.g. Go, Node.js, PostgreSQL 16, Kubernetes, Redis, Istio"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono text-[11px] focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-200 block mb-1">Known Risks</label>
                <textarea
                  rows={3}
                  value={knownRisks.join('\n')}
                  onChange={(e) => setKnownRisks(e.target.value.split('\n'))}
                  placeholder="One risk per line..."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-[11px] focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-200 block mb-1">Existing Dependencies</label>
                <textarea
                  rows={3}
                  value={existingDependencies.join('\n')}
                  onChange={(e) => setExistingDependencies(e.target.value.split('\n'))}
                  placeholder="One dependency per line..."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-[11px] focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Review & Initialize */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="p-4 bg-sky-950/30 border border-sky-800/40 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Ready to Launch Guided Setup Workflow</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Upon initialization, KNOWBRIDGE AI will guide you through the 6-step setup workflow:
                connecting data sources (GitHub, Documents, Drive), running initial incremental sync, and executing
                evidence-based AI reconstruction.
              </p>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1 font-mono text-[11px]">
              <div className="text-slate-400">Provenance Isolation Guarantee:</div>
              <div className="text-emerald-400">
                • Initial fields will be tagged with <span className="underline">USER_PROVIDED</span> provenance.
              </div>
              <div className="text-sky-400">
                • Records from GitHub & Documents will be stored separately as <span className="underline">DIRECT_SOURCE_FACT</span>.
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-200 block mb-1">Project Documentation Notes</label>
              <textarea
                rows={2}
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-[11px]"
              />
            </div>
          </div>
        )}

        {/* Navigation & Submit Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          <div>
            {step < 5 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !name.trim()) return;
                  setStep(step + 1);
                }}
                disabled={step === 1 && !name.trim()}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                {isSubmitting ? (
                  <span>Creating Workspace...</span>
                ) : (
                  <>
                    <FolderPlus className="w-4 h-4" />
                    <span>Create & Launch Guided Setup</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
};
