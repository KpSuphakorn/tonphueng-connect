"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicService, ServiceCategory } from "../../lib/services";
import { Icon } from "../components/icons";

const categories: [ServiceCategory, string][] = [
  ["community_product", "สินค้าชุมชน"], ["accommodation", "ที่พัก"], ["restaurant", "ร้านอาหาร"],
  ["tourism_trail", "ท่องเที่ยว / เส้นทางเดินป่า"], ["other", "อื่น ๆ"],
];

export function ServiceBrowser() {
  const [category, setCategory] = useState<ServiceCategory | "all">("all");
  const [services, setServices] = useState<PublicService[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState("ยังไม่ได้ใช้ตำแหน่งของคุณ");
  const sentinel = useRef<HTMLDivElement>(null);
  const requestGeneration = useRef(0);
  const loadingGeneration = useRef<number | null>(null);

  const load = useCallback(async (reset = false) => {
    if (!reset && (loadingGeneration.current === requestGeneration.current || !hasMore || Boolean(error))) return;
    const generation = reset ? ++requestGeneration.current : requestGeneration.current;
    loadingGeneration.current = generation;
    setBusy(true);
    setError("");
    const start = reset ? 0 : offset;
    const params = new URLSearchParams({ offset: String(start) });
    if (category !== "all") params.set("category", category);
    if (location) {
      params.set("latitude", String(location.latitude));
      params.set("longitude", String(location.longitude));
    }
    try {
      const response = await fetch(`/api/services?${params}`, { cache: "no-store" });
      const result = await response.json() as { services?: PublicService[]; hasMore?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "โหลดบริการไม่สำเร็จ");
      const rows = result.services ?? [];
      if (generation === requestGeneration.current) {
        setServices((current) => reset ? rows : [...current, ...rows]);
        setOffset(start + rows.length);
        setHasMore(Boolean(result.hasMore));
      }
    } catch (cause) {
      if (generation === requestGeneration.current) setError(cause instanceof Error ? cause.message : "โหลดบริการไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      if (generation === requestGeneration.current) { loadingGeneration.current = null; setBusy(false); }
    }
  }, [category, error, hasMore, location, offset]);

  useEffect(() => { void load(true); }, [category, location]);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void load();
    }, { rootMargin: "240px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, load]);

  function requestLocation() {
    if (!navigator.geolocation) { setLocationMessage("อุปกรณ์นี้ใช้ตำแหน่งไม่ได้ บริการยังเลือกดูได้"); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setLocation({ latitude: coords.latitude, longitude: coords.longitude }); setLocationMessage("เรียงตามระยะเส้นตรงจากตำแหน่งที่อนุญาต"); },
      () => { setLocation(null); setLocationMessage("ไม่ได้รับตำแหน่ง บริการยังเลือกดูและกรองได้ตามปกติ"); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  return <section aria-label="รายการบริการ">
    <div className="service-filters">
      <label className="field">ประเภทบริการ<select value={category} onChange={(event) => { setServices([]); setOffset(0); setHasMore(true); setCategory(event.target.value as ServiceCategory | "all"); }}>
        <option value="all">ทุกประเภท</option>
        {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <button className="button button-secondary" type="button" onClick={requestLocation}><Icon name="location" size={20} />เรียงตามระยะใกล้</button>
      <p className="form-help" role="status">{locationMessage} · ระยะเส้นตรงโดยประมาณ ไม่ใช่ระยะเดินทาง</p>
    </div>
    {error && <p className="error-message" role="alert">{error} <button className="text-button" onClick={() => void load(true)}>ลองอีกครั้ง</button></p>}
    {services.length ? <div className="service-grid">{services.map((service) => <Link className="service-card" href={`/services/${service.id}`} key={service.id}>
      {service.photos[0] ? <img src={service.photos[0]} alt={`รูป ${service.name}`} loading="lazy" /> : <div className="service-image-placeholder" aria-hidden="true"><Icon name="leaf" size={36} /></div>}
      <div className="service-card-copy"><span className="chip">{categories.find(([value]) => value === service.category)?.[1]}{service.other_category ? ` · ${service.other_category}` : ""}</span><h2>{service.name}</h2><p>{service.address}</p></div>
    </Link>)}</div> : !busy && !error ? <section className="note-card" aria-live="polite">ยังไม่มีบริการในหมวดนี้</section> : null}
    <div ref={sentinel} aria-hidden="true" />
    {busy && <p className="list-status" role="status">กำลังโหลดบริการ…</p>}
    {!busy && hasMore && services.length > 0 && <button className="button button-secondary button-wide" onClick={() => void load()}>โหลดเพิ่มเติม</button>}
    {!hasMore && services.length > 0 && <p className="list-status" role="status">แสดงบริการครบแล้ว</p>}
  </section>;
}
