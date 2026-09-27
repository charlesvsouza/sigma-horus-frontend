'use client';

import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/ui';
import { ReportActions } from '@/components/report/report-document';
import { BoardPaperPicker, HonorBoard, Portrait, PortraitGrid, type BoardOrientation, type BoardPaper } from '@/components/report/honor-board';
import { formatDateOnly } from '@/lib/date-only';
import type { Letterhead } from '@/lib/letterhead';
import { officeRank } from '@/lib/office-order';

interface MemberOfficeItem {
  id: string;
  office: { id: string; name: string; order: number };
  member: { id: string; name: string; photoUrl: string | null };
}
interface TermData {
  id: string;
  title: string;
  startDate: string;
  endDate: string | null;
  memberOffices: MemberOfficeItem[];
}

export default function QuadroGestaoClient({ letterhead, term, canManage = true }: { letterhead: Letterhead; term: TermData | null; canManage?: boolean }) {
  const [paper, setPaper] = useState<BoardPaper>('A4');
  const [orientation, setOrientation] = useState<BoardOrientation>('portrait');
  // O Venerável Mestre abre o quadro, em destaque; os demais cargos vêm na grade.
  const venerable = term?.memberOffices.find((mo) => officeRank(mo.office.name) === 1) ?? null;
  const others = term?.memberOffices.filter((mo) => mo !== venerable) ?? [];

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="rpt-noprint print:hidden">
          <h1 className="font-display text-2xl font-bold text-sand-light">Quadro da Gestão</h1>
          <p className="mt-1 text-sm text-sand-dark">Cargos do período em exercício, com foto — bom para mural, apresentações e prestação de contas.</p>
        </div>

        {!term ? (
          <EmptyState
            title="Nenhum veneralato em exercício."
            description={canManage ? 'Crie um período em Veneralato e vincule os cargos para que o quadro apareça aqui.' : 'A Secretaria ainda não cadastrou o veneralato desta loja.'}
            action={canManage ? <Link href="/dashboard/veneralato" className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">Ir para Veneralato</Link> : undefined}
          />
        ) : term.memberOffices.length === 0 ? (
          <EmptyState
            title="Nenhum cargo vinculado ainda."
            description={canManage ? `O período "${term.title}" está em exercício, mas nenhum cargo foi vinculado. Faça isso em Veneralato.` : `O período "${term.title}" está em exercício, mas ainda não tem cargos vinculados.`}
            action={canManage ? <Link href="/dashboard/veneralato" className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">Ir para Veneralato</Link> : undefined}
          />
        ) : (
          <>
            <ReportActions>
              <BoardPaperPicker paper={paper} orientation={orientation} onChange={(p, o) => { setPaper(p); setOrientation(o); }} />
            </ReportActions>

            <HonorBoard
              letterhead={letterhead}
              title="Quadro da Gestão"
              subtitle={`${term.title} · ${formatDateOnly(term.startDate)} a ${term.endDate ? formatDateOnly(term.endDate) : 'em exercício'}`}
              paper={paper}
              orientation={orientation}
            >
              {venerable ? (
                <div className="mb-8 flex justify-center">
                  <Portrait name={venerable.member.name} photoUrl={venerable.member.photoUrl} office={venerable.office.name} highlight />
                </div>
              ) : null}
              <PortraitGrid>
                {others.map((mo) => (
                  <Portrait key={mo.id} name={mo.member.name} photoUrl={mo.member.photoUrl} office={mo.office.name} />
                ))}
              </PortraitGrid>
            </HonorBoard>
          </>
        )}
      </div>
    </main>
  );
}
