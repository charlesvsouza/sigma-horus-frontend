// Mapeamento body → dados do Member, compartilhado por POST (create) e PUT (update).
// Mantém a paridade de campos entre criação e edição num só lugar.

type Body = Record<string, unknown>;

const str = (v: unknown) => {
  const s = v == null ? '' : String(v).trim();
  return s || null;
};
const date = (v: unknown) => (v ? new Date(String(v)) : null);

export interface MemberFields {
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  riteId: string | null;
  powerId: string | null;
  gradeName: string | null;
  birthDate: Date | null;
  cpf: string | null;
  rg: string | null;
  maritalStatus: string | null;
  spouseName: string | null;
  spouseBirthDate: Date | null;
  childrenNames: string | null;
  fatherName: string | null;
  motherName: string | null;
  occupation: string | null;
  nationality: string | null;
  addressLine: string | null;
  addressNumber: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  initiationDate: Date | null;
  elevationDate: Date | null;
  exaltationDate: Date | null;
  installationDate: Date | null;
  initiationLodge: string | null;
  elevationLodge: string | null;
  exaltationLodge: string | null;
  installationLodge: string | null;
  initiationDegree: string | null;
  currentDegree: string | null;
  originLodge: string | null;
  masonicNumber: string | null;
  documents: string | null;
  notes: string | null;
}

export function parseMemberFields(body: Body): MemberFields {
  return {
    name: String(body?.name ?? '').trim(),
    email: str(body?.email),
    phone: str(body?.phone),
    status: String(body?.status ?? 'active'),
    riteId: str(body?.riteId),
    powerId: str(body?.powerId),
    gradeName: str(body?.gradeName),
    birthDate: date(body?.birthDate),
    cpf: str(body?.cpf),
    rg: str(body?.rg),
    maritalStatus: str(body?.maritalStatus),
    spouseName: str(body?.spouseName),
    spouseBirthDate: date(body?.spouseBirthDate),
    childrenNames: str(body?.childrenNames),
    fatherName: str(body?.fatherName),
    motherName: str(body?.motherName),
    occupation: str(body?.occupation),
    nationality: str(body?.nationality),
    addressLine: str(body?.addressLine),
    addressNumber: str(body?.addressNumber),
    complement: str(body?.complement),
    neighborhood: str(body?.neighborhood),
    city: str(body?.city),
    state: str(body?.state),
    zipCode: str(body?.zipCode),
    country: str(body?.country),
    initiationDate: date(body?.initiationDate),
    elevationDate: date(body?.elevationDate),
    exaltationDate: date(body?.exaltationDate),
    installationDate: date(body?.installationDate),
    initiationLodge: str(body?.initiationLodge),
    elevationLodge: str(body?.elevationLodge),
    exaltationLodge: str(body?.exaltationLodge),
    installationLodge: str(body?.installationLodge),
    initiationDegree: str(body?.initiationDegree),
    currentDegree: str(body?.currentDegree),
    originLodge: str(body?.originLodge),
    masonicNumber: str(body?.masonicNumber),
    documents: str(body?.documents),
    notes: str(body?.notes),
  };
}

// Campos retornados na listagem/edição (inclui tudo que a UI precisa para o form).
export const MEMBER_LIST_INCLUDE = {
  rite: { select: { id: true, name: true } },
  power: { select: { id: true, name: true } },
} as const;
