"use client";

import { useEffect, useState } from 'react';

interface Option { id: string; name: string; }
interface Member {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  gradeName?: string | null;
  currentDegree?: string | null;
  originLodge?: string | null;
  initiationDate?: string | null;
  elevationDate?: string | null;
  exaltationDate?: string | null;
  rite?: Option | null;
  power?: Option | null;
}

const initialForm = {
  name: '',
  email: '',
  phone: '',
  status: 'active',
  gradeName: '',
  riteId: '',
  powerId: '',
  birthDate: '',
  cpf: '',
  rg: '',
  maritalStatus: '',
  spouseName: '',
  spouseBirthDate: '',
  childrenNames: '',
  fatherName: '',
  motherName: '',
  occupation: '',
  nationality: '',
  addressLine: '',
  addressNumber: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  initiationDate: '',
  elevationDate: '',
  exaltationDate: '',
  initiationLodge: '',
  elevationLodge: '',
  exaltationLodge: '',
  initiationDegree: '',
  currentDegree: '',
  originLodge: '',
  masonicNumber: '',
  documents: '',
  notes: '',
};

export default function MembrosPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [rites, setRites] = useState<Option[]>([]);
  const [powers, setPowers] = useState<Option[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const [membersResponse, ritesResponse, powersResponse] = await Promise.all([
      fetch('/api/members'),
      fetch('/api/rites'),
      fetch('/api/powers'),
    ]);

    const membersData = await membersResponse.json();
    const ritesData = await ritesResponse.json();
    const powersData = await powersResponse.json();
    setMembers(membersData.items ?? []);
    setRites(ritesData.items ?? []);
    setPowers(powersData.items ?? []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  function updateField(field: string, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, riteId: form.riteId || undefined, powerId: form.powerId || undefined }),
    });
    const data = await response.json();
    if (response.ok) {
      setMessage('Membro cadastrado com sucesso.');
      setForm(initialForm);
      await loadData();
    } else {
      setMessage(data.error ?? 'Erro ao cadastrar membro.');
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Membros</h1>
          <p className="mt-3 text-slate-400">Cadastre o perfil completo do obreiro com dados pessoais, documentos, endereço e evolução maçônica.</p>
        </div>

        {message ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Novo membro</h2>
          <form onSubmit={handleSubmit} className="mt-6 space-y-8">
            <div className="grid gap-4 md:grid-cols-2">
              <input value={form.name} onChange={(event) => updateField('name', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Nome completo" required />
              <input value={form.email} onChange={(event) => updateField('email', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="E-mail" />
              <input value={form.phone} onChange={(event) => updateField('phone', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Telefone" />
              <input value={form.gradeName} onChange={(event) => updateField('gradeName', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Grau atual" />
              <select value={form.riteId} onChange={(event) => updateField('riteId', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                <option value="">Selecione um rito</option>
                {rites.map((rite) => <option key={rite.id} value={rite.id}>{rite.name}</option>)}
              </select>
              <select value={form.powerId} onChange={(event) => updateField('powerId', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                <option value="">Selecione uma potência</option>
                {powers.map((power) => <option key={power.id} value={power.id}>{power.name}</option>)}
              </select>
              <select value={form.status} onChange={(event) => updateField('status', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 md:col-span-2">
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="suspended">Suspenso</option>
              </select>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">Dados pessoais</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input type="date" value={form.birthDate} onChange={(event) => updateField('birthDate', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" />
                <input value={form.cpf} onChange={(event) => updateField('cpf', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="CPF" />
                <input value={form.rg} onChange={(event) => updateField('rg', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="RG" />
                <select value={form.maritalStatus} onChange={(event) => updateField('maritalStatus', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                  <option value="">Estado civil</option>
                  <option value="single">Solteiro</option>
                  <option value="married">Casado</option>
                  <option value="divorced">Divorciado</option>
                  <option value="widowed">Viúvo</option>
                </select>
                <input value={form.spouseName} onChange={(event) => updateField('spouseName', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Nome da esposa / cônjuge" />
                <input type="date" value={form.spouseBirthDate} onChange={(event) => updateField('spouseBirthDate', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" />
                <input value={form.childrenNames} onChange={(event) => updateField('childrenNames', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Filhos (nome / idade)" />
                <input value={form.fatherName} onChange={(event) => updateField('fatherName', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Nome do pai" />
                <input value={form.motherName} onChange={(event) => updateField('motherName', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Nome da mãe" />
                <input value={form.occupation} onChange={(event) => updateField('occupation', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Profissão" />
                <input value={form.nationality} onChange={(event) => updateField('nationality', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Nacionalidade" />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">Endereço e documentos</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input value={form.addressLine} onChange={(event) => updateField('addressLine', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 md:col-span-2" placeholder="Endereço" />
                <input value={form.addressNumber} onChange={(event) => updateField('addressNumber', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Número" />
                <input value={form.complement} onChange={(event) => updateField('complement', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Complemento" />
                <input value={form.neighborhood} onChange={(event) => updateField('neighborhood', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Bairro" />
                <input value={form.city} onChange={(event) => updateField('city', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Cidade" />
                <input value={form.state} onChange={(event) => updateField('state', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Estado" />
                <input value={form.zipCode} onChange={(event) => updateField('zipCode', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="CEP" />
                <input value={form.country} onChange={(event) => updateField('country', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="País" />
                <textarea value={form.documents} onChange={(event) => updateField('documents', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 md:col-span-2" placeholder="Documentos e observações relevantes" rows={3} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">Evolução maçônica</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input type="date" value={form.initiationDate} onChange={(event) => updateField('initiationDate', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Iniciação" />
                <input type="date" value={form.elevationDate} onChange={(event) => updateField('elevationDate', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Elevação" />
                <input type="date" value={form.exaltationDate} onChange={(event) => updateField('exaltationDate', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Exaltação" />
                <input value={form.initiationDegree} onChange={(event) => updateField('initiationDegree', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Grau de iniciação" />
                <input value={form.currentDegree} onChange={(event) => updateField('currentDegree', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Grau atual" />
                <input value={form.masonicNumber} onChange={(event) => updateField('masonicNumber', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Número maçônico" />
                <input value={form.initiationLodge} onChange={(event) => updateField('initiationLodge', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Loja de iniciação" />
                <input value={form.elevationLodge} onChange={(event) => updateField('elevationLodge', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Loja de elevação" />
                <input value={form.exaltationLodge} onChange={(event) => updateField('exaltationLodge', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Loja de exaltação" />
                <input value={form.originLodge} onChange={(event) => updateField('originLodge', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Potência / loja de origem" />
                <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 md:col-span-2" placeholder="Observações maçônicas e administrativas" rows={3} />
              </div>
            </div>

            <button type="submit" className="rounded-full bg-amber-400 px-5 py-3 font-medium text-slate-950">Salvar membro</button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Listagem</h2>
          <div className="mt-6 space-y-3">
            {loading ? <p className="text-sm text-slate-500">Carregando...</p> : members.length === 0 ? <p className="text-sm text-slate-500">Nenhum membro cadastrado.</p> : members.map((member) => (
              <div key={member.id} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-slate-400">{member.email ?? 'Sem e-mail'} • {member.phone ?? 'Sem telefone'}</p>
                    <p className="mt-2 text-sm text-slate-500">{member.currentDegree ?? member.gradeName ?? 'Grau não informado'} • {member.originLodge ?? 'Loja de origem não informada'}</p>
                  </div>
                  <div className="text-sm text-slate-400">
                    <p>Rito: {member.rite?.name ?? '—'}</p>
                    <p>Potência: {member.power?.name ?? '—'}</p>
                    <p>Iniciação: {member.initiationDate ? new Date(member.initiationDate).toLocaleDateString('pt-BR') : '—'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
