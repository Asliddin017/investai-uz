/** Shapes returned by /api/v1 as seen by the client (dates arrive as ISO strings). */

export type PlanStatus = "DRAFT" | "PENDING" | "REJECTED" | "APPROVED" | "REPORTED" | "COMPLETED";
export type ItemResult = "PENDING" | "ACHIEVED" | "NOT_ACHIEVED";
export type AgreementStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";
export type AgreementDisplayStatus = AgreementStatus | "OVERDUE";
export type DocumentType = "SHARTNOMA" | "MEMORANDUM" | "BITIM" | "BOSHQA";

export type UserRef = { id: string; fullName: string; position?: string | null };

export type PlanListItem = {
  id: string;
  title: string;
  country: string;
  city: string | null;
  startDate: string;
  endDate: string;
  status: PlanStatus;
  version: number;
  updatedAt: string;
  creator: UserRef | null;
  department: { id: string; name: string } | null;
  itemCount: number;
  achievedCount: number;
  notAchievedCount: number;
  score: number | null;
  _count: { agreements: number };
};

export type PlanItem = {
  id: string;
  order: number;
  title: string;
  expectedResult: string;
  dueDate: string | null;
  result: ItemResult;
  resultNote: string | null;
  failureReason: string | null;
};

export type PlanSnapshot = {
  title: string;
  goal: string;
  country: string;
  city: string | null;
  startDate: string;
  endDate: string;
  items: { order: number; title: string; expectedResult: string; dueDate: string | null }[];
};

export type AgreementSummary = {
  id: string;
  planItemId: string | null;
  title: string;
  partner: string;
  partnerCountry: string | null;
  documentType: DocumentType;
  documentNumber: string | null;
  signedDate: string | null;
  amount: number | null;
  currency: string | null;
  deadline: string;
  status: AgreementStatus;
  displayStatus: AgreementDisplayStatus;
  progress: number;
  description: string | null;
  _count: { attachments: number; updates: number };
};

export type Analysis = {
  id: string;
  score: number;
  summary: string;
  model: string;
  createdAt: string;
  createdBy: UserRef;
  details: {
    items: { order: number; score: number; comment: string }[];
    extraAchievements: string;
    recommendations: string[];
  };
};

export type PlanDetail = {
  id: string;
  title: string;
  goal: string;
  country: string;
  city: string | null;
  startDate: string;
  endDate: string;
  status: PlanStatus;
  version: number;
  rejectionReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  reportedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  creator: UserRef;
  approvedBy: UserRef | null;
  department: { id: string; name: string } | null;
  items: PlanItem[];
  versions: { id: string; version: number; snapshot: PlanSnapshot; createdAt: string; createdBy: UserRef }[];
  approvals: {
    id: string;
    version: number;
    action: "SUBMIT" | "APPROVE" | "REJECT";
    comment: string | null;
    createdAt: string;
    user: UserRef;
  }[];
  agreements: AgreementSummary[];
  analyses: Analysis[];
  can: {
    edit: boolean;
    submit: boolean;
    delete: boolean;
    approve: boolean;
    report: boolean;
    manageAgreements: boolean;
    monitor: boolean;
    completeAgreements: boolean;
    analyze: boolean;
  };
};

export type AgreementListItem = AgreementSummary & {
  plan: { id: string; title: string; department: { name: string } | null };
  planItem: { order: number; title: string } | null;
};

export type AgreementDetail = Omit<AgreementSummary, "_count"> & {
  planId: string;
  completedAt: string | null;
  createdAt: string;
  plan: { id: string; title: string; country: string; status: PlanStatus; department: { name: string } | null };
  planItem: { id: string; order: number; title: string } | null;
  createdBy: UserRef;
  attachments: { id: string; fileName: string; size: number; mimeType: string; createdAt: string; uploadedBy: UserRef }[];
  updates: { id: string; note: string; progress: number; createdAt: string; createdBy: UserRef }[];
  can: { edit: boolean; attach: boolean; monitor: boolean; complete: boolean };
};
