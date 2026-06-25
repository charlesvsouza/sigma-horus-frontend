"use client";

import { useEffect, useState } from 'react';
import { fetchCep, maskCEP, maskCPF, maskPhone, maskRG } from '@/lib/masks';

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

  const [cepStatus, setCepStatus] = useState('');

  async function lookupCep(value: string) {
    setCepStatus('');
    const address = await fetchCep(value);
    if (!address) {
      if (value.replace(/\D/g, '').length === 8) setCepStatus('CEP não encontrado.');
      return;
    }
    setForm((previous) => ({
      ...previous,
      zipCode: address.cep,
      addressLine: address.logradouro || previous.addressLine,
      neighborhood: address.bairro || previous.neighborhood,
      city: address.cidade || previous.city,
      state: address.uf || previous.state,
    }));
    setCepStatus('Endereço preenchido pelo CEP.');
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
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-sand-light">Membros</h1>
          <p className="mt-1 text-sm text-sand-dark">Cadastre o perfil completo do obreiro com dados pessoais, documentos, endereço e evolução maçônica.</p>
        </div>

        {message ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
          <h2 className="text-base font-semibold text-sand-light">Novo membro</h2>
          <form onSubmit={handleSubmit} className="mt-5 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <input value={form.name} onChange={(event) => updateField('name', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Nome completo" required />
              <input value={form.email} onChange={(event) => updateField('email', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="E-mail" />
              <input value={form.phone} onChange={(event) => updateField('phone', maskPhone(event.target.value))} inputMode="tel" className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Telefone" />
              <input value={form.gradeName} onChange={(event) => updateField('gradeName', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Grau atual" />
              <select value={form.riteId} onChange={(event) => updateField('riteId', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20">
                <option value="">Selecione um rito</option>
                {rites.map((rite) => <option key={rite.id} value={rite.id}>{rite.name}</option>)}
              </select>
              <select value={form.powerId} onChange={(event) => updateField('powerId', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20">
                <option value="">Selecione uma potência</option>
                {powers.map((power) => <option key={power.id} value={power.id}>{power.name}</option>)}
              </select>
              <select value={form.status} onChange={(event) => updateField('status', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20 md:col-span-2">
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="suspended">Suspenso</option>
              </select>
            </div>

            <div className="rounded-lg border border-white/[6%] bg-sigma-blue-deep/50 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Dados pessoais</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input type="date" value={form.birthDate} onChange={(event) => updateField('birthDate', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" />
                <input value={form.cpf} onChange={(event) => updateField('cpf', maskCPF(event.target.value))} inputMode="numeric" className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="CPF" />
                <input value={form.rg} onChange={(event) => updateField('rg', maskRG(event.target.value))} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="RG" />
                <select value={form.maritalStatus} onChange={(event) => updateField('maritalStatus', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20">
                  <option value="">Estado civil</option>
                  <option value="single">Solteiro</option>
                  <option value="married">Casado</option>
                  <option value="divorced">Divorciado</option>
                  <option value="widowed">Viúvo</option>
                </select>
                <input value={form.spouseName} onChange={(event) => updateField('spouseName', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Nome da esposa / cônjuge" />
                <input type="date" value={form.spouseBirthDate} onChange={(event) => updateField('spouseBirthDate', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" />
                <input value={form.childrenNames} onChange={(event) => updateField('childrenNames', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Filhos (nome / idade)" />
                <input value={form.fatherName} onChange={(event) => updateField('fatherName', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Nome do pai" />
                <input value={form.motherName} onChange={(event) => updateField('motherName', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Nome da mãe" />
                <input value={form.occupation} onChange={(event) => updateField('occupation', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Profissão" />
                <input value={form.nationality} onChange={(event) => updateField('nationality', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Nacionalidade" />
              </div>
            </div>

            <div className="rounded-lg border border-white/[6%] bg-sigma-blue-deep/50 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Endereço e documentos</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input value={form.addressLine} onChange={(event) => updateField('addressLine', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20 md:col-span-2" placeholder="Endereço" />
                <input value={form.addressNumber} onChange={(event) => updateField('addressNumber', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Número" />
                <input value={form.complement} onChange={(event) => updateField('complement', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Complemento" />
                <input value={form.neighborhood} onChange={(event) => updateField('neighborhood', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Bairro" />
                <input value={form.city} onChange={(event) => updateField('city', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Cidade" />
                <input value={form.state} onChange={(event) => updateField('state', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Estado" />
                <div>
                  <input value={form.zipCode} onChange={(event) => updateField('zipCode', maskCEP(event.target.value))} onBlur={(event) => lookupCep(event.target.value)} inputMode="numeric" className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="CEP (preenche o endereço)" />
                  {cepStatus ? <p className="mt-1 text-xs text-sand-dark">{cepStatus}</p> : null}
                </div>
                <input value={form.country} onChange={(event) => updateField('country', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="País" />
                <textarea value={form.documents} onChange={(event) => updateField('documents', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20 md:col-span-2" placeholder="Documentos e observações relevantes" rows={3} />
              </div>
            </div>

            <div className="rounded-lg border border-white/[6%] bg-sigma-blue-deep/50 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Evolução maçônica</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input type="date" value={form.initiationDate} onChange={(event) => updateField('initiationDate', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" />
                <input type="date" value={form.elevationDate} onChange={(event) => updateField('elevationDate', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" />
                <input type="date" value={form.exaltationDate} onChange={(event) => updateField('exaltationDate', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" />
                <input value={form.initiationDegree} onChange={(event) => updateField('initiationDegree', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Grau de iniciação" />
                <input value={form.currentDegree} onChange={(event) => updateField('currentDegree', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Grau atual" />
                <input value={form.masonicNumber} onChange={(event) => updateField('masonicNumber', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Número maçônico" />
                <input value={form.initiationLodge} onChange={(event) => updateField('initiationLodge', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Loja de iniciação" />
                <input value={form.elevationLodge} onChange={(event) => updateField('elevationLodge', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Loja de elevação" />
                <input value={form.exaltationLodge} onChange={(event) => updateField('exaltationLodge', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Loja de exaltação" />
                <input value={form.originLodge} onChange={(event) => updateField('originLodge', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Potência / loja de origem" />
                <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/20 md:col-span-2" placeholder="Observações maçônicas e administrativas" rows={3} />
              </div>
            </div>

            <button type="submit" className="rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">Salvar membro</button>
          </form>
        </section>

        <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
          <h2 className="text-base font-semibold text-sand-light">Listagem</h2>
          <div className="mt-5 space-y-3">
            {loading ? <p className="text-sm text-sand-dark">Carregando...</p> : members.length === 0 ? <p className="text-sm text-sand-dark">Nenhum membro cadastrado.</p> : members.map((member) => (
              <div key={member.id} className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/[8%]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-sand-light">{member.name}</p>
                    <p className="mt-1 text-xs text-sand-dark">{member.email ?? 'Sem e-mail'} • {member.phone ?? 'Sem telefone'}</p>
                    <p className="mt-2 text-xs text-sand-dark/60">{member.currentDegree ?? member.gradeName ?? 'Grau não informado'} • {member.originLodge ?? 'Loja de origem não informada'}</p>
                  </div>
                  <div className="text-xs text-sand-dark">
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
