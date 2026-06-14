// 币种规范化与换算。
//
// NodeGet 后端为每个节点存了一个自由格式的 `metadata_price_unit`(例如 "$"、"¥"、
// "CNY"、"元"、"€"、"EUR"),不同节点可能用不同币种。费用统计页绝不能假设所有价格
// 都是 USD —— 必须先按每个节点自己的单位归一化、换算到 USD 基准,再统一渲染成用户
// 选定的展示币种。
//
// 歧义按典型 NodeGet(中文)用户习惯解决:
//   "¥"/"￥" -> CNY(而非 JPY),"$" -> USD(而非 HKD/AUD/...)。

export interface Currency {
  /** 规范化的 ISO-ish 代码,作为内部唯一键 */
  code: string
  /** 中文名 */
  name: string
  /** 展示符号 */
  symbol: string
  /** 每 1 USD 等于多少该币种(USD 自身为 1)。静态估算,2026 年量级 */
  rate: number
}

// 以 USD 为基准的静态汇率(每 1 USD 兑换的目标币种数量)。
export const CURRENCIES: Currency[] = [
  { code: 'USD', name: '美元', symbol: '$', rate: 1 },
  { code: 'CNY', name: '人民币', symbol: '¥', rate: 7.25 },
  { code: 'EUR', name: '欧元', symbol: '€', rate: 0.92 },
  { code: 'GBP', name: '英镑', symbol: '£', rate: 0.79 },
  { code: 'JPY', name: '日元', symbol: '¥', rate: 155 },
  { code: 'HKD', name: '港币', symbol: 'HK$', rate: 7.8 },
  { code: 'TWD', name: '新台币', symbol: 'NT$', rate: 32 },
  { code: 'KRW', name: '韩元', symbol: '₩', rate: 1350 },
  { code: 'SGD', name: '新加坡元', symbol: 'S$', rate: 1.34 },
  { code: 'CAD', name: '加元', symbol: 'C$', rate: 1.36 },
  { code: 'AUD', name: '澳元', symbol: 'A$', rate: 1.52 },
  { code: 'RUB', name: '卢布', symbol: '₽', rate: 90 },
  { code: 'INR', name: '卢比', symbol: '₹', rate: 83 },
  { code: 'BRL', name: '雷亚尔', symbol: 'R$', rate: 5.0 },
]

const BY_CODE = new Map(CURRENCIES.map(c => [c.code, c]))

// 自由格式单位 -> 规范化代码 的别名表。键全部小写比较。
const ALIASES: Record<string, string> = {
  // USD
  $: 'USD', us$: 'USD', usd: 'USD', dollar: 'USD', '美元': 'USD', '刀': 'USD', '美刀': 'USD',
  // CNY(¥ 默认归 CNY)
  '¥': 'CNY', '￥': 'CNY', cny: 'CNY', rmb: 'CNY', '人民币': 'CNY', '元': 'CNY', '块': 'CNY', '块钱': 'CNY',
  // JPY(需显式写 JPY/日元/円 才归日元)
  jpy: 'JPY', '日元': 'JPY', '円': 'JPY', yen: 'JPY', '日圆': 'JPY',
  // EUR
  '€': 'EUR', eur: 'EUR', '欧元': 'EUR', euro: 'EUR', '欧': 'EUR',
  // GBP
  '£': 'GBP', gbp: 'GBP', '英镑': 'GBP', pound: 'GBP', '镑': 'GBP',
  // HKD
  hk$: 'HKD', hkd: 'HKD', '港币': 'HKD', '港元': 'HKD', '港': 'HKD',
  // TWD
  nt$: 'TWD', twd: 'TWD', '新台币': 'TWD', '台币': 'TWD',
  // KRW
  '₩': 'KRW', krw: 'KRW', '韩元': 'KRW', won: 'KRW', '韩币': 'KRW',
  // SGD
  s$: 'SGD', sgd: 'SGD', '新加坡元': 'SGD', '坡币': 'SGD', '新币': 'SGD',
  // CAD
  c$: 'CAD', cad: 'CAD', '加元': 'CAD', '加币': 'CAD',
  // AUD
  a$: 'AUD', aud: 'AUD', '澳元': 'AUD', '澳币': 'AUD',
  // RUB
  '₽': 'RUB', rub: 'RUB', '卢布': 'RUB', '俄罗斯卢布': 'RUB',
  // INR
  '₹': 'INR', inr: 'INR', '卢比': 'INR', '印度卢比': 'INR',
  // BRL
  r$: 'BRL', brl: 'BRL', '雷亚尔': 'BRL',
}

