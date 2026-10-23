// Demo business content for `npm run seed-demo` (prototype demo-data policy in the spec).
// Every name, address, phone, price, package and coordinate here is invented demo data, not a
// real offer, agreement, price list or route permission. By owner decision the visible text does
// not say "demo"; seeded records are identified by their demo-…@example.com accounts and fixed ids.
// Photos come from Wikimedia Commons; PHOTO_CREDITS is their single attribution source, shown on /credits.
import type { PackageCategory } from "../../src/lib/packages";

export type DemoServiceCategory = "community_product" | "accommodation" | "restaurant" | "tourism_trail";

export type PhotoCredit = {
  file: string;
  subject: string;
  author: string;
  license: string;
  license_url: string;
  source_page_url: string;
};

export type DemoProduct = {
  /** Fixed id so reruns update the same row. */
  id: string;
  name: string;
  description: string;
  price_satang: number;
  photo: string;
};

export type DemoService = {
  /** Fixed id for new rows; an existing demo row keeps its own id. */
  id: string;
  key: string;
  category: DemoServiceCategory;
  email: string;
  name: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  photos: [string, string];
  products: DemoProduct[];
};

export type DemoSlot = { id: string; name: string; service_category: DemoServiceCategory };
export type DemoSubPackage = {
  id: string;
  title: string;
  description: string;
  price_per_person_satang: number;
  duration_days: number;
  slots: DemoSlot[];
};
export type DemoPackageCategory = { category: PackageCategory; description: string; sub_packages: DemoSubPackage[] };

export const DEMO_EMAIL_DOMAIN = "example.com";
/** Stored in Supabase Auth app_metadata so only users this script created are ever changed or removed. */
export const DEMO_AUTH_MARKER = "tonphueng_demo_seed";
/** Ban Ton Phueng trail v2 start (approximate), used to keep demo places within ~3 km. */
export const VILLAGE_ANCHOR = { latitude: 18.8076, longitude: 99.178 };
export const DEMO_BOUNDS = { minLatitude: 18.79, maxLatitude: 18.83, minLongitude: 99.16, maxLongitude: 99.21 };
export const PRODUCT_PRICE_RANGE_SATANG = { min: 100_00, max: 2_000_00 };
export const PACKAGE_PRICE_RANGE_SATANG = { min: 300_00, max: 10_000_00 };

