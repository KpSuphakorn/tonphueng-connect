"use client";

import Link from "next/link";
import { useState } from "react";
import type { PublicService } from "../../lib/services";
import { Icon } from "../components/icons";

export function MyTripList({ initialServices }: { initialServices: (PublicService & { saved_at: string })[] }) {
  const [services, setServices] = useState(initialServices);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  async function remove(id: string) {
    setBusyId(id); setMessage("");
    try {
      const response = await fetch("/api/my-trip", { method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ service_id: id }) });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "นำรายการออกไม่สำเร็จ");
      setServices((current) => current.filter((service) => service.id !== id));
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "นำรายการออกไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setBusyId(""); }
  }
  if (!services.length) return <section className="section note-card" aria-live="polite"><strong>สถานที่ที่บันทึกเอง</strong><p>ยังไม่มีสถานที่ที่บันทึกเอง การบันทึกสถานที่ไม่ใช่การจอง</p><Link className="text-link" href="/services">เลือกดูบริการของชุมชน</Link></section>;
  return <section className="section" aria-label="สถานที่ที่บันทึกเอง"><div className="section-heading"><h2>สถานที่ที่บันทึกเอง</h2><p>การบันทึกสถานที่ไม่ใช่การจอง</p></div>{message && <p className="error-message" role="alert">{message}</p>}
    <div className="service-grid">{services.map((service) => <article className="service-card" key={service.id}>
      <Link href={`/services/${service.id}`}>{service.photos[0] ? <img src={service.photos[0]} alt={`รูป ${service.name}`} loading="lazy" /> : <div className="service-image-placeholder" aria-hidden="true"><Icon name="leaf" size={36} /></div>}<div className="service-card-copy"><span className="chip">บันทึกเอง</span><h2>{service.name}</h2><p>{service.address}</p></div></Link>
      <button className="button button-secondary button-wide" type="button" disabled={busyId === service.id} onClick={() => void remove(service.id)}>{busyId === service.id ? "กำลังนำออก…" : "นำออกจาก My Trip"}</button>
    </article>)}</div>
  </section>;
}
