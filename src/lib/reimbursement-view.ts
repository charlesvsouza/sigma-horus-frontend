// Formato do pedido de reembolso que vai do servidor para as telas (sem datas Date: tudo serializável).

export interface ReimbursementFileView { id: string; name: string; type: string; size: number }

export interface ReimbursementView {
  id: string;
  status: string;
  memberId: string;
  memberName: string;
  memberStatus: string;
  description: string;
  vendorName: string | null;
  amount: number;
  expenseDate: string; // AAAA-MM-DD
  chartAccountId: string | null;
  chartLabel: string | null;
  requestedVia: string;
  requestedByName: string;
  createdAt: string;
  submittedAt: string | null;
  reviewNote: string | null;
  decisionNote: string | null;
  approvedAmount: number | null;
  implicitApproval: boolean;
  paidAt: string | null;
  accountId: string | null;
  files: ReimbursementFileView[];
  /** Dívida em aberto do irmão com a loja (aviso ao Venerável ao decidir). */
  openDebt: number;
  /** O que o usuário logado pode fazer com ESTE pedido (calculado no servidor, com as regras de quem pediu/digitou). */
  can: { edit: boolean; review: boolean; decide: boolean; pay: boolean; cancel: boolean };
}

export interface ChartOption { id: string; label: string }
export interface BankOption { id: string; name: string; isDefault: boolean }
