import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import {
  User,
  Project,
  ProjectMember,
  ProjectDocument,
  Finding,
  HandoverReport,
  GitHubConnection,
  ActivityLog,
  SourceRecord,
  SourceConnection,
} from '../types/index.ts';

interface DatabaseSchema {
  users: (User & { passwordHash: string })[];
  projects: Project[];
  projectMembers: ProjectMember[];
  documents: ProjectDocument[];
  findings: Finding[];
  handoverReports: HandoverReport[];
  githubConnections: GitHubConnection[];
  sourceRecords: SourceRecord[];
  sourceConnections: SourceConnection[];
  ragQueries: {
    id: string;
    projectId: string;
    userId?: string;
    question: string;
    answer: any;
    timestamp: string;
  }[];
  activityLogs: ActivityLog[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'knowbridge_store.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Seed Data with Real Synthetic Documents for Hackathon Demo
function getInitialData(): DatabaseSchema {
  const salt = bcrypt.genSaltSync(10);
  const defaultPasswordHash = bcrypt.hashSync('demo123', salt);

  const demoUser: User & { passwordHash: string } = {
    id: 'user-demo-1',
    email: 'demo@knowbridge.ai',
    name: 'Alex Rivera',
    title: 'Incoming Senior Engineer (Successor)',
    role: 'LEAD',
    passwordHash: defaultPasswordHash,
    createdAt: '2026-10-15T09:00:00Z',
  };

  const sarahUser: User & { passwordHash: string } = {
    id: 'user-sarah-2',
    email: 'sarah.lin@phoenix-retail.com',
    name: 'Sarah Lin',
    title: 'Staff Platform Architect (Departing)',
    role: 'OWNER',
    passwordHash: defaultPasswordHash,
    createdAt: '2026-08-01T10:00:00Z',
  };

  const marcusUser: User & { passwordHash: string } = {
    id: 'user-marcus-3',
    email: 'marcus.vance@phoenix-retail.com',
    name: 'Marcus Vance',
    title: 'Engineering Director & Reviewer',
    role: 'REVIEWER',
    passwordHash: defaultPasswordHash,
    createdAt: '2026-08-10T11:00:00Z',
  };

  const phoenixProject: Project = {
    id: 'proj-phoenix-001',
    name: 'E-Commerce Platform Migration',
    code: 'PHX-MIG',
    description:
      'Mission-critical replatforming of legacy monolithic storefront to distributed microservices on Kubernetes, including multi-region database migration and payment gateway overhaul.',
    category: 'Cloud Infrastructure & Core Services',
    status: 'HANDOVER_IN_PROGRESS',
    ownerId: sarahUser.id,
    ownerName: sarahUser.name,
    departingMemberName: 'Sarah Lin (Staff Architect)',
    departingMemberRole: 'Original Core Architect & Tech Lead',
    successorName: 'Alex Rivera (Incoming Senior Engineer)',
    targetHandoverDate: '2026-11-15',
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-11-01T18:30:00Z',
  };

  const telehealthProject: Project = {
    id: 'proj-telehealth-002',
    name: 'HealthBridge Telehealth Gateway v2.4',
    code: 'HLT-GW',
    description:
      'HIPAA-compliant WebRTC audio/video consultations proxy with end-to-end audit trails and EHR integration.',
    category: 'Healthcare & Regulatory',
    status: 'ACTIVE',
    ownerId: sarahUser.id,
    ownerName: sarahUser.name,
    departingMemberName: 'Dr. Emily Chen (Lead Systems Eng)',
    departingMemberRole: 'Security & Video Pipeline Lead',
    successorName: 'David Kalu (Systems Engineer)',
    targetHandoverDate: '2026-12-01',
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-28T14:15:00Z',
  };

  const members: ProjectMember[] = [
    {
      id: 'pm-1',
      projectId: phoenixProject.id,
      userId: sarahUser.id,
      userName: sarahUser.name,
      userEmail: sarahUser.email,
      role: 'OWNER',
      joinedAt: '2026-09-01T08:00:00Z',
    },
    {
      id: 'pm-2',
      projectId: phoenixProject.id,
      userId: demoUser.id,
      userName: demoUser.name,
      userEmail: demoUser.email,
      role: 'LEAD',
      joinedAt: '2026-10-20T10:00:00Z',
    },
    {
      id: 'pm-3',
      projectId: phoenixProject.id,
      userId: marcusUser.id,
      userName: marcusUser.name,
      userEmail: marcusUser.email,
      role: 'REVIEWER',
      joinedAt: '2026-09-05T09:00:00Z',
    },
  ];

  // Synthetic sample documents with exact page-level text for demonstration
  const docArchitecture: ProjectDocument = {
    id: 'doc-arch-001',
    projectId: phoenixProject.id,
    filename: 'Project_Architecture_Specification_v3.pdf',
    originalName: 'Project Architecture Specification v3.pdf',
    filesize: 1420800,
    mimeType: 'application/pdf',
    pageCount: 14,
    status: 'EXTRACTED',
    uploaderId: sarahUser.id,
    uploaderName: sarahUser.name,
    contentHash: 'hash-arch-seed-001',
    provenance: 'USER_UPLOAD',
    uploadedAt: '2026-09-12T14:22:00Z',
    processedAt: '2026-09-12T14:25:00Z',
    summary:
      'Defines the target microservices topology, PostgreSQL 16 read-replica clusters, Envoy gateway routing rules, and JWT auth flow.',
    pages: [
      {
        pageNumber: 1,
        text: 'E-COMMERCE PLATFORM MIGRATION SPECIFICATION\nDocument ID: DOC-PHX-ARCH-03\nAuthor: Sarah Lin, Staff Platform Architect\n1. Executive Summary\nThe legacy monolith (PHP/MySQL) is being decommissioned in favor of an event-driven Go and Node.js microservices architecture deployed to Google Kubernetes Engine (GKE). Core data persistence will transition to managed PostgreSQL with Citus distributed sharding.',
      },
      {
        pageNumber: 3,
        text: '3. Technical Decision Record: Database Migration Strategy\nDECISION: We have chosen PostgreSQL 16 over DynamoDB and MongoDB.\nRATIONALE: Relational consistency across order line items, strict ACID guarantees during payment transactions, and native JSONB capabilities for flexible product catalog facets.\nSTATUS: Migration tooling (Debezium + Kafka CDC pipeline) is completed for 80% of tables. Final cutover scheduled for November 12, 2026.',
      },
      {
        pageNumber: 7,
        text: '7. Authentication and Service Mesh Communication\nDECISION: All inter-service gRPC communication will enforce mutual TLS (mTLS) through Istio sidecars.\nDEPENDENCY: Service-to-service authorization depends strictly on the central user-service auth module emitting RS256 signed tokens.\nBLOCKER: The auth module latency spikes under load (p99 > 340ms) when validating expired session tokens against Redis.',
      },
    ],
  };

  const docPaymentNotes: ProjectDocument = {
    id: 'doc-pay-002',
    projectId: phoenixProject.id,
    filename: 'Payment_Integration_and_PCI_Scope_Notes.pdf',
    originalName: 'Payment Integration and PCI Scope Notes.pdf',
    filesize: 852000,
    mimeType: 'application/pdf',
    pageCount: 8,
    status: 'EXTRACTED',
    uploaderId: sarahUser.id,
    uploaderName: sarahUser.name,
    contentHash: 'hash-pay-seed-002',
    provenance: 'USER_UPLOAD',
    uploadedAt: '2026-10-02T09:15:00Z',
    processedAt: '2026-10-02T09:17:00Z',
    summary:
      'Payment provider integration analysis, Stripe vs Adyen evaluation, tokenization workflow, and PCI-DSS Level 1 compliance requirements.',
    pages: [
      {
        pageNumber: 2,
        text: 'PAYMENT INTEGRATION ARCHITECTURE NOTES\nDate: October 2, 2026\nOwner: Sarah Lin\n2. Payment Provider Selection & Conflicting Directive\nIn the August committee meeting, the platform team tentatively selected Stripe Elements for tokenization. However, on September 28, VP of Finance requested evaluation of Adyen due to European interchange rate savings.\nCURRENT STATUS: Stripe sandbox integration is completed; Adyen contract is still pending legal review. Engineering MUST know if the dual-provider abstraction is required before the November freeze.',
      },
      {
        pageNumber: 4,
        text: '4. Critical Regulatory Risk: PCI-DSS Audit Deadline\nRISK: Annual external PCI-DSS compliance audit commences on November 18, 2026.\nIMPACT: HIGH / CRITICAL. If token storage vaulting is not fully decoupled from primary database replicas, audit failure will halt credit card processing across all storefronts.\nOWNER: Payment Squad Lead (Unassigned pending Sarah Lin departure handover).',
      },
      {
        pageNumber: 6,
        text: '6. Incomplete Work and Outstanding Tasks\n- Task 1: Complete Webhook idempotency handler for asynchronous payment failure notifications. (PENDING)\n- Task 2: Implement automated fallback to secondary gateway in case of primary API 5xx outage. (PENDING - Needs approval)\n- Task 3: Load test webhook processor with 10,000 req/sec batch payload.',
      },
    ],
  };

  const docStatusReport: ProjectDocument = {
    id: 'doc-status-003',
    projectId: phoenixProject.id,
    filename: 'Q3_Migration_Status_and_Risk_Matrix.pdf',
    originalName: 'Q3 Migration Status and Risk Matrix.pdf',
    filesize: 1120400,
    mimeType: 'application/pdf',
    pageCount: 11,
    status: 'EXTRACTED',
    uploaderId: marcusUser.id,
    uploaderName: marcusUser.name,
    contentHash: 'hash-status-seed-003',
    provenance: 'USER_UPLOAD',
    uploadedAt: '2026-10-24T16:40:00Z',
    processedAt: '2026-10-24T16:43:00Z',
    summary:
      'Q3 project milestones, team velocity, completed deliverables, unresolved cross-team questions, and handover transition checklist.',
    pages: [
      {
        pageNumber: 2,
        text: 'PHOENIX REPLATFORMING: Q3 EXECUTIVE STATUS REPORT\nReporting Period: July 1 - September 30, 2026\nCompleted Milestones:\n1. GKE multi-zone cluster provisioning with automated Terraform modules (COMPLETED - 100%).\n2. Customer identity & OAuth2 token issuance service migrated from monolithic sessions (COMPLETED - 100%).\n3. Product Catalog GraphQL microservice deployed to staging (COMPLETED - 100%).',
      },
      {
        pageNumber: 5,
        text: '5. Cross-Team Dependencies and Technical Blockers\nDEPENDENCY: Real-time inventory sync is dependent on ERP SAP connector team delivering API v2 by October 30. (Status: Delayed by 2 weeks).\nBLOCKER: Search indexing worker memory leak in Elasticsearch cluster causes OOM kills every 72 hours when indexing catalog diffs.',
      },
      {
        pageNumber: 8,
        text: '8. Unresolved Knowledge Gaps & Questions Before Sarah Leaves\nQUESTION 1: Who holds the root credentials and PGP key for the encrypted database backup volume in S3/GCS?\nQUESTION 2: What is the failover protocol if the primary Kafka broker partition leader crashes during the live DNS switchover?\nQUESTION 3: Is the legacy coupon calculation engine documented anywhere, or does the new checkout rewrite simply discard unsupported promotion types?',
      },
    ],
  };

  // Structured Findings extracted from the synthetic documents with complete traceability
  const findings: Finding[] = [
    {
      id: 'fnd-phx-001',
      projectId: phoenixProject.id,
      title: 'Database Architecture Decision: PostgreSQL 16 with Citus',
      description:
        'Selected managed PostgreSQL 16 over DynamoDB and MongoDB to ensure strict ACID transactions across distributed order processing and native JSONB catalog facets.',
      category: 'DECISION',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'APPROVED',
      sourceDocumentId: docArchitecture.id,
      sourceDocumentName: docArchitecture.filename,
      pageNumber: 3,
      evidenceExcerpt:
        'DECISION: We have chosen PostgreSQL 16 over DynamoDB and MongoDB. RATIONALE: Relational consistency across order line items, strict ACID guarantees during payment transactions...',
      rationale:
        'Relational consistency across line items and ACID guarantees during high-volume flash sales.',
      owner: 'Sarah Lin (Outgoing Staff Architect)',
      reviewerId: marcusUser.id,
      reviewerName: marcusUser.name,
      reviewedAt: '2026-10-25T11:20:00Z',
      reviewerNotes:
        'Verified in architecture specification and confirmed in engineering review.',
      isAiGenerated: true,
      createdAt: '2026-10-24T17:00:00Z',
      updatedAt: '2026-10-25T11:20:00Z',
    },
    {
      id: 'fnd-phx-002',
      projectId: phoenixProject.id,
      title: 'Conflicting Payment Gateway Directives (Stripe vs Adyen)',
      description:
        'Technical specification specifies Stripe Elements tokenization (already implemented in sandbox), but finance executive memo directed evaluation of Adyen for EU interchange savings, leaving multi-gateway abstraction requirements ambiguous.',
      category: 'DECISION',
      evidenceStatus: 'CONFLICTING',
      reviewStatus: 'NEEDS_CLARIFICATION',
      sourceDocumentId: docPaymentNotes.id,
      sourceDocumentName: docPaymentNotes.filename,
      pageNumber: 2,
      evidenceExcerpt:
        'In the August committee meeting, the platform team tentatively selected Stripe Elements... However, on September 28, VP of Finance requested evaluation of Adyen due to European interchange rate savings.',
      conflictingDetails:
        'Architecture Doc specifies Stripe SDK integration (Pg 2), whereas Q3 Finance Directive requests Adyen onboarding. No architectural abstraction layer was committed in repo.',
      severity: 'HIGH',
      owner: 'Successor (Alex Rivera) / VP Finance',
      reviewerId: marcusUser.id,
      reviewerName: marcusUser.name,
      reviewedAt: '2026-10-26T15:40:00Z',
      reviewerNotes:
        'Flagged for incoming lead Alex Rivera to coordinate with Finance before writing payment abstraction wrappers.',
      isAiGenerated: true,
      createdAt: '2026-10-24T17:01:00Z',
      updatedAt: '2026-10-26T15:40:00Z',
    },
    {
      id: 'fnd-phx-003',
      projectId: phoenixProject.id,
      title: 'Pending Work: Asynchronous Payment Webhook Idempotency Handler',
      description:
        'Webhook event processing for delayed credit card authorizations, 3D-Secure chargebacks, and refund settlements is not yet idempotent, creating double-fulfillment risk during retries.',
      category: 'PENDING_TASK',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'APPROVED',
      sourceDocumentId: docPaymentNotes.id,
      sourceDocumentName: docPaymentNotes.filename,
      pageNumber: 6,
      evidenceExcerpt:
        'Task 1: Complete Webhook idempotency handler for asynchronous payment failure notifications. (PENDING)',
      owner: 'Alex Rivera (Successor)',
      deadline: '2026-11-08',
      severity: 'HIGH',
      reviewerId: demoUser.id,
      reviewerName: demoUser.name,
      reviewedAt: '2026-10-27T09:10:00Z',
      reviewerNotes:
        'Accepting this finding as primary week 1 priority for incoming engineer.',
      isAiGenerated: true,
      createdAt: '2026-10-24T17:02:00Z',
      updatedAt: '2026-10-27T09:10:00Z',
    },
    {
      id: 'fnd-phx-004',
      projectId: phoenixProject.id,
      title: 'Regulatory Risk: PCI-DSS Level 1 Compliance Audit Window',
      description:
        'External PCI-DSS audit scheduled for November 18, 2026. Credit card token vaulting must be fully isolated from application logs and read-replicas, otherwise processing license will be revoked.',
      category: 'RISK',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'APPROVED',
      sourceDocumentId: docPaymentNotes.id,
      sourceDocumentName: docPaymentNotes.filename,
      pageNumber: 4,
      evidenceExcerpt:
        'RISK: Annual external PCI-DSS compliance audit commences on November 18, 2026. IMPACT: HIGH / CRITICAL. If token storage vaulting is not fully decoupled from primary database replicas...',
      severity: 'CRITICAL',
      impact: 'Complete halt of merchant payment processing storefronts',
      owner: 'Incoming Lead (Alex Rivera)',
      deadline: '2026-11-18',
      reviewerId: marcusUser.id,
      reviewerName: marcusUser.name,
      reviewedAt: '2026-10-25T14:00:00Z',
      reviewerNotes:
        'High urgency item. Must be prioritized in handover sign-off.',
      isAiGenerated: true,
      createdAt: '2026-10-24T17:03:00Z',
      updatedAt: '2026-10-25T14:00:00Z',
    },
    {
      id: 'fnd-phx-005',
      projectId: phoenixProject.id,
      title: 'Active Blocker: Search Indexer Elasticsearch OOM Leaks',
      description:
        'Catalog diff synchronization worker running against Elasticsearch cluster suffers memory leak causing kernel Out-Of-Memory termination every 72 hours under high indexing loads.',
      category: 'BLOCKER',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'APPROVED',
      sourceDocumentId: docStatusReport.id,
      sourceDocumentName: docStatusReport.filename,
      pageNumber: 5,
      evidenceExcerpt:
        'BLOCKER: Search indexing worker memory leak in Elasticsearch cluster causes OOM kills every 72 hours when indexing catalog diffs.',
      severity: 'HIGH',
      owner: 'Catalog Squad',
      reviewerId: marcusUser.id,
      reviewerName: marcusUser.name,
      reviewedAt: '2026-10-25T14:05:00Z',
      isAiGenerated: true,
      createdAt: '2026-10-24T17:04:00Z',
      updatedAt: '2026-10-25T14:05:00Z',
    },
    {
      id: 'fnd-phx-006',
      projectId: phoenixProject.id,
      title: 'Critical Dependency: Central User-Service Auth Token RS256 Verification',
      description:
        'All downstream microservices (Catalog, Cart, Checkout, Order History) depend on user-service JWT public keys for stateless authorization, but latency spikes to p99 > 340ms during session cache misses.',
      category: 'DEPENDENCY',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'APPROVED',
      sourceDocumentId: docArchitecture.id,
      sourceDocumentName: docArchitecture.filename,
      pageNumber: 7,
      evidenceExcerpt:
        'DEPENDENCY: Service-to-service authorization depends strictly on the central user-service auth module emitting RS256 signed tokens. BLOCKER: The auth module latency spikes under load...',
      severity: 'HIGH',
      owner: 'Identity & Auth Team',
      reviewerId: marcusUser.id,
      reviewerName: marcusUser.name,
      reviewedAt: '2026-10-25T14:10:00Z',
      isAiGenerated: true,
      createdAt: '2026-10-24T17:05:00Z',
      updatedAt: '2026-10-25T14:10:00Z',
    },
    {
      id: 'fnd-phx-007',
      projectId: phoenixProject.id,
      title: 'Missing Evidence: Disaster Recovery Database Encryption Key Custody',
      description:
        'No documentation identifies who holds the master PGP secret key for decrypting daily database backup archives stored in cold cloud storage. Sarah Lin is believed to be the only key holder.',
      category: 'UNRESOLVED_QUESTION',
      evidenceStatus: 'MISSING_EVIDENCE',
      reviewStatus: 'PENDING',
      sourceDocumentId: docStatusReport.id,
      sourceDocumentName: docStatusReport.filename,
      pageNumber: 8,
      evidenceExcerpt:
        'QUESTION 1: Who holds the root credentials and PGP key for the encrypted database backup volume in S3/GCS?',
      uncertaintyReason:
        'Report asks the question, but neither the architecture spec nor the security runbook contains the key escrow location or secondary holder list.',
      severity: 'CRITICAL',
      owner: 'Sarah Lin / Security Operations',
      isAiGenerated: true,
      createdAt: '2026-10-24T17:06:00Z',
      updatedAt: '2026-10-24T17:06:00Z',
    },
    {
      id: 'fnd-phx-008',
      projectId: phoenixProject.id,
      title: 'Uncertain Claim: Legacy Coupon Engine Rules Compatibility',
      description:
        'It is claimed that 100% of legacy promotional tier pricing is supported by the new GraphQL checkout, but documents indicate complex tiered coupon logic may have been discarded.',
      category: 'UNRESOLVED_QUESTION',
      evidenceStatus: 'UNCERTAIN',
      reviewStatus: 'PENDING',
      sourceDocumentId: docStatusReport.id,
      sourceDocumentName: docStatusReport.filename,
      pageNumber: 8,
      evidenceExcerpt:
        'QUESTION 3: Is the legacy coupon calculation engine documented anywhere, or does the new checkout rewrite simply discard unsupported promotion types?',
      uncertaintyReason:
        'Contradictory comments between PR notes and the migration status report. Requires direct verification with marketing lead.',
      severity: 'MEDIUM',
      owner: 'Alex Rivera (Successor)',
      isAiGenerated: true,
      createdAt: '2026-10-24T17:07:00Z',
      updatedAt: '2026-10-24T17:07:00Z',
    },
    {
      id: 'fnd-phx-009',
      projectId: phoenixProject.id,
      title: 'Completed Milestone: Multi-Zone GKE Cluster Provisioning',
      description:
        'Production and staging Kubernetes clusters successfully provisioned across 3 availability zones using automated Terraform infrastructure-as-code modules with ArgoCD GitOps pipeline.',
      category: 'COMPLETED_WORK',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'APPROVED',
      sourceDocumentId: docStatusReport.id,
      sourceDocumentName: docStatusReport.filename,
      pageNumber: 2,
      evidenceExcerpt:
        '1. GKE multi-zone cluster provisioning with automated Terraform modules (COMPLETED - 100%).',
      owner: 'DevOps / Sarah Lin',
      reviewerId: marcusUser.id,
      reviewerName: marcusUser.name,
      reviewedAt: '2026-10-25T11:00:00Z',
      isAiGenerated: true,
      createdAt: '2026-10-24T17:08:00Z',
      updatedAt: '2026-10-25T11:00:00Z',
    },
    {
      id: 'fnd-phx-010',
      projectId: phoenixProject.id,
      title: 'Completed Milestone: Customer Identity & OAuth2 Token Issuance',
      description:
        'Successfully migrated customer sessions from PHP session storage to stateless JWT/OAuth2 token issuance service deployed on Cloud Run with Redis cluster backing.',
      category: 'COMPLETED_WORK',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'APPROVED',
      sourceDocumentId: docStatusReport.id,
      sourceDocumentName: docStatusReport.filename,
      pageNumber: 2,
      evidenceExcerpt:
        '2. Customer identity & OAuth2 token issuance service migrated from monolithic sessions (COMPLETED - 100%).',
      owner: 'Identity Squad',
      reviewerId: marcusUser.id,
      reviewerName: marcusUser.name,
      reviewedAt: '2026-10-25T11:05:00Z',
      isAiGenerated: true,
      createdAt: '2026-10-24T17:09:00Z',
      updatedAt: '2026-10-25T11:05:00Z',
    },
  ];

  const github: GitHubConnection = {
    id: 'gh-conn-001',
    projectId: phoenixProject.id,
    repoOwner: 'phoenix-retail',
    repoName: 'storefront-platform-core',
    branch: 'main',
    connectedAt: '2026-09-02T10:00:00Z',
    lastSyncedAt: '2026-11-01T20:15:00Z',
    openIssuesCount: 19,
    openPRsCount: 4,
    recentCommitsCount: 142,
    status: 'SYNCED',
  };

  const activityLogs: ActivityLog[] = [
    {
      id: 'act-001',
      projectId: phoenixProject.id,
      userId: sarahUser.id,
      userName: sarahUser.name,
      action: 'Project Workspace Initialized',
      category: 'PROJECT',
      details: 'Created workspace Phoenix Replatforming Handover with target date Nov 15, 2026.',
      timestamp: '2026-09-01T08:00:00Z',
    },
    {
      id: 'act-002',
      projectId: phoenixProject.id,
      userId: sarahUser.id,
      userName: sarahUser.name,
      action: 'Uploaded Document',
      category: 'DOCUMENT',
      details: 'Uploaded Project_Architecture_Specification_v3.pdf (14 pages).',
      timestamp: '2026-09-12T14:22:00Z',
    },
    {
      id: 'act-003',
      projectId: phoenixProject.id,
      userId: sarahUser.id,
      userName: sarahUser.name,
      action: 'Uploaded Document',
      category: 'DOCUMENT',
      details: 'Uploaded Payment_Integration_and_PCI_Scope_Notes.pdf (8 pages).',
      timestamp: '2026-10-02T09:15:00Z',
    },
    {
      id: 'act-004',
      projectId: phoenixProject.id,
      userId: marcusUser.id,
      userName: marcusUser.name,
      action: 'AI Knowledge Reconstruction',
      category: 'AI_EXTRACTION',
      details: 'Gemini 3.8 Flash extracted 10 structured findings across 3 project documents with exact citations.',
      timestamp: '2026-10-24T17:10:00Z',
    },
    {
      id: 'act-005',
      projectId: phoenixProject.id,
      userId: marcusUser.id,
      userName: marcusUser.name,
      action: 'Human Finding Review',
      category: 'REVIEW',
      details: 'Approved Finding fnd-phx-001 (PostgreSQL Decision) and fnd-phx-004 (PCI-DSS Audit Risk).',
      timestamp: '2026-10-25T11:20:00Z',
    },
    {
      id: 'act-006',
      projectId: phoenixProject.id,
      userId: demoUser.id,
      userName: demoUser.name,
      action: 'Human Review Action',
      category: 'REVIEW',
      details: 'Approved Finding fnd-phx-003 (Payment Webhook Idempotency) assigned to Alex Rivera.',
      timestamp: '2026-10-27T09:10:00Z',
    },
  ];

  // Seed initial source records from architecture docs and repository
  const initialSourceRecords: SourceRecord[] = [
    {
      id: 'sr-doc-arch-p1',
      projectId: phoenixProject.id,
      sourcePlatform: 'DOCUMENT',
      externalSourceId: 'doc-arch-001#page-1',
      sourceUrl: '/api/documents/doc-arch-001?page=1',
      recordType: 'DOCUMENT_CHUNK',
      title: 'Project Architecture Specification v3.pdf (Page 1)',
      content: 'E-COMMERCE PLATFORM MIGRATION SPECIFICATION\nDocument ID: DOC-PHX-ARCH-03\nAuthor: Sarah Lin, Staff Platform Architect\n1. Executive Summary\nThe legacy monolith (PHP/MySQL) is being decommissioned in favor of an event-driven Go and Node.js microservices architecture deployed to Google Kubernetes Engine (GKE). Core data persistence will transition to managed PostgreSQL with Citus distributed sharding.',
      author: 'Sarah Lin',
      createdDate: '2026-09-12T14:22:00Z',
      updatedDate: '2026-09-12T14:22:00Z',
      retrievedDate: '2026-11-01T08:00:00Z',
      lastSynchronisedDate: '2026-11-01T08:00:00Z',
      contentHash: 'hash-arch-p1',
      permissionMetadata: { isPublic: false, visibility: 'PROJECT_MEMBERS', requiredRole: 'MEMBER' },
      version: 1,
    },
    {
      id: 'sr-doc-arch-p3',
      projectId: phoenixProject.id,
      sourcePlatform: 'DOCUMENT',
      externalSourceId: 'doc-arch-001#page-3',
      sourceUrl: '/api/documents/doc-arch-001?page=3',
      recordType: 'DOCUMENT_CHUNK',
      title: 'Project Architecture Specification v3.pdf (Page 3)',
      content: '3. Technical Decision Record: Database Migration Strategy\nDECISION: We have chosen PostgreSQL 16 over DynamoDB and MongoDB.\nRATIONALE: Relational consistency across order line items, strict ACID guarantees during payment transactions, and native JSONB capabilities for flexible product catalog facets.\nSTATUS: Migration tooling (Debezium + Kafka CDC pipeline) is completed for 80% of tables. Final cutover scheduled for November 12, 2026.',
      author: 'Sarah Lin',
      createdDate: '2026-09-12T14:22:00Z',
      updatedDate: '2026-09-12T14:22:00Z',
      retrievedDate: '2026-11-01T08:00:00Z',
      lastSynchronisedDate: '2026-11-01T08:00:00Z',
      contentHash: 'hash-arch-p3',
      permissionMetadata: { isPublic: false, visibility: 'PROJECT_MEMBERS', requiredRole: 'MEMBER' },
      version: 1,
    },
    {
      id: 'sr-doc-pay-p2',
      projectId: phoenixProject.id,
      sourcePlatform: 'DOCUMENT',
      externalSourceId: 'doc-pay-002#page-2',
      sourceUrl: '/api/documents/doc-pay-002?page=2',
      recordType: 'DOCUMENT_CHUNK',
      title: 'Payment Integration and PCI Scope Notes.pdf (Page 2)',
      content: 'PAYMENT INTEGRATION ARCHITECTURE NOTES\nDate: October 2, 2026\nOwner: Sarah Lin\n2. Payment Provider Selection & Conflicting Directive\nIn the August committee meeting, the platform team tentatively selected Stripe Elements for tokenization. However, on September 28, VP of Finance requested evaluation of Adyen due to European interchange rate savings.\nCURRENT STATUS: Stripe sandbox integration is completed; Adyen contract is still pending legal review. Engineering MUST know if the dual-provider abstraction is required before the November freeze.',
      author: 'Sarah Lin',
      createdDate: '2026-10-02T09:15:00Z',
      updatedDate: '2026-10-02T09:15:00Z',
      retrievedDate: '2026-11-01T08:00:00Z',
      lastSynchronisedDate: '2026-11-01T08:00:00Z',
      contentHash: 'hash-pay-p2',
      permissionMetadata: { isPublic: false, visibility: 'PROJECT_MEMBERS', requiredRole: 'MEMBER' },
      version: 1,
    },
    {
      id: 'sr-gh-c1',
      projectId: phoenixProject.id,
      sourcePlatform: 'GITHUB',
      externalSourceId: 'a7f39d2e1b4c',
      sourceUrl: 'https://github.com/phoenix-retail/ecommerce-core/commit/a7f39d2e1b4c',
      recordType: 'COMMIT',
      title: 'Commit [a7f39d2]: feat(core): implement idempotent payment callback processor',
      content: 'Author: Sarah Lin <sarah.lin@phoenix-retail.com>\nDate: 2026-10-24T14:32:10Z\nBranch: main\nCommit SHA: a7f39d2e1b4c\n\nImplements webhook idempotency using Redis SETNX with 24-hour TTL to prevent double charges during gateway retries. Addresses Issue #42.',
      author: 'Sarah Lin',
      createdDate: '2026-10-24T14:32:10Z',
      updatedDate: '2026-10-24T14:32:10Z',
      retrievedDate: '2026-11-01T08:00:00Z',
      lastSynchronisedDate: '2026-11-01T08:00:00Z',
      contentHash: 'hash-gh-c1',
      permissionMetadata: { isPublic: true, visibility: 'PUBLIC_REPO', requiredRole: 'MEMBER' },
      version: 1,
    },
    {
      id: 'sr-gh-iss42',
      projectId: phoenixProject.id,
      sourcePlatform: 'GITHUB',
      externalSourceId: 'Issue #42',
      sourceUrl: 'https://github.com/phoenix-retail/ecommerce-core/issues/42',
      recordType: 'ISSUE',
      title: 'Issue #42 [OPEN]: Payment webhook callback signature validation failing under load',
      content: 'State: open\nAuthor: Sarah Lin\nAssignees: Sarah Lin, Alex Rivera\nLabels: bug, critical, security, payments\nCreated: 2026-10-22T11:00:00Z\nUpdated: 2026-10-29T16:45:00Z\n\nStripe webhook secret rotation caused transient 401 signature mismatches during blue-green deployment. Need to support dual-secret verification during the transition window. Blocks final launch cutover.',
      author: 'Sarah Lin',
      createdDate: '2026-10-22T11:00:00Z',
      updatedDate: '2026-10-29T16:45:00Z',
      retrievedDate: '2026-11-01T08:00:00Z',
      lastSynchronisedDate: '2026-11-01T08:00:00Z',
      contentHash: 'hash-gh-iss42',
      permissionMetadata: { isPublic: true, visibility: 'PUBLIC_REPO', requiredRole: 'MEMBER' },
      version: 1,
    },
    {
      id: 'sr-gh-pr18',
      projectId: phoenixProject.id,
      sourcePlatform: 'GITHUB',
      externalSourceId: 'PR #18',
      sourceUrl: 'https://github.com/phoenix-retail/ecommerce-core/pull/18',
      recordType: 'PULL_REQUEST',
      title: 'PR #18 [OPEN]: chore: migrate legacy monolithic session cookies to stateless JWT',
      content: 'State: open\nAuthor: Sarah Lin\nAssignees: Sarah Lin, Marcus Vance\nBase: main <- Head: feature/stateless-jwt\nCreated: 2026-10-25T13:00:00Z\nUpdated: 2026-10-30T11:20:00Z\nDraft: false\nMerged: Unmerged\n\nReplaces server-side Redis session storage with RS256 signed JWT tokens and HttpOnly refresh cookies. Marcus Vance requested security audit of token expiration times before merge.',
      author: 'Sarah Lin',
      createdDate: '2026-10-25T13:00:00Z',
      updatedDate: '2026-10-30T11:20:00Z',
      retrievedDate: '2026-11-01T08:00:00Z',
      lastSynchronisedDate: '2026-11-01T08:00:00Z',
      contentHash: 'hash-gh-pr18',
      permissionMetadata: { isPublic: true, visibility: 'PUBLIC_REPO', requiredRole: 'MEMBER' },
      version: 1,
    },
  ];

  const initialSourceConnections: SourceConnection[] = [
    {
      id: 'conn-gh-1',
      projectId: phoenixProject.id,
      service: 'GITHUB',
      name: 'GitHub Repository',
      status: 'CONNECTED',
      accountOrWorkspace: 'phoenix-retail',
      connectedProject: 'ecommerce-core',
      lastSyncAt: '2026-10-30T12:00:00Z',
      nextScheduledSyncAt: '2026-11-02T16:00:00Z',
      importedRecordsCount: 28,
      failedRecordsCount: 0,
      permissionStatus: 'AUTHORISED (repo, read:org)',
      authConfig: {
        repoOwner: 'phoenix-retail',
        repoName: 'ecommerce-core',
        branch: 'main',
        accessTokenMasked: 'ghp_••••••••••••••••3x9Z',
        webhookActive: true,
        scopeSummary: 'repo, read:user, read:org',
      },
      syncHistory: [
        {
          id: 'sync-gh-01',
          timestamp: '2026-10-30T12:00:00Z',
          status: 'SUCCESS',
          recordsImported: 28,
          recordsUpdated: 3,
          errorsCount: 0,
          durationMs: 1420,
          summary: 'Incremental sync completed. 28 commits, PRs, and issues indexed.',
        },
      ],
      createdAt: '2026-10-20T10:00:00Z',
      updatedAt: '2026-10-30T12:00:00Z',
    },
    {
      id: 'conn-doc-1',
      projectId: phoenixProject.id,
      service: 'DOCUMENT',
      name: 'Document Connector (PDF, DOCX, XLSX)',
      status: 'CONNECTED',
      accountOrWorkspace: 'Local Secure Vault',
      connectedProject: phoenixProject.name,
      lastSyncAt: '2026-10-24T16:43:00Z',
      nextScheduledSyncAt: null,
      importedRecordsCount: 33,
      failedRecordsCount: 0,
      permissionStatus: 'AUTHORISED (AES-256 encrypted)',
      authConfig: {
        scopeSummary: 'read, write, extract',
      },
      syncHistory: [
        {
          id: 'sync-doc-01',
          timestamp: '2026-10-24T16:43:00Z',
          status: 'SUCCESS',
          recordsImported: 33,
          recordsUpdated: 0,
          errorsCount: 0,
          durationMs: 820,
          summary: '3 document packages parsed with SHA-256 page-level chunking.',
        },
      ],
      createdAt: '2026-09-12T14:22:00Z',
      updatedAt: '2026-10-24T16:43:00Z',
    },
    {
      id: 'conn-gdrive-1',
      projectId: phoenixProject.id,
      service: 'GOOGLE_DRIVE',
      name: 'Google Drive Project Folder',
      status: 'AUTH_REQUIRED',
      accountOrWorkspace: 'Engineering Shared Drive',
      connectedProject: 'Handover / Phoenix Replatforming',
      lastSyncAt: null,
      nextScheduledSyncAt: null,
      importedRecordsCount: 0,
      failedRecordsCount: 0,
      permissionStatus: 'OAuth Required (drive.readonly)',
      authConfig: {
        folderId: 'folder_phoenix_docs_2026',
        scopeSummary: 'https://www.googleapis.com/auth/drive.readonly',
      },
      syncHistory: [],
      createdAt: '2026-10-25T09:00:00Z',
      updatedAt: '2026-10-25T09:00:00Z',
    },
    {
      id: 'conn-jira-1',
      projectId: phoenixProject.id,
      service: 'JIRA',
      name: 'Atlassian Jira Software',
      status: 'DISCONNECTED',
      accountOrWorkspace: 'phoenix.atlassian.net',
      connectedProject: 'PHX',
      lastSyncAt: null,
      nextScheduledSyncAt: null,
      importedRecordsCount: 0,
      failedRecordsCount: 0,
      permissionStatus: 'Not Connected',
      authConfig: {
        scopeSummary: 'read:jira-work, read:jira-user',
      },
      syncHistory: [],
      createdAt: '2026-10-25T09:00:00Z',
      updatedAt: '2026-10-25T09:00:00Z',
    },
    {
      id: 'conn-slack-1',
      projectId: phoenixProject.id,
      service: 'SLACK',
      name: 'Slack Continuity Stream',
      status: 'DISCONNECTED',
      accountOrWorkspace: 'phoenix-team.slack.com',
      connectedProject: '#proj-phoenix-migration',
      lastSyncAt: null,
      nextScheduledSyncAt: null,
      importedRecordsCount: 0,
      failedRecordsCount: 0,
      permissionStatus: 'Not Connected',
      authConfig: {
        scopeSummary: 'channels:history, groups:history',
      },
      syncHistory: [],
      createdAt: '2026-10-25T09:00:00Z',
      updatedAt: '2026-10-25T09:00:00Z',
    },
  ];

  return {
    users: [demoUser, sarahUser, marcusUser],
    projects: [phoenixProject, telehealthProject],
    projectMembers: members,
    documents: [docArchitecture, docPaymentNotes, docStatusReport],
    findings: findings,
    handoverReports: [],
    githubConnections: [github],
    sourceRecords: initialSourceRecords,
    sourceConnections: initialSourceConnections,
    ragQueries: [],
    activityLogs: activityLogs,
  };
}

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    if (fs.existsSync(DATA_FILE)) {
      let parsed: DatabaseSchema;
      try {
        parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as DatabaseSchema;
      } catch (error) {
        throw new Error(`Failed to load the persisted project store at ${DATA_FILE}.`, { cause: error });
      }

      if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.projects)) {
        throw new Error(`The persisted project store at ${DATA_FILE} is invalid; refusing to overwrite it.`);
      }

