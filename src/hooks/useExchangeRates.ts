import { useEffect, useState } from 'react'
import { ensureLiveRates, ratesMeta, type RatesMeta } from '../utils/currency'

/**
 * 触发实时汇率加载,并在就绪后返回汇率元信息(来源/更新时间/版本号)。
 * version 变化可用于触发依赖汇率的 useMemo 重算。
 */
export function useExchangeRates(): RatesMeta {
  const [meta, setMeta] = useState<RatesMeta>(ratesMeta)

  useEffect(() => {
    let alive = true
    ensureLiveRates().then(() => {
      if (alive) setMeta(ratesMeta())
    })
    return () => { alive = false }
  }, [])

  return meta
}
