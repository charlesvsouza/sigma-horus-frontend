'use client';

import { Field, inputClass } from '@/components/ui';
import { VISITOR_DEGREES } from '@/lib/visitors';

// Campos do cadastro de irmão visitante — os mesmos da lista de presença em papel.

export interface VisitorFormValue {
  name: string;
  degree: string;
  lodgeName: string;
  lodgeNumber: string;
  orient: string;
  powerName: string;
  cim: string;
  phone: string;
  email: string;
}

export const EMPTY_VISITOR: VisitorFormValue = { name: '', degree: '', lodgeName: '', lodgeNumber: '', orient: '', powerName: '', cim: '', phone: '', email: '' };

export function visitorFormFrom(v: Partial<Record<keyof VisitorFormValue, string | null>>): VisitorFormValue {
  const out = { ...EMPTY_VISITOR };
  for (const k of Object.keys(out) as (keyof VisitorFormValue)[]) out[k] = v[k] ?? '';
  return out;
}

export function VisitorFieldsInputs({ value, onChange, nameSlot }: { value: VisitorFormValue; onChange: (v: VisitorFormValue) => void; nameSlot?: React.ReactNode }) {
  const set = (k: keyof VisitorFormValue) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Field label="Nome do obreiro" className="md:col-span-2">
        {nameSlot ?? <input value={value.name} onChange={set('name')} className={inputClass} required />}
      </Field>
      <Field label="Grau">
        <select value={value.degree} onChange={set('degree')} className={inputClass}>
          <option value="">—</option>
          {VISITOR_DEGREES.map((d) => <option key={d} value={d}>{d}</option>)}
          {value.degree && !(VISITOR_DEGREES as readonly string[]).includes(value.degree) ? <option value={value.degree}>{value.degree}</option> : null}
        </select>
      </Field>
      <Field label="CIM">
        <input value={value.cim} onChange={set('cim')} className={inputClass} />
      </Field>
      <Field label="Loja" className="md:col-span-2">
        <input value={value.lodgeName} onChange={set('lodgeName')} className={inputClass} placeholder="ex.: Estrela do Sul" />
      </Field>
      <Field label="Nº da loja">
        <input value={value.lodgeNumber} onChange={set('lodgeNumber')} className={inputClass} />
      </Field>
      <Field label="Oriente">
        <input value={value.orient} onChange={set('orient')} className={inputClass} placeholder="cidade" />
      </Field>
      <Field label="Potência">
        <input value={value.powerName} onChange={set('powerName')} className={inputClass} placeholder="ex.: GOB" />
      </Field>
      <Field label="Telefone">
        <input value={value.phone} onChange={set('phone')} className={inputClass} />
      </Field>
      <Field label="E-mail (para o certificado)" className="md:col-span-2">
        <input type="email" value={value.email} onChange={set('email')} className={inputClass} />
      </Field>
    </div>
  );
}