      const fresh = getInitialData();
      if (!parsed.sourceConnections || parsed.sourceConnections.length === 0) {
        parsed.sourceConnections = fresh.sourceConnections;
      }
      if (!parsed.sourceRecords || parsed.sourceRecords.length === 0) {
        parsed.sourceRecords = fresh.sourceRecords;
      }
      parsed.ragQueries = parsed.ragQueries || [];
      this.saveDirect(parsed);
      return parsed;
    }

    const fresh = getInitialData();
    this.saveDirect(fresh);
    return fresh;
  }

  private saveDirect(dataToSave: DatabaseSchema) {
    const temporaryFile = `${DATA_FILE}.${process.pid}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporaryFile, JSON.stringify(dataToSave, null, 2), { encoding: 'utf-8', flag: 'wx' });
      fs.renameSync(temporaryFile, DATA_FILE);
    } catch (error) {
      if (fs.existsSync(temporaryFile)) {
        try {
          fs.unlinkSync(temporaryFile);
        } catch (cleanupError) {
          console.error(`Failed to remove incomplete store file ${temporaryFile}:`, cleanupError);
        }
      }
      throw new Error(`Failed to persist the project store at ${DATA_FILE}.`, { cause: error });
    }
  }

  public save() {
    this.saveDirect(this.data);
  }

  // --- Users ---
  public findUserByEmail(email: string) {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public findUserById(id: string) {
    const user = this.data.users.find((u) => u.id === id);
    if (!user) return null;
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  public createUser(userData: {
    email: string;
    name: string;
    title: string;
    password: string;
    role?: 'OWNER' | 'LEAD' | 'REVIEWER' | 'MEMBER';
  }) {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(userData.password, salt);
    const newUser: User & { passwordHash: string } = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      email: userData.email,
      name: userData.name,
      title: userData.title,
      role: userData.role || 'MEMBER',
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    this.data.users.push(newUser);
    this.save();
    const { passwordHash: _, ...safeUser } = newUser;
    return safeUser;
  }

  // --- Projects ---
  public getProjects() {
    return this.data.projects.map((p) => {
      const docs = this.data.documents.filter((d) => d.projectId === p.id);
      const fnds = this.data.findings.filter((f) => f.projectId === p.id);
      const pendingReviews = fnds.filter((f) => f.reviewStatus === 'PENDING');
      const approved = fnds.filter((f) => f.reviewStatus === 'APPROVED');
      const risks = fnds.filter((f) => f.category === 'RISK' || f.category === 'BLOCKER');

      return {
        ...p,
        documentCount: docs.length,
        findingsCount: fnds.length,
        pendingReviewCount: pendingReviews.length,
        approvedCount: approved.length,
        risksCount: risks.length,
      };
    });
  }

  public getProjectById(id: string) {
    const p = this.data.projects.find((proj) => proj.id === id);
    if (!p) return null;
    const docs = this.data.documents.filter((d) => d.projectId === p.id);
    const fnds = this.data.findings.filter((f) => f.projectId === p.id);
    const pendingReviews = fnds.filter((f) => f.reviewStatus === 'PENDING');
    const approved = fnds.filter((f) => f.reviewStatus === 'APPROVED');
    const risks = fnds.filter((f) => f.category === 'RISK' || f.category === 'BLOCKER');

    return {
      ...p,
      documentCount: docs.length,
      findingsCount: fnds.length,
      pendingReviewCount: pendingReviews.length,
      approvedCount: approved.length,
      risksCount: risks.length,
    };
  }

  public createProject(projectData: Partial<Project> & { name: string; ownerId: string; ownerName: string }) {
    const newProj: Project = {
      id: `proj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: projectData.name,
      code: projectData.code || projectData.name.substring(0, 4).toUpperCase(),
      description: projectData.description || '',
      category: projectData.category || 'General Engineering',
      status: projectData.status || 'ACTIVE',
      ownerId: projectData.ownerId,
      ownerName: projectData.ownerName,
      departingMemberName: projectData.departingMemberName,
      departingMemberRole: projectData.departingMemberRole,
      successorName: projectData.successorName,
      targetHandoverDate: projectData.targetHandoverDate,
      objectives: projectData.objectives,
      startDate: projectData.startDate,
      expectedCompletionDate: projectData.expectedCompletionDate,
      teamMembers: projectData.teamMembers || [],
      techStack: projectData.techStack || [],
      importantDeadlines: projectData.importantDeadlines || [],
      knownRisks: projectData.knownRisks || [],
      existingDependencies: projectData.existingDependencies || [],
      projectDocumentationNotes: projectData.projectDocumentationNotes,
      setupCompleted: projectData.setupCompleted ?? false,
      currentSetupStep: projectData.currentSetupStep ?? 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.projects.push(newProj);
    this.save();
    return this.getProjectById(newProj.id);
  }

  public updateProject(id: string, updates: Partial<Project>) {
    const idx = this.data.projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.data.projects[idx] = {
      ...this.data.projects[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.getProjectById(id);
  }

  // --- Project Members ---
  public getProjectMembers(projectId: string) {
    return this.data.projectMembers.filter((m) => m.projectId === projectId);
  }

  public addProjectMember(projectId: string, user: User, role: 'OWNER' | 'LEAD' | 'REVIEWER' | 'MEMBER') {
    const newMember: ProjectMember = {
      id: `pm-${Date.now()}`,
      projectId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      role,
      joinedAt: new Date().toISOString(),
    };
    this.data.projectMembers.push(newMember);
    this.save();
    return newMember;
  }

  // --- Documents ---
  public getDocuments(projectId: string) {
    return this.data.documents.filter((d) => d.projectId === projectId);
  }

  public getDocumentById(id: string) {
    return this.data.documents.find((d) => d.id === id) || null;
  }

  public addDocument(doc: ProjectDocument) {
    this.data.documents.push(doc);
    this.save();
    return doc;
  }

  public updateDocument(id: string, updates: Partial<ProjectDocument>) {
    const idx = this.data.documents.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    this.data.documents[idx] = { ...this.data.documents[idx], ...updates };
    this.save();
    return this.data.documents[idx];
  }

  public deleteDocument(id: string) {
    const idx = this.data.documents.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    this.data.documents.splice(idx, 1);
    // Also remove associated findings
    this.data.findings = this.data.findings.filter((f) => f.sourceDocumentId !== id);
    this.data.sourceRecords = this.data.sourceRecords.filter(
      (record) =>
        record.externalSourceId !== id &&
        !record.externalSourceId.startsWith(`${id}#`) &&
        !record.id.startsWith(`sr-doc-${id}-`)
    );
    this.save();
    return true;
  }

  // --- Findings ---
  public getFindings(projectId: string) {
    return this.data.findings.filter((f) => f.projectId === projectId);
  }

  public getFindingById(id: string) {
    return this.data.findings.find((f) => f.id === id) || null;
  }

  public addFinding(finding: Finding) {
    this.data.findings.push(finding);
    this.save();
    return finding;
  }

  public addFindings(newFindings: Finding[]) {
    newFindings.forEach((finding) => {
      const existingIndex = this.data.findings.findIndex((existing) => existing.id === finding.id);
      if (existingIndex >= 0) {
        this.data.findings[existingIndex] = finding;
      } else {
        this.data.findings.push(finding);
      }
    });
    this.save();
    return newFindings;
  }

  public replaceAiFindingsForDocument(documentId: string, newFindings: Finding[]) {
    const reviewedFindings = this.data.findings.filter(
      (finding) =>
        finding.sourceDocumentId === documentId &&
        finding.isAiGenerated &&
        finding.reviewStatus !== 'PENDING'
    );
    if (reviewedFindings.length > 0) return false;

    this.data.findings = this.data.findings.filter(
      (finding) => !(finding.sourceDocumentId === documentId && finding.isAiGenerated)
    );
    this.data.findings.push(...newFindings);
    this.save();
    return true;
  }

  public updateFinding(id: string, updates: Partial<Finding>) {
    const idx = this.data.findings.findIndex((f) => f.id === id);
    if (idx === -1) return null;
    this.data.findings[idx] = {
      ...this.data.findings[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.findings[idx];
  }

  // --- Handover Reports ---
  public getHandoverReports(projectId: string) {
    return this.data.handoverReports.filter((r) => r.projectId === projectId);
  }

  public getHandoverReportById(id: string) {
    return this.data.handoverReports.find((r) => r.id === id) || null;
  }

  public saveHandoverReport(report: HandoverReport) {
    this.data.handoverReports.push(report);
    this.save();
    return report;
  }

  // --- GitHub Integrations ---
  public getGitHubConnection(projectId: string) {
    return this.data.githubConnections.find((c) => c.projectId === projectId) || null;
  }

  public saveGitHubConnection(conn: GitHubConnection) {
    const idx = this.data.githubConnections.findIndex((c) => c.projectId === conn.projectId);
    if (idx >= 0) {
      this.data.githubConnections[idx] = conn;
    } else {
      this.data.githubConnections.push(conn);
    }
    this.save();
    return conn;
  }

  // --- Activity Logs ---
  public logActivity(log: Omit<ActivityLog, 'id' | 'timestamp'>) {
    const entry: ActivityLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.data.activityLogs.unshift(entry);
    // Keep last 500 logs
    if (this.data.activityLogs.length > 500) {
      this.data.activityLogs = this.data.activityLogs.slice(0, 500);
    }
    this.save();
    return entry;
  }

  public getActivityLogs(projectId: string) {
    return this.data.activityLogs.filter((l) => l.projectId === projectId);
  }

  // --- Document Utilities ---
  public findDocumentByHash(projectId: string, contentHash: string) {
    return this.data.documents.find((d) => d.projectId === projectId && d.contentHash === contentHash) || null;
  }

  // --- Source Records (Unified Canonical Model) ---
  public getSourceRecords(projectId: string) {
    return this.data.sourceRecords.filter((r) => r.projectId === projectId);
  }

  public saveSourceRecords(records: SourceRecord[]) {
    records.forEach((rec) => {
      const idx = this.data.sourceRecords.findIndex((r) => r.id === rec.id);
      if (idx >= 0) {
        this.data.sourceRecords[idx] = rec;
      } else {
        this.data.sourceRecords.push(rec);
      }
    });
    this.save();
    return records;
  }

  public deleteSourceRecordsByPlatform(projectId: string, platform: string) {
    this.data.sourceRecords = this.data.sourceRecords.filter(
      (r) => !(r.projectId === projectId && r.sourcePlatform === platform)
    );
    this.save();
  }

  // --- Source Connections (Connectors Center) ---
  public getSourceConnections(projectId: string) {
    return this.data.sourceConnections.filter((c) => c.projectId === projectId);
  }

  public getSourceConnection(projectId: string, service: string) {
    return this.data.sourceConnections.find((c) => c.projectId === projectId && c.service === service) || null;
  }

  public saveSourceConnection(conn: SourceConnection) {
    const idx = this.data.sourceConnections.findIndex(
      (c) => c.projectId === conn.projectId && c.service === conn.service
    );
    if (idx >= 0) {
      this.data.sourceConnections[idx] = conn;
    } else {
      this.data.sourceConnections.push(conn);
    }
    this.save();
    return conn;
  }

  public removeSourceConnection(projectId: string, service: string) {
    this.data.sourceConnections = this.data.sourceConnections.filter(
      (c) => !(c.projectId === projectId && c.service === service)
    );
    this.save();
  }

  // --- RAG Queries & Audit Trail ---
  public saveRagQuery(projectId: string, question: string, answer: any, userId?: string) {
    const entry = {
      id: `rag-q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      projectId,
      userId,
      question,
      answer,
      timestamp: new Date().toISOString(),
    };
    this.data.ragQueries.unshift(entry);
    if (this.data.ragQueries.length > 200) {
      this.data.ragQueries = this.data.ragQueries.slice(0, 200);
    }
    this.save();
    return entry;
  }

  public getRagQueries(projectId: string) {
    return this.data.ragQueries.filter((q) => q.projectId === projectId);
  }

  // Reset or reseed
  public resetToDefaultSeed() {
    this.data = getInitialData();
    this.save();
    return true;
  }
}

export const db = new Database();