export const PHOTO_CREDITS: PhotoCredit[] = [
  { file: "accommodation-1-a.jpg", subject: "Wooden village houses and shops, Mae Kampong, Chiang Mai", author: "Zeuzcloud8", license: "CC BY 4.0", license_url: "https://creativecommons.org/licenses/by/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:%E0%B8%AB%E0%B8%A1%E0%B8%B9%E0%B9%88%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99%E0%B9%81%E0%B8%A1%E0%B9%88%E0%B8%81%E0%B8%B3%E0%B8%9B%E0%B8%AD%E0%B8%87_%E0%B9%80%E0%B8%8A%E0%B8%B5%E0%B8%A2%E0%B8%87%E0%B9%83%E0%B8%AB%E0%B8%A1%E0%B9%88.jpg" },
  { file: "accommodation-1-b.jpg", subject: "Traditional teak house in a garden (King Nan's Teak House)", author: "Ellnik", license: "CC BY-SA 3.0", license_url: "http://creativecommons.org/licenses/by-sa/3.0/", source_page_url: "https://commons.wikimedia.org/wiki/File:King_Nan%27s_Teak_House2.jpg" },
  { file: "accommodation-2-a.jpg", subject: "Thatched bamboo hut bungalow", author: "audioselect", license: "CC BY-SA 3.0", license_url: "https://creativecommons.org/licenses/by-sa/3.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Bamboo_Hut_at_Bananas_Bungalows_-_panoramio.jpg" },
  { file: "accommodation-2-b.jpg", subject: "Wooden bungalow among forest trees, Pai", author: "Flora-Victoria", license: "CC0", license_url: "http://creativecommons.org/publicdomain/zero/1.0/deed.en", source_page_url: "https://commons.wikimedia.org/wiki/File:Bungalow_in_Pai,_Thailand.JPG" },
  { file: "accommodation-3-a.jpg", subject: "Camping tents on misty mountain lawn, Doi Ang Khang", author: "Ditsakul", license: "CC BY-SA 3.0", license_url: "https://creativecommons.org/licenses/by-sa/3.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Camping_Tent_at_Doi_Angkhang_Mountain,_Chiangmai,_Thailand.jpg" },
  { file: "accommodation-3-b.jpg", subject: "Tents under pine trees on a misty morning, Doi Ang Khang", author: "Ditsakul", license: "CC BY-SA 3.0", license_url: "https://creativecommons.org/licenses/by-sa/3.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Misty_Morning_at_Doi_Angkhang_Mountain,_Chiangmai,_Thailand.jpg" },
  { file: "community_product-1-a.jpg", subject: "Indigo shibori-dyed cloth hanging in a window with forest view", author: "Katie", license: "CC BY-SA 2.0", license_url: "https://creativecommons.org/licenses/by-sa/2.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Sunlight_filters_through_tied-and-indigo-dyed_(shibori)_fabric.jpg" },
  { file: "community_product-1-b.jpg", subject: "Naturally dyed silk scarves with plant dye materials", author: "SEN Heritage Looms - Sophia Tsourinaki", license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:NATURAL_DYES.jpg" },
  { file: "community_product-2-a.jpg", subject: "Craftsmen weaving bamboo baskets in a wooden heritage house (Luang Prabang, Laos)", author: "Basile Morin", license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Craftmen_at_work,_bamboo_basket_weaving_and_textile_mobile_sculptures,_in_Heuan_Chan_heritage_house,_Luang_Prabang,_Laos.jpg" },
  { file: "community_product-2-b.jpg", subject: "Woven bamboo sticky-rice baskets (kratip khao), Thailand", author: "User:Mattes", license: "Public domain (PD-self, released by author)", license_url: "https://commons.wikimedia.org/wiki/Template:PD-self", source_page_url: "https://commons.wikimedia.org/wiki/File:Different_Kratip_Khao.jpg" },
  { file: "community_product-3-a.jpg", subject: "Ripe coffee cherries, Mae Chan Tai, Chiang Rai", author: "Takeaway", license: "CC BY-SA 3.0", license_url: "https://creativecommons.org/licenses/by-sa/3.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Maejantai_Chiang_Rai_province_05.JPG" },
  { file: "community_product-3-b.jpg", subject: "Coffee beans sun-drying at Doi Chang, Chiang Rai", author: "LannaPhoto", license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:DoiChang2.jpg" },
  { file: "restaurant-1-a.jpg", subject: "Khao soi northern Thai curry noodles with pickles and shallots", author: "Chainwit.", license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Khao_Soi_Northern_Thai_food_%E0%B8%82%E0%B9%89%E0%B8%B2%E0%B8%A7%E0%B8%8B%E0%B8%AD%E0%B8%A2_%E0%B8%9C%E0%B8%B1%E0%B8%81%E0%B8%94%E0%B8%AD%E0%B8%87.jpg" },
  { file: "restaurant-1-b.jpg", subject: "Nam prik ong northern Thai pork-tomato chili dip", author: "cyclonebill from Copenhagen, Denmark", license: "CC BY-SA 2.0", license_url: "https://creativecommons.org/licenses/by-sa/2.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Nam_prik_ong_(8386821497).jpg" },
  { file: "restaurant-2-a.jpg", subject: "Kafae boran (traditional Thai coffee) set, Chiang Mai", author: "Takeaway", license: "CC BY-SA 3.0", license_url: "https://creativecommons.org/licenses/by-sa/3.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Kafae_boran_Chiang_Mai.jpg" },
  { file: "restaurant-2-b.jpg", subject: "Manual pour-over drip coffee being brewed", author: "Kim Sanso", license: "CC0", license_url: "http://creativecommons.org/publicdomain/zero/1.0/deed.en", source_page_url: "https://commons.wikimedia.org/wiki/File:Manual_drip_(pour-over)_coffee.jpg" },
  { file: "restaurant-3-a.jpg", subject: "Street food stall with grilled sausages, Chiang Mai", author: "David McKelvey from Brisbane, Australia", license: "CC BY 2.0", license_url: "https://creativecommons.org/licenses/by/2.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Street_Food_Stall,_Chiang_Mai,_Thailand_(7113967189).jpg" },
  { file: "restaurant-3-b.jpg", subject: "Coiled northern Thai sausages (sai ua) at Thanin market, Chiang Mai", author: "Takeaway", license: "CC BY-SA 3.0", license_url: "https://creativecommons.org/licenses/by-sa/3.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Thanin_market_chiang_mai_sausage.jpg" },
  { file: "tourism_trail-1-a.jpg", subject: "Wooden-step walkway through damp forest, Doi Inthanon", author: "Witthawat Yutthagosa", license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Damp,_raw-feeling_walkway.jpg" },
  { file: "tourism_trail-1-b.jpg", subject: "Moist evergreen forest, Ang Ka Nature Trail, Doi Inthanon", author: "Ktatpong", license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Moist_evergreen_forest,_Ang_Ka_Nature_Trail.JPG" },
  { file: "tourism_trail-2-a.jpg", subject: "Sunrise over a sea of mist, Doi Kio Lom, Huai Nam Dang", author: "Thaveesc", license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Sea_of_Mist_at_Doi_Kio_Lom_-_Huai_Nam_Dang_National_Park,_Thailand_-_Thaveesak_Jaikamsueb.jpg" },
  { file: "tourism_trail-2-b.jpg", subject: "Sunset over Doi Luang Chiang Dao mountain ridges", author: "Prawit thawonsak", license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Doi_Luang_Chiang_Dao_Sunset_time.jpg" },
  { file: "tourism_trail-3-a.jpg", subject: "Monthathan waterfall in forest, Doi Suthep-Pui", author: "Thaveesc", license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Monthathan_Waterfall_and_Bracket_Fungi_-_Doi_Suthep-Pui_National_Park,_Thailand_-_Thaveesak_Jaikamsueb.jpg" },
  { file: "tourism_trail-3-b.jpg", subject: "Forest waterfall on Kew Mae Pan Nature Trail, Doi Inthanon", author: "Douglas Perkins", license: "CC BY 4.0", license_url: "https://creativecommons.org/licenses/by/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Kew_Mae_Pan_Nature_Trail_Waterfall.jpg" },
  { file: "product-community_product-1-1.jpg", subject: "Eco-print (leaf-printed) fabrics / scarves", author: "Aisanctum", license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Kain_Ecoprint.jpg" },
  { file: "product-community_product-1-2.jpg", subject: "Indigo shibori tie-dyed cotton cloth", author: "Alejandra Pedernera (User:AlejandraPeder) y Luisina Gutiérrez (User:Louisine23)", license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Shibori-azul-algodon-argentina-01.jpg" },
  { file: "product-community_product-1-3.jpg", subject: "Indigo-dyed cotton fabric lengths drying after the dye vat", author: "Markmcnbowe97", license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Indigo_dyed_fabric_is_raised_from_the_dye_vat.jpg" },
  { file: "product-community_product-2-1.jpg", subject: "Thai bamboo sticky-rice containers with lid", author: "Susan Slater", license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Thai_bamboo_container_with_lid_(for_serving_sticky_rice).jpg" },
  { file: "product-community_product-2-2.jpg", subject: "Woven bamboo tray with diamond pattern", author: "Zahirulnukman", license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Anyaman_buluh_sebagai_cenderahati_di_Kampung_Kuala_Lah_1.jpg" },
  { file: "product-community_product-2-3.jpg", subject: "Hand-woven rattan bowl basket", author: "ROCKY", license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Rattan_baskets_-_%E0%A6%AC%E0%A7%87%E0%A6%A4%E0%A7%87%E0%A6%B0_%E0%A6%9D%E0%A7%81%E0%A6%A1%E0%A6%BC%E0%A6%BF_-_DSC00588.jpg" },
  { file: "product-community_product-3-1.jpg", subject: "Roasted coffee beans in burlap sack with paper coffee bags", author: "Jamain", license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0", source_page_url: "https://commons.wikimedia.org/wiki/File:A_bag_of_coffee_J1.jpg" },
  { file: "product-community_product-3-2.jpg", subject: "Bottle of honey (unlabeled)", author: "JJ Harrison (https://www.jjharrison.com.au/)", license: "CC BY-SA 3.0", license_url: "https://creativecommons.org/licenses/by-sa/3.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Honey_Bottle.jpg" },
  { file: "product-community_product-3-3.jpg", subject: "Dried green tea leaves", author: "Romain Guy from Lyon, France", license: "CC BY-SA 2.0", license_url: "https://creativecommons.org/licenses/by-sa/2.0", source_page_url: "https://commons.wikimedia.org/wiki/File:Dried_tea_leaves,_Longjin.jpg" },
];

// Fixed UUIDs (version 4 / variant 8 layout, accepted by the app validators).
const id = (group: string, n: number) => `d3e0c0de-5eed-4000-8000-${group}${String(n).padStart(4, "0")}`;
const serviceId = (n: number) => id("00000001", n);
const productId = (n: number) => id("00000002", n);
const subPackageId = (n: number) => id("00000003", n);
const slotId = (n: number) => id("00000004", n);

type ServiceInput = Omit<DemoService, "key" | "email" | "photos" | "description" | "products" | "address"> & {
  n: 1 | 2 | 3;
  description: string;
  address: string;
  products?: Array<Omit<DemoProduct, "photo" | "description"> & { description: string }>;
};

function service(input: ServiceInput): DemoService {
  const key = `${input.category}-${input.n}`;
  const photos: [string, string] = [`${key}-a.jpg`, `${key}-b.jpg`];
  return {
    id: input.id,
    key,
    category: input.category,
    email: `demo-${input.category}-${input.n}@${DEMO_EMAIL_DOMAIN}`,
    name: input.name,
    description: input.description,
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    phone: input.phone,
    photos,
    products: (input.products ?? []).map((product, index) => {
      const photo = `product-${key}-${index + 1}.jpg`;
      return { ...product, photo };
    }),
  };
}

export const DEMO_SERVICES: DemoService[] = [
  service({
    id: serviceId(1), n: 1, category: "community_product",
    name: "บ้านผ้าครามต้นผึ้ง",
    description: "บ้านผ้าเล็ก ๆ ที่ย้อมผ้าฝ้ายด้วยครามและพิมพ์ลายใบไม้แบบอีโคพรินต์จากต้นไม้รอบหมู่บ้าน แต่ละผืนมีเฉดสีและลายที่ไม่ซ้ำกัน ผู้มาเยือนแวะชมขั้นตอนการย้อมและเลือกผ้าที่ชอบกลับบ้านได้",
    address: "ซอยทางขึ้นดอย บ้านต้นผึ้ง จ.เชียงใหม่",
    latitude: 18.8091, longitude: 99.1802, phone: "000-000-0101",
    products: [
      { id: productId(1), name: "ผ้าพันคออีโคพรินต์ลายใบไม้", price_satang: 450_00, description: "ผ้าพันคอผ้าฝ้ายเนื้อนุ่ม พิมพ์ลายจากใบไม้จริงด้วยการนึ่งแบบอีโคพรินต์ ลายและสีของแต่ละผืนจึงไม่เหมือนกัน เหมาะเป็นของฝากที่มีเรื่องเล่า" },
      { id: productId(2), name: "ผ้ามัดย้อมครามลายชิโบริ", price_satang: 390_00, description: "ผ้าฝ้ายมัดย้อมครามลายเรขาคณิต ใช้เป็นผ้าคลุมโต๊ะ ผ้าพันคอ หรือของตกแต่งบ้านได้ สีครามจะนุ่มตาขึ้นตามการใช้งาน" },
      { id: productId(3), name: "ผ้าครามผืนยาว 2 เมตร", price_satang: 890_00, description: "ผ้าฝ้ายย้อมครามผืนยาวสำหรับนำไปตัดเสื้อหรือทำผ้าคลุม ย้อมซ้ำหลายรอบจนได้สีน้ำเงินเข้ม แนะนำให้ซักมือแยกในครั้งแรก" },
    ],
  }),
  service({
    id: serviceId(2), n: 2, category: "community_product",
    name: "กลุ่มจักสานไม้ไผ่ต้นผึ้ง",
    description: "กลุ่มผู้สูงวัยในหมู่บ้านที่ยังสานกระติบข้าว ถาด และภาชนะจากไม้ไผ่และหวายด้วยมือ งานแต่ละชิ้นใช้เวลาหลายวันและผ่านการรมควันให้ทนทาน ลูกค้าสั่งซื้อหรือนัดดูการสานที่ลานบ้านได้",
    address: "ลานบ้านริมทางเข้าหมู่บ้าน บ้านต้นผึ้ง จ.เชียงใหม่",
    latitude: 18.8063, longitude: 99.1757, phone: "000-000-0102",
    products: [
      { id: productId(4), name: "กระติบข้าวเหนียวไม้ไผ่", price_satang: 180_00, description: "กระติบข้าวเหนียวสานไม้ไผ่พร้อมฝาปิด เก็บความอุ่นและความชื้นของข้าวได้ดี ใช้ได้ทุกวันหรือเป็นของฝากจากบ้านต้นผึ้ง" },
      { id: productId(5), name: "ถาดสานไม้ไผ่ลายข้าวหลามตัด", price_satang: 250_00, description: "ถาดทรงกลมสานลายข้าวหลามตัด ใช้วางผลไม้ ขนม หรือเป็นของตกแต่งผนัง น้ำหนักเบาและแข็งแรง" },
      { id: productId(6), name: "ชามหวายสานมือ", price_satang: 320_00, description: "ชามหวายสานแน่นทรงลึก ใช้ใส่ของจุกจิกหรือผลไม้แห้ง ผิวหวายจะเป็นเงาสวยขึ้นเมื่อใช้งานไปนาน ๆ" },
    ],
  }),
  service({
    id: serviceId(3), n: 3, category: "community_product",
    name: "ของดีดอยต้นผึ้ง กาแฟ น้ำผึ้ง และชา",
    description: "ร้านรวมผลผลิตจากสวนบนดอย ทั้งกาแฟที่เก็บผลสุกมาตากและคั่วเอง น้ำผึ้งจากป่ารอบหมู่บ้าน และชาเขียวใบเล็กที่เก็บช่วงเช้า สามารถชิมก่อนซื้อและฟังเรื่องราวการปลูกจากเจ้าของสวนได้",
    address: "ทางไปสวนกาแฟ บ้านต้นผึ้ง จ.เชียงใหม่",
    latitude: 18.8118, longitude: 99.1849, phone: "000-000-0103",
    products: [
      { id: productId(7), name: "กาแฟคั่วกลางจากดอย 250 กรัม", price_satang: 220_00, description: "เมล็ดกาแฟอาราบิกาคั่วระดับกลาง กลิ่นหอมถั่วและคาราเมล รสชาติกลมกล่อม บรรจุถุงพร้อมวาล์วรักษากลิ่น" },
      { id: productId(8), name: "น้ำผึ้งป่า 500 มล.", price_satang: 350_00, description: "น้ำผึ้งจากรังผึ้งในป่ารอบหมู่บ้าน สีอำพันเข้ม รสหวานหอมดอกไม้ป่า ตกผลึกได้ตามธรรมชาติเมื่ออากาศเย็น" },
      { id: productId(9), name: "ชาเขียวดอย 100 กรัม", price_satang: 150_00, description: "ใบชาเขียวคั่วมือ ชงได้หลายน้ำ กลิ่นหอมสดชื่นและฝาดน้อย เหมาะดื่มคู่ขนมพื้นเมืองยามบ่าย" },
    ],
  }),
  service({
    id: serviceId(4), n: 1, category: "accommodation",
    name: "โฮมสเตย์บ้านไม้ต้นผึ้ง",
    description: "บ้านไม้สองชั้นของครอบครัวในหมู่บ้าน เปิดห้องพักให้ผู้มาเยือนได้ใช้ชีวิตแบบคนต้นผึ้ง ตื่นเช้ามาจิบกาแฟที่ชานบ้าน และร่วมทำอาหารเหนือกับเจ้าของบ้านในตอนเย็น",
    address: "ใกล้ลานกลางหมู่บ้าน บ้านต้นผึ้ง จ.เชียงใหม่",
    latitude: 18.8049, longitude: 99.1813, phone: "000-000-0201",
  }),
  service({
    id: serviceId(5), n: 2, category: "accommodation",
    name: "กระท่อมไม้ไผ่สวนป่าต้นผึ้ง",
    description: "กระท่อมไม้ไผ่หลังคามุงหญ้าตั้งอยู่กลางสวนผลไม้และร่มไม้ใหญ่ เงียบสงบ เหมาะกับผู้ที่อยากพักผ่อนฟังเสียงนกและลำธาร มีมุมนั่งเล่นและห้องน้ำรวมสะอาดใกล้ที่พัก",
    address: "สวนท้ายหมู่บ้าน บ้านต้นผึ้ง จ.เชียงใหม่",
    latitude: 18.8137, longitude: 99.1726, phone: "000-000-0202",
  }),
  service({
    id: serviceId(6), n: 3, category: "accommodation",
    name: "ลานกางเต็นท์ชมหมอกต้นผึ้ง",
    description: "ลานหญ้าบนเนินที่มองเห็นทะเลหมอกในเช้าวันอากาศดี มีเต็นท์และเครื่องนอนให้เช่า หรือนำเต็นท์มาเองก็ได้ ตอนค่ำนั่งล้อมวงรอบกองไฟพร้อมเครื่องดื่มอุ่น ๆ",
    address: "เนินด้านเหนือของหมู่บ้าน บ้านต้นผึ้ง จ.เชียงใหม่",
    latitude: 18.8212, longitude: 99.1928, phone: "000-000-0203",
  }),
  service({
    id: serviceId(7), n: 1, category: "restaurant",
    name: "ครัวข้าวซอยบ้านต้นผึ้ง",
    description: "ร้านอาหารเหนือบรรยากาศบ้าน ๆ เสิร์ฟข้าวซอยน้ำแกงเข้มข้น น้ำพริกอ่องกับผักสด และแกงพื้นเมืองตามฤดูกาล วัตถุดิบส่วนใหญ่มาจากสวนของคนในหมู่บ้าน",
    address: "ถนนกลางหมู่บ้าน บ้านต้นผึ้ง จ.เชียงใหม่",
    latitude: 18.8082, longitude: 99.1771, phone: "000-000-0301",
  }),
  service({
    id: serviceId(8), n: 2, category: "restaurant",
    name: "กาแฟโบราณริมทางต้นผึ้ง",
    description: "ร้านกาแฟเล็ก ๆ ริมทางเข้าหมู่บ้าน ชงกาแฟโบราณด้วยถุงผ้าแบบดั้งเดิม และมีกาแฟดริปจากเมล็ดบนดอยให้เลือก เป็นจุดแวะพักยอดนิยมก่อนและหลังเดินป่า",
    address: "ปากทางเข้าหมู่บ้าน บ้านต้นผึ้ง จ.เชียงใหม่",
    latitude: 18.807, longitude: 99.1795, phone: "000-000-0302",
  }),
  service({
    id: serviceId(9), n: 3, category: "restaurant",
    name: "กาดแลงต้นผึ้ง ตลาดอาหารพื้นเมือง",
    description: "ตลาดอาหารพื้นเมืองยามเย็นที่ชาวบ้านนำอาหารฝีมือตัวเองมาขาย ทั้งไส้อั่วย่างเตาถ่าน แคบหมู ขนมพื้นบ้าน และผักจากสวน เดินชิมไปพร้อมฟังดนตรีพื้นเมืองได้",
    address: "ลานกลางหมู่บ้าน บ้านต้นผึ้ง จ.เชียงใหม่",
    latitude: 18.8028, longitude: 99.1744, phone: "000-000-0303",
  }),
  service({
    id: serviceId(10), n: 1, category: "tourism_trail",
    name: "เส้นทางเดินป่าต้นผึ้ง",
    description: "เส้นทางเดินศึกษาธรรมชาติที่เริ่มจากหมู่บ้านลัดเลาะผ่านป่าดิบเขาและสวนของชุมชน ระหว่างทางมีจุดพักให้ฟังเรื่องพืชสมุนไพรและการดูแลป่าจากคนในหมู่บ้าน กรุณาสอบถามระยะทาง เวลาเดิน และเงื่อนไขการเข้าพื้นที่กับชุมชนก่อนเดินทาง",
    address: "จุดเริ่มเส้นทางกลางหมู่บ้าน บ้านต้นผึ้ง จ.เชียงใหม่",
    latitude: 18.8076, longitude: 99.178, phone: "000-000-0401",
  }),
  service({
    id: serviceId(11), n: 2, category: "tourism_trail",
    name: "จุดชมทะเลหมอกและพระอาทิตย์ขึ้น",
    description: "จุดชมวิวบนสันเขาที่เห็นทะเลหมอกปกคลุมหุบเขาในเช้าฤดูหนาว และแสงพระอาทิตย์ขึ้นเหนือแนวดอย ควรออกเดินจากหมู่บ้านก่อนรุ่งสางพร้อมไฟฉายและเสื้อกันหนาว กรุณาสอบถามเงื่อนไขการเข้าพื้นที่กับชุมชนก่อนเดินทาง",
    address: "สันเขาด้านตะวันออกของหมู่บ้าน บ้านต้นผึ้ง จ.เชียงใหม่",
    latitude: 18.8241, longitude: 99.1987, phone: "000-000-0402",
  }),
  service({
    id: serviceId(12), n: 3, category: "tourism_trail",
    name: "เส้นทางน้ำตกในป่าต้นผึ้ง",
    description: "เส้นทางเดินเลียบลำห้วยใต้ร่มไม้ใหญ่ไปยังน้ำตกเล็ก ๆ กลางป่า อากาศเย็นตลอดปีและมีน้ำมากในฤดูฝน ควรสวมรองเท้าที่ยึดเกาะดีเพราะทางบางช่วงลื่น และเดินพร้อมผู้นำทางจากชุมชน",
    address: "ป่าด้านตะวันตกของหมู่บ้าน บ้านต้นผึ้ง จ.เชียงใหม่",
    latitude: 18.7962, longitude: 99.1678, phone: "000-000-0403",
  }),
];

export const DEMO_PACKAGES: DemoPackageCategory[] = [
  {
    category: "trail_running",
    description: `เดินและวิ่งเทรลบนเส้นทางป่ารอบบ้านต้นผึ้ง พร้อมอาหารเหนือและที่พักของชุมชน`,
    sub_packages: [
      {
        id: subPackageId(1), title: "เทรลเช้าชมหมอกบ้านต้นผึ้ง", price_per_person_satang: 890_00, duration_days: 1,
        description: `ออกเดินหรือวิ่งเบา ๆ ในเส้นทางป่าช่วงเช้า แล้วกลับมาพักกินอาหารเหนือในหมู่บ้าน`,
        slots: [
          { id: slotId(1), name: "เส้นทาง", service_category: "tourism_trail" },
          { id: slotId(2), name: "มื้ออาหาร", service_category: "restaurant" },
        ],
      },
      {
        id: subPackageId(2), title: "เทรลสองวันพักค้างในหมู่บ้าน", price_per_person_satang: 2_490_00, duration_days: 2,
        description: `สองวันหนึ่งคืน เลือกเส้นทาง ที่พัก และร้านอาหารของชุมชนเอง เหมาะกับกลุ่มเพื่อนที่อยากเก็บระยะแบบสบาย ๆ`,
        slots: [
          { id: slotId(3), name: "เส้นทาง", service_category: "tourism_trail" },
          { id: slotId(4), name: "ที่พัก", service_category: "accommodation" },
          { id: slotId(5), name: "มื้ออาหาร", service_category: "restaurant" },
        ],
      },
    ],
  },
  {
    category: "wildfire_study",
    description: `เรียนรู้เรื่องไฟป่า หมอกควัน และการดูแลป่าจากประสบการณ์ของคนในชุมชน`,
    sub_packages: [
      {
        id: subPackageId(3), title: "เรียนรู้การดูแลป่าชุมชนหนึ่งวัน", price_per_person_satang: 650_00, duration_days: 1,
        description: `เดินในเส้นทางป่ากับคนในชุมชน ฟังเรื่องการเฝ้าระวังไฟป่าและการฟื้นป่า แล้วสรุปบทเรียนร่วมกันระหว่างมื้ออาหาร`,
        slots: [
          { id: slotId(6), name: "เส้นทางศึกษาป่า", service_category: "tourism_trail" },
          { id: slotId(7), name: "มื้ออาหาร", service_category: "restaurant" },
        ],
      },
      {
        id: subPackageId(4), title: "ค่ายศึกษาไฟป่าสองวันหนึ่งคืน", price_per_person_satang: 1_890_00, duration_days: 2,
        description: `สำหรับกลุ่มนักเรียนหรือผู้สนใจ เรียนรู้ภาคสนามสองวันพร้อมพักค้างในหมู่บ้าน กำหนดการวางแผนร่วมกับชุมชนตามขนาดกลุ่ม`,
        slots: [
          { id: slotId(8), name: "เส้นทางศึกษาป่า", service_category: "tourism_trail" },
          { id: slotId(9), name: "ที่พัก", service_category: "accommodation" },
          { id: slotId(10), name: "มื้ออาหาร", service_category: "restaurant" },
        ],
      },
    ],
  },
  {
    category: "cultural_study_trip",
    description: `ทำความรู้จักงานคราฟต์ อาหาร และวิถีชีวิตของบ้านต้นผึ้งผ่านการลงมือทำกับเจ้าของงาน`,
    sub_packages: [
      {
        id: subPackageId(5), title: "หนึ่งวันกับงานคราฟต์และกาแฟชุมชน", price_per_person_satang: 790_00, duration_days: 1,
        description: `เลือกแวะร้านสินค้าชุมชนเพื่อดูการทำงานจริง แล้วพักกินอาหารหรือดื่มกาแฟในหมู่บ้าน`,
        slots: [
          { id: slotId(11), name: "ร้านสินค้าชุมชน", service_category: "community_product" },
          { id: slotId(12), name: "มื้ออาหาร", service_category: "restaurant" },
        ],
      },
      {
        id: subPackageId(6), title: "ทริปวัฒนธรรมสองวันหนึ่งคืน", price_per_person_satang: 2_190_00, duration_days: 2,
        description: `สองวันหนึ่งคืนกับงานคราฟต์ อาหารเหนือ และที่พักของชุมชน เหมาะกับครอบครัวหรือกลุ่มศึกษาดูงานขนาดเล็ก`,
        slots: [
          { id: slotId(13), name: "ร้านสินค้าชุมชน", service_category: "community_product" },
          { id: slotId(14), name: "ที่พัก", service_category: "accommodation" },
          { id: slotId(15), name: "มื้ออาหาร", service_category: "restaurant" },
        ],
      },
    ],
  },
];

// ---------- Activity data: Customers, Bookings, Orders and pending Staff applicants ----------

export type DemoApplicant = {
  id: string;
  key: string;
  email: string;
  name: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  category: DemoServiceCategory | "other";
  other_category: string | null;
  photos: [string, string];
};

/** Customer accounts are LINE-only in the schema (no name column); they cannot sign in. */
export type DemoCustomer = { key: string; line_subject: string };

export type DemoBooking = {
  request_id: string;
  customer: string;
  sub_package_id: string;
  /** Start date = today in Asia/Bangkok + this many days, computed at run time. */
  start_in_days: number;
  participants: number;
  /** Service keys (e.g. "tourism_trail-1"), one per slot in slot order. */
  choices: string[];
  paid: boolean;
};

export type DemoOrderStatus = "pending_payment" | "paid" | "preparing" | "shipping" | "delivered";
export type DemoOrder = {
  request_id: string;
  customer: string;
  /** Community-product service key, e.g. "community_product-1". */
  store: string;
  items: Array<{ product_id: string; quantity: number }>;
  fulfillment: "pickup" | "delivery";
  address: string;
  status: DemoOrderStatus;
  tracking_number?: string;
};

const bookingRequestId = (n: number) => id("00000005", n);
const orderRequestId = (n: number) => id("00000006", n);

/** Real LINE user ids are "U" + 32 hex characters, so this prefix can never collide with one. */
export const DEMO_CUSTOMER_SUBJECT_PREFIX = "demo-customer-";
export const DEMO_CUSTOMERS: DemoCustomer[] = [1, 2, 3].map((n) => ({ key: `customer-${n}`, line_subject: `${DEMO_CUSTOMER_SUBJECT_PREFIX}${n}` }));

export const DEMO_APPLICANTS: DemoApplicant[] = [
  {
    id: serviceId(21), key: "pending-1", email: `demo-pending-1@${DEMO_EMAIL_DOMAIN}`, category: "accommodation", other_category: null,
    name: "บ้านพักริมลำห้วยต้นผึ้ง",
    description: "บ้านพักไม้หลังเล็กริมลำห้วย รับแขกได้ครั้งละหนึ่งครอบครัว มีระเบียงนั่งฟังเสียงน้ำและครัวเล็ก ๆ ให้ทำอาหารเอง เจ้าของบ้านพร้อมพาเดินชมสวนในตอนเช้า",
    address: "ริมลำห้วยด้านใต้ บ้านต้นผึ้ง จ.เชียงใหม่", latitude: 18.8011, longitude: 99.1769, phone: "000-000-0501",
    photos: ["accommodation-2-b.jpg", "accommodation-1-a.jpg"],
  },
  {
    id: serviceId(22), key: "pending-2", email: `demo-pending-2@${DEMO_EMAIL_DOMAIN}`, category: "restaurant", other_category: null,
    name: "ร้านขนมจีนน้ำเงี้ยวต้นผึ้ง",
    description: "ร้านอาหารเช้าเล็ก ๆ ขายขนมจีนน้ำเงี้ยว น้ำพริกอ่อง และไส้อั่วทำเอง เปิดตั้งแต่เช้าตรู่สำหรับคนที่จะออกเดินป่าหรือขึ้นไปชมหมอก",
    address: "ข้างลานกลางหมู่บ้าน บ้านต้นผึ้ง จ.เชียงใหม่", latitude: 18.8057, longitude: 99.1786, phone: "000-000-0502",
    photos: ["restaurant-3-a.jpg", "restaurant-1-b.jpg"],
  },
  {
    id: serviceId(23), key: "pending-3", email: `demo-pending-3@${DEMO_EMAIL_DOMAIN}`, category: "other", other_category: "ช่างภาพนำเที่ยวธรรมชาติ",
    name: "ถ่ายภาพธรรมชาติกับคนต้นผึ้ง",
    description: "พาเดินถ่ายภาพหมอก ป่า และวิถีชาวบ้านในมุมที่คนในหมู่บ้านรู้จักดี เหมาะกับคนที่อยากได้ภาพสวยและเรื่องเล่าระหว่างทาง ปรับเส้นทางตามช่วงเวลาและสภาพอากาศ",
    address: "จุดนัดพบหน้าศาลากลางหมู่บ้าน บ้านต้นผึ้ง จ.เชียงใหม่", latitude: 18.8095, longitude: 99.1763, phone: "000-000-0503",
    photos: ["tourism_trail-2-b.jpg", "tourism_trail-1-a.jpg"],
  },
];

export const DEMO_BOOKINGS: DemoBooking[] = [
  { request_id: bookingRequestId(1), customer: "customer-1", sub_package_id: subPackageId(1), start_in_days: 10, participants: 2, choices: ["tourism_trail-1", "restaurant-1"], paid: true },
  { request_id: bookingRequestId(2), customer: "customer-2", sub_package_id: subPackageId(2), start_in_days: 24, participants: 4, choices: ["tourism_trail-2", "accommodation-3", "restaurant-2"], paid: true },
  { request_id: bookingRequestId(3), customer: "customer-3", sub_package_id: subPackageId(3), start_in_days: 17, participants: 6, choices: ["tourism_trail-1", "restaurant-3"], paid: false },
  { request_id: bookingRequestId(4), customer: "customer-1", sub_package_id: subPackageId(6), start_in_days: 31, participants: 3, choices: ["community_product-2", "accommodation-1", "restaurant-1"], paid: true },
  { request_id: bookingRequestId(5), customer: "customer-2", sub_package_id: subPackageId(5), start_in_days: 8, participants: 1, choices: ["community_product-1", "restaurant-2"], paid: false },
];

export const DEMO_ORDERS: DemoOrder[] = [
  { request_id: orderRequestId(1), customer: "customer-1", store: "community_product-1", fulfillment: "delivery", status: "paid",
    address: "99/9 หมู่ 4 ต.ช้างเผือก อ.เมืองเชียงใหม่ จ.เชียงใหม่ 50300", items: [{ product_id: productId(1), quantity: 1 }, { product_id: productId(2), quantity: 2 }] },
  { request_id: orderRequestId(2), customer: "customer-2", store: "community_product-2", fulfillment: "pickup", status: "preparing",
    address: "", items: [{ product_id: productId(4), quantity: 2 }, { product_id: productId(6), quantity: 1 }] },
  { request_id: orderRequestId(3), customer: "customer-3", store: "community_product-3", fulfillment: "delivery", status: "shipping", tracking_number: "EF582630417TH",
    address: "12/3 ซอยสุขุมวิท 50 แขวงพระโขนง เขตคลองเตย กรุงเทพฯ 10110", items: [{ product_id: productId(7), quantity: 2 }, { product_id: productId(8), quantity: 1 }] },
  { request_id: orderRequestId(4), customer: "customer-2", store: "community_product-1", fulfillment: "pickup", status: "delivered",
    address: "", items: [{ product_id: productId(3), quantity: 1 }] },
  { request_id: orderRequestId(5), customer: "customer-3", store: "community_product-2", fulfillment: "delivery", status: "pending_payment",
    address: "45 ถ.ห้วยแก้ว ต.สุเทพ อ.เมืองเชียงใหม่ จ.เชียงใหม่ 50200", items: [{ product_id: productId(5), quantity: 1 }, { product_id: productId(4), quantity: 3 }] },
];
