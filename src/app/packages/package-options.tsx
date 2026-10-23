"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PackageCategory, PackageService, PackageSlot } from "../../lib/packages";
import { clearDraft, readDraft, writeDraft } from "../components/session-draft";

type BookingDraft = { choices: Record<string, string[]>; startDate: string; participants: number };

export type PackageView = {
  category: PackageCategory;
  category_title: string;
  revision: number;
  id: string;
  title: string;
  description: string;
  price_per_person_satang: number;
  slots: Array<PackageSlot & { options: PackageService[] }>;
};
export type SavedPackageSelection = { id: string; category: PackageCategory; sub_package_id: string; catalog_revision: number; price_per_person_satang: number; choices: Array<{ slot_id: string; service_ids: string[] }> };

export function PackageOptions({ packageView, canSelect, savedSelection }: { packageView: PackageView; canSelect: boolean; savedSelection: SavedPackageSelection | null }) {
  const router = useRouter();
  const validChoices = (source: Array<{ slot_id: string; service_ids: string[] }>) => Object.fromEntries(packageView.slots.map((slot) => {
    const saved = source.find((choice) => choice.slot_id === slot.id)?.service_ids ?? [];
    const available = new Set(slot.options.map((option) => option.id));
    return [slot.id, saved.filter((id) => available.has(id)).slice(0, slot.required_count)];
  }));
  const [choices, setChoices] = useState<Record<string, string[]>>(() => validChoices(savedSelection?.choices ?? []));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [startDate, setStartDate] = useState("");
  const [participants, setParticipants] = useState(1);
  const [lastSubmission, setLastSubmission] = useState<{ fingerprint: string; requestId: string } | null>(null);
  // Session draft of unsaved choices, date and participants. Its base is the catalogue revision plus the saved
  // selection, so a draft made before the package or the saved choices changed is dropped (server wins).
  const draftKey = `package-booking:${packageView.id}`;
  const draftBase = useMemo(() => ({ revision: packageView.revision, saved: savedSelection ? { revision: savedSelection.catalog_revision, choices: savedSelection.choices } : null }), [packageView.revision, savedSelection]);
  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    const draft = canSelect ? readDraft<BookingDraft>(draftKey, draftBase) : undefined;
    if (draft) {
      setChoices(validChoices(Object.entries(draft.choices ?? {}).map(([slot_id, service_ids]) => ({ slot_id, service_ids }))));
      if (typeof draft.startDate === "string") setStartDate(draft.startDate);
      if (Number.isInteger(draft.participants)) setParticipants(draft.participants);
    }
    setDraftReady(true);
    // Restore once on mount for this package.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!draftReady || !canSelect) return;
    const untouched = JSON.stringify(choices) === JSON.stringify(validChoices(savedSelection?.choices ?? [])) && !startDate && participants === 1;
    if (untouched) clearDraft(draftKey); else writeDraft(draftKey, { choices, startDate, participants } satisfies BookingDraft, draftBase);
    // validChoices depends only on packageView, already covered by draftBase/draftKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftReady, canSelect, choices, startDate, participants, draftKey, draftBase]);
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/packages/selection", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: packageView.category, sub_package_id: packageView.id, revision: packageView.revision,
          choices: packageView.slots.map((slot) => ({ slot_id: slot.id, service_ids: choices[slot.id] ?? [] })) }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "บันทึกตัวเลือกไม่สำเร็จ");
      setMessage("บันทึกตัวเลือกแล้ว เปิดหน้านี้อีกครั้งเพื่อดูข้อมูลที่บันทึกไว้");
    } catch (error) { setMessage(error instanceof Error ? error.message : "บันทึกตัวเลือกไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function createBooking() {
    const payload = { category: packageView.category, sub_package_id: packageView.id, revision: packageView.revision,
      choices: packageView.slots.map((slot) => ({ slot_id: slot.id, service_ids: choices[slot.id] ?? [] })), start_date: startDate, participants };
    const fingerprint = JSON.stringify(payload);
    const requestId = lastSubmission?.fingerprint === fingerprint ? lastSubmission.requestId : crypto.randomUUID();
    setLastSubmission({ fingerprint, requestId });
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/bookings", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, request_id: requestId }) });
      const result = await response.json() as { error?: string; booking?: { id: string } };
      if (!response.ok || !result.booking) throw new Error(result.error || "สร้างรายการจองไม่สำเร็จ");
      clearDraft(draftKey);
      router.push(`/bookings/${result.booking.id}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "สร้างรายการจองไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  const complete = packageView.slots.every((slot) => (choices[slot.id] ?? []).length === slot.required_count && (choices[slot.id] ?? []).every((id) => slot.options.some((option) => option.id === id)));
  const savedNeedsReview = Boolean(savedSelection && (savedSelection.catalog_revision !== packageView.revision || savedSelection.choices.some((choice) => {
    const slot = packageView.slots.find((item) => item.id === choice.slot_id);
    return !slot || choice.service_ids.length !== slot.required_count || choice.service_ids.some((id) => !slot.options.some((option) => option.id === id));
  })));
  return (
    <section className="package-options" aria-labelledby="package-options-title">
      <div className="section-heading"><h2 id="package-options-title">จัดตัวเลือกในแพ็กเกจ</h2><p>ตัวเลือกตามจำนวนที่กำหนด</p></div>
      {packageView.slots.map((slot) => {
        const selected = choices[slot.id] ?? [];
        return <fieldset className="package-slot" key={slot.id}>
          <legend>{slot.name} <span>เลือก {slot.required_count} รายการ</span></legend>
          {!slot.options.length ? <p className="form-help">ขณะนี้ไม่มีบริการที่เปิดใช้งานตรงประเภทนี้</p> : <div className="package-choice-list">
            {slot.options.map((option) => {
              const checked = selected.includes(option.id);
              return <label className="package-choice" key={option.id}>
                <input type="checkbox" checked={checked} disabled={!canSelect || busy || (!checked && selected.length >= slot.required_count)} onChange={(event) => setChoices((current) => ({
                  ...current,
                  [slot.id]: event.target.checked ? [...selected, option.id] : selected.filter((id) => id !== option.id),
                }))} />
                <span>{option.name}</span>
              </label>;
            })}
          </div>}
          <p className="form-help">เลือกแล้ว {selected.length} / {slot.required_count}</p>
        </fieldset>;
      })}
      {savedNeedsReview && <p className="form-help" role="status">ตัวเลือกหรือแพ็กเกจเดิมเปลี่ยนไปแล้ว กรุณาตรวจสอบและบันทึกตัวเลือกปัจจุบันอีกครั้ง</p>}
      {canSelect ? <button className="button button-secondary" type="button" disabled={busy || !complete || packageView.revision < 1} onClick={() => void save()}>{busy ? "กำลังบันทึก…" : savedSelection ? "บันทึกการแก้ไขตัวเลือก" : "บันทึกตัวเลือก"}</button> : <Link className="button button-primary" href="/login">เข้าสู่ระบบเพื่อเลือก</Link>}
      {canSelect && complete && packageView.revision > 0 && <div className="booking-fields">
        <label className="field"><span>วันเริ่มทริป <span className="required-marker" aria-hidden="true">*</span></span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required disabled={busy} min={new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} /></label>
        <label className="field"><span>จำนวนผู้เข้าร่วม <span className="required-marker" aria-hidden="true">*</span></span><input type="number" min="1" max="100" step="1" value={participants} onChange={(event) => setParticipants(Number(event.target.value))} required disabled={busy} /></label>
        <p className="form-help">ระบุ 1–100 คน และเลือกวันที่ในอนาคต</p>
        <div className="action-bar"><button className="button button-primary" type="button" disabled={busy || !startDate || participants < 1 || participants > 100} onClick={() => void createBooking()}>{busy ? "กำลังตรวจสอบราคา…" : "ตรวจราคาและไปหน้าชำระเงิน"}</button></div>
      </div>}
      {message && <p className={message.startsWith("บันทึกตัวเลือกแล้ว") ? "success-message" : "error-message"} role="status">{message}</p>}
    </section>
  );
}
