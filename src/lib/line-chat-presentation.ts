export type ChatCard = {
  kind: "product" | "package" | "service";
  id: string;
  serviceId?: string;
  name: string;
  description: string;
  priceSatang?: number;
  hasImage?: boolean;
};

type FlexBubble = {
  type: "bubble";
  size: "kilo";
  hero?: { type: "image"; url: string; size: "full"; aspectRatio: "4:3"; aspectMode: "cover"; backgroundColor: "#efe8d9" };
  body: { type: "box"; layout: "vertical"; spacing: "sm"; backgroundColor: "#fffdf8"; contents: Array<Record<string, unknown>> };
  footer: { type: "box"; layout: "vertical"; contents: Array<Record<string, unknown>> };
};

export type LineChatMessage =
  | { type: "text"; text: string; quickReply?: { items: Array<{ type: "action"; action: { type: "message"; label: string; text: string } | { type: "uri"; label: string; uri: string } }> } }
  | { type: "flex"; altText: string; contents: { type: "carousel"; contents: FlexBubble[] } };

export type ChatPresentation = { text: string; messages?: LineChatMessage[] };

function clip(value: string, max: number) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function safeOrigin(value: string) {
  try {
    const url = new URL(value);
    if (!(["https:", "http:"].includes(url.protocol) && !url.username && !url.password && (url.protocol === "https:" || ["localhost", "127.0.0.1"].includes(url.hostname)))) return null;
    return url.origin;
  } catch { return null; }
}

function formatPrice(item: ChatCard) {
  if (!Number.isSafeInteger(item.priceSatang) || (item.priceSatang ?? 0) <= 0) return "";
  const price = (item.priceSatang! / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return item.kind === "package" ? `ราคา ${price} บาท/คน` : `ราคา ${price} บาท`;
}

function detailPath(item: ChatCard) {
  if (item.kind === "product") return item.serviceId ? `/products/${encodeURIComponent(item.serviceId)}` : null;
  return `/${item.kind === "package" ? "packages" : "services"}/${encodeURIComponent(item.id)}`;
}

export function chatCardDetailUrl(item: ChatCard, appOrigin: string) {
  const origin = safeOrigin(appOrigin);
  const path = detailPath(item);
  return origin && path ? `${origin}${path}` : "";
}

function bubble(item: ChatCard, origin: string): FlexBubble | null {
  const path = detailPath(item);
  if (!path) return null;
  const contents: Array<Record<string, unknown>> = [
    { type: "text", text: clip(item.name, 120) || "รายการชุมชน", weight: "bold", size: "md", color: "#1f2b22", wrap: true, maxLines: 3 },
  ];
  const price = formatPrice(item);
  if (price) contents.push({ type: "text", text: price, size: "sm", color: "#264830", wrap: true });
  const description = clip(item.description, 180);
  if (description) contents.push({ type: "text", text: description, size: "sm", color: "#465249", wrap: true, maxLines: 4 });
  const card: FlexBubble = {
    type: "bubble",
    size: "kilo",
    body: { type: "box", layout: "vertical", spacing: "sm", backgroundColor: "#fffdf8", contents },
    footer: { type: "box", layout: "vertical", contents: [{
      type: "button", style: "primary", height: "md", color: "#264830",
      action: { type: "uri", label: "ดูรายละเอียด", uri: chatCardDetailUrl(item, origin) },
    }] },
  };
  if (item.hasImage && (item.kind === "service" || item.kind === "product" || item.kind === "package")) {
    card.hero = {
      type: "image", url: `${origin}/api/line/catalogue-image?kind=${item.kind}&id=${encodeURIComponent(item.id)}`,
      size: "full", aspectRatio: "4:3", aspectMode: "cover", backgroundColor: "#efe8d9",
    };
  }
  return card;
}

function quickReplies(intent?: string) {
  const choices: Record<string, Array<[string, string]>> = {
    budget: [["ไม่เกิน 1,000 บาท", "งบไม่เกิน 1,000 บาท"], ["1,000–3,000 บาท", "งบ 1,000–3,000 บาท"], ["มากกว่า 3,000 บาท", "งบมากกว่า 3,000 บาท"]],
    group: [["1–2 คน", "ไป 1–2 คน"], ["3–5 คน", "ไป 3–5 คน"], ["มากกว่า 5 คน", "ไปมากกว่า 5 คน"]],
    activity: [["สินค้า", "สนใจสินค้า"], ["บริการ", "สนใจบริการ"], ["แพ็กเกจ", "สนใจแพ็กเกจ"]],
  };
  const items = choices[intent ?? ""];
  return items ? { items: items.map(([label, text]) => ({ type: "action" as const, action: { type: "message" as const, label, text } })) } : undefined;
}

const navigationPaths = {
  packages: "/packages",
  products: "/products",
  services: "/services",
  "my-order": "/my-order",
  "my-trip": "/my-trip",
} as const;
export type ChatNavigationPath = keyof typeof navigationPaths;

export function chatNavigationUrl(path: ChatNavigationPath, appOrigin: string) {
  const origin = safeOrigin(appOrigin);
  return origin ? `${origin}${navigationPaths[path]}` : "";
}

function navigationQuickReplies(actions: Array<{ label: string; path: ChatNavigationPath }>, origin: string) {
  const items = actions.slice(0, 3).flatMap(({ label, path }) => {
    const safePath = navigationPaths[path];
    const safeLabel = clip(label, 20);
    return safePath && safeLabel ? [{ type: "action" as const, action: { type: "uri" as const, label: safeLabel, uri: `${origin}${safePath}` } }] : [];
  });
  return items.length ? { items } : undefined;
}

export function buildChatPresentation(input: {
  text: string;
  cards?: ChatCard[];
  intro?: string;
  followUp?: string;
  actions?: Array<{ label: string; path: ChatNavigationPath }>;
  appOrigin: string;
}): ChatPresentation {
  const text = clip(input.text, 1000);
  const origin = safeOrigin(input.appOrigin);
  const cards = (input.cards ?? []).slice(0, 3).filter((item) => item && ["service", "product", "package"].includes(item.kind));
  if (cards.length && origin) {
    const bubbles = cards.map((item) => bubble(item, origin)).filter((item): item is FlexBubble => Boolean(item));
    if (bubbles.length) {
      const summaries = cards.slice(0, bubbles.length).map((item) => {
        const name = clip(item.name, 60);
        const price = formatPrice(item);
        return [name, price].filter(Boolean).join(", ");
      }).filter(Boolean).join(" • ");
      const altText = clip(summaries ? `รายการแนะนำ: ${summaries}` : "รายการแนะนำจากผึ้งพาเดิน", 400);
      const messages: LineChatMessage[] = [];
      const intro = clip(input.intro ?? "", 300);
      if (intro) messages.push({ type: "text", text: intro });
      messages.push({ type: "flex", altText, contents: { type: "carousel", contents: bubbles } });
      return { text, messages };
    }
  }
  const quickReply = origin && input.actions?.length
    ? navigationQuickReplies(input.actions, origin)
    : quickReplies(input.followUp);
  return { text, messages: [{ type: "text", text: text || "ลองบอกความต้องการเพิ่มเติมได้เลย", ...(quickReply ? { quickReply } : {}) }] };
}