/**
 * 把任意自由格式的单位字符串规范化成币种代码。
 * 解析优先级:精确代码 -> 整串别名 -> 内嵌符号/别名 -> 兜底 USD。
 */
export function normalizeCurrency(unit: string | undefined | null): string {
  if (unit == null) return 'USD'
  const raw = String(unit).trim()
  if (!raw) return 'USD'

  // 1) 精确代码匹配(大小写不敏感),如 "cny"/"CNY"
  const upper = raw.toUpperCase()
  if (BY_CODE.has(upper)) return upper

  // 2) 整串别名匹配
  const lower = raw.toLowerCase()
  if (ALIASES[lower]) return ALIASES[lower]
  if (ALIASES[raw]) return ALIASES[raw]

  // 3) 内嵌符号/别名(如 "$5"、"5元"、"约¥30/月")
  //    先扫单字符货币符号(避免被普通字母误伤),再扫多字符别名。
  for (const ch of raw) {
    if (ALIASES[ch]) return ALIASES[ch]
  }
  for (const key of Object.keys(ALIASES)) {
    if (key.length > 1 && (lower.includes(key) || raw.includes(key))) return ALIASES[key]
  }

  // 4) 兜底
  return 'USD'
}

export function getCurrency(code: string): Currency {
  return BY_CODE.get(code) ?? CURRENCIES[0]
}

// ============ 实时汇率 ============
// 免 key 的 open.er-api(返回 "每 1 USD 兑换多少目标币"),localStorage 缓存 24h,
// 失败则回退到上面的静态 rate。

const FX_CACHE_KEY = 'nodeget.fxrates'
const FX_TTL = 24 * 3600 * 1000
const FX_ENDPOINT = 'https://open.er-api.com/v6/latest/USD'

let liveRates: Record<string, number> | null = null
let liveUpdatedAt: number | null = null
let fxVersion = 0
let fxPromise: Promise<void> | null = null

/** 取某币种相对 USD 的汇率:优先实时,否则静态 */
function rateOf(code: string): number {
  const live = liveRates?.[code]
  if (typeof live === 'number' && live > 0) return live
  return getCurrency(code).rate
}

export interface RatesMeta {
  source: 'live' | 'static'
  updatedAt: number | null
  version: number
}

export function ratesMeta(): RatesMeta {
  return { source: liveRates ? 'live' : 'static', updatedAt: liveUpdatedAt, version: fxVersion }
}

/** 加载实时汇率(命中缓存或拉取一次);幂等,失败静默回退 */
export function ensureLiveRates(): Promise<void> {
  if (fxPromise) return fxPromise
  fxPromise = (async () => {
    // 1) 读缓存
    try {
      const raw = localStorage.getItem(FX_CACHE_KEY)
      if (raw) {
        const cached = JSON.parse(raw) as { ts: number; rates: Record<string, number> }
        if (cached?.rates && Date.now() - cached.ts < FX_TTL) {
          liveRates = cached.rates
          liveUpdatedAt = cached.ts
          fxVersion++
          return
        }
      }
    } catch { /* ignore */ }
    // 2) 拉取
    try {
      const res = await fetch(FX_ENDPOINT)
      const j = await res.json()
      if (j?.result === 'success' && j.rates) {
        liveRates = j.rates as Record<string, number>
        liveUpdatedAt = j.time_last_update_unix ? j.time_last_update_unix * 1000 : Date.now()
        fxVersion++
        try { localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ ts: Date.now(), rates: j.rates })) } catch { /* ignore */ }
      }
    } catch { /* 网络失败:保持静态汇率 */ }
  })()
  return fxPromise
}

/** 给定金额 + 原始单位 -> 折算为 USD */
export function toUSD(amount: number, fromUnit: string | undefined | null): number {
  const rate = rateOf(normalizeCurrency(fromUnit))
  if (!Number.isFinite(amount) || rate <= 0) return 0
  return amount / rate
}

/** USD 金额 -> 目标币种代码金额 */
export function fromUSD(usd: number, toCode: string): number {
  return usd * rateOf(toCode)
}

/** 在两个任意单位之间换算 */
export function convert(amount: number, fromUnit: string | undefined | null, toCode: string): number {
  return fromUSD(toUSD(amount, fromUnit), toCode)
}

/** 格式化为「符号 + 金额」,带千位分隔 */
export function formatMoney(amount: number, code: string, fractionDigits = 2): string {
  const c = getCurrency(code)
  const n = Number.isFinite(amount) ? amount : 0
  const fixed = n.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
  return `${c.symbol}${fixed}`
}
